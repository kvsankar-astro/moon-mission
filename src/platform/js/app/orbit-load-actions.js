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
    loadProgress,
}) {
    const recordEphemeris =
        typeof onEphemerisLoaded === "function"
            ? onEphemerisLoaded
            : () => {};
    const setStatus =
        typeof onEphemerisStatus === "function"
            ? onEphemerisStatus
            : () => {};
    const progress =
        loadProgress &&
        typeof loadProgress.beginSessionIfNeeded === "function" &&
        typeof loadProgress.setStage === "function" &&
        typeof loadProgress.completeStage === "function" &&
        typeof loadProgress.abortSession === "function" &&
        typeof loadProgress.isActive === "function"
            ? loadProgress
            : null;

    async function loadOrbitDataIfNeededAndProcess(callback) {
        const config = getConfig();

        if (!orbitDataLoaded[config]) {
            const msg = getDataLoaded() ? "" : "Loading orbit data ... ";
            if (progress) {
                progress.beginSessionIfNeeded({
                    includeLanding: true,
                    label: msg || "Loading orbit data ...",
                });
                progress.setStage("orbit", 0, msg || "Loading orbit data ...");
            } else {
                ensureIndeterminateProgressBar("progressbar");
                showElementById("progressbar");
                updateProgressLabel(msg);
            }
            await sleep();
            const requiredSources = new Set();

            try {
                const configuredBodies =
                    typeof getBodiesForConfig === "function"
                        ? getBodiesForConfig(config)
                        : animationScenes[config].planetsForLocations || [];
                const requiredBodies = new Set([
                    ...(Array.isArray(configuredBodies) ? configuredBodies : []),
                    "SUN",
                ]);

                for (const bodyId of requiredBodies) {
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

                const totalSources = Math.max(1, requiredSources.size);
                let completedSources = 0;
                const updateOrbitSourceProgress = () => {
                    completedSources += 1;
                    if (progress) {
                        progress.setStage(
                            "orbit",
                            completedSources / totalSources,
                            "Loading orbit data ...",
                        );
                    }
                };

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
                    updateOrbitSourceProgress();
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
                    updateOrbitSourceProgress();
                }

                if (requiredSources.size === 0 && progress) {
                    progress.completeStage("orbit", "Loading orbit data ...");
                }

                setDataLoaded(true);
                orbitDataLoaded[config] = true;

                if (progress) {
                    progress.completeStage("orbit", "Loading orbit data ...");
                    progress.setStage("process", 0, "Processing orbit data ...");
                } else {
                    hideElementById("progressbar");
                }
                await processOrbitData();
                if (progress) {
                    progress.completeStage("process", "Processing orbit data ...");
                }
                await sleep();
                callback();
            } catch (error) {
                console.error("Error loading orbit ephemeris data:", error);
                if (progress) {
                    progress.abortSession();
                } else {
                    hideElementById("progressbar");
                }
                setEventInfoText("Error: failed to load orbit data.");
                for (const source of requiredSources) {
                    setStatus(config, source, "error", error?.message || String(error));
                }
            }
            return;
        }

        if (progress && progress.isActive()) {
            progress.setStage("process", 0, "Processing orbit data ...");
        }
        await processOrbitData();
        if (progress && progress.isActive()) {
            progress.completeStage("process", "Processing orbit data ...");
        }
        await sleep();
        callback();
    }

    return { loadOrbitDataIfNeededAndProcess };
}
