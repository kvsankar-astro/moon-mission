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
            try {
                const landingDataNpz = resolveLandingNpzUrl(globalConfig, cfg);
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
            }

            try {
                const landingDataCheb = resolveLandingChebyshevUrl(globalConfig, cfg);
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
            }
        }

        setLandingDataLoaded(anyLoaded);
    }

    return { loadLandingDataAndProcess };
}
