export function createEarthActions({ EarthRenderer, render }) {
    function addEarth(scene, { earthRadius, viewPolarAxes, viewPoles }) {
        // Create Earth renderer
        scene.earthRenderer = new EarthRenderer(earthRadius);
        scene.earthRenderer.setTextures(scene.earthTexture, scene.earthSpecularTexture, scene.earthNightTexture);
        scene.earthRenderer.create(viewPolarAxes, viewPoles);

        // Backward-compatible property references
        scene.earthContainer = scene.earthRenderer.container;
        scene.earth = scene.earthRenderer.mesh;
        scene.earthAxis = scene.earthRenderer.axis;
        scene.earthNorthPoleSphere = scene.earthRenderer.northPoleSphere;
        scene.earthSouthPoleSphere = scene.earthRenderer.southPoleSphere;

        render();
    }

    function disposeEarth(scene) {
        if (scene.earthRenderer) {
            scene.earthRenderer.dispose();
            scene.earthRenderer = null;
        }

        // Clear backward-compatible references
        scene.earth = null;
        scene.earthAxis = null;
        scene.earthNorthPoleSphere = null;
        scene.earthSouthPoleSphere = null;
        scene.earthContainer = null;
        scene.earthTexture = null;
        scene.earthPhotoTexture = null;
        scene.earthSpecularTexture = null;
        scene.earthNightTexture = null;
    }

    return { addEarth, disposeEarth };
}
