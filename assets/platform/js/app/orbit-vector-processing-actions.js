export function createOrbitVectorProcessingActions({
    orbitCurveActions,
    getConfig,
    setOrbitPointsCount,
    setLandingPointsCount,
}) {
    function processOrbitVectorsData3D(scene) {
        const count = orbitCurveActions.addOrbitCurveVectors({
            config: getConfig(),
            curve: scene.curve,
            curveVelocities: scene.curveVelocities,
        });
        setOrbitPointsCount(count);
    }

    function processLandingVectors(scene) {
        const count = orbitCurveActions.addLandingCurveVectors({
            config: getConfig(),
            landingCurve: scene.landingCurve,
            landingCurveVelocities: scene.landingCurveVelocities,
        });
        setLandingPointsCount(count);
    }

    return { processOrbitVectorsData3D, processLandingVectors };
}

