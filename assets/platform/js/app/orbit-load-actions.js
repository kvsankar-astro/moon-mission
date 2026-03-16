export function createOrbitLoadActions({
    d3,
    sleep,
    getConfig,
    animationScenes,
    orbitDataLoaded,
    chebyshevData,
    chebyshevDataLoaded,
    npzData,
    npzDataLoaded,
    getDataLoaded,
    setDataLoaded,
    loadChebyshev,
    loadNpz,
    processOrbitData,
    ensureIndeterminateProgressBar,
    showElementById,
    hideElementById,
    updateProgressLabel,
    setEventInfoText,
    getEphemerisSource,
    getBodySource,
    getBodiesForConfig,
    onEphemerisLoaded,
    onEphemerisStatus,
}) {
    const recordEphemeris =
        typeof onEphemerisLoaded === "function"
            ? onEphemerisLoaded
            : () => {};
    const setStatus =
        typeof onEphemerisStatus === "function"
            ? onEphemerisStatus
            : () => {};

    async function loadOrbitDataIfNeededAndProcess(callback) {
        const config = getConfig();

        if (!orbitDataLoaded[config]) {
            const msg = getDataLoaded() ? "" : "Loading orbit data ... ";
            ensureIndeterminateProgressBar("progressbar");
            showElementById("progressbar");
            updateProgressLabel(msg);
            await sleep();
            const requiredSources = new Set();

            try {
                const configuredBodies =
                    typeof getBodiesForConfig === "function"
                        ? getBodiesForConfig(config)
                        : animationScenes[config].planetsForLocations || [];
                for (const bodyId of configuredBodies) {
                    const source =
                        typeof getBodySource === "function"
                            ? getBodySource(bodyId)
                            : typeof getEphemerisSource === "function"
                              ? getEphemerisSource()
                              : "chebyshev";
                    if (source === "npz" || source === "chebyshev") {
                        requiredSources.add(source);
                    }
                }

                if (requiredSources.has("npz")) {
                    setStatus(config, "npz", "loading");
                    const npzUrl = animationScenes[config].orbitsNpz;
                    if (!npzUrl) {
                        throw new Error(`NPZ ephemeris path not configured for ${config}`);
                    }
                    console.log(`Loading NPZ ephemeris from ${npzUrl}`);
                    npzData[config] = await loadNpz(npzUrl);
                    npzDataLoaded[config] = true;
                    console.log(
                        `NPZ ephemeris loaded for ${config}: bodies=${Object.keys(npzData[config]).join(",")}`,
                    );
                    recordEphemeris({
                        config,
                        source: "npz",
                        url: npzUrl,
                        bodies: Object.keys(npzData[config] || {}),
                    });
                    setStatus(config, "npz", "ok");
                }

                if (requiredSources.has("chebyshev")) {
                    setStatus(config, "chebyshev", "loading");
                    const chebUrl = animationScenes[config].orbitsCheb;
                    if (!chebUrl) {
                        throw new Error(`Chebyshev ephemeris path not configured for ${config}`);
                    }
                    console.log(`Loading Chebyshev data from ${chebUrl}`);

                    chebyshevData[config] = await loadChebyshev(chebUrl);
                    chebyshevDataLoaded[config] = true;
                    console.log(
                        `Chebyshev data loaded for ${config}: ${chebyshevData[config].segments.length} segments`,
                    );
                    recordEphemeris({
                        config,
                        source: "chebyshev",
                        url: chebUrl,
                    });
                    setStatus(config, "chebyshev", "ok");
                }

                setDataLoaded(true);
                orbitDataLoaded[config] = true;

                hideElementById("progressbar");
                await processOrbitData();
                await sleep();
                callback();
            } catch (error) {
                console.error("Error loading orbit ephemeris data:", error);
                hideElementById("progressbar");
                setEventInfoText("Error: failed to load orbit data.");
                for (const source of requiredSources) {
                    setStatus(config, source, "error", error?.message || String(error));
                }
            }
            return;
        }

        await processOrbitData();
        await sleep();
        callback();
    }

    return { loadOrbitDataIfNeededAndProcess };
}
