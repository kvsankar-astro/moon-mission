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
    loadProgress,
}) {
    const progress =
        loadProgress &&
        typeof loadProgress.beginSessionIfNeeded === "function" &&
        typeof loadProgress.setStage === "function" &&
        typeof loadProgress.completeStage === "function" &&
        typeof loadProgress.completeSession === "function" &&
        typeof loadProgress.isActive === "function"
            ? loadProgress
            : null;

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
            d3.select("#svg-wrapper > svg").remove();
            setSvgContainer(null);

            const scene = animationScenes[config];
            if (!scene.initialized3D) {
                const msg = "Loading 3D data. This may take a while. Please wait ...";
                if (progress) {
                    progress.beginSessionIfNeeded({
                        includeLanding: true,
                        label: msg,
                    });
                    progress.setStage("scene", 0, msg);
                } else {
                    ensureIndeterminateProgressBar("progressbar");
                    showElementById("progressbar");
                    updateProgressLabel(msg);
                }

                scene.processOrbitVectorsData3D();
                scene.processLandingVectors();

                scene.init3d(function () {
                    if (progress) {
                        progress.completeStage("scene", "Preparing 3D scene ...");
                        progress.completeSession("Ready");
                    } else {
                        hideElementById("progressbar");
                    }
                    handleDimensionSwitch(transitionPlan.requestedDimension);
                    handlePlaneChange(getDimensionChanged(), init_flag);
                    setLocation();
                    if (getStartLandingFlag()) {
                        clearStartLandingFlag();
                        toggleLanding();
                    }
                });
            } else {
                if (progress && progress.isActive()) {
                    progress.completeStage("scene", "Preparing 3D scene ...");
                    progress.completeSession("Ready");
                }
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
                if (getCurrentDimension() !== "2D") {
                    if (progress && progress.isActive()) {
                        progress.completeSession("Ready");
                    }
                    return;
                }
                handleDimensionSwitch(transitionPlan.requestedDimension);
                handlePlaneChange(getDimensionChanged(), init_flag);
                setLocation();
                adjustLabelLocations();
                if (getStartLandingFlag()) {
                    clearStartLandingFlag();
                    toggleLanding();
                }
                if (progress && progress.isActive()) {
                    progress.completeStage("scene", "Preparing 2D view ...");
                    progress.completeSession("Ready");
                }
            });
        }

        setDimensionChanged(false);
        setPreviousDimension(transitionPlan.nextPreviousDimension);
    }

    return { setDimension };
}
