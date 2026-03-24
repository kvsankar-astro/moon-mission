function executeAnimationFrame(deps) {
    const {
        performanceRef,
        fpsFrameCount,
        fpsLastTime,
        fpsUpdateInterval,
        updateFPSCounter,
        prevFrameTime,
        deltaFrameTime,
        animateLoopCount,
        ticksPerAnimationStep,
        updateFpsCounterState,
        updateFrameDeltaState,
        computeAnimationStepState,
        animationController,
        getScene,
        cameraControlsCallback,
        updateThreeDLoopCamera,
    } = deps;

    const curFrameTime = performanceRef.now();

    const nextFpsState = updateFpsCounterState({
        curFrameTime,
        fpsFrameCount,
        fpsLastTime,
        fpsUpdateInterval,
        updateFPSCounter,
    });

    const nextFrameTimingState = updateFrameDeltaState({
        curFrameTime,
        prevFrameTime,
        deltaFrameTime,
    });

    const nextStepState = computeAnimationStepState({
        animateLoopCount,
        ticksPerAnimationStep,
    });

    if (nextStepState.shouldAdvance) {
        // The animation controller's onTimeChange callback handles setLocation().
        animationController.tick(curFrameTime);
    }

    updateThreeDLoopCamera({
        scene: getScene(),
        cameraControlsCallback,
    });

    return {
        curFrameTime,
        fpsFrameCount: nextFpsState.fpsFrameCount,
        fpsLastTime: nextFpsState.fpsLastTime,
        prevFrameTime: nextFrameTimingState.prevFrameTime,
        deltaFrameTime: nextFrameTimingState.deltaFrameTime,
        animateLoopCount: nextStepState.animateLoopCount,
    };
}

export { executeAnimationFrame };
