export function initSceneHandlerDom({
    d3,
    bindSettingsPanel,
    computeSVGDimensions,
    getSvgWidth,
    getSvgHeight,
    isTestMode,
    onWindowResize,
    THREE,
}) {
    computeSVGDimensions();

    const width = getSvgWidth();
    const height = getSvgHeight();

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
        renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isTestMode ? 1.0 : window.devicePixelRatio);
    renderer.setSize(width, height);

    const canvasNode = d3.select("#canvas-wrapper")[0][0].appendChild(renderer.domElement);

    window.addEventListener("resize", onWindowResize, { passive: false });

    renderer.domElement.addEventListener("dragstart", function (e) {
        e.preventDefault();
        return false;
    });

    renderer.domElement.style.userSelect = "none";
    renderer.domElement.style.webkitUserSelect = "none";
    renderer.domElement.style.MozUserSelect = "none";

    bindSettingsPanel();

    return { renderer, canvasNode };
}
