export function createSpacecraftModelActions({
    SpacecraftRenderer,
    planetProperties,
    getCraftSize,
    getGlobalConfig,
    getModelPathPrefix,
}) {
    async function addSpacecraftModel(scene) {
        const globalConfig = getGlobalConfig();
        if (!globalConfig?.spacecraftModel?.enabled) {
            return;
        }

        const craftColor = planetProperties["SC"]["color"];
        const modelPath = getModelPathPrefix() + globalConfig.spacecraftModel.file;

        scene.spacecraftRenderer = new SpacecraftRenderer(
            scene.motherContainer,
            getCraftSize(),
            craftColor,
        );
        await scene.spacecraftRenderer.loadModel(modelPath);

        scene.craft = scene.spacecraftRenderer.craft;
        scene.craftInner = scene.spacecraftRenderer.craftInner;
        scene.craftAxesHelper = scene.spacecraftRenderer.axesHelper;
        scene.craftVisible = scene.spacecraftRenderer.visible;
    }

    function disposeSpacecraftModel(scene) {
        if (scene.spacecraftRenderer) {
            scene.spacecraftRenderer.disposeModel();
            scene.spacecraftRenderer = null;
        }

        scene.craft = null;
        scene.craftInner = null;
        scene.craftAxesHelper = null;
        scene.craftVisible = false;
    }

    return { addSpacecraftModel, disposeSpacecraftModel };
}

