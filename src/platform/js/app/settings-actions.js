import {
    applySceneOrbitVisibility,
    getSceneMissionCraftIds,
    setSceneVisibleCraftIds,
    shouldShowSceneCraft,
    syncSceneActiveCraft,
} from "./scene-craft-helpers.js";
import { refreshSceneOrbitStyleOpacities } from "./orbit-style-meta-actions.js";

import { planOriginModeTransition } from "../core/domain/ui-transition-plan.js";
import { applySkyLayerVisibility } from "./sky-visibility.js";
import {
    resolveHeadOpacity2D,
    resolveTailOpacity2D,
    resolveTailVisualStyle,
    resolveTrackOpacity2D,
    resolveTrackOpacity3D,
} from "./orbit-trail-style.js";

export function createSettingsActions({
    getConfig,
    setConfig,
    animationScenes,
    AnimationScene,
    initAnimation,
    readOriginMode,
    readViewSettings,
    setFPSCounterVisibility,
    render,
    getGlobalConfig,
    getAnimationRunning,
    setViewFlags,
    setDimension,
    onConfigChanged,
}) {
    function isRelativeOriginSelected() {
        if (typeof document === "undefined") return false;
        return !!document.getElementById("origin-relative")?.checked;
    }

    function resolveEffectiveOrbitStyle(orbitStyle) {
        const selectedStyle = orbitStyle === "trail" ? "trail" : "classic";
        if (selectedStyle !== "trail") return selectedStyle;
        return getAnimationRunning?.() ? "trail" : "classic";
    }

    function applyOrbitSvgStyle(
        orbitElement,
        orbitStyle,
        trailTrackBrightness2D = 1,
        trailTailBrightness2D = 1,
    ) {
        if (!orbitElement) return;
        const style = resolveEffectiveOrbitStyle(orbitStyle);
        orbitElement.setAttribute("data-orbit-style", style);
        orbitElement
            .querySelectorAll(".orbit-classic-path")
            .forEach((element) =>
                element.setAttribute("visibility", style === "classic" ? "inherit" : "hidden"),
            );
        orbitElement
            .querySelectorAll(".orbit-trail-background, .orbit-trail-tail, .orbit-trail-mid, .orbit-trail-head-glow, .orbit-trail-head")
            .forEach((element) =>
                element.setAttribute("visibility", style === "trail" ? "inherit" : "hidden"),
            );
        orbitElement
            .querySelectorAll(".orbit-trail-background")
            .forEach((element) =>
                element.setAttribute(
                    "stroke-opacity",
                    String(resolveTrackOpacity2D(trailTrackBrightness2D)),
                ),
            );
        orbitElement
            .querySelectorAll(".orbit-trail-tail")
            .forEach((element) =>
                element.setAttribute(
                    "stroke-opacity",
                    String(resolveTailOpacity2D(trailTailBrightness2D)),
                ),
            );
        orbitElement
            .querySelectorAll(".orbit-trail-mid")
            .forEach((element) =>
                element.setAttribute(
                    "stroke-opacity",
                    String(style === "trail"
                        ? resolveTailVisualStyle({
                            dimension: "2D",
                            prominence: trailTailBrightness2D,
                        }).midOpacity
                        : 0),
                ),
            );
        orbitElement
            .querySelectorAll(".orbit-trail-head-glow")
            .forEach((element) =>
                element.setAttribute(
                    "stroke-opacity",
                    String(style === "trail"
                        ? resolveTailVisualStyle({
                            dimension: "2D",
                            prominence: trailTailBrightness2D,
                        }).headGlowOpacity
                        : 0),
                ),
            );
        orbitElement
            .querySelectorAll(".orbit-trail-head")
            .forEach((element) =>
                element.setAttribute(
                    "stroke-opacity",
                    String(resolveHeadOpacity2D(trailTailBrightness2D)),
                ),
            );
    }

    function applySceneTailProminence(
        scene,
        trailTailBrightness2D = 1,
        trailTailBrightness3D = 1,
    ) {
        if (!scene) return;

        const style2D = resolveTailVisualStyle({
            dimension: "2D",
            prominence: trailTailBrightness2D,
        });
        const style3D = resolveTailVisualStyle({
            dimension: "3D",
            prominence: trailTailBrightness3D,
        });

        if (typeof document !== "undefined") {
            for (const bodyId of Object.keys(scene.orbitSvgPointsByBodyId || {})) {
                const orbitGroup = document.getElementById(`orbit-${bodyId}`);
                if (!orbitGroup) continue;
                orbitGroup.querySelectorAll(".orbit-trail-tail").forEach((element) => {
                    element.setAttribute("stroke-width", String(style2D.tailWidth));
                    element.setAttribute("stroke-opacity", String(style2D.tailOpacity));
                });
                orbitGroup.querySelectorAll(".orbit-trail-mid").forEach((element) => {
                    element.setAttribute("stroke-width", String(style2D.midWidth));
                    element.setAttribute("stroke-opacity", String(style2D.midOpacity));
                });
                orbitGroup.querySelectorAll(".orbit-trail-head-glow").forEach((element) => {
                    element.setAttribute("stroke-width", String(style2D.headGlowWidth));
                    element.setAttribute("stroke-opacity", String(style2D.headGlowOpacity));
                });
                orbitGroup.querySelectorAll(".orbit-trail-head").forEach((element) => {
                    element.setAttribute("stroke-width", String(style2D.headWidth));
                    element.setAttribute("stroke-opacity", String(style2D.headOpacity));
                });
            }
        }

        for (const bundle of Object.values(scene.orbitTrailLinesByBodyId || {})) {
            if (bundle?.tailLine?.material) {
                bundle.tailLine.material.opacity = style3D.tailOpacity;
                bundle.tailLine.material.needsUpdate = true;
            }
            if (bundle?.midLine?.material) {
                bundle.midLine.material.opacity = style3D.midOpacity;
                bundle.midLine.material.needsUpdate = true;
            }
            if (bundle?.headGlowLine?.material) {
                bundle.headGlowLine.material.opacity = style3D.headGlowOpacity;
                bundle.headGlowLine.material.needsUpdate = true;
            }
            if (bundle?.headLine?.material) {
                bundle.headLine.material.opacity = style3D.headOpacity;
                bundle.headLine.material.needsUpdate = true;
            }
        }
    }

    function toggleMode() {
        const previousConfig = getConfig();
        const previousScene = animationScenes[previousConfig];
        const transitionPlan = planOriginModeTransition({
            currentConfig: previousConfig,
            requestedConfig: readOriginMode(),
            currentSceneState: previousScene?.state,
            addCurveDoneState: AnimationScene.SCENE_STATE_ADD_CURVE_DONE,
        });
        if (!transitionPlan.shouldSwitch) return;

        if (transitionPlan.shouldDisposeCurrentScene && previousScene) {
            previousScene.stopCreation();
            previousScene.dispose();
            delete animationScenes[previousConfig];
        }

        setConfig(transitionPlan.nextConfig);
        initAnimation({ reset: false });
        onConfigChanged?.(transitionPlan.nextConfig, transitionPlan.previousConfig);
    }

    function setDimensionTop() {
        setDimension(false);
    }

    function setView() {
        const requestedView = readViewSettings();
        setViewFlags(requestedView);

        setFPSCounterVisibility(requestedView.viewFPS);
        const globalConfig = getGlobalConfig();

        ["geo", "lunar"].forEach(function(cfg) {
            const scene = animationScenes[cfg];
            const nextVisibleCraftIds = Array.isArray(requestedView.visibleCraftIds)
                ? requestedView.visibleCraftIds
                : requestedView.viewAdditionalCrafts === true
                    ? getSceneMissionCraftIds(scene, globalConfig)
                    : requestedView.viewAdditionalCrafts === false
                        ? [requestedView.activeCraftId ?? scene?.activeCraftId ?? scene?.primaryCraftId].filter(Boolean)
                        : scene?.visibleCraftIds;
            const view = {
                ...requestedView,
                activeCraftId: requestedView.activeCraftId ?? scene?.activeCraftId ?? scene?.primaryCraftId ?? null,
                viewAdditionalCrafts:
                    requestedView.viewAdditionalCrafts ?? scene?.viewAdditionalCrafts ?? false,
                visibleCraftIds: nextVisibleCraftIds,
            };
            const effectiveOrbitStyle = resolveEffectiveOrbitStyle(view.orbitStyle);
            if (scene) {
                scene.trailContextOpacity2D = resolveTrackOpacity2D(view.trailTrackBrightness2D);
                scene.trailContextOpacity3D = resolveTrackOpacity3D(view.trailTrackBrightness3D);
                scene.trailTailProminence2D = view.trailTailBrightness2D;
                scene.trailTailProminence3D = view.trailTailBrightness3D;
                const visibleCraftIds = setSceneVisibleCraftIds(
                    scene,
                    globalConfig,
                    view.visibleCraftIds,
                );
                const nextActiveCraftId = visibleCraftIds.length === 1
                    ? visibleCraftIds[0]
                    : view.activeCraftId;
                scene.viewAdditionalCrafts = visibleCraftIds.length > 1;
                syncSceneActiveCraft(scene, globalConfig, nextActiveCraftId);
                refreshSceneOrbitStyleOpacities(scene);
                applySceneTailProminence(
                    scene,
                    view.trailTailBrightness2D,
                    view.trailTailBrightness3D,
                );
            }
            if (scene?.planetsForLocations) {
                for (const bodyId of scene.planetsForLocations) {
                    const orbitElement =
                        typeof document !== "undefined"
                            ? document.getElementById(`orbit-${bodyId}`)
                            : null;
                    if (!orbitElement) continue;
                    const isGeoSecondaryBodyOrbit =
                        globalConfig?.is_lunar &&
                        cfg === "geo" &&
                        bodyId === "MOON";
                    const visible = isGeoSecondaryBodyOrbit
                        ? view.viewMoonOsculatingOrbit && !isRelativeOriginSelected()
                        : view.viewOrbit && shouldShowSceneCraft({
                            scene,
                            globalConfig,
                            bodyId,
                        });
                    applyOrbitSvgStyle(
                        orbitElement,
                        effectiveOrbitStyle,
                        view.trailTrackBrightness2D,
                        view.trailTailBrightness2D,
                    );
                    orbitElement.setAttribute("visibility", visible ? "visible" : "hidden");
                }
            }
            if (scene && scene.initialized3D) {
                applySceneOrbitVisibility(
                    scene,
                    globalConfig,
                    view.viewOrbit,
                    effectiveOrbitStyle,
                    view.trailTrackBrightness3D,
                    view.trailTailBrightness3D,
                );
                if (cfg === "lunar" && getGlobalConfig()?.landing?.enabled) {
                    scene.landingOrbitLine.visible = view.viewOrbitDescent;
                }

                scene.locations.forEach((x) => { x.visible = view.viewCraters; });

                scene.axesHelper.visible = view.viewXYZAxes;

                scene.earthNorthPoleSphere.visible = view.viewPoles;
                scene.earthSouthPoleSphere.visible = view.viewPoles;

                if (globalConfig?.is_lunar) {
                    scene.moonNorthPoleSphere.visible = view.viewPoles;
                    scene.moonSouthPoleSphere.visible = view.viewPoles;
                    scene.moonAxis.visible = view.viewPolarAxes;
                    scene.moonSOISphere.visible = view.viewMoonSOI;
                    const shouldShowMoonHighlight =
                        (cfg === "geo" || cfg === "lunar") && view.viewMoonHighlightRing;
                    if (scene.bodyHighlightSprite) {
                        scene.bodyHighlightSprite.visible = false;
                    }
                    if (scene.sceneHelpers?.setBodyHighlightVisible) {
                        scene.sceneHelpers.setBodyHighlightVisible(shouldShowMoonHighlight);
                    }
                    if (scene.moonOsculatingOrbitLine) {
                        scene.moonOsculatingOrbitLine.visible =
                            cfg === "geo" &&
                            view.viewMoonOsculatingOrbit &&
                            !isRelativeOriginSelected();
                    }
                }

                scene.earthAxis.visible = view.viewPolarAxes;

                applySkyLayerVisibility(scene, {
                    viewSky: view.viewSky,
                    viewConstellationLines: view.viewConstellationLines,
                });
                scene.eclipticPlaneHelper.visible = view.viewEclipticPlane;
                scene.eclipticPolarGridHelper.visible = view.viewEclipticPlane;
                scene.equatorialPlaneHelper.visible = view.viewEquatorialPlane;
                scene.equatorialPolarGridHelper.visible = view.viewEquatorialPlane;
            }
        });

        // Force an immediate redraw of the active scene.
        render();
    }

    return { toggleMode, setDimensionTop, setView };
}
