function createInitOrchestrationActions(deps) {
    const {
        initConfig,
        init,
        getConfig,
        isOrbitDataProcessed,
        missionStart,
        missionSetTime,
        setRealtimeSpeed,
        playAnimation,
        setAnimTime,
        setLocation,
        setDimension,
        getSetView,
        getChangeCameraFromTo,
        updateCraftScale,
        d3,
        d3SelectAll,
        render,
        requestAnimationFrame,
        animateLoop,
        getStartTime,
        getLatestEndTime,
        animationScenes,
    } = deps;
    let animationLoopStarted = false;
    let latestInitRunId = 0;

    function shouldWaitFor3DSceneReady() {
        if (typeof document === "undefined") return false;
        return !!document.getElementById("dimension-3D")?.checked;
    }

    function isSceneOrbitRenderable(scene) {
        if (!scene) return false;
        const addCurveDoneState = scene?.constructor?.SCENE_STATE_ADD_CURVE_DONE;
        if (Number.isFinite(addCurveDoneState) && scene.state === addCurveDoneState) {
            return true;
        }
        const bodyMap = scene.orbitLinesByBodyId || {};
        return Object.values(bodyMap).some((lines) => Array.isArray(lines) && lines.length > 0);
    }

    function reapplyStartupViewWhenReady(runId, maxAttempts = 40, pollIntervalMs = 50) {
        if (runId !== latestInitRunId) {
            return;
        }

        const setView = getSetView();
        if (typeof setView !== "function") {
            return;
        }

        const cfg = getConfig();
        const scene = animationScenes?.[cfg];
        const needs3DReady = shouldWaitFor3DSceneReady();
        const sceneReady = !needs3DReady || (
            !!scene?.initialized3D &&
            isSceneOrbitRenderable(scene)
        );

        if (sceneReady) {
            setView();
            return;
        }

        if (maxAttempts <= 0) {
            // Best effort fallback: apply once even if readiness signal was late.
            setView();
            return;
        }

        setTimeout(() => {
            reapplyStartupViewWhenReady(runId, maxAttempts - 1, pollIntervalMs);
        }, pollIntervalMs);
    }

    function releaseStartupButtonDisable() {
        const slowerButton = document.getElementById("slower");
        const fasterButton = document.getElementById("faster");
        const slowerWasDisabled = slowerButton?.getAttribute("aria-disabled") === "true";
        const fasterWasDisabled = fasterButton?.getAttribute("aria-disabled") === "true";
        d3SelectAll("button").attr("disabled", null);
        if (slowerButton) {
            slowerButton.disabled = slowerWasDisabled;
            slowerButton.setAttribute("aria-disabled", slowerWasDisabled ? "true" : "false");
        }
        if (fasterButton) {
            fasterButton.disabled = fasterWasDisabled;
            fasterButton.setAttribute("aria-disabled", fasterWasDisabled ? "true" : "false");
        }
    }

    async function waitUntilOrbitDataProcessed({
        onReady,
        pollIntervalMs = 50,
        runId = 0,
    } = {}) {
        if (runId !== latestInitRunId) {
            return;
        }
        const cfg = getConfig();
        if (!isOrbitDataProcessed(cfg)) {
            setTimeout(() => {
                waitUntilOrbitDataProcessed({
                    onReady,
                    pollIntervalMs,
                    runId,
                });
            }, pollIntervalMs);
            return;
        }

        if (runId === latestInitRunId && typeof onReady === "function") {
            onReady();
        }
    }

    async function initAnimation(flags) {
        const runId = ++latestInitRunId;
        try {
            await initConfig();
            await init(() => {});

            await waitUntilOrbitDataProcessed({
                runId,
                onReady: () => {
                    if (runId !== latestInitRunId) {
                        return;
                    }
                    const startupAnimTimeOverride = Number(flags?.startupAnimTimeOverride);
                    const hasStartupAnimTimeOverride = Number.isFinite(startupAnimTimeOverride);
                    const nowTimeMs = Date.now();
                    const startTime = Number(getStartTime?.());
                    const latestEndTime = Number(getLatestEndTime?.());
                    const shouldStartAtNow = !!flags.reset &&
                        Number.isFinite(nowTimeMs) &&
                        Number.isFinite(startTime) &&
                        Number.isFinite(latestEndTime) &&
                        nowTimeMs >= startTime &&
                        nowTimeMs <= latestEndTime;

                    if (shouldStartAtNow) {
                        setAnimTime?.(nowTimeMs);
                        if (typeof missionSetTime === "function") {
                            missionSetTime();
                        } else {
                            setLocation();
                        }
                        if (typeof setRealtimeSpeed === "function") {
                            setRealtimeSpeed();
                        }
                        if (typeof playAnimation === "function") {
                            playAnimation();
                        }
                    } else if (hasStartupAnimTimeOverride) {
                        setAnimTime?.(startupAnimTimeOverride);
                        if (typeof missionSetTime === "function") {
                            missionSetTime();
                        } else {
                            setLocation();
                        }
                    } else if (flags.reset) {
                        missionStart();
                    } else {
                        setLocation();
                    }

                    setDimension(true);

                    const setView = getSetView();
                    if (typeof setView === "function") {
                        setView();
                    }
                    // Dimension switch can finalize asynchronously (3D init), so apply
                    // startup view settings again once the scene is actually ready.
                    reapplyStartupViewWhenReady(runId);

                    // Also resets camera parameters in manual/manual mode for consistent startup.
                    const changeCameraFromTo = getChangeCameraFromTo();
                    if (typeof changeCameraFromTo === "function") {
                        changeCameraFromTo();
                    }

                    updateCraftScale();

                    // Re-run the frame once startup view/camera state has settled.
                    setLocation();

                    // Some startup paths (for example missions that begin in 3D and
                    // don't re-enter the orbit-processing unlock path) can leave
                    // controls disabled. Always release the startup blanket-disable.
                    releaseStartupButtonDisable();
                },
            });
        } catch (error) {
            d3.select("#eventinfo").text("Failed to load the aninmation. Please restart the browser and try again.");
            console.error("Error: exception in initAnimation(): " + error);
            d3SelectAll("button").attr("disabled", true);
            return;
        }

        render();
        if (!animationLoopStarted) {
            requestAnimationFrame(animateLoop);
            animationLoopStarted = true;
        }
    }

    return {
        initAnimation,
    };
}

export { createInitOrchestrationActions };
