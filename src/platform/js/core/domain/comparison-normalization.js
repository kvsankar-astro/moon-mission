import {
    COMPARISON_REFERENCE_DISTANCE_KM,
    resolveComparisonNormalizationBodyId,
    resolveComparisonNormalizationScaleFromDistance,
    transformComparisonBodyState,
    transformComparisonCurveVectors,
} from "./comparison-display.js";
import { resolveComparisonOverlayNormalizationSupportBodyId } from "./comparison-overlay.js";

function normalizeBodyId(value) {
    return typeof value === "string" ? value.toUpperCase() : "";
}

function resolveComparisonNormalizationAnchorBodyId({
    globalConfig,
    bodyId,
    config,
}) {
    const overlaySupportBodyId = resolveComparisonOverlayNormalizationSupportBodyId({
        globalConfig,
        bodyId,
        config,
    });
    if (overlaySupportBodyId) {
        return overlaySupportBodyId;
    }

    return resolveComparisonNormalizationBodyId(config);
}

function createComparisonNormalizationScaleResolver({
    config,
    globalConfig,
    resolveBodyDistanceKm,
}) {
    const scaleByBodyAndTimeMs = new Map();
    const defaultNormalizationBodyId = resolveComparisonNormalizationBodyId(config);
    const defaultOverlayAliasBodyId = normalizeBodyId(
        globalConfig?.comparisonOverlay?.normalizationSupportBodyIdsByOrigin?.[config],
    );

    return ({ bodyId, timeMs }) => {
        const normalizationBodyId = resolveComparisonNormalizationAnchorBodyId({
            globalConfig,
            bodyId,
            config,
        });
        const cacheKey = `${normalizeBodyId(normalizationBodyId)}|${Number(timeMs)}`;
        if (scaleByBodyAndTimeMs.has(cacheKey)) {
            return scaleByBodyAndTimeMs.get(cacheKey);
        }

        const usesOverlaySupportAlias =
            normalizeBodyId(normalizationBodyId) !==
            normalizeBodyId(defaultNormalizationBodyId);
        let distanceKm =
            typeof resolveBodyDistanceKm === "function"
                ? resolveBodyDistanceKm({
                    bodyId: normalizationBodyId,
                    timeMs,
                })
                : Number.NaN;

        if (
            !Number.isFinite(distanceKm) &&
            !usesOverlaySupportAlias &&
            defaultOverlayAliasBodyId
        ) {
            distanceKm = resolveBodyDistanceKm({
                bodyId: defaultOverlayAliasBodyId,
                timeMs,
            });
        }

        const scale = resolveComparisonNormalizationScaleFromDistance(distanceKm);
        scaleByBodyAndTimeMs.set(cacheKey, scale);
        return scale;
    };
}

function normalizeComparisonCurveVectorsByScaleResolver({
    compareMode = false,
    bodyId = null,
    vectors,
    resolveScaleForBodyTime,
}) {
    if (!compareMode || !Array.isArray(vectors) || vectors.length === 0) {
        return vectors;
    }

    return transformComparisonCurveVectors(
        vectors,
        (vector) => resolveScaleForBodyTime({
            bodyId,
            timeMs: vector?.timeMs,
        }),
    );
}

function createNormalizedComparisonDisplayStateWithScaleResolver(
    sceneState,
    {
        resolveScaleForBodyTime,
    } = {},
) {
    if (!sceneState || typeof sceneState !== "object") {
        return sceneState;
    }

    const bodies = {};
    const comparisonNormalizationScaleByBodyId = {};
    for (const [bodyId, bodyState] of Object.entries(sceneState.bodies || {})) {
        const scale = resolveScaleForBodyTime({
            bodyId,
            timeMs: sceneState.time,
        });
        comparisonNormalizationScaleByBodyId[bodyId] = scale;
        bodies[bodyId] = transformComparisonBodyState(bodyState, scale);
    }

    const defaultNormalizationBodyId = resolveComparisonNormalizationBodyId(
        sceneState.config,
    );
    const defaultScale =
        comparisonNormalizationScaleByBodyId[defaultNormalizationBodyId] ??
        resolveScaleForBodyTime({
            bodyId: defaultNormalizationBodyId,
            timeMs: sceneState.time,
        });

    return {
        ...sceneState,
        bodies,
        comparisonNormalizationScale: defaultScale,
        comparisonNormalizationScaleByBodyId,
        comparisonReferenceDistanceKm: COMPARISON_REFERENCE_DISTANCE_KM,
    };
}

export {
    createComparisonNormalizationScaleResolver,
    createNormalizedComparisonDisplayStateWithScaleResolver,
    normalizeComparisonCurveVectorsByScaleResolver,
    resolveComparisonNormalizationAnchorBodyId,
};
