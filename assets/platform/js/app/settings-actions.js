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
        const val = readOriginMode();
        const oldConfig = getConfig();

        if (oldConfig !== val) {
            if (animationScenes[oldConfig]) {
                if (animationScenes[oldConfig].state !== AnimationScene.SCENE_STATE_ADD_CURVE_DONE) {
                    animationScenes[oldConfig].stopCreation();
                    animationScenes[oldConfig].dispose();
                    delete animationScenes[oldConfig];
                }
            }

            setConfig(val);
            initAnimation({ reset: false });
            onConfigChanged?.(val, oldConfig);
        }
    }

    function setDimensionTop() {
        setDimension(false);
    }

    function setView() {
        const view = readViewSettings();
        setViewFlags(view);

        setFPSCounterVisibility(view.viewFPS);

        ["geo", "lunar"].map(function(cfg) {
            if (animationScenes[cfg] && animationScenes[cfg].initialized3D) {
                animationScenes[cfg].orbitLines.map((orbitLine) => { orbitLine.visible = view.viewOrbit; });
                if (cfg === "lunar" && getGlobalConfig()?.landing?.enabled) {
                    animationScenes[cfg].landingOrbitLine.visible = view.viewOrbitDescent;
                }

                animationScenes[cfg].locations.map(x => x.visible = view.viewCraters);

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

                animationScenes[cfg].skyContainer.visible = view.viewSky;
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
