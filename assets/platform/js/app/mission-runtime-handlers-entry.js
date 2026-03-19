import { executeAnimationFrame } from "./scene-frame-loop-actions.js";

function createMissionRuntimeHandlersEntry(ctx) {
    const {
        performanceRef,
        requestAnimationFrameRef,
        startMissionApp,
        eventBus,
        toggleModeGuarded,
        toggleRelativeMode,
        getSetView,
        getSetDimensionTop,
        getMissionRuntimeWireup,
        readLoopState,
        writeLoopState,
        getFpsUpdateInterval,
        getTicksPerAnimationStep,
        updateFPSCounter,
        updateFpsCounterState,
        updateFrameDeltaState,
        computeAnimationStepState,
        getAnimationController,
        getScene,
        getCameraControlsCallback,
        updateThreeDLoopCamera,
    } = ctx;

    async function initAnimation(flags) {
        return getMissionRuntimeWireup().runtimeBootstrapActions.initOrchestrationActions.initAnimation(flags);
    }

    async function processOrbitData() {
        return getMissionRuntimeWireup().runtimeBootstrapActions.processOrbitData();
    }

    function animateLoop() {
        const {
            fpsFrameCount,
            fpsLastTime,
            prevFrameTime,
            deltaFrameTime,
            animateLoopCount,
        } = readLoopState();

        const nextLoopState = executeAnimationFrame({
            performanceRef,
            fpsFrameCount,
            fpsLastTime,
            fpsUpdateInterval: getFpsUpdateInterval(),
            updateFPSCounter,
            prevFrameTime,
            deltaFrameTime,
            animateLoopCount,
            ticksPerAnimationStep: getTicksPerAnimationStep(),
            updateFpsCounterState,
            updateFrameDeltaState,
            computeAnimationStepState,
            animationController: getAnimationController(),
            getScene,
            cameraControlsCallback: getCameraControlsCallback(),
            updateThreeDLoopCamera,
            updateCameraOverlay: () => getMissionRuntimeWireup().runtimeBootstrapActions.updateCameraOverlay(),
        });

        writeLoopState(nextLoopState);
        requestAnimationFrameRef(animateLoop);
    }

    function main() {
        startMissionApp({
            eventBus,
            handlers: {
                reset: () => getMissionRuntimeWireup().runtimeBootstrapActions.reset(),
                toggleMode: toggleModeGuarded,
                toggleRelativeMode,
                changeCameraFromTo: () => getMissionRuntimeWireup().runtimeBootstrapActions.changeCameraFromTo(),
                toggleLockSC: () => getMissionRuntimeWireup().runtimeBootstrapActions.toggleLockSC(),
                toggleLockMoon: () => getMissionRuntimeWireup().runtimeBootstrapActions.toggleLockMoon(),
                toggleLockEarth: () => getMissionRuntimeWireup().runtimeBootstrapActions.toggleLockEarth(),
                togglePlane: () => getMissionRuntimeWireup().runtimeBootstrapActions.togglePlane(),
                setView: getSetView(),
                setDimensionTop: getSetDimensionTop(),
                cy3Animate: () => getMissionRuntimeWireup().runtimeBootstrapActions.cy3Animate(),
                toggleJoyRide: () => getMissionRuntimeWireup().runtimeBootstrapActions.toggleJoyRide(),
                toggleLanding: () => getMissionRuntimeWireup().runtimeBootstrapActions.toggleLanding(),
                toggleInfo: () => getMissionRuntimeWireup().runtimeBootstrapActions.toggleInfo(),
                initAnimation,
            },
        });

        getMissionRuntimeWireup().runtimeBootstrapActions.initCameraOverlay();
    }

    return {
        initAnimation,
        processOrbitData,
        animateLoop,
        main,
    };
}

export { createMissionRuntimeHandlersEntry };
