import {
    getSceneMissionCraftIds,
    getScenePrimaryCraftId,
    setSceneVisibleCraftIds,
    syncSceneActiveCraft,
} from "./scene-craft-helpers.js";

export function createSpacecraftActions({
    SpacecraftRenderer,
    planetProperties,
    getCraftSize,
    getGlobalConfig,
}) {
    function addSpacecraft(scene) {
        const globalConfig = getGlobalConfig();
        const craftIds = getSceneMissionCraftIds(scene, globalConfig);
        scene.primaryCraftId = getScenePrimaryCraftId(scene, globalConfig);
        scene.activeCraftId = scene.primaryCraftId;
        setSceneVisibleCraftIds(scene, globalConfig, [scene.primaryCraftId]);
        scene.spacecraftRenderersById = {};
        scene.craftsById = {};
        scene.craftInnersById = {};
        scene.craftEdgesById = {};
        scene.craftAxesHelpersById = {};
        scene.dronesById = {};

        for (const craftId of craftIds) {
            const props = planetProperties[craftId] || planetProperties.SC;
            const renderer = new SpacecraftRenderer(
                scene.motherContainer,
                getCraftSize(),
                props.color,
                {
                    edgeColor: props.orbitcolor || props.color,
                    droneColor: props.color,
                },
            );
            renderer.createSimple();

            scene.spacecraftRenderersById[craftId] = renderer;
            scene.craftsById[craftId] = renderer.craft;
            scene.craftInnersById[craftId] = renderer.craftInner;
            scene.craftEdgesById[craftId] = renderer.craftEdges;
            scene.craftAxesHelpersById[craftId] = renderer.axesHelper;
            scene.dronesById[craftId] = renderer.drone;
        }

        syncSceneActiveCraft(scene, globalConfig, scene.primaryCraftId);
    }

    function disposeSpacecraft(scene) {
        for (const renderer of Object.values(scene.spacecraftRenderersById || {})) {
            renderer?.dispose?.();
        }

        scene.spacecraftRenderersById = {};
        scene.craftsById = {};
        scene.craftInnersById = {};
        scene.craftEdgesById = {};
        scene.craftAxesHelpersById = {};
        scene.dronesById = {};
        scene.primaryCraftId = "SC";
        scene.activeCraftId = "SC";
        scene.visibleCraftIds = null;
        scene.spacecraftRenderer = null;
        scene.craft = null;
        scene.craftInner = null;
        scene.craftEdges = null;
        scene.craftAxesHelper = null;
        scene.craftVisible = false;
        scene.drone = null;
    }

    return { addSpacecraft, disposeSpacecraft };
}
