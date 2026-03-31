export function createMoonActions({
    MoonRenderer,
    getMoonRadius,
    getGlobalConfig,
    getViewPolarAxes,
    getViewPoles,
    getAnimTime,
    render,
}) {
    function addMoon(scene) {
        const globalConfig = getGlobalConfig();

        if (!globalConfig || !globalConfig.is_lunar) {
            console.debug("Skipping moon creation - not a lunar mission");
            return;
        }

        scene.moonRenderer = new MoonRenderer(getMoonRadius());
        scene.moonRenderer.setTextures(scene.moonMap, scene.moonDisplacementMap);
        scene.moonRenderer.create(getViewPolarAxes(), getViewPoles());

        scene.moonContainer = scene.moonRenderer.container;
        scene.moon = scene.moonRenderer.mesh;
        scene.moonAxis = scene.moonRenderer.axis;
        scene.moonAxisVector = scene.moonRenderer.axisVector;
        scene.moonNorthPoleSphere = scene.moonRenderer.northPoleSphere;
        scene.moonSouthPoleSphere = scene.moonRenderer.southPoleSphere;

        scene.addMoonSOI();
        scene.addMoonOsculatingOrbit();
        scene.rotateMoon(getAnimTime());

        render();
    }

    function disposeMoon(scene) {
        const globalConfig = getGlobalConfig();

        if (!globalConfig || !globalConfig.is_lunar) {
            return;
        }

        scene.disposeMoonSOI();
        scene.disposeSecondaryBodyHighlight();
        scene.disposeMoonOsculatingOrbit();

        if (scene.moonRenderer) {
            scene.moonRenderer.dispose();
            scene.moonRenderer = null;
        }

        scene.moon = null;
        scene.moonAxis = null;
        scene.moonAxisVector = null;
        scene.moonNorthPoleSphere = null;
        scene.moonSouthPoleSphere = null;
        scene.moonContainer = null;
        scene.moonHighlightSprite = null;
        scene.moonOsculatingOrbitLine = null;
        scene.moonMap = null;
        scene.moonDisplacementMap = null;
    }

    return { addMoon, disposeMoon };
}
