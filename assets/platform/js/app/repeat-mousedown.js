export function createRepeatMouseDownHandlers({
    zoomIn,
    zoomOut,
    panLeft,
    panRight,
    panUp,
    panDown,
    forward,
    fastForward,
    backward,
    fastBackward,
    slower,
    resetspeed,
    faster,
    realtime,
    getDelayMs,
    setDelayMs,
    setTimeoutHandle,
    minDelayMs = 10,
}) {
    function makeRepeat(action) {
        function repeat() {
            action();

            const delayMs = getDelayMs();
            setTimeoutHandle(setTimeout(repeat, delayMs));

            if (delayMs > minDelayMs) {
                setDelayMs(delayMs - minDelayMs);
            }
        }
        return repeat;
    }

    return {
        f1: makeRepeat(zoomIn),
        f2: makeRepeat(zoomOut),
        f3: makeRepeat(panLeft),
        f4: makeRepeat(panRight),
        f5: makeRepeat(panUp),
        f6: makeRepeat(panDown),
        f7: makeRepeat(forward),
        f8: makeRepeat(fastForward),
        f9: makeRepeat(backward),
        f10: makeRepeat(fastBackward),
        f11: makeRepeat(slower),
        f12: makeRepeat(resetspeed),
        f13: makeRepeat(faster),
        f14: makeRepeat(realtime),
    };
}

