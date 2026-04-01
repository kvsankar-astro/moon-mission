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

    function setMetricText(selector, value) {
        d3.select(selector).text(Number.isFinite(value) ? formatMetric(value) : "");
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
        if (sceneState.telemetry) {
            const tel = sceneState.telemetry;

            setMetricText(`#distance-SC-${primaryBody}`, tel.distancePrimary);
            setMetricText(`#altitude-SC-${primaryBody}`, tel.altitudePrimary);
            setMetricText(`#velocity-SC-${primaryBody}`, tel.velocityPrimary);

            const hasMoonSecondary = tel.distanceMoon !== undefined && tel.distanceMoon !== null;
            const hasEarthSecondary = tel.distanceEarth !== undefined && tel.distanceEarth !== null;

            // Always write both panels each frame so stale values never linger.
            if (hasMoonSecondary) {
                setMetricText("#distance-SC-MOON", tel.distanceMoon);
                setMetricText("#altitude-SC-MOON", tel.altitudeMoon);
                setMetricText("#velocity-SC-MOON", tel.velocityMoon);
            } else if (primaryBody === "MOON") {
                setMetricText("#distance-SC-MOON", tel.distancePrimary);
                setMetricText("#altitude-SC-MOON", tel.altitudePrimary);
                setMetricText("#velocity-SC-MOON", tel.velocityPrimary);
            } else {
                setMetricText("#distance-SC-MOON", null);
                setMetricText("#altitude-SC-MOON", null);
                setMetricText("#velocity-SC-MOON", null);
            }

            if (hasEarthSecondary) {
                setMetricText("#distance-SC-EARTH", tel.distanceEarth);
                setMetricText("#altitude-SC-EARTH", tel.altitudeEarth);
                setMetricText("#velocity-SC-EARTH", tel.velocityEarth);
            } else if (primaryBody === "EARTH") {
                setMetricText("#distance-SC-EARTH", tel.distancePrimary);
                setMetricText("#altitude-SC-EARTH", tel.altitudePrimary);
                setMetricText("#velocity-SC-EARTH", tel.velocityPrimary);
            } else {
                setMetricText("#distance-SC-EARTH", null);
                setMetricText("#altitude-SC-EARTH", null);
                setMetricText("#velocity-SC-EARTH", null);
            }
            return;
        }

        setMetricText("#distance-SC-EARTH", null);
        setMetricText("#altitude-SC-EARTH", null);
        setMetricText("#velocity-SC-EARTH", null);
        setMetricText("#distance-SC-MOON", null);
        setMetricText("#altitude-SC-MOON", null);
        setMetricText("#velocity-SC-MOON", null);
    }

    function updatePhaseIndicator(sceneState, globalConfig) {
        if (!globalConfig || !globalConfig.is_lunar) return;

        d3.select("#phase-1").html("Earth Bound Phase");
        d3.select("#phase-2").html("Lunar Bound Phase");
        d3.select("#phase-3").html("Lunar Orbit Phase");

        if (sceneState.phase === "earth-bound") {
            d3.select("#phase-1").html("<b><u>Earth Bound Phase</u></b>");
        } else if (sceneState.phase === "lunar-bound") {
            d3.select("#phase-2").html("<b><u>Lunar Bound Phase</u></b>");
        } else if (sceneState.phase === "lunar-orbit") {
            d3.select("#phase-3").html("<b><u>Lunar Orbit Phase</u></b>");
        }
    }

    function updateActiveEvent(sceneState) {
        if (sceneState.activeEvent) {
            if (!activeEventVisible) {
                d3.select("#burng").style("visibility", "visible");
                activeEventVisible = true;
            }
            updateEventInfo(sceneState.activeEvent.infoText || sceneState.activeEvent.label || "");
            updateActiveEventButtonHighlight(sceneState.activeEvent);
            return;
        }

        if (activeEventVisible) {
            d3.select("#burng").style("visibility", "hidden");
            activeEventVisible = false;
        }
        clearEventInfo();
        clearActiveEventButtonHighlight();
    }

    return {
        updateTelemetry,
        updatePhaseIndicator,
        updateActiveEvent,
    };
}

export { createSceneUiUpdateActions };
