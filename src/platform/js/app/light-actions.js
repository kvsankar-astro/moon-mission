export function createLightActions({ LightManager }) {
    function addLight(scene) {
        scene.lightManager = new LightManager(scene.motherContainer);
        scene.lightManager.create();

        scene.light = scene.lightManager.primaryLight;
        scene.lightFill = scene.lightManager.earthshineLight;
        scene.light2 = scene.lightManager.craftLight;

        scene.scene.add(scene.motherContainer);
    }

    function disposeLight(scene) {
        if (!scene.motherContainer) {
            return;
        }

        if (scene.lightManager) {
            scene.lightManager.dispose();
            scene.lightManager = null;
        }

        scene.light = null;
        scene.lightFill = null;
        scene.light2 = null;

        if (scene.scene) {
            scene.scene.remove(scene.motherContainer);
        }
    }

    return { addLight, disposeLight };
}
