export function createLandingLoadActions({
    getGlobalConfig,
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

        const landingDataCheb = resolveLandingChebyshevUrl(globalConfig);
        if (!landingDataCheb) {
            console.error(
                "Landing Chebyshev path unavailable (missing window.missionConfig.dataPath)",
            );
            setLandingChebyshevLoaded(false);
            return;
        }

        try {
            console.log(`Loading landing Chebyshev data from ${landingDataCheb}`);
            const landingChebyshevData = await loadChebyshev(landingDataCheb);
            setLandingChebyshevData(landingChebyshevData);
            setLandingChebyshevLoaded(true);
            setLandingDataLoaded(true);
            console.log(
                `Landing Chebyshev data loaded: ${landingChebyshevData.segments.length} segments`,
            );
        } catch (chebError) {
            console.error(`Failed to load landing Chebyshev data: ${chebError}`);
            setLandingChebyshevLoaded(false);
        }
    }

    return { loadLandingDataAndProcess };
}

