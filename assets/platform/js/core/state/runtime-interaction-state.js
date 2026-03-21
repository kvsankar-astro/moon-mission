function createRuntimeInteractionState({
    initialMissionStartCalled = false,
    initialStartLandingFlag = false,
    initialMouseDown = false,
    initialMouseDownTimeout = 0,
    initialTimeoutHandleZoom = undefined,
    initialLegacyTimeoutHandle = undefined,
} = {}) {
    let missionStartCalled = Boolean(initialMissionStartCalled);
    let startLandingFlag = Boolean(initialStartLandingFlag);
    let mouseDown = Boolean(initialMouseDown);
    let mouseDownTimeout = initialMouseDownTimeout;
    let timeoutHandleZoom = initialTimeoutHandleZoom;
    let legacyTimeoutHandle = initialLegacyTimeoutHandle;

    return {
        getMissionStartCalled: () => missionStartCalled,
        setMissionStartCalled: (value) => {
            missionStartCalled = Boolean(value);
        },
        getStartLandingFlag: () => startLandingFlag,
        setStartLandingFlag: (value) => {
            startLandingFlag = Boolean(value);
        },
        getMouseDown: () => mouseDown,
        setMouseDown: (value) => {
            mouseDown = Boolean(value);
        },
        getMouseDownTimeout: () => mouseDownTimeout,
        setMouseDownTimeout: (value) => {
            mouseDownTimeout = value;
        },
        getTimeoutHandleZoom: () => timeoutHandleZoom,
        setTimeoutHandleZoom: (value) => {
            timeoutHandleZoom = value;
        },
        getLegacyTimeoutHandle: () => legacyTimeoutHandle,
        setLegacyTimeoutHandle: (value) => {
            legacyTimeoutHandle = value;
        },
    };
}

export { createRuntimeInteractionState };
