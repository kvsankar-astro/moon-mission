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
        // Moon photometric overrides held flat at the asset-profile defaults
        // (DEFAULT_QUALITY_MOON_RENDER_SETTINGS in moon-render-asset-profiles.js).
        // The composer / aux panel render path applies these values onto the
        // moon material before its render pass; previously the values diverged
        // from the defaults (e.g. moonShadowLift 0.05, moonHighlightBoost 1.45,
        // moonShadowWeightExponent 1.6, moonTerminatorIndirectOcclusion 0.85)
        // which made composer-rendered moons look softer + flatter than the
        // main scene's tuned defaults. Keeping these equal to defaults makes
        // the override a visual no-op so composer and main scene render the
        // moon identically. The earth-* fields above are unaffected by this
        // change — Photo Mode for Earth still works.
        moonShadowLift: 0.0,
        moonShadowWeightExponent: 1.92,
        moonHighlightWeightExponent: 1.2,
        moonTerminatorContrast: 1.8,
        moonTerminatorReliefStrength: 7.5,
        moonTerminatorShadowFloor: 0.0,
        moonTerminatorIndirectOcclusion: 1.0,
        moonHighlightBoost: 1.20,
    };
}

export const computeComposerBodyLightingPresentation = computePhotoModeLightingPresentation;
