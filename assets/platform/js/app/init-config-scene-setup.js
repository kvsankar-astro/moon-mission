function createInitConfigSceneSetupActions(deps) {
    const {
        PC,
        windowRef,
        animationScenes,
        animation3DControllers,
        animation2DControllers,
        AnimationScene,
        Animation3DController,
        Animation2DController,
        planetProperties,
        showPlanet,
        computeSVGDimensions,
        getSvgWidth,
        getSvgHeight,
        setPixelsPerAU,
        setDefaultCameraDistance,
        setTrackWidth,
        setEarthRadius,
        setMoonRadius,
        setStartTime,
        setEndTime,
        setEndTimeSC,
        setLatestEndTime,
        setTimelineTotalSteps,
        setTicksPerAnimationStep,
        setEpochJD,
        setEpochDate,
        getStartAndEndTimes,
        animationController,
        resolveOrbitUrls,
        resolveOrbitNpzUrl,
        handleModeSwitchToGeo,
        handleModeSwitchToLunar,
        setRelativeOrbitUrls,
    } = deps;

    function ensureSceneAndControllers(sceneConfig) {
        if (!animationScenes[sceneConfig]) {
            animationScenes[sceneConfig] = new AnimationScene(sceneConfig);
            animation3DControllers[sceneConfig] = new Animation3DController(sceneConfig, animationScenes[sceneConfig]);
            animation2DControllers[sceneConfig] = new Animation2DController(sceneConfig, {
                planetProperties,
                showPlanet,
            });
        }
        return animationScenes[sceneConfig];
    }

    function applySceneScale({ moonScale = 1.0 } = {}) {
        computeSVGDimensions();

        const pixelsPerAu = Math.min(getSvgWidth(), getSvgHeight()) / (1.2 * (2 * PC.EARTH_MOON_DISTANCE_MEAN_AU));
        setPixelsPerAU(pixelsPerAu);
        setDefaultCameraDistance(2 * PC.EARTH_MOON_DISTANCE_MEAN_AU * pixelsPerAu);
        setTrackWidth(0.6);
        setEarthRadius((PC.EARTH_RADIUS_KM / PC.KM_PER_AU) * pixelsPerAu);
        setMoonRadius((PC.MOON_RADIUS_KM / PC.KM_PER_AU) * pixelsPerAu * moonScale);
    }

    function applyOrbitConfig({ configData, sceneConfig, scene }) {
        const spacecraftMnemonic = configData?.spacecraft_mnemonic || "SC";
        if (configData && configData[sceneConfig]) {
            const cfg = configData[sceneConfig];
            scene.planetsForOrbits = cfg.planets;
            scene.planetsForLocations = cfg.planets;
            scene.stepDurationInMilliSeconds = cfg.step_size_in_seconds * 1000;

            const orbitUrls = resolveOrbitUrls(configData, sceneConfig);
            if (orbitUrls) {
                scene.orbitsJson = orbitUrls.orbitsJson;
                scene.orbitsCheb = orbitUrls.orbitsCheb;
            }
            const orbitNpz = resolveOrbitNpzUrl(configData, sceneConfig);
            if (orbitNpz) {
                scene.orbitsNpz = orbitNpz;
            }
        }

        return spacecraftMnemonic;
    }

    function applyTimelineConfig({ scene, spacecraftMnemonic }) {
        const start = getStartAndEndTimes("EARTH")[0];
        const end = getStartAndEndTimes("EARTH")[1];
        const endSc = getStartAndEndTimes(spacecraftMnemonic)[1];

        setStartTime(start);
        setEndTime(end);
        setEndTimeSC(endSc);
        setLatestEndTime(end);
        setTimelineTotalSteps((end - start) / scene.stepDurationInMilliSeconds);
        setTicksPerAnimationStep(1);

        animationController.configure({
            startTime: start,
            endTime: end,
            stepDurationMs: scene.stepDurationInMilliSeconds,
            stepsPerHop: scene.stepsPerHop,
        });

        setEpochJD("N/A");
        setEpochDate("N/A");
    }

    function configureGeoScene({ configData, isRelativeMode }) {
        const scene = ensureSceneAndControllers("geo");
        applySceneScale();

        scene.primaryBody = "EARTH";
        scene.primaryBodyRadius = deps.getEarthRadius();
        scene.secondaryBody = "MOON";
        scene.secondaryBodyRadius = deps.getMoonRadius();

        const spacecraftMnemonic = applyOrbitConfig({
            configData,
            sceneConfig: "geo",
            scene,
        });

        if (isRelativeMode) {
            const dataPath = windowRef?.missionConfig?.dataPath;
            const relativeBase = `relative-${spacecraftMnemonic}`;
            if (typeof dataPath === "string" && dataPath.length > 0) {
                setRelativeOrbitUrls({
                    scene,
                    orbitsJson: `${dataPath}${relativeBase}.json`,
                    orbitsCheb: `${dataPath}${relativeBase}-cheb.json`,
                });
            }
        }

        scene.orbitsJsonFileSizeInBytes = 34793 * 1024;
        scene.stepsPerHop = 4;
        applyTimelineConfig({ scene, spacecraftMnemonic });
        handleModeSwitchToGeo();
    }

    function configureLunarScene({ configData }) {
        const scene = ensureSceneAndControllers("lunar");
        applySceneScale({ moonScale: 0.997 });

        scene.primaryBody = "MOON";
        scene.primaryBodyRadius = deps.getMoonRadius();
        scene.secondaryBody = "EARTH";
        scene.secondaryBodyRadius = deps.getEarthRadius();

        const spacecraftMnemonic = applyOrbitConfig({
            configData,
            sceneConfig: "lunar",
            scene,
        });

        scene.orbitsJsonFileSizeInBytes = 34800 * 1024;
        scene.stepsPerHop = 4;
        applyTimelineConfig({ scene, spacecraftMnemonic });
        handleModeSwitchToLunar();
    }

    return {
        configureGeoScene,
        configureLunarScene,
    };
}

export { createInitConfigSceneSetupActions };
