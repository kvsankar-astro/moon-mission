export function createOrbitLoadActions({
    d3,
    sleep,
    getConfig,
    animationScenes,
    orbitDataLoaded,
    chebyshevData,
    chebyshevDataLoaded,
    getDataLoaded,
    setDataLoaded,
    loadChebyshev,
    processOrbitData,
    ensureIndeterminateProgressBar,
    showElementById,
    hideElementById,
    updateProgressLabel,
    setEventInfoText,
}) {
    async function loadOrbitDataIfNeededAndProcess(callback) {
        const config = getConfig();

        if (!orbitDataLoaded[config]) {
            const msg = getDataLoaded() ? "" : "Loading orbit data ... ";
            ensureIndeterminateProgressBar("progressbar");
            showElementById("progressbar");
            updateProgressLabel(msg);
            await sleep();

            try {
                const chebUrl = animationScenes[config].orbitsCheb;
                console.log(`Loading Chebyshev data from ${chebUrl}`);

                chebyshevData[config] = await loadChebyshev(chebUrl);
                chebyshevDataLoaded[config] = true;
                console.log(
                    `Chebyshev data loaded for ${config}: ${chebyshevData[config].segments.length} segments`,
                );

                setDataLoaded(true);
                orbitDataLoaded[config] = true;

                hideElementById("progressbar");
                await processOrbitData();
                await sleep();
                callback();
            } catch (error) {
                console.error("Error loading Chebyshev data:", error);
                hideElementById("progressbar");
                setEventInfoText("Error: failed to load orbit data.");
            }
            return;
        }

        await processOrbitData();
        await sleep();
        callback();
    }

    return { loadOrbitDataIfNeededAndProcess };
}

