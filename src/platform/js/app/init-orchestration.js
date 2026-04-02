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
    } = deps;

    async function waitUntilOrbitDataProcessed({
        onReady,
        pollIntervalMs = 50,
    } = {}) {
        const cfg = getConfig();
        if (!isOrbitDataProcessed(cfg)) {
            setTimeout(() => {
                waitUntilOrbitDataProcessed({ onReady, pollIntervalMs });
            }, pollIntervalMs);
            return;
        }

        if (typeof onReady === "function") {
            onReady();
        }
    }

    async function initAnimation(flags) {
        try {
            await initConfig();
            await init(() => {});

            await waitUntilOrbitDataProcessed({
                onReady: () => {
                    const startupAnimTimeOverride = Number(flags?.startupAnimTimeOverride);
                    const hasStartupAnimTimeOverride = Number.isFinite(startupAnimTimeOverride);
                    const nowTimeMs = Date.now();
                    const startTime = Number(getStartTime?.());
                    const latestEndTime = Number(getLatestEndTime?.());
                    const shouldStartAtNow = !hasStartupAnimTimeOverride &&
                        !!flags.reset &&
                        Number.isFinite(nowTimeMs) &&
                        Number.isFinite(startTime) &&
                        Number.isFinite(latestEndTime) &&
                        nowTimeMs >= startTime &&
                        nowTimeMs <= latestEndTime;

                    if (hasStartupAnimTimeOverride) {
                        setAnimTime?.(startupAnimTimeOverride);
                        if (typeof missionSetTime === "function") {
                            missionSetTime();
                        } else {
                            setLocation();
                        }
                    } else if (shouldStartAtNow) {
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

                    // Also resets camera parameters in manual/manual mode for consistent startup.
                    const changeCameraFromTo = getChangeCameraFromTo();
                    if (typeof changeCameraFromTo === "function") {
                        changeCameraFromTo();
                    }

                    updateCraftScale();

                    // Re-run the frame once startup view/camera state has settled.
                    setLocation();
                },
            });
        } catch (error) {
            d3.select("#eventinfo").text("Failed to load the aninmation. Please restart the browser and try again.");
            console.error("Error: exception in initAnimation(): " + error);
            d3SelectAll("button").attr("disabled", true);
            return;
        }

        render();
        requestAnimationFrame(animateLoop);
    }

    return {
        initAnimation,
    };
}

export { createInitOrchestrationActions };
