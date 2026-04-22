function createComparePanelController(deps = {}) {
    const documentRef = deps.documentRef || globalThis.document;
    const windowRef = deps.windowRef || globalThis.window;
    const marginPx = Number.isFinite(deps.marginPx) ? deps.marginPx : 8;
    const gapPx = Number.isFinite(deps.gapPx) ? deps.gapPx : 8;
    const elementCtor = windowRef?.Element || globalThis.Element || null;

    let bound = false;

    function getElement(id) {
        return documentRef?.getElementById?.(id) || null;
    }

    function isElementLike(value) {
        if (!value) return false;
        if (elementCtor) return value instanceof elementCtor;
        return typeof value === "object";
    }

    function isComparePanelOpen() {
        const wrapper = getElement("compare-panel-wrapper");
        const panel = getElement("compare-panel");
        return !!wrapper &&
            wrapper.hidden !== true &&
            !panel?.classList?.contains?.("compare-panel--hidden");
    }

    function syncLauncher() {
        const button = getElement("compare-pill-button");
        if (!button) return;
        const open = isComparePanelOpen();
        button.setAttribute?.("aria-expanded", open ? "true" : "false");
        button.classList?.toggle?.("is-open", open);
    }

    function positionPanel() {
        if (!isComparePanelOpen()) return;
        const button = getElement("compare-pill-button");
        const panel = getElement("compare-panel");
        if (!button || !panel) return;

        panel.style.left = `${marginPx}px`;
        panel.style.top = `${marginPx}px`;

        const buttonRect = button.getBoundingClientRect?.();
        const panelRect = panel.getBoundingClientRect?.();
        if (!buttonRect || !panelRect) return;

        const viewportWidth = Number(windowRef?.innerWidth) || 0;
        const viewportHeight = Number(windowRef?.innerHeight) || 0;
        const panelWidth = Math.max(panelRect.width || 320, 280);
        const panelHeight = Math.max(panelRect.height || 140, 120);
        const maxLeft = Math.max(marginPx, viewportWidth - panelWidth - marginPx);
        const maxTop = Math.max(marginPx, viewportHeight - panelHeight - marginPx);

        let left = buttonRect.left;
        let top = buttonRect.bottom + gapPx;
        if (left > maxLeft) {
            left = maxLeft;
        }
        if (top > maxTop) {
            top = Math.max(marginPx, buttonRect.top - panelHeight - gapPx);
        }

        panel.style.left = `${Math.round(Math.max(marginPx, left))}px`;
        panel.style.top = `${Math.round(Math.max(marginPx, top))}px`;
    }

    function openPanel() {
        const wrapper = getElement("compare-panel-wrapper");
        const panel = getElement("compare-panel");
        if (!wrapper || !panel) return;
        wrapper.hidden = false;
        panel.classList?.remove?.("compare-panel--hidden");
        syncLauncher();
        positionPanel();
    }

    function closePanel() {
        const wrapper = getElement("compare-panel-wrapper");
        const panel = getElement("compare-panel");
        if (!wrapper || !panel) return;
        panel.classList?.add?.("compare-panel--hidden");
        wrapper.hidden = true;
        syncLauncher();
    }

    function togglePanel() {
        if (isComparePanelOpen()) {
            closePanel();
            return;
        }
        openPanel();
    }

    function bind() {
        if (bound) return;
        bound = true;

        const button = getElement("compare-pill-button");
        const closeButton = getElement("compare-panel-close");
        const panel = getElement("compare-panel");
        if (!button || !closeButton || !panel) return;

        button.addEventListener?.("click", (event) => {
            event.preventDefault?.();
            if (button.disabled) return;
            togglePanel();
        });

        closeButton.addEventListener?.("click", (event) => {
            event.preventDefault?.();
            event.stopPropagation?.();
            closePanel();
        });

        documentRef?.addEventListener?.("pointerdown", (event) => {
            if (!isComparePanelOpen()) return;
            if (!isElementLike(event?.target)) return;
            if (panel.contains?.(event.target) || button.contains?.(event.target)) return;
            closePanel();
        });

        documentRef?.addEventListener?.("keydown", (event) => {
            if (event?.key !== "Escape") return;
            if (!isComparePanelOpen()) return;
            closePanel();
        });

        windowRef?.addEventListener?.("resize", () => {
            positionPanel();
        }, { passive: true });

        syncLauncher();
    }

    return {
        bind,
        closePanel,
        isComparePanelOpen,
        openPanel,
        positionPanel,
    };
}

export { createComparePanelController };
