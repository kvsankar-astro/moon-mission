import { getBodyEphemerisState } from "../data/ephemeris-provider.js";
import { resolveComparisonNormalizationBodyId } from "../core/domain/comparison-display.js";
import {
    createComparisonNormalizationScaleResolver,
    createNormalizedComparisonDisplayStateWithScaleResolver,
    normalizeComparisonCurveVectorsByScaleResolver,
} from "../core/domain/comparison-normalization.js";

function normalizeBodyId(value) {
    return typeof value === "string" ? value.toUpperCase() : "";
}

function createComparisonNormalizationDistanceResolver({
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
    const spacecraftMnemonic = globalConfig?.spacecraft_mnemonic || "SC";
    const defaultNormalizationBodyId = resolveComparisonNormalizationBodyId(config);

    return ({ bodyId, timeMs }) => {
        const usesOverlaySupportAlias =
            normalizeBodyId(bodyId) !== normalizeBodyId(defaultNormalizationBodyId);
        const bodyState = getBodyEphemerisState({
            bodyId,
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
                        ? resolveBodySource(bodyId)
                        : undefined
                ),
            defaultSpacecraftSource,
            spacecraftMnemonic,
        });

        if (!bodyState?.available) {
            return Number.NaN;
        }

        return Math.hypot(
            Number(bodyState.position?.x) || 0,
            Number(bodyState.position?.y) || 0,
            Number(bodyState.position?.z) || 0,
        );
    };
}

function createAppComparisonNormalizationScaleResolver({
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
    return createComparisonNormalizationScaleResolver({
        config,
        globalConfig,
        resolveBodyDistanceKm: createComparisonNormalizationDistanceResolver({
            config,
            globalConfig,
            npzData,
            npzDataLoaded,
            chebyshevData,
            chebyshevDataLoaded,
            bodySources,
            resolveBodySource,
            defaultSpacecraftSource,
        }),
    });
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

    const resolveScaleForBodyTime = createAppComparisonNormalizationScaleResolver({
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

    return normalizeComparisonCurveVectorsByScaleResolver({
        compareMode,
        bodyId,
        vectors,
        resolveScaleForBodyTime,
    });
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

    const resolveScaleForBodyTime = createAppComparisonNormalizationScaleResolver({
        config: sceneState.config,
        globalConfig,
        npzData,
        npzDataLoaded,
        chebyshevData,
        chebyshevDataLoaded,
        bodySources,
        resolveBodySource,
        defaultSpacecraftSource,
    });

    return createNormalizedComparisonDisplayStateWithScaleResolver(
        sceneState,
        { resolveScaleForBodyTime },
    );
}

export {
    createNormalizedComparisonDisplayState,
    normalizeComparisonCurveVectors,
};
