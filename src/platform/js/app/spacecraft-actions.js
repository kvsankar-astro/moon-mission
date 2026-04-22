import {
    getSceneDefaultVisibleCraftIds,
    getSceneMissionCraftIds,
    getScenePrimaryCraftId,
    setSceneVisibleCraftIds,
    syncSceneActiveCraft,
} from "./scene-craft-helpers.js";
import { resolveMissionCraft } from "../core/domain/mission-config.js";

function asTrimmedString(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function resolveCraftModelConfig(globalConfig, craftId) {
    const craft = resolveMissionCraft(globalConfig, craftId);
    const craftModel = craft?.spacecraftModel && typeof craft.spacecraftModel === "object"
        ? craft.spacecraftModel
        : null;
    const missionModel = globalConfig?.spacecraftModel && typeof globalConfig.spacecraftModel === "object"
        ? globalConfig.spacecraftModel
        : null;

    const isPrimaryCraft = craft?.primary === true;
    const hasCraftOverride = !!craftModel;
    const enabled = hasCraftOverride
        ? craftModel.enabled !== false
        : (isPrimaryCraft && !!missionModel && missionModel.enabled !== false);
    if (!enabled) return null;

    const pluginName = asTrimmedString(
        craftModel?.plugin,
        asTrimmedString(craftModel?.name, asTrimmedString(missionModel?.plugin, asTrimmedString(missionModel?.name))),
    );
    if (!pluginName) return null;

    const missionOptions = missionModel?.options && typeof missionModel.options === "object"
        ? missionModel.options
        : {};
    const craftOptions = craftModel?.options && typeof craftModel.options === "object"
        ? craftModel.options
        : {};

    return {
        pluginName,
        options: {
            ...missionOptions,
            ...craftOptions,
        },
    };
}

function resolveCraftVisualProps(globalConfig, craftId, planetProperties) {
    const missionCraft = resolveMissionCraft(globalConfig, craftId);
    const explicitProps =
        planetProperties[missionCraft?.id] ||
        planetProperties[missionCraft?.mnemonic] ||
        planetProperties[craftId];
    if (explicitProps) {
        return explicitProps;
    }

    const fallbackProps = planetProperties.SC;
    if (!missionCraft || !fallbackProps) {
        return fallbackProps || null;
    }

    return {
        ...fallbackProps,
        id: missionCraft.id || craftId,
        name: missionCraft.viewLabel || missionCraft.name || missionCraft.mnemonic || craftId,
        color: missionCraft.color || fallbackProps.color,
        orbitcolor: missionCraft.orbitcolor || missionCraft.color || fallbackProps.orbitcolor,
    };
}

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
        setSceneVisibleCraftIds(
            scene,
            globalConfig,
            getSceneDefaultVisibleCraftIds(scene, globalConfig),
        );
        scene.spacecraftRenderersById = {};
        scene.craftsById = {};
        scene.craftInnersById = {};
        scene.craftEdgesById = {};
        scene.craftAxesHelpersById = {};
        scene.dronesById = {};

        for (const craftId of craftIds) {
            const props = resolveCraftVisualProps(globalConfig, craftId, planetProperties);
            const renderer = new SpacecraftRenderer(
                scene.motherContainer,
                getCraftSize(),
                props.color,
                {
                    edgeColor: props.orbitcolor || props.color,
                    droneColor: props.color,
                },
            );
            const modelConfig = resolveCraftModelConfig(globalConfig, craftId);
            if (modelConfig) {
                renderer.createFromPlugin(modelConfig.pluginName, {
                    ...modelConfig.options,
                    craftId,
                });
            } else {
                renderer.createSimple();
            }

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
