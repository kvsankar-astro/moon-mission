function createSceneUiUpdateActions(deps) {
    const {
        d3,
        formatMetric,
        updateEventInfo,
        clearEventInfo,
    } = deps;
    const KM_TO_MILES = 0.621371192237334;
    const KMPS_TO_MPH = 2236.9362920544;
    const UNIT_MODE_KM = "km";
    const UNIT_MODE_MILES = "miles";
    const ACTIVE_EVENT_BUTTON_CLASS = "burnbutton--active-event";
    let highlightedEventButton = null;
    let activeEventVisible = false;
    let metricUnitMode = UNIT_MODE_KM;
    let unitControlsBound = false;
    let telemetrySnapshot = null;
    let telemetryPrimaryBody = "EARTH";
    let sceneStateSnapshot = null;

    function convertDistanceValue(valueKm) {
        if (!Number.isFinite(valueKm)) return null;
        if (metricUnitMode === UNIT_MODE_MILES) {
            return valueKm * KM_TO_MILES;
        }
        return valueKm;
    }

    function convertVelocityValue(valueKmPerSec) {
        if (!Number.isFinite(valueKmPerSec)) return null;
        if (metricUnitMode === UNIT_MODE_MILES) {
            return valueKmPerSec * KMPS_TO_MPH;
        }
        return valueKmPerSec;
    }

    function setMetricText(selector, value, metricType) {
        if (!Number.isFinite(value)) {
            d3.select(selector).text("");
            return;
        }
        const converted =
            metricType === "speed"
                ? convertVelocityValue(value)
                : convertDistanceValue(value);
        d3.select(selector).text(Number.isFinite(converted) ? formatMetric(converted) : "");
    }

    function formatMetricWithUnit(value, metricType) {
        if (!Number.isFinite(value)) return "--";
        const converted =
            metricType === "speed"
                ? convertVelocityValue(value)
                : convertDistanceValue(value);
        if (!Number.isFinite(converted)) return "--";
        const unitText =
            metricType === "speed"
                ? (metricUnitMode === UNIT_MODE_MILES ? "miles/h" : "km/s")
                : (metricUnitMode === UNIT_MODE_MILES ? "miles" : "km");
        return `${formatMetric(converted)} ${unitText}`;
    }

    function setMobileText(id, text) {
        const node = document.getElementById(id);
        if (!node) return;
        node.textContent = text;
    }

    function hasFiniteVector3(vector) {
        return !!vector &&
            Number.isFinite(vector.x) &&
            Number.isFinite(vector.y) &&
            Number.isFinite(vector.z);
    }

    function computeAngleDegreesBetweenVectors(fromVertexA, fromVertexB) {
        if (!hasFiniteVector3(fromVertexA) || !hasFiniteVector3(fromVertexB)) return null;
        const aMag = Math.hypot(fromVertexA.x, fromVertexA.y, fromVertexA.z);
        const bMag = Math.hypot(fromVertexB.x, fromVertexB.y, fromVertexB.z);
        if (!Number.isFinite(aMag) || !Number.isFinite(bMag) || aMag <= 1e-9 || bMag <= 1e-9) {
            return null;
        }
        const dot = fromVertexA.x * fromVertexB.x + fromVertexA.y * fromVertexB.y + fromVertexA.z * fromVertexB.z;
        const cosine = dot / (aMag * bMag);
        if (!Number.isFinite(cosine)) return null;
        const angleRadians = Math.acos(Math.max(-1, Math.min(1, cosine)));
        if (!Number.isFinite(angleRadians)) return null;
        return angleRadians * (180 / Math.PI);
    }

    function computeEarthCraftMoonAngleFromSceneState(sceneState) {
        const scPos = sceneState?.bodies?.SC?.position;
        const earthPos = sceneState?.bodies?.EARTH?.position;
        const moonPos = sceneState?.bodies?.MOON?.position;
        if (!hasFiniteVector3(scPos) || !hasFiniteVector3(earthPos) || !hasFiniteVector3(moonPos)) {
            return null;
        }

        return computeAngleDegreesBetweenVectors(
            {
                x: earthPos.x - moonPos.x,
                y: earthPos.y - moonPos.y,
                z: earthPos.z - moonPos.z,
            },
            {
                x: scPos.x - moonPos.x,
                y: scPos.y - moonPos.y,
                z: scPos.z - moonPos.z,
            },
        );
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

    function formatAngleMetric(angleDegrees) {
        if (!Number.isFinite(angleDegrees)) return "--";
        return `${angleDegrees.toFixed(1)}°`;
    }

    function updateUnitLabels() {
        const distanceUnitText =
            metricUnitMode === UNIT_MODE_MILES
                ? "miles"
                : "km";
        const speedUnitText =
            metricUnitMode === UNIT_MODE_MILES
                ? "miles/h"
                : "km/s";
        const distanceNodes = document.querySelectorAll(".stats-unit-distance");
        for (const node of distanceNodes) {
            node.textContent = distanceUnitText;
        }
        const speedNodes = document.querySelectorAll(".stats-unit-speed");
        for (const node of speedNodes) {
            node.textContent = speedUnitText;
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

    function updateMobileTelemetry(sceneState, primaryBody, tel) {
        if (!tel) {
            setMobileText("mobile-metric-earth", "--");
            setMobileText("mobile-metric-moon", "--");
            setMobileText("mobile-metric-speed", "--");
            setMobileText("mobile-metric-angle", "--");
            return;
        }

        const earthDistance = tel.distanceEarth !== undefined && tel.distanceEarth !== null
            ? tel.distanceEarth
            : (primaryBody === "EARTH" ? tel.distancePrimary : null);
        const moonDistance = tel.distanceMoon !== undefined && tel.distanceMoon !== null
            ? tel.distanceMoon
            : (primaryBody === "MOON" ? tel.distancePrimary : null);

        setMobileText("mobile-metric-earth", formatMetricWithUnit(earthDistance, "distance"));
        setMobileText("mobile-metric-moon", formatMetricWithUnit(moonDistance, "distance"));
        setMobileText("mobile-metric-speed", formatMetricWithUnit(tel.velocityPrimary, "speed"));
        setMobileText("mobile-metric-angle", formatAngleMetric(computeEarthCraftMoonAngleDegrees(sceneState)));
    }

    function renderTelemetry() {
        const tel = telemetrySnapshot;
        const primaryBody = telemetryPrimaryBody;
        if (!tel) {
            setMetricText("#distance-SC-EARTH", null, "distance");
            setMetricText("#altitude-SC-EARTH", null, "distance");
            setMetricText("#velocity-SC-EARTH", null, "speed");
            setMetricText("#distance-SC-MOON", null, "distance");
            setMetricText("#altitude-SC-MOON", null, "distance");
            setMetricText("#velocity-SC-MOON", null, "speed");
            updateMobileTelemetry(null, primaryBody, null);
            return;
        }

        setMetricText(`#distance-SC-${primaryBody}`, tel.distancePrimary, "distance");
        setMetricText(`#altitude-SC-${primaryBody}`, tel.altitudePrimary, "distance");
        setMetricText(`#velocity-SC-${primaryBody}`, tel.velocityPrimary, "speed");

        const hasMoonSecondary = tel.distanceMoon !== undefined && tel.distanceMoon !== null;
        const hasEarthSecondary = tel.distanceEarth !== undefined && tel.distanceEarth !== null;

        // Always write both panels each frame so stale values never linger.
        if (hasMoonSecondary) {
            setMetricText("#distance-SC-MOON", tel.distanceMoon, "distance");
            setMetricText("#altitude-SC-MOON", tel.altitudeMoon, "distance");
            setMetricText("#velocity-SC-MOON", tel.velocityMoon, "speed");
        } else if (primaryBody === "MOON") {
            setMetricText("#distance-SC-MOON", tel.distancePrimary, "distance");
            setMetricText("#altitude-SC-MOON", tel.altitudePrimary, "distance");
            setMetricText("#velocity-SC-MOON", tel.velocityPrimary, "speed");
        } else {
            setMetricText("#distance-SC-MOON", null, "distance");
            setMetricText("#altitude-SC-MOON", null, "distance");
            setMetricText("#velocity-SC-MOON", null, "speed");
        }

        if (hasEarthSecondary) {
            setMetricText("#distance-SC-EARTH", tel.distanceEarth, "distance");
            setMetricText("#altitude-SC-EARTH", tel.altitudeEarth, "distance");
            setMetricText("#velocity-SC-EARTH", tel.velocityEarth, "speed");
        } else if (primaryBody === "EARTH") {
            setMetricText("#distance-SC-EARTH", tel.distancePrimary, "distance");
            setMetricText("#altitude-SC-EARTH", tel.altitudePrimary, "distance");
            setMetricText("#velocity-SC-EARTH", tel.velocityPrimary, "speed");
        } else {
            setMetricText("#distance-SC-EARTH", null, "distance");
            setMetricText("#altitude-SC-EARTH", null, "distance");
            setMetricText("#velocity-SC-EARTH", null, "speed");
        }

        updateMobileTelemetry(sceneStateSnapshot, primaryBody, tel);
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

    function normalizeText(value) {
        return typeof value === "string" ? value.trim().toLowerCase() : "";
    }

    function resolveButtonForActiveEvent(activeEvent) {
        const eventKey = typeof activeEvent?.key === "string" ? activeEvent.key : "";
        const buttons = document.querySelectorAll("#burnbuttons button[data-event-key]");
        if (!buttons.length) return null;

        if (eventKey) {
            for (const button of buttons) {
                if (button?.dataset?.eventKey === eventKey) {
                    return button;
                }
            }
        }

        const eventLabel = normalizeText(activeEvent?.label);
        const eventHoverText = normalizeText(activeEvent?.hoverText || activeEvent?.infoText);
        for (const button of buttons) {
            const buttonLabel = normalizeText(button?.textContent);
            const buttonTitle = normalizeText(button?.getAttribute("title"));
            if (eventLabel && buttonLabel === eventLabel) {
                return button;
            }
            if (eventHoverText && buttonTitle && buttonTitle === eventHoverText) {
                return button;
            }
        }
        return null;
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
    }

    function updateTelemetry(sceneState, primaryBody) {
        ensureUnitControlsBound();
        telemetryPrimaryBody = primaryBody;
        telemetrySnapshot = sceneState?.telemetry || null;
        sceneStateSnapshot = sceneState || null;
        renderTelemetry();
    }

    function updatePhaseIndicator(sceneState, globalConfig) {
        const isLunarMission = !!(globalConfig && globalConfig.is_lunar);
        if (isLunarMission) {
            d3.select("#phase-1").html("Earth Bound Phase");
            d3.select("#phase-2").html("Lunar Bound Phase");
            d3.select("#phase-3").html("Lunar Orbit Phase");
        }

        if (sceneState.phase === "earth-bound") {
            if (isLunarMission) {
                d3.select("#phase-1").html("<b><u>Earth Bound Phase</u></b>");
            }
            setMobileText("mobile-mission-phase", "Earth Bound");
        } else if (sceneState.phase === "lunar-bound") {
            if (isLunarMission) {
                d3.select("#phase-2").html("<b><u>Lunar Bound Phase</u></b>");
            }
            setMobileText("mobile-mission-phase", "Lunar Bound");
        } else if (sceneState.phase === "lunar-orbit") {
            if (isLunarMission) {
                d3.select("#phase-3").html("<b><u>Lunar Orbit Phase</u></b>");
            }
            setMobileText("mobile-mission-phase", "Lunar Orbit");
        } else {
            setMobileText("mobile-mission-phase", "--");
        }
    }

    function updateActiveEvent(sceneState) {
        if (sceneState.activeEvent) {
            if (!activeEventVisible) {
                d3.select("#burng").style("visibility", "visible");
                activeEventVisible = true;
            }
            const eventText = sceneState.activeEvent.infoText || sceneState.activeEvent.label || "";
            updateEventInfo(eventText);
            setMobileText("mobile-mission-event", eventText || "No active event");
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
