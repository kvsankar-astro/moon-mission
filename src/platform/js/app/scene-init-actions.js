export function createSceneInitActions({ THREE, render, wait20, clearEventInfo }) {
    function init3dRest(scene) {
        scene.scene = new THREE.Scene();
        scene.motherContainer = new THREE.Group();

        scene.computeDimensions();
        render();
        wait20().then();

        scene.addLight();
        render();
        wait20().then();

        scene.addSky();
        render();
        wait20().then();

        scene.addSun();
        render();
        wait20().then();

        scene.addMoon();
        render();
        wait20().then();

        scene.addEarth();
        render();
        wait20().then();

        scene.setPrimaryAndSecondaryBodies();
        render();
        wait20().then();

        scene.addSpacecraft();
        render();
        wait20().then();

        scene.addBodyHalos();
        render();
        wait20().then();

        scene.addCamera();
        render();
        wait20().then();

        scene.initialized3D = true;
        render();
        wait20().then();

        scene.addEarthLocations();
        render();
        wait20().then();

        scene.addMoonLocations();
        render();
        wait20().then();

        scene.addSpacecraftCurve();
        render();
        wait20().then();

        scene.addLineOfSight();
        render();
        wait20().then();

        scene.addAxesHelper();
        render();
        wait20().then();

        clearEventInfo();
    }

    return { init3dRest };
}

