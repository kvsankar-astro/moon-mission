export function createLandingLoadActions({
    getGlobalConfig,
    getConfigsList,
    getLandingDataLoaded,
    setLandingDataLoaded,
    setLandingNpzLoaded,
    setLandingNpzData,
    setLandingChebyshevLoaded,
    setLandingChebyshevData,
    resolveLandingNpzUrl,
    resolveLandingChebyshevUrl,
    loadNpz,
    loadChebyshev,
    loadProgress,
}) {
    const progress =
        loadProgress &&
        typeof loadProgress.setStage === "function" &&
        typeof loadProgress.completeStage === "function" &&
        typeof loadProgress.isActive === "function"
            ? loadProgress
            : null;

    async function loadLandingDataAndProcess() {
        const globalConfig = getGlobalConfig();

        const isLandingEnabled =
            globalConfig && globalConfig.landing && globalConfig.landing.enabled;
        if (!isLandingEnabled) return;

        if (getLandingDataLoaded()) return;

        const configs = getConfigsList();
        let anyLoaded = false;
        const plannedLandingUrls = {};
        const totalLandingTasks = configs.reduce((count, cfg) => {
            const npzUrl = resolveLandingNpzUrl(globalConfig, cfg);
            const chebUrl = resolveLandingChebyshevUrl(globalConfig, cfg);
            plannedLandingUrls[cfg] = { npzUrl, chebUrl };
            return count + (npzUrl ? 1 : 0) + (chebUrl ? 1 : 0);
        }, 0);
        let completedLandingTasks = 0;

        const shouldTrackLandingProgress = !!(progress && progress.isActive());
        const updateLandingProgress = () => {
            if (!shouldTrackLandingProgress || totalLandingTasks <= 0) return;
            completedLandingTasks += 1;
            progress.setStage(
                "landing",
                completedLandingTasks / totalLandingTasks,
                "Loading landing data ...",
            );
        };

        if (shouldTrackLandingProgress) {
            if (totalLandingTasks <= 0) {
                progress.completeStage("landing", "Loading landing data ...");
            } else {
                progress.setStage("landing", 0, "Loading landing data ...");
            }
        }

        for (const cfg of configs) {
            const { npzUrl: landingDataNpz, chebUrl: landingDataCheb } = plannedLandingUrls[cfg] || {};

            try {
                if (landingDataNpz) {
                    console.log(`Loading landing NPZ data for ${cfg} from ${landingDataNpz}`);
                    const landingNpzData = await loadNpz(landingDataNpz);
                    setLandingNpzData(cfg, landingNpzData);
                    setLandingNpzLoaded(cfg, true);
                    anyLoaded = true;
                    console.log(
                        `Landing NPZ data loaded (${cfg}): bodies=${Object.keys(landingNpzData).join(",")}`,
                    );
                } else {
                    setLandingNpzLoaded(cfg, false);
                }
            } catch (npzError) {
                console.warn(`Failed to load landing NPZ data for ${cfg}: ${npzError}`);
                setLandingNpzLoaded(cfg, false);
            } finally {
                if (landingDataNpz) {
                    updateLandingProgress();
                }
            }

            try {
                if (!landingDataCheb) {
                    console.warn(
                        `Landing Chebyshev path unavailable for ${cfg} (missing dataPath or filename)`,
                    );
                    setLandingChebyshevLoaded(cfg, false);
                    continue;
                }

                console.log(`Loading landing Chebyshev data for ${cfg} from ${landingDataCheb}`);
                const landingChebyshevData = await loadChebyshev(landingDataCheb);
                setLandingChebyshevData(cfg, landingChebyshevData);
                setLandingChebyshevLoaded(cfg, true);
                anyLoaded = true;
                console.log(
                    `Landing Chebyshev data loaded (${cfg}): ${landingChebyshevData.segments.length} segments`,
                );
            } catch (chebError) {
                console.warn(`Failed to load landing Chebyshev data for ${cfg}: ${chebError}`);
                setLandingChebyshevLoaded(cfg, false);
            } finally {
                if (landingDataCheb) {
                    updateLandingProgress();
                }
            }
        }

        if (shouldTrackLandingProgress && totalLandingTasks > 0) {
            progress.completeStage("landing", "Loading landing data ...");
        }

        setLandingDataLoaded(anyLoaded);
    }

    return { loadLandingDataAndProcess };
}
