import {
    ensureIndeterminateProgressBar,
    hideElementById,
    readCheckedRadioValue,
    showElementById,
} from "../ui/dom-helpers.js";

export function createDimensionActions({
    d3,
    getConfig,
    animationScenes,
    getCurrentDimension,
    setCurrentDimension,
    getPreviousDimension,
    setPreviousDimension,
    setDimensionChanged,
    getDimensionChanged,
    setSvgContainer,
    initSVG,
    loadOrbitDataIfNeededAndProcess,
    handleDimensionSwitch,
    handlePlaneChange,
    setLocation,
    adjustLabelLocations,
    getStartLandingFlag,
    clearStartLandingFlag,
    toggleLanding,
    updateProgressLabel,
}) {
    function setDimension(init_flag = false) {
        const val = readCheckedRadioValue("dimension", getCurrentDimension());
        setCurrentDimension(val);

        if (getCurrentDimension() !== getPreviousDimension()) {
            setDimensionChanged(true);
        }

        const config = getConfig();

        if (val === "3D") {
            // Clean up SVG when switching to 3D mode
            d3.select("svg").remove();
            setSvgContainer(null);

            const scene = animationScenes[config];
            if (!scene.initialized3D) {
                const msg = "Loading 3D data. This may take a while. Please wait ...";
                ensureIndeterminateProgressBar("progressbar");
                showElementById("progressbar");
                updateProgressLabel(msg);

                scene.processOrbitVectorsData3D();
                scene.processLandingVectors();

                scene.init3d(function () {
                    hideElementById("progressbar");
                    handleDimensionSwitch(val);
                    handlePlaneChange(getDimensionChanged(), init_flag);
                    setLocation();
                    if (getStartLandingFlag()) {
                        clearStartLandingFlag();
                        toggleLanding();
                    }
                });
            } else {
                handleDimensionSwitch(val);
                handlePlaneChange(getDimensionChanged(), init_flag);
                setLocation();
                if (getStartLandingFlag()) {
                    clearStartLandingFlag();
                    toggleLanding();
                }
            }
        } else {
            initSVG();
            loadOrbitDataIfNeededAndProcess(function () {
                if (getCurrentDimension() !== "2D") return;
                handleDimensionSwitch(val);
                handlePlaneChange(getDimensionChanged(), init_flag);
                setLocation();
                adjustLabelLocations();
                if (getStartLandingFlag()) {
                    clearStartLandingFlag();
                    toggleLanding();
                }
            });
        }

        setDimensionChanged(false);
        setPreviousDimension(getCurrentDimension());
    }

    return { setDimension };
}

