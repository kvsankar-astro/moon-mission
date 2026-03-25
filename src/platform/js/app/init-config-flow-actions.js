function createInitConfigFlowActions(deps) {
    const {
        getConfig,
        getAnimationScene,
        AnimationScene,
        shouldSkipInitConfig,
        applyInitConfigAlreadyInitialized,
        handleModeSwitchToGeo,
        handleModeSwitchToLunar,
        setChecked,
        normalizePlaneSelection,
        setPlaneSelectionState,
        syncPlaneSelectionControls,
        initConfigOrchestrationActions,
        getGlobalConfig,
        initConfigSceneSetupActions,
        isRelativeMode,
        initConfigUiActions,
        setSceneState,
        consoleRef,
    } = deps;

    async function initConfig() {
        const config = getConfig();
        const existingScene = getAnimationScene(config);
        if (shouldSkipInitConfig({ animationScene: existingScene, AnimationScene })) {
            applyInitConfigAlreadyInitialized({
                config,
                globalConfig: getGlobalConfig(),
                handleModeSwitchToGeo,
                handleModeSwitchToLunar,
                setChecked,
                animationScene: existingScene,
                syncPlaneSelection: (selection) => {
                    const normalized = normalizePlaneSelection(selection);
                    setPlaneSelectionState(normalized, config);
                    syncPlaneSelectionControls(normalized, setChecked);
                },
            });
            return;
        }

        await initConfigOrchestrationActions.ensureGlobalConfigLoaded();

        const configData = getGlobalConfig();
        initConfigOrchestrationActions.applyConfigDerivedUpdates();
        initConfigOrchestrationActions.ensureSceneHandlerInitialized();

        initConfigSceneSetupActions.configureSceneForOrigin({
            originKey: config,
            configData,
            isRelativeMode,
        });

        initConfigUiActions.configureInitConfigControls();

        setSceneState(config, AnimationScene.SCENE_STATE_INIT_CONFIG_DONE);
        consoleRef.debug(`initConfig(${config}) returning - state at SCENE_STATE_ADD_CURVE_DONE`);
    }

    return {
        initConfig,
    };
}

export { createInitConfigFlowActions };
