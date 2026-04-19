const DEFAULT_PLANE_PILL_PAIRS = [
    ["plane-pill-default", "checkbox-lock-default", "DEFAULT"],
    ["plane-pill-xy", "checkbox-lock-xy", "XY"],
    ["plane-pill-yz", "checkbox-lock-yz", "YZ"],
    ["plane-pill-zx", "checkbox-lock-zx", "ZX"],
    ["plane-pill-xy-minus", "checkbox-lock-xy-minus", "XY-"],
    ["plane-pill-yz-minus", "checkbox-lock-yz-minus", "YZ-"],
    ["plane-pill-zx-minus", "checkbox-lock-zx-minus", "ZX-"],
];

export function createPlanePillController(deps = {}) {
    const documentRef = deps.documentRef || document;
    const windowRef = deps.windowRef || window;
    const controlBackend = deps.controlBackend || {};
    const planePillPairs = deps.planePillPairs || DEFAULT_PLANE_PILL_PAIRS;

    const commitPlaneSelectionToBackend =
        typeof controlBackend.commitPlaneSelection === "function"
            ? controlBackend.commitPlaneSelection
            : () => {};

    let bound = false;
    let planePresetReleasedByNavigation = false;

    function sync() {
        planePillPairs.forEach(([pillId, inputId]) => {
            const pill = documentRef.getElementById(pillId);
            const input = documentRef.getElementById(inputId);
            if (!pill || !input) return;
            const isActive = !planePresetReleasedByNavigation && input.checked === true;
            pill.classList.toggle("is-active", isActive);
            pill.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    function commitPlaneSelection(planeSelection) {
        planePresetReleasedByNavigation = false;
        commitPlaneSelectionToBackend(planeSelection);
        sync();
    }

    function releasePlanePresetFromManualNavigation() {
        const activePlaneInput = planePillPairs
            .map(([, inputId]) => documentRef.getElementById(inputId))
            .find((input) => input?.checked);
        if (!activePlaneInput) return;
        if (activePlaneInput.id === "checkbox-lock-default") return;
        planePresetReleasedByNavigation = true;
        sync();
    }

    function bindPlanePresetReleaseOnSceneDrag() {
        const canvasWrapper = documentRef.getElementById("canvas-wrapper");
        if (!canvasWrapper) return;

        let activePointerId = null;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragReleased = false;
        const dragReleaseThresholdPx = 4;
        const dragReleaseThresholdSquared = dragReleaseThresholdPx * dragReleaseThresholdPx;

        const resetDragState = (pointerId = null) => {
            if (pointerId !== null && activePointerId !== pointerId) return;
            activePointerId = null;
            dragStartX = 0;
            dragStartY = 0;
            dragReleased = false;
        };

        canvasWrapper.addEventListener("pointerdown", (event) => {
            if (event.isPrimary === false) return;
            activePointerId = event.pointerId;
            dragStartX = Number.isFinite(event.clientX) ? event.clientX : 0;
            dragStartY = Number.isFinite(event.clientY) ? event.clientY : 0;
            dragReleased = false;
        }, true);

        windowRef.addEventListener("pointermove", (event) => {
            if (activePointerId === null || event.pointerId !== activePointerId || dragReleased) return;
            const deltaX = (Number.isFinite(event.clientX) ? event.clientX : 0) - dragStartX;
            const deltaY = (Number.isFinite(event.clientY) ? event.clientY : 0) - dragStartY;
            if ((deltaX * deltaX) + (deltaY * deltaY) < dragReleaseThresholdSquared) return;
            dragReleased = true;
            releasePlanePresetFromManualNavigation();
        }, { passive: true });

        windowRef.addEventListener("pointerup", (event) => {
            resetDragState(event.pointerId);
        }, { passive: true });

        windowRef.addEventListener("pointercancel", (event) => {
            resetDragState(event.pointerId);
        }, { passive: true });
    }

    function bind() {
        if (bound) return;
        bound = true;

        planePillPairs.forEach(([pillId, inputId, planeSelection]) => {
            const pill = documentRef.getElementById(pillId);
            const input = documentRef.getElementById(inputId);

            if (input) {
                input.addEventListener("click", () => {
                    commitPlaneSelection(planeSelection);
                });
                input.addEventListener("change", () => {
                    planePresetReleasedByNavigation = false;
                    sync();
                });
            }

            if (pill) {
                pill.addEventListener("click", () => {
                    commitPlaneSelection(planeSelection);
                });
            }
        });

        ["panleft", "panright", "panup", "pandown"].forEach((id) => {
            const button = documentRef.getElementById(id);
            button?.addEventListener("click", releasePlanePresetFromManualNavigation);
        });

        bindPlanePresetReleaseOnSceneDrag();
        sync();
    }

    return {
        bind,
        commitPlaneSelection,
        releasePlanePresetFromManualNavigation,
        sync,
    };
}
