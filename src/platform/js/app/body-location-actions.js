export function createBodyLocationActions({
    THREE,
    getConfig,
    getGlobalConfig,
    getStartTime,
    getEndTimeSC,
    getStartLandingTime,
    getEndLandingTime,
    chebyshevDataLoaded,
    chebyshevData,
    npzData,
    npzDataLoaded,
    getLandingNpzLoaded,
    getLandingNpzData,
    getLandingChebyshevLoaded,
    getLandingChebyshevData,
    getStartAndEndTimes,
    TC,
    getFrameMode,
    getEphemerisSource,
    resolveBodySource,
    getBodyEphemerisRange,
    getBodyEphemerisState,
}) {
    function shouldDrawOrbit(planet) {
        const config = getConfig();

        return (
            planet == "MARS" ||
            planet == "SC" ||
            planet == "MOON" ||
            planet == "EARTH" ||
            (((config == "lunar") || (config == "helio")) && planet == "CSS")
        );
    }

    function planetStartTime(planet) {
        const times = getStartAndEndTimes(planet);
        return times[0];
    }

    function isLocationAvaialable(planet, date) {
        const config = getConfig();
        let flag = false;

        if (planet === "SC") {
            const range =
                typeof getBodyEphemerisRange === "function"
                    ? getBodyEphemerisRange({
                          bodyId: planet,
                          config,
                          npzData,
                          npzDataLoaded,
                          chebyshevData,
                          chebyshevDataLoaded,
                          resolvedSource:
                              typeof resolveBodySource === "function"
                                  ? resolveBodySource(planet)
                                  : null,
                      })
                    : null;

            if (range) {
                const jd =
                    typeof new Date(date).getJD_UTC === "function"
                        ? new Date(date).getJD_UTC()
                        : 2440587.5 + date / 86400000;
                flag = jd >= range.start && jd <= range.end;
            } else {
                flag = date >= getStartTime() && date <= getEndTimeSC();
            }
        } else {
            flag = date >= getStartTime() && date <= getEndTimeSC();
        }

        return flag;
    }

    function getBodyLocation(craftid, t) {
        const config = getConfig();

        const globalConfig = getGlobalConfig();
        const cfgKey = getConfig();
        const resolvedSource =
            typeof resolveBodySource === "function"
                ? resolveBodySource(craftid)
                : typeof getEphemerisSource === "function"
                  ? getEphemerisSource()
                  : "chebyshev";
        const state =
            typeof getBodyEphemerisState === "function"
                ? getBodyEphemerisState({
                      bodyId: craftid,
                      timeMs: t,
                      config,
                      npzData,
                      npzDataLoaded,
                      chebyshevData,
                      chebyshevDataLoaded,
                      landingNpzData: getLandingNpzData(cfgKey),
                      landingNpzLoaded: getLandingNpzLoaded(cfgKey),
                      landingChebyshevData: getLandingChebyshevData(cfgKey),
                      landingChebyshevLoaded: getLandingChebyshevLoaded(cfgKey),
                      globalConfig,
                      startLandingTime: getStartLandingTime(),
                      endLandingTime: getEndLandingTime(),
                      resolvedSource,
                      defaultSpacecraftSource:
                          typeof getEphemerisSource === "function"
                              ? getEphemerisSource()
                              : "chebyshev",
                  })
                : null;

        if (state?.available) {
            return [
                new THREE.Vector3(
                    state.position.x,
                    state.position.y,
                    state.position.z,
                ),
                new THREE.Vector3(
                    state.velocity.vx,
                    state.velocity.vy,
                    state.velocity.vz,
                ),
            ];
        }

        return [null, null];
    }

    return {
        shouldDrawOrbit,
        planetStartTime,
        isLocationAvaialable,
        getBodyLocation,
    };
}
