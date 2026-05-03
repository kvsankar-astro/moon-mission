import {
    buildMobilePanelCollapseState,
    computeMobileRenderViewportLayout,
    countVisibleMobileNavButtons,
} from "../core/domain/mobile-shell-layout-state.js";

function createMobileShellLayoutSync(deps) {
    const {
        panelCollapseButton,
        missionCard,
        missionCardBody,
        viewsCard,
        viewsCardBody,
        mobileShellNav,
        navButtons = [],
        contentWrapper,
        mobileTabCards = {},
        getActiveTab = () => "",
        isMobileViewport = () => false,
        onEnterMobileMode = () => {},
        onExitMobileMode = () => {},
        windowRef = globalThis?.window || globalThis,
        documentRef = globalThis?.document,
        localStorageRef = globalThis?.localStorage,
        missionPanelCollapseStorageKey = "",
        viewsPanelCollapseStorageKey = "",
    } = deps;

    const buttons = Array.from(navButtons);
    let mobileModeActive = null;

    function isLayoutVisible(element) {
        if (!element || element.hidden) return false;
        const style = windowRef?.getComputedStyle?.(element);
        if (!style || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
            return false;
        }
        const rect = element.getBoundingClientRect?.();
        return !!rect && rect.height > 0 && rect.width > 0;
    }

    function syncPanelCollapseButton() {
        if (!panelCollapseButton) return;
        const panelState = buildMobilePanelCollapseState({
            activeTab: getActiveTab(),
            missionCollapsed: !!missionCard?.classList.contains("mobile-shell__card--collapsed"),
            viewsCollapsed: !!viewsCard?.classList.contains("mobile-shell__card--collapsed"),
        });
        panelCollapseButton.hidden = panelState.hidden;
        if (panelState.hidden) return;
        panelCollapseButton.textContent = panelState.text;
        panelCollapseButton.setAttribute("aria-expanded", panelState.ariaExpanded);
        panelCollapseButton.setAttribute("aria-label", panelState.label);
        panelCollapseButton.title = panelState.label;
    }

    function syncNavLayout() {
        if (!mobileShellNav) return;
        const visibleNavCount = countVisibleMobileNavButtons(buttons);
        mobileShellNav.style.setProperty("--mobile-shell-tab-count", String(Math.max(1, visibleNavCount)));
    }

    function setMissionCardCollapsed(collapsed) {
        if (!missionCard || !missionCardBody) return;
        missionCard.classList.toggle("mobile-shell__card--collapsed", !!collapsed);
        syncPanelCollapseButton();
        if (!missionPanelCollapseStorageKey) return;
        try {
            localStorageRef?.setItem?.(missionPanelCollapseStorageKey, collapsed ? "true" : "false");
        } catch {
            // Ignore localStorage failures.
        }
    }

    function setViewsCardCollapsed(collapsed) {
        if (!viewsCard || !viewsCardBody) return;
        viewsCard.classList.toggle("mobile-shell__card--collapsed", !!collapsed);
        syncPanelCollapseButton();
        if (!viewsPanelCollapseStorageKey) return;
        try {
            localStorageRef?.setItem?.(viewsPanelCollapseStorageKey, collapsed ? "true" : "false");
        } catch {
            // Ignore localStorage failures.
        }
    }

    function applyRenderViewportCentering() {
        if (!contentWrapper) return;
        const viewportHeight = Math.max(1, windowRef?.innerHeight || 1);
        const activeTab = getActiveTab();
        const activeCard = mobileTabCards[activeTab] || null;
        const activeCardBottomPx = isLayoutVisible(activeCard)
            ? activeCard.getBoundingClientRect().bottom
            : Number.NaN;
        const pillStrip = documentRef?.getElementById?.("header-pill-strip");
        const pillStripBottomPx = (
            pillStrip &&
            isLayoutVisible(pillStrip) &&
            !pillStrip.classList.contains("header-pill-strip--collapsed")
        )
            ? pillStrip.getBoundingClientRect().bottom
            : Number.NaN;
        const bottomInsetPx = [mobileShellNav, documentRef?.getElementById?.("timeline-dock")]
            .filter((candidate) => isLayoutVisible(candidate))
            .reduce((minimumTop, candidate) => {
                const rect = candidate.getBoundingClientRect();
                const boundedTop = Math.max(0, Math.min(viewportHeight, rect.top));
                return Math.min(minimumTop, boundedTop);
            }, viewportHeight);
        const headerBottomPx = (() => {
            const header = documentRef?.getElementById?.("header");
            if (!header) return Number.NaN;
            const rect = header.getBoundingClientRect?.();
            return rect ? rect.bottom : Number.NaN;
        })();

        const layout = computeMobileRenderViewportLayout({
            isMobileViewport: isMobileViewport(),
            activeTab,
            viewportHeight,
            activeCardBottomPx,
            pillStripBottomPx,
            bottomInsetPx,
            mobileShellEnabled: !!documentRef?.body?.classList.contains("mobile-shell-enabled"),
            headerBottomPx,
        });

        contentWrapper.style.setProperty("--mobile-render-shift-y", `${layout.shiftPx}px`);
        const rootStyle = documentRef?.documentElement?.style;
        if (layout.pillStripTopPx === null) {
            rootStyle?.removeProperty?.("--mobile-pill-strip-top");
            return;
        }
        rootStyle?.setProperty?.("--mobile-pill-strip-top", `${layout.pillStripTopPx}px`);
    }

    function toggleMode() {
        const mobile = isMobileViewport();
        const modeChanged = mobileModeActive !== mobile;
        documentRef?.body?.classList.toggle("mobile-shell-enabled", mobile);
        if (modeChanged) {
            mobileModeActive = mobile;
            if (mobile) {
                onEnterMobileMode();
            } else {
                onExitMobileMode();
            }
        }
        applyRenderViewportCentering();
    }

    function initializeCollapsedState() {
        let initialMissionCollapsed = false;
        try {
            initialMissionCollapsed = localStorageRef?.getItem?.(missionPanelCollapseStorageKey) === "true";
        } catch {
            initialMissionCollapsed = false;
        }
        setMissionCardCollapsed(initialMissionCollapsed);

        let initialViewsCollapsed = false;
        try {
            initialViewsCollapsed = localStorageRef?.getItem?.(viewsPanelCollapseStorageKey) === "true";
        } catch {
            initialViewsCollapsed = false;
        }
        setViewsCardCollapsed(initialViewsCollapsed);
    }

    return {
        applyRenderViewportCentering,
        initializeCollapsedState,
        setMissionCardCollapsed,
        setViewsCardCollapsed,
        syncNavLayout,
        syncPanelCollapseButton,
        toggleMode,
    };
}

export { createMobileShellLayoutSync };
