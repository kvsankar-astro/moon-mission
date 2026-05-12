import {
    applySceneOrbitVisibility,
    setSceneVisibleCraftIds,
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
} from "./orbit-trail-style.js";
import {
    buildSceneViewPlan,
    resolveEffectiveOrbitStyle,
} from "./view-application-plan.js";
import { applySceneViewPlanToScene } from "./scene-view-plan-application.js";

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
    syncViewIdentity = null,
}) {
    function syncLocatorsPillState(enabled) {
        if (typeof document === "undefined") return;
        const locatorsPill = document.getElementById("locators-pill");
        if (!locatorsPill) return;
        const isEnabled = Boolean(enabled);
        locatorsPill.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    }

    function isRelativeOriginSelected() {
        if (typeof document === "undefined") return false;
        return !!document.getElementById("origin-relative")?.checked;
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
        } else if (previousScene?.sceneHelpers?.updateBodyHalos) {
            // Scene instances are reused across origin switches in steady state.
            // Ensure the previous scene's body-attached halos are hidden
            // while the next origin scene is initializing.
            previousScene.sceneHelpers.updateBodyHalos({ visible: false });
        }

        setConfig(transitionPlan.nextConfig);
        initAnimation({ reset: false });
        onConfigChanged?.(transitionPlan.nextConfig, transitionPlan.previousConfig);
    }

    function setDimensionTop() {
        setDimension(false);
    }

    function setView() {
        if (typeof syncViewIdentity === "function") {
            syncViewIdentity();
        }
        const requestedView = readViewSettings();
        setViewFlags(requestedView);
        syncLocatorsPillState(requestedView.viewBodyHalos);

        setFPSCounterVisibility(requestedView.viewFPS);
        const globalConfig = getGlobalConfig();
        const relativeOriginSelected = isRelativeOriginSelected();

        ["geo", "lunar"].forEach(function(cfg) {
            const scene = animationScenes[cfg];
            const plan = buildSceneViewPlan({
                configKey: cfg,
                requestedView,
                scene,
                globalConfig,
                isRelativeOriginSelected: relativeOriginSelected,
            });
            applySceneViewPlanToScene({
                scene,
                configKey: cfg,
                plan,
                globalConfig,
                documentRef: typeof document !== "undefined" ? document : null,
                applyOrbitSvgStyle,
                applySceneTailProminence,
                applySceneOrbitVisibility,
                setSceneVisibleCraftIds,
                syncSceneActiveCraft,
                refreshSceneOrbitStyleOpacities,
                applySkyLayerVisibility,
            });
        });

        // Force an immediate redraw of the active scene.
        render();
    }

    return { toggleMode, setDimensionTop, setView };
}

