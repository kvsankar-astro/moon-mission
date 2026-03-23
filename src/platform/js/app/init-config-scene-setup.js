import {
    applyModeSwitchForPhase,
    resolvePhaseDescriptor,
} from "../core/domain/phase-compat.js";

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
        getEarthRadius,
        getMoonRadius,
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
        resolveOrbitSunChebyshevUrl,
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
            const orbitSunCheb = resolveOrbitSunChebyshevUrl(configData, sceneConfig);
            if (orbitSunCheb) {
                scene.orbitsSunCheb = orbitSunCheb;
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

    function configureSceneForPhase({ phaseKey, configData, isRelativeMode = false }) {
        const scene = ensureSceneAndControllers(phaseKey);
        const descriptor = resolvePhaseDescriptor(phaseKey, configData);
        applySceneScale({ moonScale: descriptor.moonScale });

        scene.primaryBody = descriptor.primaryBody;
        scene.primaryBodyRadius = descriptor.primaryBody === "MOON"
            ? getMoonRadius()
            : getEarthRadius();
        scene.secondaryBody = descriptor.secondaryBody;
        scene.secondaryBodyRadius = descriptor.secondaryBody === "MOON"
            ? getMoonRadius()
            : getEarthRadius();

        const spacecraftMnemonic = applyOrbitConfig({
            configData,
            sceneConfig: phaseKey,
            scene,
        });

        if (isRelativeMode && descriptor.allowRelativeOrbitOverride) {
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

        scene.orbitsJsonFileSizeInBytes = descriptor.orbitFileSizeBytes;
        scene.stepsPerHop = descriptor.stepsPerHop;
        applyTimelineConfig({ scene, spacecraftMnemonic });
        applyModeSwitchForPhase({
            phaseKey,
            globalConfig: configData,
            switchToGeo: handleModeSwitchToGeo,
            switchToLunar: handleModeSwitchToLunar,
        });
    }

    return {
        configureSceneForPhase,
    };
}

export { createInitConfigSceneSetupActions };
