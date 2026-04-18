function buildMobilePanelCollapseState({
    activeTab = "",
    missionCollapsed = false,
    viewsCollapsed = false,
} = {}) {
    if (activeTab === "mission") {
        const collapsed = !!missionCollapsed;
        return {
            hidden: false,
            collapsed,
            text: collapsed ? "+" : "−",
            ariaExpanded: collapsed ? "false" : "true",
            label: collapsed ? "Expand mission panel" : "Collapse mission panel",
        };
    }
    if (activeTab === "views") {
        const collapsed = !!viewsCollapsed;
        return {
            hidden: false,
            collapsed,
            text: collapsed ? "+" : "−",
            ariaExpanded: collapsed ? "false" : "true",
            label: collapsed ? "Expand views controls" : "Collapse views controls",
        };
    }
    return {
        hidden: true,
        collapsed: false,
        text: "",
        ariaExpanded: "false",
        label: "",
    };
}

function countVisibleMobileNavButtons(buttons = []) {
    return buttons.reduce((count, button) => (button?.hidden ? count : count + 1), 0);
}

function shouldCenterMobileRenderViewport(activeTab = "") {
    return activeTab === "mission" || activeTab === "views" || activeTab === "compose";
}

function computeMobileRenderViewportLayout({
    isMobileViewport = false,
    activeTab = "",
    viewportHeight = 0,
    activeCardBottomPx = Number.NaN,
    pillStripBottomPx = Number.NaN,
    bottomInsetPx = Number.NaN,
    mobileShellEnabled = false,
    headerBottomPx = Number.NaN,
} = {}) {
    let shiftPx = 0;
    const shouldCenterForTab = shouldCenterMobileRenderViewport(activeTab);
    if (
        isMobileViewport &&
        shouldCenterForTab &&
        Number.isFinite(bottomInsetPx) &&
        bottomInsetPx > 0
    ) {
        const safeViewportHeight = Math.max(1, viewportHeight || 1);
        let topInset = 0;
        if (Number.isFinite(activeCardBottomPx)) {
            topInset = Math.max(topInset, Math.max(0, Math.min(safeViewportHeight, activeCardBottomPx)));
        }
        if (Number.isFinite(pillStripBottomPx)) {
            topInset = Math.max(topInset, Math.max(0, Math.min(safeViewportHeight, pillStripBottomPx)));
        }
        const boundedBottomInset = Math.max(0, Math.min(safeViewportHeight, bottomInsetPx));
        if (boundedBottomInset > topInset + 24) {
            shiftPx = Math.round(((topInset + boundedBottomInset) * 0.5) - (safeViewportHeight * 0.5));
        }
    }

    if (!isMobileViewport || !mobileShellEnabled) {
        return {
            shiftPx,
            pillStripTopPx: null,
        };
    }

    const collapsedTopPx = Number.isFinite(headerBottomPx)
        ? Math.round(headerBottomPx + 4)
        : 56;
    const pillStripTopPx = Number.isFinite(activeCardBottomPx)
        ? Math.max(48, Math.round(activeCardBottomPx + 4))
        : Math.max(48, collapsedTopPx);

    return {
        shiftPx,
        pillStripTopPx,
    };
}

export {
    buildMobilePanelCollapseState,
    computeMobileRenderViewportLayout,
    countVisibleMobileNavButtons,
    shouldCenterMobileRenderViewport,
};
