export function createLandingLoadActions({
    getGlobalConfig,
    getConfigsList,
    getLandingDataLoaded,
    setLandingDataLoaded,
    setLandingChebyshevLoaded,
    setLandingChebyshevData,
    resolveLandingChebyshevUrl,
    loadChebyshev,
}) {
    async function loadLandingDataAndProcess() {
        const globalConfig = getGlobalConfig();

        const isLandingEnabled =
            globalConfig && globalConfig.landing && globalConfig.landing.enabled;
        if (!isLandingEnabled) return;

        if (getLandingDataLoaded()) return;

        const configs = getConfigsList();
        let anyLoaded = false;

        for (const cfg of configs) {
            const landingDataCheb = resolveLandingChebyshevUrl(globalConfig, cfg);
            if (!landingDataCheb) {
                console.warn(
                    `Landing Chebyshev path unavailable for ${cfg} (missing dataPath or filename)`,
                );
                setLandingChebyshevLoaded(cfg, false);
                continue;
            }

            try {
                console.log(`Loading landing Chebyshev data for ${cfg} from ${landingDataCheb}`);
                const landingChebyshevData = await loadChebyshev(landingDataCheb);
                setLandingChebyshevData(cfg, landingChebyshevData);
                setLandingChebyshevLoaded(cfg, true);
                anyLoaded = true;
                console.log(
                    `Landing Chebyshev data loaded (${cfg}): ${landingChebyshevData.segments.length} segments`,
                );
            } catch (chebError) {
                console.error(`Failed to load landing Chebyshev data for ${cfg}: ${chebError}`);
                setLandingChebyshevLoaded(cfg, false);
            }
        }

        setLandingDataLoaded(anyLoaded);
    }

    return { loadLandingDataAndProcess };
}
