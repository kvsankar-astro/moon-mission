import { applyViewSettings, setChecked } from "../ui/ui-state.js";
import { planRuntimeModeToggle } from "../core/domain/ui-transition-plan.js";

// Hotfix gate: keep craft locator edge overlay disabled without removing code paths.
const CRAFT_EDGE_LOCATOR_ENABLED = false;

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
    function setCraftCollectionVisibility(collection, visible) {
        if (!collection || typeof collection !== "object") return;
        Object.values(collection).forEach((item) => {
            if (item && "visible" in item) {
                item.visible = visible;
            }
        });
    }

    function applyCraftVisibility(scene, { craftVisible, craftEdgesVisible }) {
        if (!scene) return;
        const effectiveCraftEdgesVisible = Boolean(craftEdgesVisible) && CRAFT_EDGE_LOCATOR_ENABLED;

        // Keep legacy active-craft references in sync.
        if (scene.craft && "visible" in scene.craft) {
            scene.craft.visible = craftVisible;
        }
        if (scene.craftInner && "visible" in scene.craftInner) {
            scene.craftInner.visible = craftVisible;
        }
        if (scene.craftEdges && "visible" in scene.craftEdges) {
            scene.craftEdges.visible = effectiveCraftEdgesVisible;
        }
        if (scene.craftAxesHelper && "visible" in scene.craftAxesHelper) {
            scene.craftAxesHelper.visible = craftVisible;
        }

        // Ensure all per-craft collections follow the mode toggle, even when
        // scene.craft references lag behind active-craft sync.
        setCraftCollectionVisibility(scene.craftsById, craftVisible);
        setCraftCollectionVisibility(scene.craftInnersById, craftVisible);
        setCraftCollectionVisibility(scene.craftEdgesById, effectiveCraftEdgesVisible);
        setCraftCollectionVisibility(scene.craftAxesHelpersById, craftVisible);
        setCraftCollectionVisibility(scene.dronesById, craftVisible);

        scene.craftVisible = craftVisible;
    }

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
        applyCraftVisibility(scene, transitionPlan.craftVisibility);

        if (transitionPlan.shouldResetMotherContainer) {
            scene?.motherContainer?.position?.set?.(0, 0, 0);
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
