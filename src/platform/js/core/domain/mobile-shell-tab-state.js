function resolveMobileShellTabTransition({
    requestedTab = "mission",
    availableTabs = [],
    activeTab = "mission",
    composeFeatureEnabled = false,
    mobileViewport = false,
    isViewsVisualSimplificationTab = () => false,
} = {}) {
    const normalizedRequestedTab = (requestedTab === "compose" && !composeFeatureEnabled)
        ? "mission"
        : requestedTab;
    const nextTab = availableTabs.includes(normalizedRequestedTab)
        ? normalizedRequestedTab
        : "mission";
    const previousTab = activeTab;

    return {
        previousTab,
        nextTab,
        previousNeedsSimplification: mobileViewport && isViewsVisualSimplificationTab(previousTab),
        nextNeedsSimplification: mobileViewport && isViewsVisualSimplificationTab(nextTab),
    };
}

function buildMobileShellButtonStates({
    buttonTabs = [],
    nextTab = "mission",
    hiddenTabs = [],
} = {}) {
    const hiddenTabSet = new Set(hiddenTabs);
    return buttonTabs.map((tabKey) => ({
        tabKey,
        isHidden: hiddenTabSet.has(tabKey),
        isActive: !hiddenTabSet.has(tabKey) && tabKey === nextTab,
    }));
}

function buildMobileShellCardStates({
    cardTabs = [],
    nextTab = "mission",
    composeFeatureEnabled = false,
} = {}) {
    return cardTabs.map((tabKey) => ({
        tabKey,
        isHidden: (tabKey === "compose" && !composeFeatureEnabled) || tabKey !== nextTab,
    }));
}

export {
    buildMobileShellButtonStates,
    buildMobileShellCardStates,
    resolveMobileShellTabTransition,
};
