import { applyViewSettings, setChecked } from "../ui/ui-state.js";
import { planRuntimeModeToggle } from "../core/domain/ui-transition-plan.js";

export function createModeActions({
    animationScenes,
    getConfig,
    getGlobalConfig,
    render,
    updateCraftScale,
    getLandingFlag,
    setLandingFlag,
    getJoyRideFlag,
    setJoyRideFlag,
    setView,
}) {
    function toggleButtonDownState(id, isDown) {
        const button = document.getElementById(id);
        if (!button) return;
        button.classList.toggle("down", !!isDown);
        button.setAttribute("aria-pressed", isDown ? "true" : "false");
    }

    function applyModeTransition(transitionPlan) {
        if (!transitionPlan.allowed) return;

        setJoyRideFlag(transitionPlan.nextFlags.joyRide);
        setLandingFlag(transitionPlan.nextFlags.landing);

        const scene = animationScenes[getConfig()];
        scene.craft.visible = transitionPlan.craftVisibility.craftVisible;
        scene.craftEdges.visible = transitionPlan.craftVisibility.craftEdgesVisible;

        if (transitionPlan.shouldResetMotherContainer) {
            scene.motherContainer.position.set(0, 0, 0);
        }

        toggleButtonDownState("joyridebutton", transitionPlan.controlStates.joyRide);
        toggleButtonDownState("landingbutton", transitionPlan.controlStates.landing);
        setChecked("joyride", transitionPlan.controlStates.joyRide);
        setChecked("landing", transitionPlan.controlStates.landing);

        applyViewSettings(transitionPlan.viewSettings);
        setView();

        updateCraftScale();
        render();
    }

    function toggleJoyRide() {
        applyModeTransition(planRuntimeModeToggle({
            intent: "joyride",
            joyRideActive: getJoyRideFlag(),
            landingActive: getLandingFlag(),
            landingEnabled: !!getGlobalConfig()?.landing?.enabled,
        }));
    }

    function toggleLanding() {
        applyModeTransition(planRuntimeModeToggle({
            intent: "landing",
            joyRideActive: getJoyRideFlag(),
            landingActive: getLandingFlag(),
            landingEnabled: !!getGlobalConfig()?.landing?.enabled,
        }));
    }

    return { toggleJoyRide, toggleLanding };
}
