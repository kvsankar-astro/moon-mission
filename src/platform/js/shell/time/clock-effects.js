function createClockEffects({
    clearTimeoutFn,
    getLegacyTimeoutHandle,
}) {
    return {
        clearLegacyTimeout: () => {
            clearTimeoutFn(getLegacyTimeoutHandle());
        },
    };
}

export { createClockEffects };
