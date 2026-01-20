export function createAnimationActions({
    animationController,
    getAnimTime,
    getTimeTransLunarInjection,
    getTimeLunarOrbitInsertion,
    setMissionStartCalled,
    clearLegacyTimeout,
}) {
    return {
        cy3Animate: () => animationController.toggle(),
        fastBackward: () => animationController.fastBackward(),
        backward: () => animationController.stepBackward(),
        stopAnimation: () => {
            animationController.pause();
            clearLegacyTimeout?.();
        },
        forward: () => animationController.stepForward(),
        fastForward: () => animationController.fastForward(),
        missionStart: () => {
            setMissionStartCalled?.(true);
            animationController.goToStart();
        },
        missionSetTime: () => animationController.goToEvent(getAnimTime()),
        missionNow: () => animationController.goToNow(),
        missionTLI: () => animationController.goToEvent(getTimeTransLunarInjection()),
        missionLunar: () => animationController.goToEvent(getTimeLunarOrbitInsertion()),
        missionEnd: () => animationController.goToEnd(),
        faster: () => animationController.faster(),
        resetspeed: () => animationController.resetSpeed(),
        slower: () => animationController.slower(),
        realtime: () => animationController.setRealtimeSpeed(),
    };
}

