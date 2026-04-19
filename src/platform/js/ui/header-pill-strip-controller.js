const HEADER_PILL_AUTO_REVEAL_CLICK_GRACE_MS = 700;

export function createHeaderPillStripController(deps = {}) {
    const documentRef = deps.documentRef || document;
    const windowRef = deps.windowRef || window;
    const requestAnimationFrameImpl = typeof deps.requestAnimationFrameImpl === "function"
        ? deps.requestAnimationFrameImpl
        : windowRef.requestAnimationFrame?.bind(windowRef) || ((callback) => callback());
    const nowImpl = typeof deps.nowImpl === "function" ? deps.nowImpl : () => Date.now();

    let manualCollapsed = false;
    let autoCollapsed = false;
    let lastAutoRevealAt = 0;
    let bound = false;

    function resetScrollPosition() {
        const primaryRow = documentRef.getElementById("header-pill-strip-primary");
        const secondaryRow = documentRef.getElementById("header-pill-strip-secondary");
        const tertiaryRow = documentRef.getElementById("header-pill-strip-tertiary");
        if (primaryRow) primaryRow.scrollLeft = 0;
        if (secondaryRow) secondaryRow.scrollLeft = 0;
        if (tertiaryRow) tertiaryRow.scrollLeft = 0;
    }

    function isEffectivelyCollapsed() {
        return manualCollapsed || autoCollapsed;
    }

    function syncUi() {
        const strip = documentRef.getElementById("header-pill-strip");
        const toggle = documentRef.getElementById("header-pill-strip-toggle");
        if (!strip || !toggle) return;
        const collapsed = isEffectivelyCollapsed();
        strip.classList.toggle("header-pill-strip--collapsed", collapsed);
        toggle.textContent = collapsed ? "›" : "‹";
        toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
        toggle.setAttribute(
            "aria-label",
            collapsed ? "Expand mission controls" : "Collapse mission controls",
        );
        toggle.setAttribute(
            "title",
            collapsed ? "Expand mission controls" : "Collapse mission controls",
        );
        if (!collapsed) {
            resetScrollPosition();
        }
    }

    function setManualCollapsedState(collapsed) {
        const nextCollapsed = !!collapsed;
        if (manualCollapsed === nextCollapsed) return;
        manualCollapsed = nextCollapsed;
        syncUi();
    }

    function setAutoCollapsedState(collapsed) {
        const nextCollapsed = !!collapsed;
        if (autoCollapsed === nextCollapsed) return;
        if (autoCollapsed && !nextCollapsed) {
            lastAutoRevealAt = nowImpl();
        }
        if (nextCollapsed) {
            lastAutoRevealAt = 0;
        }
        autoCollapsed = nextCollapsed;
        syncUi();
    }

    function bind() {
        if (bound) return;
        bound = true;

        const toggle = documentRef.getElementById("header-pill-strip-toggle");
        if (toggle) {
            toggle.addEventListener("click", function () {
                const recentlyAutoRevealed = lastAutoRevealAt > 0 &&
                    (nowImpl() - lastAutoRevealAt) <= HEADER_PILL_AUTO_REVEAL_CLICK_GRACE_MS;
                if (autoCollapsed || recentlyAutoRevealed) {
                    lastAutoRevealAt = 0;
                    setManualCollapsedState(false);
                    setAutoCollapsedState(false);
                    return;
                }
                setManualCollapsedState(!isEffectivelyCollapsed());
            });
        }

        requestAnimationFrameImpl(resetScrollPosition);
        windowRef.addEventListener("resize", resetScrollPosition);
        syncUi();
    }

    return {
        bind,
        isEffectivelyCollapsed,
        resetScrollPosition,
        setAutoCollapsedState,
        setManualCollapsedState,
        syncUi,
    };
}
