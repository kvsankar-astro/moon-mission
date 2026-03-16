export function createOrbitVectorsActions({
    d3,
    sleep,
    getSvgContainer,
    getCurrentDimension,
    getConfig,
    animationScenes,
    planetProperties,
    shouldDrawOrbit,
    chebyshevDataLoaded,
    chebyshevData,
    npzData,
    npzDataLoaded,
    getEphemerisSource,
    resolveBodySource,
    generateBodyCurve,
    getStartTime,
    getLatestEndTime,
    getZoomFactor,
    getPlaneVariables,
    planetStartTime,
    PC,
    UC,
    getPixelsPerAU,
    getEpochJD,
    getEpochDate,
    setEpochDisplay,
}) {
    async function processOrbitVectorsData() {
        // Add spacecraft orbits (2D SVG mode)

        // Only process if svgContainer exists (2D mode)
        if (!getSvgContainer()) {
            console.debug(
                "SVG container not initialized, skipping processOrbitVectorsData",
            );
            return;
        }

        const config = getConfig();

        for (let i = 0; i < animationScenes[config].planetsForLocations.length; ++i) {
            const planetKey = animationScenes[config].planetsForLocations[i];
            const planetProps = planetProperties[planetKey];

            if (shouldDrawOrbit(planetKey)) {
                if (!getSvgContainer() || getCurrentDimension() !== "2D") {
                    return;
                }

                let vectors = [];
                const stepMs = animationScenes[config].stepDurationInMilliSeconds;
                vectors =
                    typeof generateBodyCurve === "function"
                        ? generateBodyCurve({
                              bodyId: planetKey,
                              config,
                              startTimeMs: getStartTime(),
                              endTimeMs: getLatestEndTime(),
                              stepMs,
                              npzData,
                              npzDataLoaded,
                              chebyshevData,
                              chebyshevDataLoaded,
                              resolvedSource:
                                  typeof resolveBodySource === "function"
                                      ? resolveBodySource(planetKey)
                                      : typeof getEphemerisSource === "function"
                                        ? getEphemerisSource()
                                        : "chebyshev",
                              defaultSpacecraftSource:
                                  typeof getEphemerisSource === "function"
                                      ? getEphemerisSource()
                                      : "chebyshev",
                          })
                        : [];

                if (vectors.length === 0) {
                    console.warn(
                        `No orbit data available for ${planetKey} in 2D mode`,
                    );
                    continue;
                }

                const svgContainer = getSvgContainer();
                if (!svgContainer) return;

                svgContainer
                    .append("g")
                    .attr("id", "orbit-" + planetKey)
                    .attr("visibility", "visible");

                const { xFactor, yFactor, xVariable, yVariable } = getPlaneVariables();
                const zoomFactor = getZoomFactor();
                const pixelsPerAU = getPixelsPerAU();

                var line = d3.svg
                    .line()
                    .x(function (d) {
                        return (+1 * xFactor * d[xVariable]) / PC.KM_PER_AU * pixelsPerAU;
                    })
                    .y(function (d) {
                        return (-1 * yFactor * d[yVariable]) / PC.KM_PER_AU * pixelsPerAU;
                    })
                    .interpolate("cardinal-open");

                svgContainer
                    .select("#" + "orbit-" + planetKey)
                    .append("path")
                    .attr("d", line(vectors))
                    .attr(
                        "style",
                        "stroke: " +
                            planetProps.orbitcolor +
                            "; stroke-width: " +
                            1.0 / zoomFactor +
                            "; fill: none",
                    )
                    .attr("visibility", "inherit");
            }
        }

        await sleep();
        if (!getSvgContainer() || getCurrentDimension() !== "2D") {
            return;
        }

        // Add center planet - Sun/Earth/Mars/Moon
        {
            const svgContainer = getSvgContainer();
            if (!svgContainer) return;

            svgContainer
                .append("circle")
                .attr("id", animationScenes[config].primaryBody)
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", animationScenes[config].primaryBodyRadius)
                .attr("fill-opacity", "0.6")
                .attr("stroke", "none")
                .attr("stroke-width", 0)
                .attr(
                    "fill",
                    planetProperties[animationScenes[config].primaryBody].color,
                );
        }

        await sleep();
        if (!getSvgContainer() || getCurrentDimension() !== "2D") {
            return;
        }

        if (config == "geo" || config == "helio") {
            const svgContainer = getSvgContainer();
            if (!svgContainer) return;

            svgContainer
                .append("g")
                .attr("class", "label")
                .append("text")
                .attr("id", "label-" + animationScenes[config].primaryBody)
                .attr("x", UC.CENTER_LABEL_OFFSET_X)
                .attr("y", UC.CENTER_LABEL_OFFSET_Y)
                .attr("font-size", 10 / getZoomFactor())
                .attr(
                    "fill",
                    planetProperties[animationScenes[config].primaryBody].color,
                )
                .text(planetProperties[animationScenes[config].primaryBody].name);
        }

        await sleep();
        if (!getSvgContainer() || getCurrentDimension() !== "2D") {
            return;
        }

        if (config == "martian") {
            const svgContainer = getSvgContainer();
            if (!svgContainer) return;

            const r = (3390 / PC.KM_PER_AU) * getPixelsPerAU() / getZoomFactor();
            svgContainer
                .append("image")
                .attr("id", "mars-image")
                .attr("xlink:href", "cy3-mars-image-transparent.gif")
                .attr("x", -r)
                .attr("y", -r)
                .attr("height", 2 * r)
                .attr("width", 2 * r);
        }

        await sleep();
        if (!getSvgContainer() || getCurrentDimension() !== "2D") {
            return;
        }

        // Add planetary positions
        for (let i = 0; i < animationScenes[config].planetsForLocations.length; ++i) {
            const planetKey = animationScenes[config].planetsForLocations[i];
            const planetProps = planetProperties[planetKey];

            // If a planet location is avialable only after an interval of time from the epoch (startTime)
            // For example, Maven and the Mars Orbiter Mission were launched at different times.
            // The "offset" vallue is to take care of such scenarios.

            const planetIndexOffset =
                (planetStartTime(planetKey) - getStartTime()) /
                animationScenes[config].stepDurationInMilliSeconds;
            planetProperties[planetKey].offset = planetIndexOffset;

            const svgContainer = getSvgContainer();
            if (!svgContainer) return;

            svgContainer
                .append("circle")
                .attr("id", planetKey)
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", planetProps.r / getZoomFactor())
                .attr("stroke", "none")
                .attr("stroke-width", 0)
                .attr("fill", planetProps.color);
        }

        await sleep();
        if (!getSvgContainer() || getCurrentDimension() !== "2D") {
            return;
        }

        // Add fire
        {
            const svgContainer = getSvgContainer();
            if (!svgContainer) return;

            svgContainer
                .append("g")
                .attr("id", "burng")
                .style("visibility", "hidden")
                .append("polygon")
                .attr("id", "burn")
                .attr("points", "3 9 3 -9 45 0")
                .attr("fill", "red");
        }

        await sleep();
        if (!getSvgContainer() || getCurrentDimension() !== "2D") {
            return;
        }

        // Add labels
        {
            const svgContainer = getSvgContainer();
            if (!svgContainer) return;

            svgContainer.append("g").attr("id", "labels").attr("class", "label");
        }

        for (let i = 0; i < animationScenes[config].planetsForLocations.length; ++i) {
            const planetKey = animationScenes[config].planetsForLocations[i];
            const planetProps = planetProperties[planetKey];

            d3.select("#labels")
                .append("text")
                .attr("id", "label-" + planetKey)
                .attr("x", 0)
                .attr("y", 0)
                .attr("font-size", 10 / getZoomFactor())
                .attr("fill", planetProps.color);

            d3.select("#label-" + planetKey).text(planetProps.name);
        }

        await sleep();
        if (!getSvgContainer() || getCurrentDimension() !== "2D") {
            return;
        }

        if (config == "geo") {
            // Add Greenwich longitude
            const svgContainer = getSvgContainer();
            if (!svgContainer) return;

            svgContainer
                .append("line")
                .attr("id", "Greenwich")
                .attr("class", "geo")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 0)
                .attr("y2", 0)
                .attr(
                    "style",
                    "stroke: DarkGray; stroke-opacity: 0.5; stroke-width: " +
                        0.5 / getZoomFactor(),
                )
                .attr("visibility", "inherit");
        }

        await sleep();

        setEpochDisplay({ epochJD: getEpochJD(), epochDate: getEpochDate() });
    }

    return { processOrbitVectorsData };
}
