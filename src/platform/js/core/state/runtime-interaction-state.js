function createRuntimeInteractionState({
    initialMissionStartCalled = false,
    initialStartLandingFlag = false,
    initialMouseDown = false,
    initialMouseDownTimeout = 0,
    initialTimeoutHandleZoom = undefined,
    initialLegacyTimeoutHandle = undefined,
    initialLastInputActivityMs = -Infinity,
} = {}) {
    let missionStartCalled = Boolean(initialMissionStartCalled);
    let startLandingFlag = Boolean(initialStartLandingFlag);
    let mouseDown = Boolean(initialMouseDown);
    let mouseDownTimeout = initialMouseDownTimeout;
    let timeoutHandleZoom = initialTimeoutHandleZoom;
    let legacyTimeoutHandle = initialLegacyTimeoutHandle;
    let lastInputActivityMs = Number.isFinite(initialLastInputActivityMs)
        ? initialLastInputActivityMs
        : -Infinity;

    function getNowMs() {
        return Date.now();
    }

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
        markInputActivity: (timeMs = getNowMs()) => {
            const numericTimeMs = Number(timeMs);
            if (Number.isFinite(numericTimeMs)) {
                lastInputActivityMs = numericTimeMs;
            }
            return lastInputActivityMs;
        },
        getLastInputActivityMs: () => lastInputActivityMs,
        getInputIdleMs: (timeMs = getNowMs()) => {
            const numericTimeMs = Number(timeMs);
            if (!Number.isFinite(numericTimeMs) || !Number.isFinite(lastInputActivityMs)) {
                return Infinity;
            }
            return Math.max(0, numericTimeMs - lastInputActivityMs);
        },
        isInputRecentlyActive: (graceMs, timeMs = getNowMs()) => {
            const numericGraceMs = Math.max(0, Number(graceMs) || 0);
            return Number.isFinite(lastInputActivityMs) &&
                Number.isFinite(Number(timeMs)) &&
                timeMs - lastInputActivityMs < numericGraceMs;
        },
    };
}

export { createRuntimeInteractionState };
