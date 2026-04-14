function resolveSecondaryBodyOrbitGravitationalParameter(physicsConstants, sceneName) {
    const earthGm = Number(physicsConstants?.EARTH_GM_KM3_S2);
    const moonGm = Number(physicsConstants?.MOON_GM_KM3_S2);
    const combinedEarthMoonGm = earthGm + moonGm;

    if (
        (sceneName === "geo" || sceneName === "lunar") &&
        Number.isFinite(combinedEarthMoonGm) &&
        combinedEarthMoonGm > 0
    ) {
        return combinedEarthMoonGm;
    }

    if (Number.isFinite(earthGm) && earthGm > 0) {
        return earthGm;
    }

    return Number.isFinite(moonGm) && moonGm > 0 ? moonGm : 0;
}

export { resolveSecondaryBodyOrbitGravitationalParameter };
