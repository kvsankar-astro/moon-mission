export function createSceneCameraActions({ animationScenes, getConfig, renderScene }) {
    function getSceneOrNull() {
        const config = getConfig();
        const scene = animationScenes[config];
        if (!scene || !scene.initialized3D) return null;
        return scene;
    }

    function toggleCameraPos(target) {
        const scene = getSceneOrNull();
        if (!scene) return;

        if (scene.name == "geo" && target == "EARTH") {
            scene.camera.position.set(0, 0, 0);
        }
        if (scene.name == "geo" && target == "MOON") {
            scene.camera.position.copy(scene.secondaryBody3D.position);
        }
        if (scene.name == "lunar" && target == "EARTH") {
            scene.camera.position.copy(scene.secondaryBody3D.position);
        }
        if (scene.name == "lunar" && target == "MOON") {
            scene.camera.position.set(0, 0, 0);
        }

        renderScene(scene);
    }

    function toggleCameraLook(target) {
        const scene = getSceneOrNull();
        if (!scene) return;

        if (scene.name == "geo") {
            if (target == "EARTH") {
                scene.camera.lookAt(0, 0, 0);
            }
            if (target == "MOON") {
                scene.camera.lookAt(scene.secondaryBody3D.position);
            }
            if (target == "SC") {
                scene.camera.lookAt(scene.craft.position);
            }
        }

        if (scene.name == "lunar") {
            if (target == "EARTH") {
                scene.camera.lookAt(scene.secondaryBody3D.position);
            }
            if (target == "MOON") {
                scene.camera.lookAt(0, 0, 0);
            }
            if (target == "SC") {
                scene.camera.lookAt(scene.craft.position);
            }
        }
    }

    return { toggleCameraPos, toggleCameraLook };
}
