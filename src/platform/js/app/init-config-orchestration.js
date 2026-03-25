function createInitConfigOrchestrationActions(deps) {
    const {
        loadMissionConfig,
        getGlobalConfig,
        setGlobalConfig,
        setEventInfos,
        getEphemerisSource,
        setEphemerisSource,
        setBodyEphemerisSources,
        setEphemerisStatusesForConfig,
        bindInfoPanelControls,
        updateEphemerisPanel,
        applyMissionMetadata,
        getPlanetProperties,
        documentRef,
        updateMultipleElementsText,
        updateSpacecraftMnemonic,
        updateMoonUIFromConfig,
        updateLandingUIFromConfig,
        applyLandingTimesUpdate,
        computeLandingTimesUpdate,
        createUTCTimestamp,
        setStartLandingTime,
        setEndLandingTime,
        consoleRef,
        applyEventsUpdate,
        computeEventsUpdate,
        getConfig,
        getDataEndTimeMs,
        computeMissionEventTimes,
        setTimeTransLunarInjection,
        setTimeLunarOrbitInsertion,
        getSceneHandler,
        setSceneHandler,
        SceneHandlerClass,
        loadProgress,
    } = deps;
    const progress =
        loadProgress &&
        typeof loadProgress.beginSessionIfNeeded === "function" &&
        typeof loadProgress.setStage === "function" &&
        typeof loadProgress.completeStage === "function"
            ? loadProgress
            : null;

    async function ensureGlobalConfigLoaded() {
        const hasGlobalConfig = getGlobalConfig() !== null;

        if (progress) {
            const progressActive =
                typeof progress.isActive === "function" && progress.isActive();
            if (!hasGlobalConfig) {
                progress.beginSessionIfNeeded({
                    includeLanding: true,
                    label: "Loading mission configuration ...",
                });
                progress.setStage("config", 0, "Loading mission configuration ...");
            } else if (progressActive) {
                progress.completeStage("config", "Loading mission configuration ...");
            }
        }

        if (hasGlobalConfig) {
            return;
        }

        const loadedGlobalConfig = await loadMissionConfig();
        setGlobalConfig(loadedGlobalConfig);
        setEventInfos(loadedGlobalConfig?.eventInfos || []);
        setEphemerisSource(getEphemerisSource(loadedGlobalConfig));
        setBodyEphemerisSources(loadedGlobalConfig?.ephemeris_sources || {});
        const origins = loadedGlobalConfig?.origins || [];
        for (const cfg of origins) {
            setEphemerisStatusesForConfig(cfg, {});
        }
        bindInfoPanelControls();
        updateEphemerisPanel();

        if (loadedGlobalConfig) {
            applyMissionMetadata({
                globalConfig: loadedGlobalConfig,
                planetProperties: getPlanetProperties(),
                document: documentRef,
                updateMultipleElementsText,
                updateSpacecraftMnemonic,
            });
            updateMoonUIFromConfig();
            updateLandingUIFromConfig();
        }

        if (progress) {
            progress.completeStage("config", "Loading mission configuration ...");
        }
    }

    function applyConfigDerivedUpdates() {
        const globalConfig = getGlobalConfig();

        applyLandingTimesUpdate({
            update: computeLandingTimesUpdate({ globalConfig, createUTCTimestamp }),
            setStartLandingTime,
            setEndLandingTime,
            console: consoleRef,
        });

        updateLandingUIFromConfig();

        applyEventsUpdate({
            update: computeEventsUpdate({
                globalConfig,
                config: getConfig(),
                nowDate: new Date(),
                getDataEndTimeMs,
            }),
            setEventInfos,
            console: consoleRef,
        });

        const missionEventTimes = computeMissionEventTimes({ globalConfig });
        if (typeof missionEventTimes.timeTransLunarInjection === "number") {
            setTimeTransLunarInjection(missionEventTimes.timeTransLunarInjection);
        }
        if (typeof missionEventTimes.timeLunarOrbitInsertion === "number") {
            setTimeLunarOrbitInsertion(missionEventTimes.timeLunarOrbitInsertion);
        }
    }

    function ensureSceneHandlerInitialized() {
        if (!getSceneHandler()) {
            setSceneHandler(new SceneHandlerClass());
        }
    }

    return {
        ensureGlobalConfigLoaded,
        applyConfigDerivedUpdates,
        ensureSceneHandlerInitialized,
    };
}

export { createInitConfigOrchestrationActions };
