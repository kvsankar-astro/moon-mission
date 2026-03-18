function createRuntimeUiControlsActions(deps) {
    const {
        createNavigationActions,
        createRepeatMouseDownHandlers,
        createLockActions,
        createCameraActions,
        createModeActions,
        createBurnActions,
        getPanX,
        setPanX,
        getPanY,
        setPanY,
        getZoomFactor,
        setZoomFactor,
        zoomChange,
        zoomEnd,
        render,
        getZoomTimeoutMs,
        getZoomScale,
        toggleStatsVisibility,
        forward,
        fastForward,
        backward,
        fastBackward,
        slower,
        resetspeed,
        faster,
        realtime,
        getMouseDownTimeout,
        setMouseDownTimeout,
        setTimeoutHandleZoom,
        animationScenes,
        getConfig,
        setChecked,
        readCameraPositionMode,
        readCameraLookMode,
        applyCameraFromTo,
        readPlaneSelection,
        setPlaneSelection,
        handlePlaneChange,
        getViewSky,
        getGlobalConfig,
        updateCraftScale,
        getLandingFlag,
        setLandingFlag,
        getJoyRideFlag,
        setJoyRideFlag,
        setView,
        getEventInfos,
        setAnimTime,
        missionSetTime,
    } = deps;

    const navigationActions = createNavigationActions({
        getPanX,
        setPanX,
        getPanY,
        setPanY,
        getZoomFactor,
        setZoomFactor,
        zoomChange,
        zoomEnd,
        render,
        getZoomTimeoutMs,
        getZoomScale,
        toggleInfo: toggleStatsVisibility,
    });

    const repeatHandlers = createRepeatMouseDownHandlers({
        zoomIn: navigationActions.zoomIn,
        zoomOut: navigationActions.zoomOut,
        panLeft: navigationActions.panLeft,
        panRight: navigationActions.panRight,
        panUp: navigationActions.panUp,
        panDown: navigationActions.panDown,
        forward,
        fastForward,
        backward,
        fastBackward,
        slower,
        resetspeed,
        faster,
        realtime,
        getDelayMs: getMouseDownTimeout,
        setDelayMs: setMouseDownTimeout,
        setTimeoutHandle: setTimeoutHandleZoom,
    });

    const lockActions = createLockActions({
        animationScenes,
        getConfig,
        reset: navigationActions.reset,
        setChecked,
    });

    const cameraActions = createCameraActions({
        animationScenes,
        getConfig,
        readCameraPositionMode,
        readCameraLookMode,
        applyCameraFromTo,
        readPlaneSelection,
        setPlaneSelection,
        handlePlaneChange,
        render,
        getViewSky,
    });

    const modeActions = createModeActions({
        animationScenes,
        getConfig,
        getGlobalConfig,
        render,
        updateCraftScale,
        getLandingFlag,
        setLandingFlag,
        getJoyRideFlag,
        setJoyRideFlag,
        setView,
    });

    const burnActions = createBurnActions({
        getEventInfos,
        setAnimTime,
        missionSetTime,
    });

    return {
        ...navigationActions,
        ...repeatHandlers,
        ...lockActions,
        ...cameraActions,
        ...modeActions,
        burnButtonHandler: burnActions.burnButtonHandler,
    };
}

export { createRuntimeUiControlsActions };
