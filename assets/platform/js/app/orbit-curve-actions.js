import { generateCurveFromNpz } from "../data/npz-ephemeris.js";

export function createOrbitCurveActions({
    THREE,
    generateCurveFromChebyshev,
    chebyshevDataLoaded,
    chebyshevData,
    npzData,
    npzDataLoaded,
    getLandingNpzLoaded,
    getLandingNpzData,
    getEphemerisSource,
    resolveBodySource,
    generateBodyCurve,
    getStepMs,
    getStartTime,
    getLatestEndTime,
    getLandingEnabled,
    getLandingChebyshevLoaded,
    getLandingChebyshevData,
    getStartLandingTime,
    getEndLandingTime,
    PC,
    getPixelsPerAU,
}) {
    function addOrbitCurveVectors({ config, curve, curveVelocities }) {
        let nOrbitPoints = 0;

        const vectors =
            typeof generateBodyCurve === "function"
                ? generateBodyCurve({
                      bodyId: "SC",
                      config,
                      startTimeMs: getStartTime(),
                      endTimeMs: getLatestEndTime(),
                      stepMs: getStepMs(config),
                      npzData,
                      npzDataLoaded,
                      chebyshevData,
                      chebyshevDataLoaded,
                      resolvedSource:
                          typeof resolveBodySource === "function"
                              ? resolveBodySource("SC")
                              : typeof getEphemerisSource === "function"
                                ? getEphemerisSource()
                                : "chebyshev",
                      defaultSpacecraftSource:
                          typeof getEphemerisSource === "function"
                              ? getEphemerisSource()
                              : "chebyshev",
                  })
                : [];

        if (vectors.length > 0) {
            const pixelsPerAU = getPixelsPerAU();
            for (const vec of vectors) {
                const x = (vec.x / PC.KM_PER_AU) * pixelsPerAU;
                const y = (vec.y / PC.KM_PER_AU) * pixelsPerAU;
                const z = (vec.z / PC.KM_PER_AU) * pixelsPerAU;

                const vx = (vec.vx / PC.KM_PER_AU) * pixelsPerAU;
                const vy = (vec.vy / PC.KM_PER_AU) * pixelsPerAU;
                const vz = (vec.vz / PC.KM_PER_AU) * pixelsPerAU;

                curve.push(new THREE.Vector3(x, y, z));
                curveVelocities.push(new THREE.Vector3(vx, vy, vz));
                ++nOrbitPoints;
            }
        }

        return nOrbitPoints;
    }

    function addLandingCurveVectors({ config, landingCurve, landingCurveVelocities }) {
        let nLandingPoints = 0;

        if (!getLandingEnabled() || config != "lunar") return nLandingPoints;

        let vectors = [];
        const landingSource =
            typeof resolveBodySource === "function"
                ? resolveBodySource("SC")
                : typeof getEphemerisSource === "function"
                  ? getEphemerisSource()
                  : "chebyshev";

        if (landingSource === "npz" && getLandingNpzLoaded(config) && getLandingNpzData(config)) {
            const landingBucket = getLandingNpzData(config);
            const landingSeries = landingBucket?.SC || landingBucket?.sc || null;
            if (landingSeries) {
                vectors = generateCurveFromNpz(
                    landingSeries,
                    getStartLandingTime(),
                    getEndLandingTime(),
                    1000,
                );
            }
        } else if (getLandingChebyshevLoaded(config) && getLandingChebyshevData(config)) {
            vectors = generateCurveFromChebyshev(
                getLandingChebyshevData(config),
                getStartLandingTime(),
                getEndLandingTime(),
                1000, // Landing data uses 1-second resolution
            );
        }

        if (vectors.length > 0) {
            const pixelsPerAU = getPixelsPerAU();
            for (const vec of vectors) {
                const x = (vec.x / PC.KM_PER_AU) * pixelsPerAU;
                const y = (vec.y / PC.KM_PER_AU) * pixelsPerAU;
                const z = (vec.z / PC.KM_PER_AU) * pixelsPerAU;

                const vx = (vec.vx / PC.KM_PER_AU) * pixelsPerAU;
                const vy = (vec.vy / PC.KM_PER_AU) * pixelsPerAU;
                const vz = (vec.vz / PC.KM_PER_AU) * pixelsPerAU;

                landingCurve.push(new THREE.Vector3(x, y, z));
                landingCurveVelocities.push(new THREE.Vector3(vx, vy, vz));
                ++nLandingPoints;
            }
        }

        return nLandingPoints;
    }

    return { addOrbitCurveVectors, addLandingCurveVectors };
}
