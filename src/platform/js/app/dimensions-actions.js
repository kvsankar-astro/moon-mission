export function computeSceneDimensions({ svgWidth, svgHeight }) {
    return { width: svgWidth, height: svgHeight };
}

export function createDimensionsActions({
    computeSVGDimensions,
    getSvgWidth,
    getSvgHeight,
}) {
    function computeDimensions(scene) {
        computeSVGDimensions();

        const dims = computeSceneDimensions({
            svgWidth: getSvgWidth(),
            svgHeight: getSvgHeight(),
        });
        scene.width = dims.width;
        scene.height = dims.height;
    }

    return { computeDimensions };
}

