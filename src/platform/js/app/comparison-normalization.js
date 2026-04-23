import { getBodyEphemerisState } from "../data/ephemeris-provider.js";
import {
    COMPARISON_REFERENCE_DISTANCE_KM,
    resolveComparisonNormalizationBodyId,
    resolveComparisonNormalizationScaleFromDistance,
    transformComparisonBodyState,
    transformComparisonCurveVectors,
} from "../core/domain/comparison-display.js";
import { resolveComparisonOverlayNormalizationSupportBodyId } from "../core/domain/comparison-overlay.js";

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
    npzData,
    npzDataLoaded,
    chebyshevData,
    chebyshevDataLoaded,
    bodySources,
    resolveBodySource,
    defaultSpacecraftSource,
}) {
    const scaleByBodyAndTimeMs = new Map();
    const spacecraftMnemonic = globalConfig?.spacecraft_mnemonic || "SC";

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
            normalizeBodyId(resolveComparisonNormalizationBodyId(config));
        let bodyState = getBodyEphemerisState({
            bodyId: normalizationBodyId,
            timeMs,
            config,
            npzData,
            npzDataLoaded,
            chebyshevData,
            chebyshevDataLoaded,
            globalConfig,
            bodySources,
            resolvedSource: usesOverlaySupportAlias
                ? "chebyshev"
                : (
                    typeof resolveBodySource === "function"
                        ? resolveBodySource(normalizationBodyId)
                        : undefined
                ),
            defaultSpacecraftSource,
            spacecraftMnemonic,
        });
        if (
            !bodyState?.available &&
            !usesOverlaySupportAlias &&
            defaultOverlayAliasBodyId
        ) {
            // Past the primary mission's own Moon data end, fall back to the
            // compare-craft's Moon alias (time-shifted by the alignment offset
            // inside getBodyEphemerisState).  This keeps the scale anchored to
            // the single mission whose data is still live, matching the body
            // state fallback in scene-state.js.
            bodyState = getBodyEphemerisState({
                bodyId: defaultOverlayAliasBodyId,
                timeMs,
                config,
                npzData,
                npzDataLoaded,
                chebyshevData,
                chebyshevDataLoaded,
                globalConfig,
                bodySources,
                resolvedSource: "chebyshev",
                defaultSpacecraftSource,
                spacecraftMnemonic,
            });
        }
        const distanceKm = bodyState?.available
            ? Math.hypot(
                Number(bodyState.position?.x) || 0,
                Number(bodyState.position?.y) || 0,
                Number(bodyState.position?.z) || 0,
            )
            : Number.NaN;
        const scale = resolveComparisonNormalizationScaleFromDistance(distanceKm);
        scaleByBodyAndTimeMs.set(cacheKey, scale);
        return scale;
    };
}

function normalizeComparisonCurveVectors({
    compareMode = false,
    bodyId = null,
    vectors,
    config,
    globalConfig,
    npzData,
    npzDataLoaded,
    chebyshevData,
    chebyshevDataLoaded,
    bodySources,
    resolveBodySource,
    defaultSpacecraftSource,
}) {
    if (!compareMode || !Array.isArray(vectors) || vectors.length === 0) {
        return vectors;
    }

    const resolveScaleForBodyTime = createComparisonNormalizationScaleResolver({
        config,
        globalConfig,
        npzData,
        npzDataLoaded,
        chebyshevData,
        chebyshevDataLoaded,
        bodySources,
        resolveBodySource,
        defaultSpacecraftSource,
    });

    return transformComparisonCurveVectors(
        vectors,
        (vector) => resolveScaleForBodyTime({
            bodyId,
            timeMs: vector?.timeMs,
        }),
    );
}

function createNormalizedComparisonDisplayState(
    sceneState,
    {
        globalConfig,
        npzData,
        npzDataLoaded,
        chebyshevData,
        chebyshevDataLoaded,
        bodySources,
        resolveBodySource,
        defaultSpacecraftSource,
    } = {},
) {
    if (!sceneState || typeof sceneState !== "object") {
        return sceneState;
    }

    const config = sceneState.config;
    const resolveScaleForBodyTime = createComparisonNormalizationScaleResolver({
        config,
        globalConfig,
        npzData,
        npzDataLoaded,
        chebyshevData,
        chebyshevDataLoaded,
        bodySources,
        resolveBodySource,
        defaultSpacecraftSource,
    });

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

    const defaultNormalizationBodyId = resolveComparisonNormalizationBodyId(config);
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
    createNormalizedComparisonDisplayState,
    normalizeComparisonCurveVectors,
};
