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
        // Exposure bias: held flat at 1.0 so composer / aux panels render the
        // moon at the same renderer.toneMappingExposure (1.14) as the main
        // scene. The earlier mix(1.42, 1.0, ...) push for moon-dominant frames
        // was making the composer's lit hemisphere ~32% brighter than the main
        // scene, which sat the moon higher on the ACES tone-map shoulder and
        // visibly flattened crater contrast vs. Follow Moon.
        exposureBias: 1.0,
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
        // Moon photometric values are NOT overridden here. The previous
        // implementation hard-coded DEFAULT_QUALITY_MOON_RENDER_SETTINGS values
        // intending a no-op for both profiles, but the Standard/Fast profile
        // uses different values (e.g. highlightBoost 1.15 vs 1.20,
        // terminatorReliefStrength 7.0 vs 7.5, terminatorShadowFloor 0.04 vs
        // 0.0, terminatorIndirectOcclusion 0.96 vs 1.0). Hard-coding the
        // quality values silently retuned Standard renders.
        // The composer / aux panels now render the moon with whatever
        // photometric settings the active profile already wrote onto the
        // material — composer and main scene agree by construction.
    };
}

export const computeComposerBodyLightingPresentation = computePhotoModeLightingPresentation;
