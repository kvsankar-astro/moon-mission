import { PHYSICS_CONSTANTS as PC } from "../core/constants.js";
import { resolveMissionCraft } from "../core/domain/mission-config.js";
import { getSceneMissionCraftIds, getScenePrimaryCraftId } from "./scene-craft-helpers.js";

export function createOrbitVectorProcessingActions({
    THREE,
    orbitCurveActions,
    generateBodyCurve,
    getConfig,
    getGlobalConfig,
    npzData,
    npzDataLoaded,
    chebyshevData,
    chebyshevDataLoaded,
    getStartTime,
    getLatestEndTime,
    getStepMs,
    getPixelsPerAU,
    getEphemerisSource,
    resolveBodySource,
    setOrbitPointsCount,
    setLandingPointsCount,
}) {
    function processOrbitVectorsData3D(scene) {
        const globalConfig = getGlobalConfig();
        const craftIds = getSceneMissionCraftIds(scene, globalConfig);
        const primaryCraftId = getScenePrimaryCraftId(scene, globalConfig);
        const activeConfig = getConfig();
        const startTimeMs = getStartTime();
        const endTimeMs = getLatestEndTime();

        scene.primaryCraftId = primaryCraftId;
        scene.curvesById = {};
        scene.curveVelocitiesById = {};

        let primaryCount = 0;
        for (const craftId of craftIds) {
            const curve = [];
            const curveVelocities = [];
            const config = activeConfig;
            const missionCraft = resolveMissionCraft(globalConfig, craftId);
            const vectors = generateBodyCurve({
                bodyId: craftId,
                config,
                startTimeMs,
                endTimeMs,
                stepMs: getStepMs(config),
                npzData,
                npzDataLoaded,
                chebyshevData,
                chebyshevDataLoaded,
                resolvedSource:
                    typeof resolveBodySource === "function"
                        ? resolveBodySource(craftId)
                        : typeof getEphemerisSource === "function"
                          ? getEphemerisSource()
                          : "chebyshev",
                spacecraftMnemonic:
                    missionCraft?.mnemonic ||
                    globalConfig?.spacecraft_mnemonic ||
                    "SC",
                defaultSpacecraftSource:
                    typeof getEphemerisSource === "function"
                        ? getEphemerisSource()
                        : "chebyshev",
            });
            const pixelsPerAU = getPixelsPerAU();
            for (const vec of vectors) {
                curve.push(
                    new THREE.Vector3(
                        (vec.x / PC.KM_PER_AU) * pixelsPerAU,
                        (vec.y / PC.KM_PER_AU) * pixelsPerAU,
                        (vec.z / PC.KM_PER_AU) * pixelsPerAU,
                    ),
                );
                curveVelocities.push(
                    new THREE.Vector3(
                        (vec.vx / PC.KM_PER_AU) * pixelsPerAU,
                        (vec.vy / PC.KM_PER_AU) * pixelsPerAU,
                        (vec.vz / PC.KM_PER_AU) * pixelsPerAU,
                    ),
                );
            }
            const count = curve.length;
            scene.curvesById[craftId] = curve;
            scene.curveVelocitiesById[craftId] = curveVelocities;
            if (craftId === primaryCraftId) {
                primaryCount = count;
                scene.curve = curve;
                scene.curveVelocities = curveVelocities;
            }
        }

        if (!scene.curvesById[primaryCraftId]) {
            scene.curve = [];
            scene.curveVelocities = [];
        }

        setOrbitPointsCount(primaryCount);
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
