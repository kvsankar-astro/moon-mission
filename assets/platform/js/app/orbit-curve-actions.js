export function createOrbitCurveActions({
    THREE,
    generateCurveFromChebyshev,
    chebyshevDataLoaded,
    chebyshevData,
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

        if (chebyshevDataLoaded[config] && chebyshevData[config]) {
            const vectors = generateCurveFromChebyshev(
                chebyshevData[config],
                getStartTime(),
                getLatestEndTime(),
                getStepMs(config),
            );

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

        if (getLandingChebyshevLoaded(config) && getLandingChebyshevData(config)) {
            const vectors = generateCurveFromChebyshev(
                getLandingChebyshevData(config),
                getStartLandingTime(),
                getEndLandingTime(),
                1000, // Landing data uses 1-second resolution
            );

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
