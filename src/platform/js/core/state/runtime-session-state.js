function createFlagProxy(state) {
    const proxy = {};
    Object.defineProperties(proxy, {
        joyRide: {
            enumerable: true,
            get() {
                return state.joyRide;
            },
            set(value) {
                state.joyRide = Boolean(value);
            },
        },
        landing: {
            enumerable: true,
            get() {
                return state.landing;
            },
            set(value) {
                state.landing = Boolean(value);
            },
        },
    });
    return proxy;
}

function createRuntimeSessionState({
    initialAnimTime = undefined,
    initialAnimationRunning = false,
    initialJoyRide = false,
    initialLanding = false,
} = {}) {
    let animTime = initialAnimTime;
    let animationRunning = Boolean(initialAnimationRunning);
    const flagState = {
        joyRide: Boolean(initialJoyRide),
        landing: Boolean(initialLanding),
    };
    const runtimeFlags = createFlagProxy(flagState);

    return {
        getAnimTime: () => animTime,
        setAnimTime: (value) => {
            animTime = value;
        },
        getAnimationRunning: () => animationRunning,
        setAnimationRunning: (value) => {
            animationRunning = Boolean(value);
        },
        getJoyRideFlag: () => flagState.joyRide,
        setJoyRideFlag: (value) => {
            flagState.joyRide = Boolean(value);
        },
        getLandingFlag: () => flagState.landing,
        setLandingFlag: (value) => {
            flagState.landing = Boolean(value);
        },
        getRuntimeFlags: () => runtimeFlags,
    };
}

export { createRuntimeSessionState };
