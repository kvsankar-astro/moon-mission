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
    } = deps;

    async function ensureGlobalConfigLoaded() {
        if (getGlobalConfig() !== null) {
            return;
        }

        const loadedGlobalConfig = await loadMissionConfig();
        setGlobalConfig(loadedGlobalConfig);
        setEventInfos(loadedGlobalConfig?.eventInfos || []);
        setEphemerisSource(getEphemerisSource(loadedGlobalConfig));
        setBodyEphemerisSources(loadedGlobalConfig?.ephemeris_sources || {});
        for (const cfg of loadedGlobalConfig?.phases || []) {
            setEphemerisStatusesForConfig(cfg, {
                npz: { status: "pending", message: "" },
                chebyshev: { status: "pending", message: "" },
            });
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
