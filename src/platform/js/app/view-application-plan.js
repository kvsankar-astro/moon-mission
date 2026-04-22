import { isMissionCraftBody } from "../core/domain/mission-config.js";
import {
    getSceneDefaultVisibleCraftIds,
    getSceneMissionCraftIds,
    getSceneVisibleCraftIds,
} from "./scene-craft-helpers.js";
import { resolveTrackOpacity2D, resolveTrackOpacity3D } from "./orbit-trail-style.js";

function extractSkyParameterPatch(viewSettings) {
    if (!viewSettings || typeof viewSettings !== "object") {
        return null;
    }
    const patch = {};
    if (typeof viewSettings.atmosphere_enabled === "boolean") {
        patch.atmosphere_enabled = viewSettings.atmosphere_enabled;
    }
    if (Number.isFinite(viewSettings.bloom_strength)) {
        patch.bloom_strength = viewSettings.bloom_strength;
    }
    if (Number.isFinite(viewSettings.star_size_scale)) {
        patch.star_size_scale = viewSettings.star_size_scale;
    }
    if (Number.isFinite(viewSettings.extinction_strength)) {
        patch.extinction_strength = viewSettings.extinction_strength;
    }
    if (Number.isFinite(viewSettings.twinkle_strength)) {
        patch.twinkle_strength = viewSettings.twinkle_strength;
    }
    if (Number.isFinite(viewSettings.observer_lat)) {
        patch.observer_lat = viewSettings.observer_lat;
    }
    if (Number.isFinite(viewSettings.observer_lon)) {
        patch.observer_lon = viewSettings.observer_lon;
    }
    if (Number.isFinite(viewSettings.sky_time_ms)) {
        patch.sky_time_ms = viewSettings.sky_time_ms;
    }
    return Object.keys(patch).length ? patch : null;
}

function resolveEffectiveOrbitStyle(_orbitStyle) {
    return "classic";
}

function resolveRequestedVisibleCraftIds(requestedView, scene, globalConfig, activeCraftId) {
    if (Array.isArray(requestedView.visibleCraftIds)) {
        return requestedView.visibleCraftIds;
    }
    if (requestedView.viewAdditionalCrafts === true) {
        const comparisonDefaultVisibleCraftIds = getSceneDefaultVisibleCraftIds(scene, globalConfig);
        if (comparisonDefaultVisibleCraftIds.length > 1) {
            return comparisonDefaultVisibleCraftIds;
        }
        return getSceneMissionCraftIds(scene, globalConfig);
    }
    if (requestedView.viewAdditionalCrafts === false) {
        return [activeCraftId].filter(Boolean);
    }
    return scene?.visibleCraftIds;
}

function shouldShowOrbitBody({
    bodyId,
    configKey,
    globalConfig,
    visibleCraftIds,
    viewOrbit,
    viewMoonOsculatingOrbit,
    isRelativeOriginSelected,
}) {
    const isSecondaryBodyOrbit =
        globalConfig?.is_lunar &&
        ((configKey === "geo" && bodyId === "MOON") || (configKey === "lunar" && bodyId === "EARTH"));

    if (isSecondaryBodyOrbit) {
        return Boolean(viewMoonOsculatingOrbit) && !isRelativeOriginSelected;
    }

    if (!viewOrbit) {
        return false;
    }

    if (!isMissionCraftBody(globalConfig, bodyId)) {
        return true;
    }

    return visibleCraftIds.includes(bodyId);
}

function buildSceneViewPlan({
    configKey,
    requestedView,
    scene,
    globalConfig,
    isRelativeOriginSelected,
}) {
    const activeCraftId = requestedView.activeCraftId ?? scene?.activeCraftId ?? scene?.primaryCraftId ?? null;
    const view = {
        ...requestedView,
        activeCraftId,
        viewAdditionalCrafts:
            requestedView.viewAdditionalCrafts ?? scene?.viewAdditionalCrafts ?? false,
        visibleCraftIds: resolveRequestedVisibleCraftIds(
            requestedView,
            scene,
            globalConfig,
            activeCraftId,
        ),
    };

    const visibleCraftIds = getSceneVisibleCraftIds(scene, globalConfig, view.visibleCraftIds);
    const nextActiveCraftId = visibleCraftIds.length === 1
        ? visibleCraftIds[0]
        : view.activeCraftId;
    const effectiveOrbitStyle = resolveEffectiveOrbitStyle(view.orbitStyle);
    const orbitVisibilityByBodyId = {};
    for (const bodyId of scene?.planetsForLocations || []) {
        orbitVisibilityByBodyId[bodyId] = shouldShowOrbitBody({
            bodyId,
            configKey,
            globalConfig,
            visibleCraftIds,
            viewOrbit: view.viewOrbit,
            viewMoonOsculatingOrbit: view.viewMoonOsculatingOrbit,
            isRelativeOriginSelected,
        });
    }

    return {
        view,
        visibleCraftIds,
        nextActiveCraftId,
        nextViewAdditionalCrafts: visibleCraftIds.length > 1,
        effectiveOrbitStyle,
        trailContextOpacity2D: resolveTrackOpacity2D(view.trailTrackBrightness2D),
        trailContextOpacity3D: resolveTrackOpacity3D(view.trailTrackBrightness3D),
        trailTailProminence2D: view.trailTailBrightness2D,
        trailTailProminence3D: view.trailTailBrightness3D,
        orbitVisibilityByBodyId,
        showMoonOsculatingOrbit:
            configKey !== "relative" &&
            Boolean(view.viewMoonOsculatingOrbit) &&
            !isRelativeOriginSelected,
        showLandingOrbit:
            configKey === "lunar" && Boolean(globalConfig?.landing?.enabled)
                ? Boolean(view.viewOrbitDescent)
                : false,
        skyPatch: extractSkyParameterPatch(view),
    };
}

export {
    buildSceneViewPlan,
    extractSkyParameterPatch,
    resolveEffectiveOrbitStyle,
};
