export function createSpacecraftActions({
    SpacecraftRenderer,
    planetProperties,
    getCraftSize,
}) {
    function addSpacecraft(scene) {
        const craftColor = planetProperties["SC"]["color"];

        scene.spacecraftRenderer = new SpacecraftRenderer(
            scene.motherContainer,
            getCraftSize(),
            craftColor,
        );
        scene.spacecraftRenderer.createSimple();

        scene.craft = scene.spacecraftRenderer.craft;
        scene.craftInner = scene.spacecraftRenderer.craftInner;
        scene.craftEdges = scene.spacecraftRenderer.craftEdges;
        scene.craftAxesHelper = scene.spacecraftRenderer.axesHelper;
        scene.craftVisible = scene.spacecraftRenderer.visible;
        scene.drone = scene.spacecraftRenderer.drone;
    }

    function disposeSpacecraft(scene) {
        if (scene.spacecraftRenderer) {
            scene.spacecraftRenderer.dispose();
            scene.spacecraftRenderer = null;
        }

        scene.craft = null;
        scene.craftInner = null;
        scene.craftEdges = null;
        scene.craftAxesHelper = null;
        scene.craftVisible = false;
        scene.drone = null;
    }

    return { addSpacecraft, disposeSpacecraft };
}

