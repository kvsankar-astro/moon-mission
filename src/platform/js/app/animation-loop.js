function updateFpsCounterState({
    curFrameTime,
    fpsFrameCount,
    fpsLastTime,
    fpsUpdateInterval,
    updateFPSCounter,
}) {
    let nextFrameCount = fpsFrameCount + 1;
    let nextLastTime = fpsLastTime;

    if (nextLastTime === 0) {
        nextLastTime = curFrameTime;
    }

    if (curFrameTime - nextLastTime >= fpsUpdateInterval) {
        const fps = Math.round(nextFrameCount * 1000 / (curFrameTime - nextLastTime));
        updateFPSCounter(fps);
        nextFrameCount = 0;
        nextLastTime = curFrameTime;
    }

    return {
        fpsFrameCount: nextFrameCount,
        fpsLastTime: nextLastTime,
    };
}

function updateFrameDeltaState({
    curFrameTime,
    prevFrameTime,
    deltaFrameTime,
}) {
    let nextDelta = deltaFrameTime;
    if (prevFrameTime != null) {
        nextDelta = curFrameTime - prevFrameTime;
    }

    return {
        prevFrameTime: curFrameTime,
        deltaFrameTime: nextDelta,
    };
}

function computeAnimationStepState({
    animateLoopCount,
    ticksPerAnimationStep,
}) {
    let nextCount = animateLoopCount + 1;
    const shouldAdvance = (nextCount % ticksPerAnimationStep) < 0.1;
    if (shouldAdvance) {
        nextCount = 0;
    }

    return {
        animateLoopCount: nextCount,
        shouldAdvance,
    };
}

function updateThreeDLoopCamera({
    scene,
    cameraControlsCallback,
}) {
    if (!scene || !scene.initialized3D || !scene.cameraControlsEnabled) return;
    if (!scene.camera) return;

    // Keep sky centered on the camera without relying on matrixWorld timing.
    scene.camera.updateMatrixWorld?.(true);
    scene.skyContainer?.position?.copy?.(scene.camera.position);

    if (!scene.cameraController?._freeFlyActive && scene.cameraControls) {
        scene.cameraControls.update?.();
        cameraControlsCallback?.();
    }
}

export {
    computeAnimationStepState,
    updateFpsCounterState,
    updateFrameDeltaState,
    updateThreeDLoopCamera,
};
