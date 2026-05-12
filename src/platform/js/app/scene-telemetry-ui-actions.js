import { createGroundTrackPanelActions } from "./ground-track-panel.js";
import { createMediaTimelineCoordination } from "./media-timeline-coordination.js";
import {
    buildSceneTelemetryUiState,
    buildTelemetryUnitControlModel,
    normalizeTelemetryUnitMode,
    UNIT_MODE_KM,
    UNIT_MODE_MILES,
} from "../core/domain/scene-telemetry-ui-state.js";
import {
    computeAngleDegreesBetweenVectors,
    computeEarthCraftMoonAngleFromSceneState,
    hasFiniteVector3,
} from "../core/domain/earth-craft-moon-angle.js";
import { buildCompareModeUiModel } from "../core/domain/compare-mode-ui-model.js";

function createSceneTelemetryUiActions(deps) {
    const {
        d3,
        formatMetric,
        setMobileText,
        getStartTime = () => Number.NaN,
        getLatestEndTime = () => Number.NaN,
        getAnimationRunning = () => false,
        getIsCompareMode = () => false,
        playAnimation = () => {},
        pauseAnimation = () => {},
        setRealtimeSpeed = () => {},
        getAnimationSpeedMultiplier = () => Number.NaN,
        getAnimationRealtime = () => false,
        setTimelineMediaMarkers = () => {},
        documentRef = document,
        windowRef = window,
    } = deps;
    let metricUnitMode = UNIT_MODE_KM;
    let unitControlsBound = false;
    let telemetrySnapshot = null;
    let telemetryPrimaryBody = "EARTH";
    let sceneStateSnapshot = null;
    let telemetryGlobalConfig = null;
    const groundTrackPanelActions = createGroundTrackPanelActions({ formatMetric });
    const mediaTimelineCoordination = createMediaTimelineCoordination({
        getStartTime,
        getLatestEndTime,
        getAnimationRunning,
        getIsCompareMode,
        playAnimation,
        pauseAnimation,
        setRealtimeSpeed,
        getAnimationSpeedMultiplier,
        getAnimationRealtime,
        setTimelineMediaMarkers,
    });

    function setText(id, text) {
        const node = documentRef.getElementById(id);
        if (!node) return;
        node.textContent = text;
    }

    function setHidden(id, hidden) {
        const node = documentRef.getElementById(id);
        if (!node) return;
        node.hidden = !!hidden;
    }

    function resolveActiveSceneForAngle() {
        const selectedMode = documentRef.querySelector('input[name="mode"]:checked');
        const mode = (selectedMode?.value || "geo").trim();
        if (mode !== "geo" && mode !== "lunar" && mode !== "relative") return null;
        return windowRef.animationScenes?.[mode] || null;
    }

    function resolveActiveCraftObject(scene) {
        if (!scene) return null;
        if (scene.activeCraftId && scene.craftsById?.[scene.activeCraftId]) {
            return scene.craftsById[scene.activeCraftId];
        }
        if (scene.primaryCraftId && scene.craftsById?.[scene.primaryCraftId]) {
            return scene.craftsById[scene.primaryCraftId];
        }
        if (scene.craft) return scene.craft;
        const allCrafts = Object.values(scene.craftsById || {});
        return allCrafts.find((craft) => !!craft) || null;
    }

    function resolveWorldPosition(scene, objectRef) {
        if (!scene || !objectRef?.getWorldPosition || !scene.camera?.position?.clone) return null;
        const target = scene.camera.position.clone();
        objectRef.getWorldPosition(target);
        if (!hasFiniteVector3(target)) return null;
        return target;
    }

    function computeEarthCraftMoonAngleFromSceneGraph() {
        const scene = resolveActiveSceneForAngle();
        if (!scene) return null;
        const craftObj = resolveActiveCraftObject(scene);
        const earthObj = scene.earthContainer || scene.earth || null;
        const moonObj = scene.moonContainer || scene.moon || null;
        if (!craftObj || !earthObj || !moonObj) return null;

        const craftPos = resolveWorldPosition(scene, craftObj);
        const earthPos = resolveWorldPosition(scene, earthObj);
        const moonPos = resolveWorldPosition(scene, moonObj);
        if (!craftPos || !earthPos || !moonPos) return null;

        return computeAngleDegreesBetweenVectors(
            {
                x: earthPos.x - moonPos.x,
                y: earthPos.y - moonPos.y,
                z: earthPos.z - moonPos.z,
            },
            {
                x: craftPos.x - moonPos.x,
                y: craftPos.y - moonPos.y,
                z: craftPos.z - moonPos.z,
            },
        );
    }

    function computeEarthCraftMoonAngleDegrees(sceneState) {
        const fromSceneState = computeEarthCraftMoonAngleFromSceneState(sceneState);
        if (Number.isFinite(fromSceneState)) return fromSceneState;
        return computeEarthCraftMoonAngleFromSceneGraph();
    }

    function applyTelemetryUnitControlModel(unitControlModel) {
        const distanceNodes = documentRef.querySelectorAll(".stats-unit-distance");
        for (const node of distanceNodes) {
            node.textContent = unitControlModel.unitLabels.distance;
        }
        const speedNodes = documentRef.querySelectorAll(".stats-unit-speed");
        for (const node of speedNodes) {
            node.textContent = unitControlModel.unitLabels.speed;
        }

        for (const buttonState of unitControlModel.buttons) {
            const button = documentRef.getElementById(buttonState.id);
            if (!button) continue;
            button.classList.toggle("is-active", buttonState.isActive);
            button.setAttribute("aria-pressed", buttonState.ariaPressed);
        }
    }

    function renderTelemetry() {
        const telemetryUiState = buildSceneTelemetryUiState({
            telemetry: telemetrySnapshot,
            primaryBody: telemetryPrimaryBody,
            angleDegrees: computeEarthCraftMoonAngleDegrees(sceneStateSnapshot),
            unitMode: metricUnitMode,
            formatMetric,
        });
        const { telemetryDisplayModel, unitControlModel } = telemetryUiState;

        applyTelemetryUnitControlModel(unitControlModel);
        d3.select("#distance-SC-EARTH").text(telemetryDisplayModel.desktop.distanceEarth);
        d3.select("#altitude-SC-EARTH").text(telemetryDisplayModel.desktop.altitudeEarth);
        d3.select("#velocity-SC-EARTH").text(telemetryDisplayModel.desktop.velocityEarth);
        d3.select("#distance-SC-MOON").text(telemetryDisplayModel.desktop.distanceMoon);
        d3.select("#altitude-SC-MOON").text(telemetryDisplayModel.desktop.altitudeMoon);
        d3.select("#velocity-SC-MOON").text(telemetryDisplayModel.desktop.velocityMoon);
        setMobileText("mobile-metric-earth", telemetryDisplayModel.mobile.earth);
        setMobileText("mobile-metric-moon", telemetryDisplayModel.mobile.moon);
        setMobileText("mobile-metric-speed", telemetryDisplayModel.mobile.speed);
        setMobileText("mobile-metric-angle", telemetryDisplayModel.mobile.angle);

        const compareModeUiModel = buildCompareModeUiModel({
            sceneState: sceneStateSnapshot,
            globalConfig: telemetryGlobalConfig,
            primaryBody: telemetryPrimaryBody,
            unitMode: metricUnitMode,
            formatMetric,
        });
        const compareEnabled = compareModeUiModel.enabled && compareModeUiModel.entries.length >= 2;

        setHidden("stats-single-wrapper", compareEnabled);
        setHidden("stats-compare-wrapper", !compareEnabled);
        setHidden("mobile-primary-metrics", compareEnabled);
        setHidden("mobile-compare-metrics", !compareEnabled);
        setText(
            "mobile-mission-card-title",
            compareEnabled ? compareModeUiModel.mobileTitle : "Mission Info",
        );

        if (!compareEnabled) {
            return;
        }

        for (const entry of compareModeUiModel.entries) {
            const key = entry.id === "primary" ? "primary" : "secondary";
            setText(`stats-compare-${key}-role`, entry.roleLabel);
            setText(`stats-compare-${key}-label`, entry.label);
            setText(`stats-compare-${key}-phase`, entry.phaseText);
            setText(`stats-compare-${key}-distance-earth`, entry.desktop.distanceEarth || "--");
            setText(`stats-compare-${key}-altitude-earth`, entry.desktop.altitudeEarth || "--");
            setText(`stats-compare-${key}-velocity-earth`, entry.desktop.velocityEarth || "--");
            setText(`stats-compare-${key}-distance-moon`, entry.desktop.distanceMoon || "--");
            setText(`stats-compare-${key}-altitude-moon`, entry.desktop.altitudeMoon || "--");
            setText(`stats-compare-${key}-velocity-moon`, entry.desktop.velocityMoon || "--");

            setText(`mobile-compare-${key}-role`, entry.roleLabel);
            setText(`mobile-compare-${key}-label`, entry.label);
            setText(`mobile-compare-${key}-phase`, entry.phaseText);
            setText(`mobile-compare-${key}-earth`, entry.mobile.earth || "--");
            setText(`mobile-compare-${key}-moon`, entry.mobile.moon || "--");
            setText(`mobile-compare-${key}-speed`, entry.mobile.speed || "--");
        }
    }

    function setMetricUnitMode(nextMode) {
        const normalizedNextMode = normalizeTelemetryUnitMode(nextMode);
        if (metricUnitMode === normalizedNextMode) {
            return;
        }
        metricUnitMode = normalizedNextMode;
        renderTelemetry();
    }

    function ensureUnitControlsBound() {
        if (unitControlsBound) {
            return;
        }
        const kmButton = documentRef.getElementById("stats-unit-km");
        const milesButton = documentRef.getElementById("stats-unit-miles");
        const mobileKmButton = documentRef.getElementById("mobile-unit-km");
        const mobileMilesButton = documentRef.getElementById("mobile-unit-miles");
        const hasDesktopButtons = !!(kmButton && milesButton);
        const hasMobileButtons = !!(mobileKmButton && mobileMilesButton);
        if (!hasDesktopButtons && !hasMobileButtons) {
            return;
        }

        if (kmButton) {
            kmButton.addEventListener("click", () => {
                setMetricUnitMode(UNIT_MODE_KM);
            });
        }
        if (milesButton) {
            milesButton.addEventListener("click", () => {
                setMetricUnitMode(UNIT_MODE_MILES);
            });
        }
        if (mobileKmButton) {
            mobileKmButton.addEventListener("click", () => {
                setMetricUnitMode(UNIT_MODE_KM);
            });
        }
        if (mobileMilesButton) {
            mobileMilesButton.addEventListener("click", () => {
                setMetricUnitMode(UNIT_MODE_MILES);
            });
        }

        unitControlsBound = true;
        applyTelemetryUnitControlModel(buildTelemetryUnitControlModel(metricUnitMode));
    }

    function updateTelemetry(sceneState, primaryBody, globalConfig = null, config = null, animTime = null) {
        ensureUnitControlsBound();
        telemetryPrimaryBody = primaryBody;
        telemetrySnapshot = sceneState?.telemetry || null;
        sceneStateSnapshot = sceneState || null;
        telemetryGlobalConfig = globalConfig || null;
        if (config && windowRef.animationScenes?.[config]) {
            windowRef.animationScenes[config].latestSceneState = sceneState || null;
        }
        groundTrackPanelActions.update({
            sceneState,
            config,
            animTime: Number.isFinite(animTime) ? animTime : Date.now(),
        });
        mediaTimelineCoordination.update({
            globalConfig,
            config,
            animTime: Number.isFinite(animTime) ? animTime : Date.now(),
        });
        renderTelemetry();
    }

    function dispose() {
        groundTrackPanelActions.dispose?.();
        mediaTimelineCoordination.dispose?.();
    }

    return {
        updateTelemetry,
        dispose,
    };
}

export { createSceneTelemetryUiActions };
