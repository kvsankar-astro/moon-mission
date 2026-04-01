import { applySkyLayerVisibility } from "./sky-visibility.js";

export function createSkyActions({ SkyRenderer, render }) {
    function addSky(scene, { earthRadius, viewSky, viewConstellationLines }) {
        scene.skyRenderer = new SkyRenderer(scene.motherContainer, earthRadius);
        scene.skyRenderer.setTextures(scene.skyTexture, scene.skyConstellationTexture);
        scene.skyRenderer.create(viewSky || viewConstellationLines);

        scene.skyContainer = scene.skyRenderer.container;
        scene.sky = scene.skyRenderer.skyMesh;
        scene.skyConstellation = scene.skyRenderer.constellationMesh;
        scene.skyBaseQuaternion = scene.skyContainer?.quaternion?.clone?.() || null;
        applySkyLayerVisibility(scene, { viewSky, viewConstellationLines });

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
        scene.skyBaseQuaternion = null;
        scene.skyTexture = null;
        scene.skyConstellationTexture = null;
    }

    return { addSky, disposeSky };
}
