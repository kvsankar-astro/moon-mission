import {
    isStartupViewSceneReady,
    planStartupViewReapply,
    resolveStartupAnimationMode,
} from "./startup-animation-plan.js";

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
        scheduleTimeout = setTimeout,
        resolveStartupAnimationMode: resolveStartupAnimationModeImpl = resolveStartupAnimationMode,
        planStartupViewReapply: planStartupViewReapplyImpl = planStartupViewReapply,
        isStartupViewSceneReady: isStartupViewSceneReadyImpl = isStartupViewSceneReady,
    } = deps;
    let animationLoopStarted = false;
    let latestInitRunId = 0;

    function clampTimeToMissionSpan(timeMs) {
        const numericTimeMs = Number(timeMs);
        if (!Number.isFinite(numericTimeMs)) {
            return numericTimeMs;
        }

        const startTime = Number(getStartTime?.());
        const latestEndTime = Number(getLatestEndTime?.());
        if (!Number.isFinite(startTime) || !Number.isFinite(latestEndTime)) {
            return numericTimeMs;
        }
        if (numericTimeMs < startTime) {
            return startTime;
        }
        if (numericTimeMs > latestEndTime) {
            return latestEndTime;
        }
        return numericTimeMs;
    }

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
        const setView = getSetView();
        const cfg = getConfig();
        const scene = animationScenes?.[cfg];
        const reapplyPlan = planStartupViewReapplyImpl({
            runId,
            latestRunId: latestInitRunId,
            hasSetView: typeof setView === "function",
            sceneReady: isStartupViewSceneReadyImpl({
                needs3DReady: shouldWaitFor3DSceneReady(),
                scene,
                isSceneOrbitRenderable,
            }),
            attemptsRemaining: maxAttempts,
        });

        if (reapplyPlan.type === "skip") {
            return;
        }

        if (reapplyPlan.type === "apply") {
            setView();
            return;
        }

        scheduleTimeout(() => {
            reapplyStartupViewWhenReady(runId, maxAttempts - 1, pollIntervalMs);
        }, pollIntervalMs);
    }

    function releaseStartupButtonDisable() {
        if (typeof document === "undefined") {
            d3SelectAll("button").attr("disabled", null);
            return;
        }
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

    /**
     * @param {{ onReady?: Function, pollIntervalMs?: number, runId?: number }} [options]
     */
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
            scheduleTimeout(() => {
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
        const applyTimeSetOrLocationRefresh = (timeMs) => {
            const clampedTimeMs = clampTimeToMissionSpan(timeMs);
            setAnimTime?.(clampedTimeMs);
            if (typeof missionSetTime === "function") {
                missionSetTime();
            } else {
                setLocation();
            }
        };
        const applyStartupAnimationMode = (startupAction) => {
            switch (startupAction.type) {
            case "start-now":
                applyTimeSetOrLocationRefresh(startupAction.animTime);
                if (startupAction.shouldSetRealtimeSpeed && typeof setRealtimeSpeed === "function") {
                    setRealtimeSpeed();
                }
                if (startupAction.shouldPlayAnimation && typeof playAnimation === "function") {
                    playAnimation();
                }
                return;
            case "set-time":
                applyTimeSetOrLocationRefresh(startupAction.animTime);
                return;
            case "mission-start":
                missionStart();
                return;
            default:
                setLocation();
            }
        };
        try {
            await initConfig();
            await init(() => {});

            await waitUntilOrbitDataProcessed({
                runId,
                onReady: () => {
                    if (runId !== latestInitRunId) {
                        return;
                    }
                    const startupAction = resolveStartupAnimationModeImpl({
                        flags,
                        nowTimeMs: Date.now(),
                        startTime: Number(getStartTime?.()),
                        latestEndTime: Number(getLatestEndTime?.()),
                    });

                    applyStartupAnimationMode(startupAction);

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
