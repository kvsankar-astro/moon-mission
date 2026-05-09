function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function mix(minValue, maxValue, t) {
    return minValue + ((maxValue - minValue) * clamp01(t));
}

export function computeApparentDiskWeight({
    distance,
    radius,
} = {}) {
    const safeRadius = Number(radius);
    const safeDistance = Number(distance);
    if (!Number.isFinite(safeRadius) || safeRadius <= 0 || !Number.isFinite(safeDistance) || safeDistance <= 0) {
        return 0;
    }

    const clampedRatio = clamp01(safeRadius / Math.max(safeDistance, safeRadius + 1e-9));
    const angularRadius = Math.asin(Math.min(clampedRatio, 0.999999));
    return Math.PI * angularRadius * angularRadius;
}

export function computePhotoModeLightingPresentation({
    distanceToEarth,
    earthRadius,
    distanceToMoon,
    moonRadius,
} = {}) {
    const earthWeight = computeApparentDiskWeight({
        distance: distanceToEarth,
        radius: earthRadius,
    });
    const moonWeight = computeApparentDiskWeight({
        distance: distanceToMoon,
        radius: moonRadius,
    });
    const totalWeight = earthWeight + moonWeight;
    const earthDominance = totalWeight > 1e-12 ? clamp01(earthWeight / totalWeight) : 0.5;
    const moonDominance = 1 - earthDominance;

    return {
        dominantBody: earthDominance >= moonDominance ? "earth" : "moon",
        earthDominance,
        moonDominance,
        // Photo Mode is intentionally opinionated. Moon-dominant frames should
        // read like a photographed Moon exposure rather than an evenly metered
        // simulation, so push the global exposure harder than the old Flyby-only
        // pass did.
        exposureBias: mix(1.42, 1.0, earthDominance),
        // Black Marble is a cloud-free composite, not a single deep-space exposure.
        // Keep night lights subdued when the Moon dominates the frame, and only let
        // them come up modestly when Earth is the primary subject.
        earthNightLightsGain: mix(0.004, 0.07, earthDominance),
        // In Moon-dominant scenes like Earthset, constrain the visible lights to the
        // deepest night side so the dark hemisphere mostly stays black.
        earthNightMapExponent: mix(3.4, 1.75, earthDominance),
        // Give the sunlit Earth crescent a slight lift in Moon-dominant views so it
        // sits higher on the tone-mapping shoulder without re-metering the whole view.
        earthDayGain: mix(1.18, 1.0, earthDominance),
        // The repo Earth texture is cloudless and reads too "atlas-like" at small
        // crescent sizes. In Moon-dominant Flyby shots, suppress saturation and add
        // more atmospheric rim so the presentation feels more photographic.
        earthDaySaturation: mix(0.48, 0.86, earthDominance),
        earthAtmosphereRimStrength: mix(0.38, 0.16, earthDominance),
        // The lunar photometric shader derives crater-rim drama from its
        // terrain self-shadow + cavity-occlusion path, but the lit-side has
        // to read substantially brighter than the raw albedo*NdotL would
        // produce — real photos compensate exposure for the lunar disc, and
        // we mirror that here by pushing highlightBoost on Moon-dominant
        // frames. Keep terminatorContrast moderate so the lit hemisphere
        // doesn't darken too quickly into the terminator.
        moonShadowLift: mix(0.05, 0.02, earthDominance),
        moonShadowWeightExponent: mix(1.6, 1.92, earthDominance),
        moonHighlightWeightExponent: mix(1.2, 1.1, earthDominance),
        moonTerminatorContrast: mix(1.8, 2.0, earthDominance),
        moonTerminatorReliefStrength: mix(7.5, 7.5, earthDominance),
        moonTerminatorShadowFloor: mix(0.0, 0.0, earthDominance),
        moonTerminatorIndirectOcclusion: mix(0.85, 1.0, earthDominance),
        moonHighlightBoost: mix(1.45, 1.25, earthDominance),
    };
}

export const computeComposerBodyLightingPresentation = computePhotoModeLightingPresentation;
