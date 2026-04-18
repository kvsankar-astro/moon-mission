import {
    buildMobileShellButtonStates,
    buildMobileShellCardStates,
    resolveMobileShellTabTransition,
} from "../core/domain/mobile-shell-tab-state.js";

function createMobileShellTabSync(deps) {
    const {
        navButtons = [],
        mobileTabCards = {},
        getActiveTab,
        setActiveTab,
        isComposeFeatureEnabled,
        isMobileViewport,
        isViewsVisualSimplificationTab,
        documentBody = globalThis?.document?.body || null,
        setMissionEventMessage = () => {},
        onEnterSimplifiedTab = () => {},
        onExitSimplifiedTab = () => {},
        onEnterMission = () => {},
        onEnterViews = () => {},
        onEnterCompose = () => {},
        onLeaveViews = () => {},
        onLeaveCompose = () => {},
        onAfterTransition = () => {},
    } = deps;

    const buttons = Array.from(navButtons);

    function renderButtons(nextTab, composeFeatureEnabled) {
        const buttonStates = buildMobileShellButtonStates({
            buttonTabs: buttons.map((button) => button.dataset.mobileTab || ""),
            nextTab,
            hiddenTabs: composeFeatureEnabled ? [] : ["compose"],
        });

        buttons.forEach((button, index) => {
            const buttonState = buttonStates[index];
            if (!buttonState || button.hidden) return;
            button.classList.toggle("is-active", buttonState.isActive);
            if (buttonState.isActive) {
                button.setAttribute("aria-current", "page");
            } else {
                button.removeAttribute("aria-current");
            }
        });
    }

    function renderCards(nextTab, composeFeatureEnabled) {
        const cardStates = buildMobileShellCardStates({
            cardTabs: Object.keys(mobileTabCards),
            nextTab,
            composeFeatureEnabled,
        });

        cardStates.forEach(({ tabKey, isHidden }) => {
            const card = mobileTabCards[tabKey];
            if (!card) return;
            card.hidden = isHidden;
        });
    }

    function applyRequestedTab(requestedTab) {
        const composeFeatureEnabled = !!isComposeFeatureEnabled?.();
        const mobileViewport = !!isMobileViewport?.();
        const transition = resolveMobileShellTabTransition({
            requestedTab,
            availableTabs: Object.keys(mobileTabCards),
            activeTab: getActiveTab?.() || "mission",
            composeFeatureEnabled,
            mobileViewport,
            isViewsVisualSimplificationTab,
        });

        setActiveTab?.(transition.nextTab);
        if (documentBody) {
            documentBody.dataset.mobileActiveTab = transition.nextTab;
        }

        renderButtons(transition.nextTab, composeFeatureEnabled);
        renderCards(transition.nextTab, composeFeatureEnabled);

        if (transition.nextNeedsSimplification && !transition.previousNeedsSimplification) {
            onEnterSimplifiedTab(transition);
        } else if (!transition.nextNeedsSimplification && transition.previousNeedsSimplification) {
            onExitSimplifiedTab(transition);
        }

        if (mobileViewport && transition.nextTab === "mission") {
            onEnterMission(transition);
        }

        if (transition.nextTab === "views" && mobileViewport) {
            onEnterViews(transition);
        } else if (transition.nextTab === "compose" && mobileViewport && composeFeatureEnabled) {
            onEnterCompose(transition);
        } else if (transition.previousTab === "views" && mobileViewport) {
            onLeaveViews(transition);
        } else if (transition.previousTab === "compose" && mobileViewport) {
            onLeaveCompose(transition);
        }

        onAfterTransition(transition);
    }

    function bind() {
        buttons.forEach((button) => {
            button.addEventListener("click", function () {
                if (button.disabled) {
                    setMissionEventMessage(`${button.textContent.trim()} card coming next`);
                    return;
                }
                setMissionEventMessage("");
                applyRequestedTab(button.dataset.mobileTab || "mission");
            });
        });
    }

    return {
        bind,
        setActiveTab: applyRequestedTab,
    };
}

export { createMobileShellTabSync };
