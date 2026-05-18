const HEADER_PILL_AUTO_REVEAL_CLICK_GRACE_MS = 700;
const HEADER_PILL_GROUP_EXPAND_LINGER_MS = 2400;

export function createHeaderPillStripController(deps = {}) {
    const documentRef = deps.documentRef || document;
    const windowRef = deps.windowRef || window;
    const requestAnimationFrameImpl = typeof deps.requestAnimationFrameImpl === "function"
        ? deps.requestAnimationFrameImpl
        : windowRef.requestAnimationFrame?.bind(windowRef) || ((callback) => callback());
    const nowImpl = typeof deps.nowImpl === "function" ? deps.nowImpl : () => Date.now();
    const setTimeoutImpl = typeof deps.setTimeoutImpl === "function"
        ? deps.setTimeoutImpl
        : windowRef.setTimeout?.bind(windowRef) || setTimeout;
    const clearTimeoutImpl = typeof deps.clearTimeoutImpl === "function"
        ? deps.clearTimeoutImpl
        : windowRef.clearTimeout?.bind(windowRef) || clearTimeout;

    let manualCollapsed = false;
    let autoCollapsed = false;
    let lastAutoRevealAt = 0;
    let groupsExpanded = false;
    let groupCollapseTimer = null;
    let lastGroupActivityAt = 0;
    let bound = false;

    function isMobileControlLayout() {
        const body = documentRef?.body;
        if (body?.classList?.contains?.("mobile-shell-enabled")) return true;
        return windowRef?.matchMedia?.("(max-width: 600px)")?.matches === true;
    }

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
        const mobileLayout = isMobileControlLayout();
        strip.classList.toggle("header-pill-strip--collapsed", collapsed);
        strip.classList.toggle(
            "header-pill-strip--groups-expanded",
            !collapsed && (groupsExpanded || mobileLayout),
        );
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

    function clearGroupCollapseTimer() {
        if (groupCollapseTimer == null) return;
        clearTimeoutImpl(groupCollapseTimer);
        groupCollapseTimer = null;
    }

    function setGroupsExpandedState(expanded) {
        const nextExpanded = !!expanded;
        if (groupsExpanded === nextExpanded) return;
        groupsExpanded = nextExpanded;
        syncUi();
    }

    function expandGroups() {
        if (isMobileControlLayout()) {
            syncUi();
            return;
        }
        lastGroupActivityAt = nowImpl();
        clearGroupCollapseTimer();
        setGroupsExpandedState(true);
    }

    function queueGroupsCollapse(delay = HEADER_PILL_GROUP_EXPAND_LINGER_MS) {
        clearGroupCollapseTimer();
        groupCollapseTimer = setTimeoutImpl(() => {
            groupCollapseTimer = null;
            const inactiveForMs = nowImpl() - lastGroupActivityAt;
            if (inactiveForMs < HEADER_PILL_GROUP_EXPAND_LINGER_MS) {
                queueGroupsCollapse(HEADER_PILL_GROUP_EXPAND_LINGER_MS - inactiveForMs);
                return;
            }
            setGroupsExpandedState(false);
        }, delay);
    }

    function scheduleGroupsCollapse() {
        if (isMobileControlLayout()) {
            syncUi();
            return;
        }
        lastGroupActivityAt = nowImpl();
        queueGroupsCollapse(HEADER_PILL_GROUP_EXPAND_LINGER_MS);
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
        const strip = documentRef.getElementById("header-pill-strip");
        if (strip) {
            strip.addEventListener("pointerenter", expandGroups);
            strip.addEventListener("pointermove", expandGroups);
            strip.addEventListener("pointerleave", scheduleGroupsCollapse);
            strip.addEventListener("focusin", expandGroups);
            strip.addEventListener("focusout", scheduleGroupsCollapse);
        }
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
        windowRef.addEventListener("resize", () => {
            resetScrollPosition();
            syncUi();
        });
        syncUi();
    }

    return {
        bind,
        expandGroups,
        isEffectivelyCollapsed,
        resetScrollPosition,
        scheduleGroupsCollapse,
        setAutoCollapsedState,
        setGroupsExpandedState,
        setManualCollapsedState,
        syncUi,
    };
}
