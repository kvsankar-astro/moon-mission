import { planOriginModeTransition } from "../core/domain/ui-transition-plan.js";
import { applySkyLayerVisibility } from "./sky-visibility.js";

export function createSettingsActions({
    getConfig,
    setConfig,
    animationScenes,
    AnimationScene,
    initAnimation,
    readOriginMode,
    readViewSettings,
    setFPSCounterVisibility,
    render,
    getGlobalConfig,
    setViewFlags,
    setDimension,
    onConfigChanged,
}) {
    function toggleMode() {
        const previousConfig = getConfig();
        const previousScene = animationScenes[previousConfig];
        const transitionPlan = planOriginModeTransition({
            currentConfig: previousConfig,
            requestedConfig: readOriginMode(),
            currentSceneState: previousScene?.state,
            addCurveDoneState: AnimationScene.SCENE_STATE_ADD_CURVE_DONE,
        });
        if (!transitionPlan.shouldSwitch) return;

        if (transitionPlan.shouldDisposeCurrentScene && previousScene) {
            previousScene.stopCreation();
            previousScene.dispose();
            delete animationScenes[previousConfig];
        }

        setConfig(transitionPlan.nextConfig);
        initAnimation({ reset: false });
        onConfigChanged?.(transitionPlan.nextConfig, transitionPlan.previousConfig);
    }

    function setDimensionTop() {
        setDimension(false);
    }

    function setView() {
        const view = readViewSettings();
        setViewFlags(view);

        setFPSCounterVisibility(view.viewFPS);

        ["geo", "lunar"].forEach(function(cfg) {
            if (animationScenes[cfg] && animationScenes[cfg].initialized3D) {
                animationScenes[cfg].orbitLines.forEach((orbitLine) => { orbitLine.visible = view.viewOrbit; });
                if (cfg === "lunar" && getGlobalConfig()?.landing?.enabled) {
                    animationScenes[cfg].landingOrbitLine.visible = view.viewOrbitDescent;
                }

                animationScenes[cfg].locations.forEach((x) => { x.visible = view.viewCraters; });

                animationScenes[cfg].axesHelper.visible = view.viewXYZAxes;

                animationScenes[cfg].earthNorthPoleSphere.visible = view.viewPoles;
                animationScenes[cfg].earthSouthPoleSphere.visible = view.viewPoles;

                if (getGlobalConfig()?.is_lunar) {
                    animationScenes[cfg].moonNorthPoleSphere.visible = view.viewPoles;
                    animationScenes[cfg].moonSouthPoleSphere.visible = view.viewPoles;
                    animationScenes[cfg].moonAxis.visible = view.viewPolarAxes;
                    animationScenes[cfg].moonSOISphere.visible = view.viewMoonSOI;
                }

                animationScenes[cfg].earthAxis.visible = view.viewPolarAxes;

                applySkyLayerVisibility(animationScenes[cfg], {
                    viewSky: view.viewSky,
                    viewConstellationLines: view.viewConstellationLines,
                });
                animationScenes[cfg].eclipticPlaneHelper.visible = view.viewEclipticPlane;
                animationScenes[cfg].eclipticPolarGridHelper.visible = view.viewEclipticPlane;
                animationScenes[cfg].equatorialPlaneHelper.visible = view.viewEquatorialPlane;
                animationScenes[cfg].equatorialPolarGridHelper.visible = view.viewEquatorialPlane;
            }
        });

        // Force an immediate redraw of the active scene.
        render();
    }

    return { toggleMode, setDimensionTop, setView };
}
