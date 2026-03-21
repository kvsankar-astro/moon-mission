function assignIfDefined(value, assign) {
    if (value !== undefined) {
        assign(value);
    }
}

function createRuntimeLoopState({
    initialFpsFrameCount = 0,
    initialFpsLastTime = 0,
    initialPrevFrameTime = null,
    initialDeltaFrameTime = 0,
    initialAnimateLoopCount = 0,
} = {}) {
    let fpsFrameCount = initialFpsFrameCount;
    let fpsLastTime = initialFpsLastTime;
    let prevFrameTime = initialPrevFrameTime;
    let deltaFrameTime = initialDeltaFrameTime;
    let animateLoopCount = initialAnimateLoopCount;

    return {
        getLoopState: () => ({
            fpsFrameCount,
            fpsLastTime,
            prevFrameTime,
            deltaFrameTime,
            animateLoopCount,
        }),
        setLoopState: (nextState = {}) => {
            assignIfDefined(nextState.fpsFrameCount, (value) => {
                fpsFrameCount = value;
            });
            assignIfDefined(nextState.fpsLastTime, (value) => {
                fpsLastTime = value;
            });
            assignIfDefined(nextState.prevFrameTime, (value) => {
                prevFrameTime = value;
            });
            assignIfDefined(nextState.deltaFrameTime, (value) => {
                deltaFrameTime = value;
            });
            assignIfDefined(nextState.animateLoopCount, (value) => {
                animateLoopCount = value;
            });
        },
    };
}

export { createRuntimeLoopState };
