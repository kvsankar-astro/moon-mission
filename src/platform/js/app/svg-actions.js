import { UI_CONSTANTS as UC } from "../core/constants.js";

export function createSvgActions({
    d3,
    getConfig,
    getCurrentDimension,
    setSvgContainer,
    setDataLoaded,
    setSvgX,
    setSvgY,
    setSvgWidth,
    setSvgHeight,
    setOffsetX,
    setOffsetY,
    getOffsetX,
    getOffsetY,
    updateProgressLabel,
}) {
    function getDockedMainViewRect() {
        const surface = document.getElementById("mission-main-view-surface");
        const rect = surface?.getBoundingClientRect?.() || null;
        if (!rect || rect.width <= 1 || rect.height <= 1) {
            return null;
        }
        return rect;
    }

    function computeSVGDimensions() {
        const dockedRect = getDockedMainViewRect();
        const panelWidth = Math.max(1, Math.round(dockedRect?.width || 0));
        const panelHeight = Math.max(1, Math.round(dockedRect?.height || 0));
        const width = dockedRect
            ? panelWidth
            : Math.max(1, Math.round(Number(window.innerWidth) || 1));
        const height = dockedRect
            ? panelHeight
            : Math.max(1, Math.round(Number(window.innerHeight) || 1));
        setSvgX(0);
        const baseline = document.getElementById("svg-top-baseline");
        setSvgY(baseline ? baseline.getBoundingClientRect().top : 0);
        setSvgWidth(width);
        setSvgHeight(height);
        setOffsetX(width * (1 / 2) - UC.SVG_ORIGIN_X);
        setOffsetY(height * (1 / 2) - UC.SVG_ORIGIN_Y);
    }

    function initSVG() {
        d3.select("#svg-wrapper > svg").remove();

        computeSVGDimensions();

        const config = getConfig();
        const currentDimension = getCurrentDimension();
        const offsetX = getOffsetX();
        const offsetY = getOffsetY();

        const svgContainer = d3
            .select("#svg-wrapper")
            .attr("class", config + " dimension-2D")
            .append("svg")
            .attr("id", "svg")
            .attr("overflow", "visible")
            .attr("class", "dimension-2D")
            .attr("display", currentDimension === "2D" ? "block" : "none")
            .style("visibility", currentDimension === "2D" ? "visible" : "hidden")
            .append("g")
            .attr("transform", "translate(" + offsetX + ", " + offsetY + ")");

        setSvgContainer(svgContainer);

        updateProgressLabel("Loading orbit data ...");
        setDataLoaded(false);
    }

    return { computeSVGDimensions, initSVG };
}
