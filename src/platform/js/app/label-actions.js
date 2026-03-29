import { resolveMissionCraft } from "../core/domain/mission-config.js";

export function createLabelActions({
    d3,
    Astronomy,
    getCurrentDimension,
    getConfig,
    animationScenes,
    planetProperties,
    showPlanet,
    isLocationAvaialable,
    getAnimTime,
    getBodyLocation,
    PC,
    UC,
    getPixelsPerAU,
    getZoomFactor,
    getXFactor,
    getYFactor,
    getXVariable,
    getYVariable,
    getCraftData,
    getGlobalConfig,
}) {
    const readGlobalConfig =
        typeof getGlobalConfig === "function"
            ? getGlobalConfig
            : () => null;

    function getPlanetProps(bodyId) {
        const missionCraft = resolveMissionCraft(readGlobalConfig(), bodyId);
        if (!missionCraft) {
            return planetProperties[bodyId];
        }

        const explicitProps =
            planetProperties[missionCraft.id] ||
            planetProperties[missionCraft.mnemonic] ||
            planetProperties[bodyId];

        if (explicitProps) {
            return explicitProps;
        }

        const fallbackProps = planetProperties.SC;
        if (!fallbackProps) {
            return null;
        }

        return {
            ...fallbackProps,
            id: missionCraft.id || bodyId,
            name: missionCraft.viewLabel || missionCraft.name || missionCraft.mnemonic || bodyId,
            color: missionCraft.color || fallbackProps.color,
            orbitcolor: missionCraft.orbitcolor || missionCraft.color || fallbackProps.orbitcolor,
        };
    }

    function setLabelLocation(planetKey, bodyState = null) {
        const planetProps = getPlanetProps(planetKey);
        if (!planetProps) {
            return;
        }
        const animTime = getAnimTime();

        const isAvailable = bodyState
            ? !!bodyState.available
            : isLocationAvaialable(planetKey, animTime);

        if (isAvailable) {
            // Prefer computed state (functional core) when provided to avoid re-querying orbit data.
            let planet_pos = bodyState?.position;
            if (!planet_pos) {
                // var index = timelineIndex - planetProperties[planetKey]["offset"];
                var [posFromData, planet_vel] = getBodyLocation(planetKey, animTime);
                planet_pos = posFromData;
            }

            if (!planet_pos) {
                // Data not available, hide the label
                d3.select("#label-" + planetKey).attr("visibility", "hidden");
                return;
            }

            const zoomFactor = getZoomFactor();
            const pixelsPerAU = getPixelsPerAU();

            var x = getXFactor() * planet_pos[getXVariable()];
            var y = getYFactor() * planet_pos[getYVariable()];

            var newx = (+1 * (x / PC.KM_PER_AU)) * pixelsPerAU;
            var newy = (-1 * (y / PC.KM_PER_AU)) * pixelsPerAU;

            var labelx = newx + planetProps.labelOffsetX / zoomFactor;
            var labely = newy + planetProps.labelOffsetY / zoomFactor;

            d3.select("#label-" + planetKey)
                .attr("visibility", showPlanet(planetKey) ? "visible" : "hidden")
                .attr("x", labelx)
                .attr("y", labely)
                .attr("font-size", 10 / zoomFactor);
        } else {
            d3.select("#label-" + planetKey).attr("visibility", "hidden");
        }
    }

    function showGreenwichLongitude() {
        if (getCurrentDimension() != "2D") return;

        const config = getConfig();
        if (config == "helio") return;

        // Greenwich Apparent Sidereal Time in degrees (hours × 15)
        var mst = Astronomy.SiderealTime(new Date(getAnimTime())) * 15;

        var radialLength = (PC.EARTH_RADIUS_KM / PC.KM_PER_AU) * getPixelsPerAU();

        var x1 = 0;
        var y1 = 0;
        var x2 = +1 * radialLength * Math.cos(mst / PC.DEGREES_PER_RADIAN);
        var y2 = -1 * radialLength * Math.sin(mst / PC.DEGREES_PER_RADIAN);

        d3.select("#Greenwich").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2);
    }

    function adjustLabelLocations() {
        const config = getConfig();
        const zoomFactor = getZoomFactor();
        const pixelsPerAU = getPixelsPerAU();

        for (var i = 0; i < animationScenes[config].planetsForOrbits.length; ++i) {
            var planetKey = animationScenes[config].planetsForLocations[i];
            d3.selectAll("#orbit-" + planetKey).attr("r", 0.5 / zoomFactor);
            var strokeWidth = (getPlanetProps(planetKey)?.["stroke-width"]) ?? 1.0;
            d3.selectAll("#ellipse-orbit-" + planetKey).attr(
                "stroke-width",
                strokeWidth / zoomFactor,
            );
        }

        // d3.select("#" + primaryBody).attr("r", (primaryBodyRadius/zoomFactor));

        for (var i = 0; i < animationScenes[config].planetsForLocations.length; ++i) {
            var planetKey = animationScenes[config].planetsForLocations[i];
            setLabelLocation(planetKey);

            var planetProps = getPlanetProps(planetKey);
            if (!planetProps) {
                continue;
            }

            if (planetKey == "MOON") {
                var moonRadius = (PC.MOON_RADIUS_KM / PC.KM_PER_AU) * pixelsPerAU;
                d3.selectAll("#" + planetKey).attr(
                    "r",
                    Math.max(moonRadius, planetProps.r / zoomFactor),
                );
            } else {
                d3.selectAll("#" + planetKey).attr("r", planetProps.r / zoomFactor);
            }

            d3.select("#orbit-" + planetKey)
                .selectAll("path")
                .attr(
                    "style",
                    "stroke: " +
                        planetProps.orbitcolor +
                        "; stroke-width: " +
                        1.0 / zoomFactor +
                        "; fill: none",
                );

            d3.select("#label-" + planetKey).attr("font-size", 10 / zoomFactor);
        }

        d3.select("#Greenwich").attr(
            "style",
            "stroke: LightBlue; stroke-opacity: 0.5; " + "stroke-width: " + 0.5 / zoomFactor,
        );

        var radialLength = (PC.EARTH_RADIUS_KM / PC.KM_PER_AU) * pixelsPerAU;
        d3.select("#label-" + animationScenes[config].primaryBody).attr(
            "x",
            -1 * radialLength + UC.CENTER_LABEL_OFFSET_X / zoomFactor,
        );
        d3.select("#label-" + animationScenes[config].primaryBody).attr(
            "y",
            -1 * radialLength + UC.CENTER_LABEL_OFFSET_Y / zoomFactor,
        );

        d3.select("#label-" + animationScenes[config].primaryBody).attr(
            "font-size",
            10 / zoomFactor,
        );

        const craftData = getCraftData();
        const burnX = craftData["x"];
        const burnY = craftData["y"];
        const burnAngle = craftData["angle"];
        if (!Number.isFinite(burnX) || !Number.isFinite(burnY)) {
            return;
        }

        var transformString = `translate(${burnX}, ${burnY}) `;
        transformString += `rotate(${burnAngle || 0} 0 0) `;
        var burnZoomFactor = Math.max(0.25, zoomFactor);
        // console.log("zoomFactor = " + zoomFactor);
        transformString += `scale(${1 / burnZoomFactor} ${1 / burnZoomFactor}) `;
        d3.select("#burng").attr("transform", transformString);
    }

    return {
        adjustLabelLocations,
        setLabelLocation,
        showGreenwichLongitude,
    };
}
