export function createOrbitProcessActions({
    d3,
    d3SelectAll,
    hideElementById,
    clearProgressLabel,
    updateConfigFromMetadata,
    getCurrentDimension,
    processOrbitVectorsData,
    sleep,
    getSvgWidth,
    getSvgHeight,
    setSvgRect,
    getOffsetX,
    getOffsetY,
    getPanX,
    getPanY,
    getZoomFactor,
    handleZoom,
    zoomEnd,
    getMissionStartCalled,
    missionStart,
    getAnimationRunning,
    updateAnimateButtonText,
    zoomChangeTransform,
    getConfig,
    orbitDataProcessed,
}) {
    async function processOrbitData() {
        // console.log("processOrbitData() called");

        // Update configuration from metadata if available
        updateConfigFromMetadata();

        // Only process SVG orbit vectors in 2D mode
        if (getCurrentDimension() === "2D") {
            await processOrbitVectorsData();
        }
        await sleep();

        // TODO d3v7 handling
        // var zoom = d3.zoom().on("zoom", handleZoom).on("end", zoomEnd);

        // console.log("offsetx = " + offsetx + ", panx = " + panx + ", offsety = " + offsety + ", pany = " + pany);

        // Only create SVG rect in 2D mode
        if (getCurrentDimension() === "2D") {
            const svgRect = d3
                .select("#svg")
                .append("rect")
                .attr("id", "svg-rect")
                .attr("point-events", "all")
                .attr("class", "overlay")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", getSvgWidth())
                .attr("height", getSvgHeight())
                .attr(
                    "style",
                    "fill:none;stroke:black;stroke-width:0;fill-opacity:0;stroke-opacity:0",
                )
                // .attr("class", "background")
                .call(
                    d3
                        .behavior.zoom()
                        .translate([getOffsetX() + getPanX(), getOffsetY() + getPanY()])
                        .scale(getZoomFactor())
                        .on("zoom", handleZoom)
                        .on("zoomend", zoomEnd),
                );

            setSvgRect(svgRect);
        }

        // TODO d3v7 way of zoom
        // svgRect = d3.select("#svg")
        //     .append("rect")
        //         .attr("id", "svg-rect")
        //         .attr("class", "overlay")
        //         .attr("x", 0)
        //         .attr("y", 0)
        //         .attr("width", svgWidth)
        //         .attr("height", svgHeight)
        //         .attr("style", "fill:none;stroke:black;stroke-width:0;fill-opacity:0;stroke-opacity:0")
        //         // .attr("class", "background");
        //         .zoom(zoom);
        //
        // TODO handle error with d3v7
        // d3.select("#svg-rect").call(zoom
        //     .translateBy(offsetx+panx, offsety+pany)
        //     .scaleBy(zoomFactor)
        //     );
        //
        // svgRect = d3.select("#svg")
        //     .append("rect")
        //         .attr("id", "svg-rect")
        //         .attr("class", "overlay")
        //         .attr("x", 0)
        //         .attr("y", 0)
        //         .attr("width", svgWidth)
        //         .attr("height", svgHeight)
        //         .attr("style", "fill:none;stroke:black;stroke-width:0;fill-opacity:0;stroke-opacity:0")
        //         // .attr("class", "background")
        //         .call(zoom.transform,
        //             d3.zoomIdentity
        //             .translate([offsetx+panx, offsety+pany])
        //             .call(zoom.transform,
        //                 d3.zoomIdentity
        //             .scale(zoomFactor)
        //             .on("zoom", zoom)
        //             .on("zoomend", zoomEnd)));

        if (!getMissionStartCalled()) {
            missionStart();
        }
        d3SelectAll("button").attr("disabled", null);

        if (!getAnimationRunning()) {
            updateAnimateButtonText();
        }

        zoomChangeTransform(0);

        orbitDataProcessed[getConfig()] = true;

        // console.log("processOrbitData() returning");
    }

    return { processOrbitData };
}
