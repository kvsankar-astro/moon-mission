function createMissionBridgeActions(deps) {
    const {
        windowRef,
        showElementById,
        computeMoonUiPatch,
        applyMoonUiPatch,
        computeLandingUiPatch,
        applyLandingUiPatch,
        setChecked,
        getGlobalConfig,
        getConfig,
        setConfig,
        getLandingFlag,
        setLandingFlag,
        getCraftScaleActions,
        getSceneFrameOrchestrationActions,
        render,
        adjustSceneCameraProjectionAndSky,
        getAnimationScenes,
    } = deps;

    function showWhatsNew() {
        if (windowRef.CY3Dialog?.open) {
            windowRef.CY3Dialog.open("#dialog-whatsnew");
        } else {
            showElementById("dialog-whatsnew");
        }
    }

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function wait10() {
        return wait(10);
    }

    function wait20() {
        return wait(20);
    }

    async function sleep() {
        return new Promise(requestAnimationFrame);
    }

    async function fetchMetadata(baseFileName) {
        const baseName = baseFileName.replace(/-cheb\.json$/, "").replace(/\.json$/, "");
        const metaFileName = `${baseName}-meta.json`;
        try {
            const response = await fetch(metaFileName);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn(`No metadata file found: ${metaFileName}, using defaults`);
        }
        return null;
    }

    function updateMoonUIFromConfig() {
        const patch = computeMoonUiPatch({
            globalConfig: getGlobalConfig(),
            currentConfig: getConfig(),
        });

        applyMoonUiPatch({
            setChecked,
            patch,
            setConfig,
        });
    }

    function updateLandingUIFromConfig() {
        const patch = computeLandingUiPatch({
            globalConfig: getGlobalConfig(),
            landingFlag: getLandingFlag(),
        });

        applyLandingUiPatch({
            setChecked,
            patch,
            setLandingFlag,
        });
    }

    function updateCraftScale() {
        getCraftScaleActions().updateCraftScale();
    }

    function cameraControlsCallbackShim() {
        getCraftScaleActions().cameraControlsCallback();
    }

    function onWindowResize() {
        render();
    }

    function showPlanet() {
        return true;
    }

    function setLocation() {
        getSceneFrameOrchestrationActions().setLocation();
    }

    function adjustCameraProjectionMatrixAndSkyAngle() {
        adjustSceneCameraProjectionAndSky({
            scene: getAnimationScenes()[getConfig()],
            cameraControlsCallback: cameraControlsCallbackShim,
        });
    }

    return {
        showWhatsNew,
        wait,
        wait10,
        wait20,
        sleep,
        fetchMetadata,
        updateMoonUIFromConfig,
        updateLandingUIFromConfig,
        updateCraftScale,
        cameraControlsCallback: cameraControlsCallbackShim,
        onWindowResize,
        showPlanet,
        setLocation,
        adjustCameraProjectionMatrixAndSkyAngle,
    };
}

export { createMissionBridgeActions };
