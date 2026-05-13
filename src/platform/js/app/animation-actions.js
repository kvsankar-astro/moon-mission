export function createAnimationActions({
    animationController,
    getAnimTime,
    getTimeTransLunarInjection,
    getTimeLunarOrbitInsertion,
    setMissionStartCalled,
    clearLegacyTimeout,
}) {
    const toggleAnimation = () => animationController.toggle();
    const playAnimation = () => animationController.play();

    return {
        toggleAnimation,
        playAnimation,
        // Backward compatibility while shared handlers migrate off CY3 naming.
        cy3Animate: toggleAnimation,
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
        missionSetTime: () => animationController.goToEvent(getAnimTime(), {
            source: "mission-set-time",
        }),
        missionNow: () => animationController.goToNow(),
        missionTLI: () => animationController.goToEvent(getTimeTransLunarInjection(), {
            source: "mission-tli",
        }),
        missionLunar: () => animationController.goToEvent(getTimeLunarOrbitInsertion(), {
            source: "mission-lunar",
        }),
        missionEnd: () => animationController.goToEnd(),
        faster: () => animationController.faster(),
        resetspeed: () => animationController.resetSpeed(),
        slower: () => animationController.slower(),
        realtime: () => animationController.setRealtimeSpeed(),
    };
}
