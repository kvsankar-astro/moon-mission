export function createFocusPillController(deps = {}) {
    const documentRef = deps.documentRef || document;
    const windowRef = deps.windowRef || window;
    const setView = deps.setView;
    const invokeMissionPanelAction = deps.invokeMissionPanelAction || (() => false);
    const requestAnimationFrameImpl = typeof deps.requestAnimationFrameImpl === "function"
        ? deps.requestAnimationFrameImpl
        : windowRef.requestAnimationFrame?.bind(windowRef) || ((callback) => callback());
    const MutationObserverImpl = deps.MutationObserverImpl
        || (typeof MutationObserver !== "undefined" ? MutationObserver : null);
    const createCustomEvent = typeof deps.createCustomEvent === "function"
        ? deps.createCustomEvent
        : (type) => new CustomEvent(type);

    let bound = false;

    function getElement(id) {
        return documentRef?.getElementById?.(id) || null;
    }

    function isArtemis2Mission() {
        try {
            const params = new URLSearchParams(windowRef?.location?.search || "");
            const mission = String(params.get("mission") || "").trim().toLowerCase();
            return mission === "artemis2";
        } catch {
            return false;
        }
    }

    function resolveTimelineEventButtonByKeys(keys) {
        if (!Array.isArray(keys) || keys.length === 0) return null;
        const normalizedKeys = keys
            .map((key) => String(key || "").trim())
            .filter(Boolean);
        if (normalizedKeys.length === 0) return null;
        const buttons = documentRef?.querySelectorAll?.("#burnbuttons button[data-event-key]") || [];
        for (const button of buttons) {
            const key = String(button?.dataset?.eventKey || "").trim();
            if (normalizedKeys.includes(key)) {
                return button;
            }
        }
        return null;
    }

    function syncPressedState(element, isActive) {
        if (!element) return;
        element.classList?.toggle?.("is-active", !!isActive);
        element.setAttribute?.("aria-pressed", isActive ? "true" : "false");
    }

    function syncFocusPillVisibility() {
        const flybyPill = getElement("flyby-pill");
        const splashdownFocusPill = getElement("focus-pill-splashdown");
        const flybyPillWrap = getElement("flyby-pill-wrap");
        if (!flybyPillWrap) return;

        const flybyVisible = isArtemis2Mission();
        const splashdownVisible = isArtemis2Mission() && !!resolveTimelineEventButtonByKeys(["splashdown"]);
        if (flybyPill) {
            flybyPill.hidden = !flybyVisible;
        }
        if (splashdownFocusPill) {
            splashdownFocusPill.hidden = !splashdownVisible;
        }
        const visible = flybyVisible || splashdownVisible;
        const flybyGroup = flybyPillWrap.closest?.(".header-pill-group");
        if (flybyGroup) {
            flybyGroup.hidden = !visible;
        } else {
            flybyPillWrap.hidden = !visible;
        }
        requestAnimationFrameImpl(() => {
            const tertiaryRow = getElement("header-pill-strip-tertiary");
            if (!tertiaryRow) return;
            tertiaryRow.scrollLeft = 0;
        });
    }

    function syncFocusPillState() {
        const flybyPill = getElement("flyby-pill");
        const splashdownFocusPill = getElement("focus-pill-splashdown");
        const composerPanelVisible = !!documentRef?.querySelector?.(
            "#aux-camera-views .aux-camera-view[data-mode=\"composer\"]:not([hidden])",
        );
        const groundTrackPanelVisible = !!documentRef?.querySelector?.(
            "#ground-track-panel:not(.ground-track-panel--hidden)",
        );
        syncPressedState(flybyPill, composerPanelVisible);
        syncPressedState(splashdownFocusPill, groundTrackPanelVisible);
    }

    function restoreComposerPanel() {
        const restored = invokeMissionPanelAction("aux:earth-rise-composer", "restore");
        if (restored) return;

        const composerChip = documentRef?.querySelector?.(
            "#aux-camera-views .aux-camera-chip--composer-tab",
        ) || Array.from(
            documentRef?.querySelectorAll?.("#aux-camera-views .aux-camera-chip") || [],
        ).find((button) => /^flyby\b/i.test((button?.textContent || "").trim()));
        if (composerChip && !composerChip.hidden && typeof composerChip.click === "function") {
            composerChip.click();
        }
    }

    function bind() {
        if (bound) return;
        bound = true;

        const flybyPill = getElement("flyby-pill");
        const splashdownFocusPill = getElement("focus-pill-splashdown");
        const auxiliaryPanelsToggle = getElement("view-aux-camera-panels");
        const burnButtonsHost = getElement("burnbuttons");

        if (flybyPill) {
            flybyPill.addEventListener("click", function () {
                if (
                    auxiliaryPanelsToggle &&
                    typeof auxiliaryPanelsToggle.checked === "boolean" &&
                    !auxiliaryPanelsToggle.checked &&
                    !auxiliaryPanelsToggle.disabled
                ) {
                    auxiliaryPanelsToggle.checked = true;
                    if (typeof setView === "function") {
                        setView();
                    }
                }
                restoreComposerPanel();
                requestAnimationFrameImpl(syncFocusPillState);
            });
        }

        if (splashdownFocusPill) {
            splashdownFocusPill.addEventListener("click", function () {
                if (!isArtemis2Mission()) return;
                documentRef?.dispatchEvent?.(createCustomEvent("ground-track-panel-open"));
                syncFocusPillState();
            });
        }

        if (burnButtonsHost && MutationObserverImpl) {
            const observer = new MutationObserverImpl(() => {
                syncFocusPillVisibility();
                syncFocusPillState();
            });
            observer.observe(burnButtonsHost, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["class", "data-event-key", "data-event-time-ms", "title"],
            });
        }

        documentRef?.addEventListener?.("ground-track-panel-visibilitychange", syncFocusPillState);
        sync();
    }

    function sync() {
        syncFocusPillVisibility();
        syncFocusPillState();
    }

    return {
        bind,
        isArtemis2Mission,
        resolveTimelineEventButtonByKeys,
        restoreComposerPanel,
        sync,
        syncFocusPillState,
        syncFocusPillVisibility,
    };
}
