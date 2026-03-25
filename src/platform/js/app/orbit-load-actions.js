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
    function getChebyshevBodySeries(chebData, bodyId) {
        if (!chebData || !bodyId) return null;
        if (chebData[bodyId]) return chebData[bodyId];
        if (bodyId === "SC" && chebData.segments) return chebData;
        return null;
    }

    function getChebyshevSegmentCount(chebData) {
        if (!chebData || typeof chebData !== "object") return 0;
        if (Array.isArray(chebData.segments)) return chebData.segments.length;
        const seriesList = Object.values(chebData).filter(
            (value) => value && Array.isArray(value.segments),
        );
        if (seriesList.length === 0) return 0;
        return Math.max(...seriesList.map((series) => series.segments.length));
    }

    function mergeMissingChebyshevBodySeries(targetChebData, supportChebData) {
        if (
            !targetChebData ||
            typeof targetChebData !== "object" ||
            !supportChebData ||
            typeof supportChebData !== "object"
        ) {
            return [];
        }

        const mergedBodies = [];
        for (const [key, value] of Object.entries(supportChebData)) {
            if (targetChebData[key]) continue;
            if (key === "format" || key === "version" || key === "metadata" || key === "time_range") continue;
            if (!value || !Array.isArray(value.segments)) continue;
            targetChebData[key] = value;
            mergedBodies.push(key);
        }

        return mergedBodies;
    }

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
                        `Chebyshev data loaded for ${config}: ${getChebyshevSegmentCount(chebyshevData[config])} segments`,
                    );

                    const sunSource =
                        typeof getBodySource === "function"
                            ? getBodySource("SUN")
                            : typeof getEphemerisSource === "function"
                              ? getEphemerisSource()
                              : "chebyshev";
                    if (sunSource === "chebyshev") {
                        const hasSunInPrimaryFile = !!getChebyshevBodySeries(
                            chebyshevData[config],
                            "SUN",
                        );
                        if (!hasSunInPrimaryFile) {
                            const sunChebUrl = animationScenes[config].orbitsSunCheb;
                            if (!sunChebUrl) {
                                throw new Error(`Sun Chebyshev ephemeris path not configured for ${config}`);
                            }
                            console.log(`Loading Sun Chebyshev data from ${sunChebUrl}`);
                            const sunChebData = await loadChebyshev(sunChebUrl);
                            chebyshevData[config].SUN = sunChebData;
                        }
                    }

                    const needsMoonSeries = requiredBodies.has("MOON");
                    const hasMoonSeries = !!getChebyshevBodySeries(
                        chebyshevData[config],
                        "MOON",
                    );
                    if (needsMoonSeries && !hasMoonSeries) {
                        const supportChebUrl = animationScenes[config].relativeSupportOrbitsCheb;
                        if (supportChebUrl && supportChebUrl !== chebUrl) {
                            console.log(`Loading support Chebyshev data from ${supportChebUrl}`);
                            const supportChebData = await loadChebyshev(supportChebUrl);
                            const mergedBodies = mergeMissingChebyshevBodySeries(
                                chebyshevData[config],
                                supportChebData,
                            );
                            if (mergedBodies.length > 0) {
                                console.log(
                                    `Merged support Chebyshev series for ${config}: ${mergedBodies.join(",")}`,
                                );
                            }
                        }
                    }

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
