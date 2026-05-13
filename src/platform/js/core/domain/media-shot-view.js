function asTrimmedString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function toLowerCorpus(parts) {
    return parts
        .map((part) => asTrimmedString(part).toLowerCase())
        .filter(Boolean)
        .join(" ");
}

function normalizeBodyName(value) {
    return asTrimmedString(value).toLowerCase();
}

function normalizeLockTarget(value) {
    const normalized = asTrimmedString(value).toLowerCase();
    return normalized === "earth" || normalized === "moon" ? normalized : "";
}

function parseFocalLengthMm(...candidates) {
    for (const candidate of candidates) {
        const text = asTrimmedString(candidate);
        if (!text) continue;
        const match = text.match(/(\d+(?:\.\d+)?)\s*mm\b/i);
        if (!match) continue;
        const focalLengthMm = toFiniteNumber(match[1]);
        if (Number.isFinite(focalLengthMm) && focalLengthMm > 0) {
            return focalLengthMm;
        }
    }
    return Number.NaN;
}

function resolveSensorProfile(cameraLabel) {
    const label = asTrimmedString(cameraLabel).toLowerCase();
    if (!label) return null;
    if (
        label.includes("nikon d5")
        || label.includes("nikon z 9")
        || label.includes("nikon z9")
        || label.includes("canon eos r5")
        || label.includes("canon eos 5d")
        || label.includes("5d mark iv")
    ) {
        return {
            id: "full-frame",
            widthMm: 36,
            heightMm: 24,
        };
    }
    return null;
}

function computeVerticalFovDegrees(focalLengthMm, sensorHeightMm) {
    if (!Number.isFinite(focalLengthMm) || focalLengthMm <= 0) return Number.NaN;
    if (!Number.isFinite(sensorHeightMm) || sensorHeightMm <= 0) return Number.NaN;
    const radians = 2 * Math.atan(sensorHeightMm / (2 * focalLengthMm));
    const degrees = radians * (180 / Math.PI);
    return Number.isFinite(degrees) ? degrees : Number.NaN;
}

function inferLockTarget(corpus) {
    if (!corpus) return "";
    if (
        /\bearthrise\b/.test(corpus)
        || /\bearthset\b/.test(corpus)
        || /\bsetting earth\b/.test(corpus)
        || /\bpeek(?:ing)? at earth\b/.test(corpus)
        || /\bdestination and home\b/.test(corpus)
        || /\bdistant earth\b/.test(corpus)
        || /\bcrescent earth\b/.test(corpus)
        || /\bearth\b.*\bhorizon\b/.test(corpus)
    ) {
        return "earth";
    }
    return "";
}

function inferLockTargetFromBodies(bodies = []) {
    const normalizedBodies = (Array.isArray(bodies) ? bodies : []).map(normalizeBodyName);
    if (normalizedBodies.includes("earth")) return "earth";
    if (normalizedBodies.includes("moon")) return "moon";
    return "";
}

function inferLockTargetFromMainBody(mainBody) {
    return normalizeLockTarget(mainBody);
}

function normalizeExplicitMediaShotHint(item) {
    const explicit = item?.shotViewHint || item?.compositionHint || null;
    const compositionHints = item?.compositionHints || item?.composition_hints || null;
    const explicitLockTarget = normalizeLockTarget(
        explicit?.lockTarget ||
        explicit?.suggestedLockTarget ||
        explicit?.suggested_lock_target ||
        compositionHints?.lockTarget ||
        compositionHints?.suggestedLockTarget ||
        compositionHints?.suggested_lock_target,
    );
    const mainBodyLockTarget = inferLockTargetFromMainBody(item?.mainBody || item?.main_body || item?.primaryBody || item?.primary_body);
    const bodyLockTarget = inferLockTargetFromBodies(item?.bodies);
    const lockTarget = explicitLockTarget || mainBodyLockTarget || bodyLockTarget;
    if (!lockTarget) return null;
    return {
        mediaItemId: asTrimmedString(item.id),
        lockTarget,
        orientationReference: asTrimmedString(
            explicit?.orientationReference ||
            explicit?.orientation_reference ||
            compositionHints?.orientationReference ||
            compositionHints?.orientation_reference,
        ) || (lockTarget === "earth" ? "moon-north" : "world"),
        focalLengthMm: toFiniteNumber(explicit?.focalLengthMm || explicit?.focal_length_mm),
        verticalFovDegrees: toFiniteNumber(explicit?.verticalFovDegrees || explicit?.vertical_fov_degrees),
        sensorProfileId: asTrimmedString(explicit?.sensorProfileId || explicit?.sensor_profile_id),
        surfaceTarget: explicit?.surfaceTarget || explicit?.surface_target || compositionHints?.surfaceTarget || compositionHints?.surface_target || null,
        bodies: Array.isArray(item?.bodies) ? item.bodies.map(asTrimmedString).filter(Boolean) : [],
    };
}

const SURFACE_TARGET_HINT_OVERRIDES = Object.freeze([
    {
        match: (item, corpus) =>
            corpus.includes("hertzsprung in light and shadow")
            || asTrimmedString(item?.fileName || item?.file || "").includes("55199984595_1727ddf745_o.jpg"),
        hint: {
            lockTarget: "moon",
            orientationReference: "world",
            surfaceTarget: {
                bodyId: "moon",
                label: "Hertzsprung basin",
                latitudeDeg: 1.37,
                longitudeDeg: -128.66,
                radiusScale: 1.0,
                sourceUrl: "https://en.wikipedia.org/wiki/Hertzsprung_(crater)",
            },
        },
    },
]);

function resolveSurfaceTargetHint(item, corpus) {
    for (const override of SURFACE_TARGET_HINT_OVERRIDES) {
        if (typeof override?.match === "function" && override.match(item, corpus)) {
            return override.hint;
        }
    }
    return null;
}

function inferMediaShotViewHint(item) {
    if (!item || typeof item !== "object") {
        return null;
    }

    const explicitHint = normalizeExplicitMediaShotHint(item);
    if (explicitHint) {
        return explicitHint;
    }

    const corpus = toLowerCorpus([
        item.title,
        item.description,
        item.location,
        item.cameraLabel,
        item.settings,
    ]);
    const surfaceTargetHint = resolveSurfaceTargetHint(item, corpus);
    const lockTarget = surfaceTargetHint?.lockTarget || inferLockTarget(corpus);
    if (!lockTarget) {
        return null;
    }

    const focalLengthMm = parseFocalLengthMm(item.settings, item.cameraLabel);
    const sensorProfile = resolveSensorProfile(item.cameraLabel);
    const verticalFovDegrees = sensorProfile
        ? computeVerticalFovDegrees(focalLengthMm, sensorProfile.heightMm)
        : Number.NaN;

    return {
        mediaItemId: asTrimmedString(item.id),
        lockTarget,
        orientationReference: surfaceTargetHint?.orientationReference
            || (lockTarget === "earth" ? "moon-north" : "world"),
        focalLengthMm,
        verticalFovDegrees,
        sensorProfileId: sensorProfile?.id || "",
        surfaceTarget: surfaceTargetHint?.surfaceTarget || null,
    };
}

export {
    computeVerticalFovDegrees,
    inferMediaShotViewHint,
    parseFocalLengthMm,
};
