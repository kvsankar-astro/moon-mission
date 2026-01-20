export function createSkyActions({ SkyRenderer, render }) {
    function addSky(scene, { earthRadius, viewSky }) {
        scene.skyRenderer = new SkyRenderer(scene.motherContainer, earthRadius);
        scene.skyRenderer.setTextures(scene.skyTexture, scene.skyConstellationTexture);
        scene.skyRenderer.create(viewSky);

        scene.skyContainer = scene.skyRenderer.container;
        scene.sky = scene.skyRenderer.skyMesh;
        scene.skyConstellation = scene.skyRenderer.constellationMesh;

        render();
    }

    function disposeSky(scene) {
        if (scene.skyRenderer) {
            scene.skyRenderer.dispose();
            scene.skyRenderer = null;
        }

        scene.sky = null;
        scene.skyConstellation = null;
        scene.skyContainer = null;
        scene.skyTexture = null;
        scene.skyConstellationTexture = null;
    }

    return { addSky, disposeSky };
}

