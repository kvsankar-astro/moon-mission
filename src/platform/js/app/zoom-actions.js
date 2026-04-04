import { requestSceneOrbitOverlapRefinement } from "./orbit-overlap-manager.js";

export function createZoomActions({
    d3,
    getSvgContainer,
    getCurrentDimension,
    animationScenes,
    getConfig,
    getGlobalConfig = () => null,
    getZoomFactor,
    setZoomFactor,
    getPanX,
    setPanX,
    getPanY,
    setPanY,
    getOffsetX,
    getOffsetY,
    adjustLabelLocations,
    showGreenwichLongitude,
    getOrbitStyle,
}) {
    const artemis2MobileFrameStateByConfig = new Map();

    function isArtemis2Mission() {
        const globalConfig = getGlobalConfig?.();
        const missionName = String(
            globalConfig?.mission_name_short ||
            globalConfig?.mission_name ||
            "",
        ).toLowerCase();
        if (missionName.includes("artemis 2") || missionName.includes("artemis ii")) {
            return true;
        }

        const dataPath = String(window?.missionConfig?.dataPath || "").toLowerCase();
        return dataPath.includes("/artemis2/") || dataPath.includes("\\artemis2\\");
    }

    function isDefaultXYScene(scene) {
        if (!scene) return false;
        return (
            scene.xVariable === "x" &&
            scene.yVariable === "y" &&
            Number(scene.xFactor) === 1 &&
            Number(scene.yFactor) === 1
        );
    }

    function maybeApplyArtemis2MobileFrame(config) {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return;
        }
        if (window.innerWidth > 600) {
            return;
        }
        if (!isArtemis2Mission()) {
            return;
        }
        if (config !== "geo") {
            return;
        }

        const scene = animationScenes[config];
        if (!isDefaultXYScene(scene)) {
            return;
        }

        const timelineDock = document.getElementById("timeline-dock");
        const timelineTop = timelineDock?.getBoundingClientRect?.().top;
        const earthNode = document.getElementById("EARTH");
        const moonClassicOrbit = document.querySelector("#orbit-MOON .orbit-classic-path");
        if (!earthNode || !moonClassicOrbit || typeof moonClassicOrbit.getBBox !== "function") {
            return;
        }

        const earthCx = Number(earthNode.getAttribute("cx"));
        const earthCy = Number(earthNode.getAttribute("cy"));
        if (!Number.isFinite(earthCx) || !Number.isFinite(earthCy)) {
            return;
        }

        let moonBBox = null;
        try {
            moonBBox = moonClassicOrbit.getBBox();
        } catch (_error) {
            return;
        }
        if (!moonBBox || !Number.isFinite(moonBBox.y) || !Number.isFinite(moonBBox.height)) {
            return;
        }

        const moonOrbitBottomY = moonBBox.y + moonBBox.height;
        const lunarSpanFromEarth = moonOrbitBottomY - earthCy;
        if (!Number.isFinite(lunarSpanFromEarth) || lunarSpanFromEarth <= 0) {
            return;
        }

        // Fine-tuned mobile framing for Artemis 2:
        // place Earth slightly higher and keep a small safety margin near bottom controls.
        const targetEarthScreenY = window.innerHeight * 0.1;
        const targetOrbitBottomY = Math.min(
            Number.isFinite(timelineTop) ? timelineTop - 12 : window.innerHeight * 0.81,
            window.innerHeight * 0.9,
        );
        const usableHeight = targetOrbitBottomY - targetEarthScreenY;
        if (!Number.isFinite(usableHeight) || usableHeight <= 20) {
            return;
        }

        const frameSignature = [
            Math.round(window.innerWidth),
            Math.round(window.innerHeight),
            Math.round(targetOrbitBottomY),
            Math.round(lunarSpanFromEarth * 10) / 10,
        ].join(":");
        if (artemis2MobileFrameStateByConfig.get(config) === frameSignature) {
            return;
        }

        const nextZoom = Math.min(8, Math.max(0.2, usableHeight / lunarSpanFromEarth));
        const nextPanX = (window.innerWidth * 0.5) - getOffsetX() - (nextZoom * earthCx);
        const nextPanY = targetEarthScreenY - getOffsetY() - (nextZoom * earthCy);

        setZoomFactor(nextZoom);
        setPanX(nextPanX);
        setPanY(nextPanY);
        artemis2MobileFrameStateByConfig.set(config, frameSignature);
    }

    function zoomChangeTransform(t) {
        // Only process in 2D mode when svgContainer exists
        const svgContainer = getSvgContainer();
        if (!svgContainer || getCurrentDimension() !== "2D") {
            return;
        }

        const config = getConfig();
        maybeApplyArtemis2MobileFrame(config);
        const zoomFactor = getZoomFactor();
        const panx = getPanX();
        const pany = getPanY();
        const offsetx = getOffsetX();
        const offsety = getOffsetY();

        var cy3x = 0;
        var cy3y = 0;

        if (animationScenes[config].lockOnSC) {
            const activeCraftId = animationScenes[config].activeCraftId || "SC";
            var scElement = d3.select("#" + activeCraftId);
            if (!scElement.empty()) {
                cy3x = parseFloat(scElement.attr("cx"));
                cy3y = parseFloat(scElement.attr("cy"));
            }
        }

        if (animationScenes[config].lockOnMoon) {
            var moonElement = d3.select("#MOON");
            if (!moonElement.empty()) {
                cy3x = parseFloat(moonElement.attr("cx"));
                cy3y = parseFloat(moonElement.attr("cy"));
            }
        }

        if (animationScenes[config].lockOnEarth) {
            var earthElement = d3.select("#EARTH");
            if (!earthElement.empty()) {
                cy3x = parseFloat(earthElement.attr("cx"));
                cy3y = parseFloat(earthElement.attr("cy"));
            }
        }

        var container = svgContainer;
        // if (t != 0) {
        //     container = svgContainer.transition().delay(t);
        // }

        container.attr(
            "transform",
            "matrix(" +
                zoomFactor +
                ", 0" +
                ", 0" +
                ", " +
                zoomFactor +
                ", " +
                (offsetx +
                    panx +
                    cy3x -
                    zoomFactor * cy3x -
                    cy3x) +
                ", " +
                (offsety +
                    pany +
                    cy3y -
                    zoomFactor * cy3y -
                    cy3y) +
                ")",
        );
        animationScenes[config].orbitSvgTransformMatrix = container.attr("transform") || "";
        requestSceneOrbitOverlapRefinement({
            scene: animationScenes[config],
            dimension: "2D",
            orbitStyle: getOrbitStyle?.() || "trail",
        });

        // var zoom = d3.zoom().on("zoom", handleZoom).on("end", adjustLabelLocations);

        // sychronize D3's state // TODO
        // svgRect && svgRect
        //     .call(zoom.transform,
        //         d3.zoomIdentity
        //         .translate([offsetx+panx, offsety+pany])
        //         .scale(zoomFactor));
    }

    function zoomChange(t) {
        zoomChangeTransform(t);
        showGreenwichLongitude();
    }

    function handleZoom(_event) {
        var x = d3.event.translate[0];
        var y = d3.event.translate[1];
        setZoomFactor(d3.event.scale);
        setPanX(x - getOffsetX());
        setPanY(y - getOffsetY());
        zoomChangeTransform();
    }

    function handleZoomNew(event) {
        // console.log(event);
        const x = event.transform.x || 0;
        const y = event.transform.y || 0;
        setZoomFactor(event.transform.k || 1);
        setPanX(x - getOffsetX());
        setPanY(y - getOffsetY());
        zoomChangeTransform();
    }

    function zoomEnd() {
        adjustLabelLocations();
    }

    return {
        handleZoom,
        handleZoomNew,
        zoomEnd,
        zoomChangeTransform,
        zoomChange,
    };
}
