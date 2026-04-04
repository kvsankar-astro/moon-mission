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
        computeSVGDimensions,
        getSvgWidth,
        getSvgHeight,
        getSceneHandler,
    } = deps;

    function showWhatsNew() {
        const dialogApi = windowRef.MissionDialog || windowRef.CY3Dialog;
        if (dialogApi?.open) {
            dialogApi.open("#dialog-whatsnew");
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
            const response = await fetch(metaFileName, { cache: "no-store" });
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

    function resolveViewportSize() {
        const width = Number(getSvgWidth?.());
        const height = Number(getSvgHeight?.());
        const resolvedWidth = Number.isFinite(width) && width > 0
            ? width
            : Number(windowRef?.innerWidth) || 1;
        const resolvedHeight = Number.isFinite(height) && height > 0
            ? height
            : Number(windowRef?.innerHeight) || 1;

        return { width: resolvedWidth, height: resolvedHeight };
    }

    function updateSceneAspect(scene, width, height) {
        if (!scene || !Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
            return;
        }

        scene.width = width;
        scene.height = height;

        if (scene.cameraController?.updateAspect) {
            scene.cameraController.updateAspect(width, height);
        } else if (scene.camera?.updateProjectionMatrix) {
            scene.camera.aspect = width / height;
            scene.camera.updateProjectionMatrix();
        }

        if (scene.skyContainer?.position && scene.camera?.position) {
            scene.skyContainer.position.copy(scene.camera.position);
        }
    }

    function onWindowResize() {
        computeSVGDimensions?.();
        const { width, height } = resolveViewportSize();

        const sceneHandler = getSceneHandler?.();
        if (sceneHandler?.renderer?.setSize) {
            sceneHandler.renderer.setSize(width, height);
        }

        const scenes = getAnimationScenes?.();
        if (scenes && typeof scenes === "object") {
            for (const scene of Object.values(scenes)) {
                updateSceneAspect(scene, width, height);
            }
        }

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
