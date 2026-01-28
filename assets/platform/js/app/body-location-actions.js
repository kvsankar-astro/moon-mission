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
    getLandingChebyshevLoaded,
    getLandingChebyshevData,
    getStateFromChebyshev,
    getMoonState,
    getEarthFromMoonState,
    getStartAndEndTimes,
    TC,
    getFrameMode,
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

        if (
            planet === "SC" &&
            chebyshevDataLoaded[config] &&
            chebyshevData[config]?.time_range
        ) {
            const jd = new Date(date).getJD_TDB();
            const range = chebyshevData[config].time_range;
            flag = jd >= range.start && jd <= range.end;
        } else {
            flag = date >= getStartTime() && date <= getEndTimeSC();
        }

        return flag;
    }

    function getBodyLocation(craftid, t) {
        const config = getConfig();

        // Check if landing is enabled before using landing time range
        const globalConfig = getGlobalConfig();
        const isLandingEnabled =
            globalConfig && globalConfig.landing && globalConfig.landing.enabled;
        const cfgKey = getConfig();

        // For SC (spacecraft), use Chebyshev data
        if (craftid === "SC") {
            const startLandingTime = getStartLandingTime();
            const endLandingTime = getEndLandingTime();
            const frameMode = typeof getFrameMode === "function" ? getFrameMode() : "inertial";

            // Landing phase (and post-landing hold) - always use landing Chebyshev if available.
            if (isLandingEnabled && t >= startLandingTime) {
                if (getLandingChebyshevLoaded(cfgKey) && getLandingChebyshevData(cfgKey)) {
                    // Clamp to the landing data end to avoid stepping out of range.
                    const tLanding = Math.min(t, endLandingTime - TC.ONE_SECOND_MS);
                    const jd = new Date(tLanding).getJD_TDB();
                    const state = getStateFromChebyshev(getLandingChebyshevData(cfgKey), jd);
                    if (state) {
                        return [
                            new THREE.Vector3(state.pos.x, state.pos.y, state.pos.z),
                            new THREE.Vector3(state.vel.vx, state.vel.vy, state.vel.vz),
                        ];
                    }
                }
                console.debug(`Landing Chebyshev data not available for time ${t}`);
                return [null, null];
            }

            // Regular orbital phase - use Chebyshev
            if (chebyshevDataLoaded[config] && chebyshevData[config]) {
                const jd = new Date(t).getJD_TDB();
                const state = getStateFromChebyshev(chebyshevData[config], jd);
                if (state) {
                    return [
                        new THREE.Vector3(state.pos.x, state.pos.y, state.pos.z),
                        new THREE.Vector3(state.vel.vx, state.vel.vy, state.vel.vz),
                    ];
                }
            }
            console.debug(`Chebyshev data not available for SC at time ${t}`);
            return [null, null];
        }

        // Use Astronomy Engine for Moon and Earth positions
        if (craftid === "MOON" && config === "geo") {
            const state = getMoonState(t);
            return [
                new THREE.Vector3(state.x, state.y, state.z),
                new THREE.Vector3(state.vx, state.vy, state.vz),
            ];
        }

        if (craftid === "EARTH" && config === "lunar") {
            const state = getEarthFromMoonState(t);
            return [
                new THREE.Vector3(state.x, state.y, state.z),
                new THREE.Vector3(state.vx, state.vy, state.vz),
            ];
        }

        // Unknown body
        console.error(`Unknown body: ${craftid} in config ${config}`);
        return [null, null];
    }

    return {
        shouldDrawOrbit,
        planetStartTime,
        isLocationAvaialable,
        getBodyLocation,
    };
}
