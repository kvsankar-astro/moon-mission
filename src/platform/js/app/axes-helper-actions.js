export function createAxesHelperActions({ SceneHelpers, getPixelsPerAU, PC }) {
    function addAxesHelper(scene, { earthRadius, viewXYZAxes, viewEclipticPlane, viewEquatorialPlane }) {
        if (!scene.sceneHelpers) {
            scene.sceneHelpers = new SceneHelpers(scene.motherContainer);
        }

        const axesSize = 2 * getPixelsPerAU() * PC.EARTH_MOON_DISTANCE_MEAN_AU;
        const gridRadius = earthRadius * 64;
        const eclipticPlaneSize = earthRadius * 128;
        const equatorialPlaneSize = earthRadius * 144;

        scene.sceneHelpers.createAxesHelper(axesSize, viewXYZAxes);
        scene.sceneHelpers.createEclipticPlane(gridRadius, eclipticPlaneSize, viewEclipticPlane);
        scene.sceneHelpers.createEquatorialPlane(
            gridRadius,
            equatorialPlaneSize,
            viewEquatorialPlane,
        );

        scene.axesHelper = scene.sceneHelpers.axesHelper;
        scene.eclipticPolarGridHelper = scene.sceneHelpers.eclipticPolarGridHelper;
        scene.eclipticPlaneHelper = scene.sceneHelpers.eclipticPlaneHelper;
        scene.equatorialPolarGridHelper = scene.sceneHelpers.equatorialPolarGridHelper;
        scene.equatorialPlaneHelper = scene.sceneHelpers.equatorialPlaneHelper;
    }

    function disposeAxesHelper(scene) {
        if (scene.sceneHelpers) {
            scene.sceneHelpers.disposeAxesHelper();
            scene.sceneHelpers.disposeEclipticPlane();
            scene.sceneHelpers.disposeEquatorialPlane();
        }

        scene.axesHelper = null;
        scene.eclipticPolarGridHelper = null;
        scene.eclipticPlaneHelper = null;
        scene.equatorialPolarGridHelper = null;
        scene.equatorialPlaneHelper = null;
    }

    return { addAxesHelper, disposeAxesHelper };
}
