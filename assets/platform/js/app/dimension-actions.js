import {
    ensureIndeterminateProgressBar,
    hideElementById,
    readCheckedRadioValue,
    showElementById,
} from "../ui/dom-helpers.js";
import { planDimensionTransition } from "../core/domain/ui-transition-plan.js";

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
        const transitionPlan = planDimensionTransition({
            requestedDimension: readCheckedRadioValue("dimension", getCurrentDimension()),
            previousDimension: getPreviousDimension(),
        });
        setCurrentDimension(transitionPlan.nextCurrentDimension);

        if (transitionPlan.dimensionChanged) {
            setDimensionChanged(true);
        }

        const config = getConfig();

        if (transitionPlan.is3D) {
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
                    handleDimensionSwitch(transitionPlan.requestedDimension);
                    handlePlaneChange(getDimensionChanged(), init_flag);
                    setLocation();
                    if (getStartLandingFlag()) {
                        clearStartLandingFlag();
                        toggleLanding();
                    }
                });
            } else {
                handleDimensionSwitch(transitionPlan.requestedDimension);
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
                handleDimensionSwitch(transitionPlan.requestedDimension);
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
        setPreviousDimension(transitionPlan.nextPreviousDimension);
    }

    return { setDimension };
}
