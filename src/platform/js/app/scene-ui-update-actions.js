import { createGroundTrackPanelActions } from "./ground-track-panel.js";
import {
    planActiveEventUiState,
    resolveActiveEventButtonMatchIndex,
} from "../core/domain/active-event-ui-state.js";
import {
    buildTelemetryDisplayModel,
    resolveTelemetryUnitLabels,
    UNIT_MODE_KM,
    UNIT_MODE_MILES,
} from "../core/domain/telemetry-display-model.js";
import { buildPhaseIndicatorModel } from "../core/domain/phase-indicator-state.js";
import {
    computeAngleDegreesBetweenVectors,
    computeEarthCraftMoonAngleFromSceneState,
    hasFiniteVector3,
} from "../core/domain/earth-craft-moon-angle.js";

function createSceneUiUpdateActions(deps) {
    const {
        d3,
        formatMetric,
        updateEventInfo,
        clearEventInfo,
    } = deps;
    const ACTIVE_EVENT_BUTTON_CLASS = "burnbutton--active-event";
    let highlightedEventButton = null;
    let activeEventVisible = false;
    let metricUnitMode = UNIT_MODE_KM;
    let unitControlsBound = false;
    let telemetrySnapshot = null;
    let telemetryPrimaryBody = "EARTH";
    let sceneStateSnapshot = null;
    const groundTrackPanelActions = createGroundTrackPanelActions({ formatMetric });

    function setMobileText(id, text) {
        const node = document.getElementById(id);
        if (!node) return;
        node.textContent = text;
    }

    function resolveActiveSceneForAngle() {
        const selectedMode = document.querySelector('input[name="mode"]:checked');
        const mode = (selectedMode?.value || "geo").trim();
        if (mode !== "geo" && mode !== "lunar" && mode !== "relative") return null;
        return window.animationScenes?.[mode] || null;
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

    function updateUnitLabels() {
        const unitLabels = resolveTelemetryUnitLabels(metricUnitMode);
        const distanceNodes = document.querySelectorAll(".stats-unit-distance");
        for (const node of distanceNodes) {
            node.textContent = unitLabels.distance;
        }
        const speedNodes = document.querySelectorAll(".stats-unit-speed");
        for (const node of speedNodes) {
            node.textContent = unitLabels.speed;
        }

        const kmButton = document.getElementById("stats-unit-km");
        const milesButton = document.getElementById("stats-unit-miles");
        if (kmButton) {
            const active = metricUnitMode === UNIT_MODE_KM;
            kmButton.classList.toggle("is-active", active);
            kmButton.setAttribute("aria-pressed", active ? "true" : "false");
        }
        if (milesButton) {
            const active = metricUnitMode === UNIT_MODE_MILES;
            milesButton.classList.toggle("is-active", active);
            milesButton.setAttribute("aria-pressed", active ? "true" : "false");
        }

        const mobileKmButton = document.getElementById("mobile-unit-km");
        const mobileMilesButton = document.getElementById("mobile-unit-miles");
        if (mobileKmButton) {
            const active = metricUnitMode === UNIT_MODE_KM;
            mobileKmButton.classList.toggle("is-active", active);
            mobileKmButton.setAttribute("aria-pressed", active ? "true" : "false");
        }
        if (mobileMilesButton) {
            const active = metricUnitMode === UNIT_MODE_MILES;
            mobileMilesButton.classList.toggle("is-active", active);
            mobileMilesButton.setAttribute("aria-pressed", active ? "true" : "false");
        }
    }

    function renderTelemetry() {
        const telemetryDisplayModel = buildTelemetryDisplayModel({
            telemetry: telemetrySnapshot,
            primaryBody: telemetryPrimaryBody,
            angleDegrees: computeEarthCraftMoonAngleDegrees(sceneStateSnapshot),
            unitMode: metricUnitMode,
            formatMetric,
        });
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
    }

    function setMetricUnitMode(nextMode) {
        if (nextMode !== UNIT_MODE_KM && nextMode !== UNIT_MODE_MILES) {
            return;
        }
        if (metricUnitMode === nextMode) {
            return;
        }
        metricUnitMode = nextMode;
        updateUnitLabels();
        renderTelemetry();
    }

    function ensureUnitControlsBound() {
        if (unitControlsBound) {
            return;
        }
        const kmButton = document.getElementById("stats-unit-km");
        const milesButton = document.getElementById("stats-unit-miles");
        const mobileKmButton = document.getElementById("mobile-unit-km");
        const mobileMilesButton = document.getElementById("mobile-unit-miles");
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
        updateUnitLabels();
    }

    function clearActiveEventButtonHighlight() {
        if (highlightedEventButton) {
            highlightedEventButton.classList.remove(ACTIVE_EVENT_BUTTON_CLASS);
            highlightedEventButton = null;
        }
    }

    function resolveButtonForActiveEvent(activeEvent) {
        const buttons = Array.from(document.querySelectorAll("#burnbuttons button[data-event-key]"));
        if (!buttons.length) return null;
        const matchedIndex = resolveActiveEventButtonMatchIndex({
            activeEvent,
            buttonDescriptors: buttons.map((button) => ({
                eventKey: button?.dataset?.eventKey || "",
                label: button?.textContent || "",
                title: button?.getAttribute("title") || "",
            })),
        });
        return matchedIndex === null ? null : buttons[matchedIndex] || null;
    }

    function updateActiveEventButtonHighlight(activeEvent) {
        if (!activeEvent) {
            clearActiveEventButtonHighlight();
            return;
        }

        const button = resolveButtonForActiveEvent(activeEvent);
        if (!button) {
            clearActiveEventButtonHighlight();
            return;
        }

        if (button === highlightedEventButton) {
            return;
        }

        clearActiveEventButtonHighlight();
        button.classList.add(ACTIVE_EVENT_BUTTON_CLASS);
        highlightedEventButton = button;
        if (typeof button.scrollIntoView === "function") {
            button.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center",
            });
        }
    }

    function updateTelemetry(sceneState, primaryBody, config = null, animTime = null) {
        ensureUnitControlsBound();
        telemetryPrimaryBody = primaryBody;
        telemetrySnapshot = sceneState?.telemetry || null;
        sceneStateSnapshot = sceneState || null;
        if (config && typeof window !== "undefined" && window.animationScenes?.[config]) {
            window.animationScenes[config].latestSceneState = sceneState || null;
        }
        groundTrackPanelActions.update({
            sceneState,
            config,
            animTime: Number.isFinite(animTime) ? animTime : Date.now(),
        });
        renderTelemetry();
    }

    function updatePhaseIndicator(sceneState, globalConfig) {
        const phaseIndicatorModel = buildPhaseIndicatorModel({
            phase: sceneState?.phase,
            isLunarMission: !!(globalConfig && globalConfig.is_lunar),
        });

        for (const phaseEntry of phaseIndicatorModel.desktopPhases) {
            d3.select(`#${phaseEntry.id}`).html(
                phaseEntry.isActive
                    ? `<b><u>${phaseEntry.label}</u></b>`
                    : phaseEntry.label,
            );
        }
        setMobileText("mobile-mission-phase", phaseIndicatorModel.mobilePhaseText);
    }

    function updateActiveEvent(sceneState) {
        const activeEventUiState = planActiveEventUiState({
            activeEvent: sceneState.activeEvent,
            currentTimeMs: sceneState?.time,
        });
        if (activeEventUiState.hasActiveEvent) {
            if (activeEventUiState.showBurnIndicator && !activeEventVisible) {
                d3.select("#burng").style("visibility", "visible");
                activeEventVisible = true;
            }
            if (!activeEventUiState.showBurnIndicator && activeEventVisible) {
                d3.select("#burng").style("visibility", "hidden");
                activeEventVisible = false;
            }
            updateEventInfo(activeEventUiState.eventText);
            setMobileText("mobile-mission-event", activeEventUiState.mobileEventText);
            updateActiveEventButtonHighlight(sceneState.activeEvent);
            return;
        }

        if (activeEventVisible) {
            d3.select("#burng").style("visibility", "hidden");
            activeEventVisible = false;
        }
        clearEventInfo();
        setMobileText("mobile-mission-event", "No active event");
        clearActiveEventButtonHighlight();
    }

    return {
        updateTelemetry,
        updatePhaseIndicator,
        updateActiveEvent,
    };
}

export { createSceneUiUpdateActions };
