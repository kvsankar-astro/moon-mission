function asTrimmedString(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeBodyId(value) {
    return asTrimmedString(value).toUpperCase();
}

function normalizeComparisonMissionParam(value) {
    return asTrimmedString(value).toLowerCase();
}

function sanitizeComparisonIdPart(value, fallback) {
    const normalized = normalizeBodyId(value)
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return normalized || fallback;
}

const COMPARISON_CRAFT_ID_PREFIX = "CMP_";
const COMPARISON_OVERLAY_PALETTES = Object.freeze([
    { color: "#d946ef", orbitcolor: "#22c55e" },
    { color: "#38bdf8", orbitcolor: "#f97316" },
    { color: "#f43f5e", orbitcolor: "#a78bfa" },
]);

function buildComparisonOverlayCraftId({ missionFolder, sourceCraftId }) {
    const missionPart = sanitizeComparisonIdPart(missionFolder, "MISSION");
    const craftPart = sanitizeComparisonIdPart(sourceCraftId, "CRAFT");
    return `${COMPARISON_CRAFT_ID_PREFIX}${missionPart}_${craftPart}`;
}

function buildComparisonOverlaySupportBodyId({ compareCraftId, sourceBodyId }) {
    const craftPart = sanitizeComparisonIdPart(compareCraftId, "CRAFT");
    const bodyPart = sanitizeComparisonIdPart(sourceBodyId, "BODY");
    return `${craftPart}__${bodyPart}`;
}

function normalizeTimeRangeCandidate(candidate) {
    if (!candidate || typeof candidate !== "object") {
        return null;
    }

    const startMs = Number(candidate.startMs);
    const endMs = Number(candidate.endMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
        return null;
    }

    return { startMs, endMs };
}

function normalizeColorToken(value) {
    return asTrimmedString(value).toLowerCase();
}

function resolveComparisonOverlayPalette(primaryCraft) {
    const avoidedColors = new Set(
        [primaryCraft?.color, primaryCraft?.orbitcolor]
            .map(normalizeColorToken)
            .filter(Boolean),
    );

    for (const palette of COMPARISON_OVERLAY_PALETTES) {
        const paletteColors = [palette.color, palette.orbitcolor]
            .map(normalizeColorToken)
            .filter(Boolean);
        if (paletteColors.every((color) => !avoidedColors.has(color))) {
            return palette;
        }
    }

    return COMPARISON_OVERLAY_PALETTES[0];
}

function mapOffsetTimeRange({ timeMs, fromRange, toRange }) {
    if (!Number.isFinite(timeMs)) {
        return timeMs;
    }

    const normalizedFromRange = normalizeTimeRangeCandidate(fromRange);
    const normalizedToRange = normalizeTimeRangeCandidate(toRange);
    if (!normalizedFromRange || !normalizedToRange) {
        return timeMs;
    }

    return normalizedToRange.startMs + (timeMs - normalizedFromRange.startMs);
}

function resolveComparisonOverlay(globalConfig) {
    const overlay = globalConfig?.comparisonOverlay;
    return overlay && typeof overlay === "object" ? overlay : null;
}

function resolveComparisonOverlayMappedBodyIds(globalConfig) {
    const overlay = resolveComparisonOverlay(globalConfig);
    const normalizedIds = [];
    const seen = new Set();

    for (const candidate of [
        overlay?.compareCraftId,
        overlay?.craftId,
        ...Object.values(overlay?.normalizationSupportBodyIdsByOrigin || {}),
    ]) {
        const normalized = normalizeBodyId(candidate);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        normalizedIds.push(normalized);
    }

    return normalizedIds;
}

function resolveComparisonOverlayBodyId(globalConfig) {
    const overlay = resolveComparisonOverlay(globalConfig);
    return normalizeBodyId(overlay?.compareCraftId || overlay?.craftId);
}

function isComparisonOverlayBody(globalConfig, bodyId) {
    const normalizedBodyId = normalizeBodyId(bodyId);
    if (!normalizedBodyId) return false;
    return normalizedBodyId === resolveComparisonOverlayBodyId(globalConfig);
}

function isComparisonOverlayMappedBody(globalConfig, bodyId) {
    const normalizedBodyId = normalizeBodyId(bodyId);
    if (!normalizedBodyId) return false;
    return resolveComparisonOverlayMappedBodyIds(globalConfig).includes(normalizedBodyId);
}

function resolveComparisonTimeRangeByOrigin(rangeMap, config) {
    if (!rangeMap || typeof rangeMap !== "object") {
        return null;
    }

    const normalizedConfig = asTrimmedString(config).toLowerCase();
    const directRange = normalizeTimeRangeCandidate(rangeMap[normalizedConfig]);
    if (directRange) {
        return directRange;
    }

    if (normalizedConfig === "relative") {
        return (
            normalizeTimeRangeCandidate(rangeMap.geo) ||
            normalizeTimeRangeCandidate(rangeMap.relative)
        );
    }

    if (normalizedConfig === "geo") {
        return (
            normalizeTimeRangeCandidate(rangeMap.geo) ||
            normalizeTimeRangeCandidate(rangeMap.relative)
        );
    }

    return normalizeTimeRangeCandidate(rangeMap.relative);
}

function resolveComparisonBodyValueByOrigin(valueMap, config) {
    if (!valueMap || typeof valueMap !== "object") {
        return "";
    }

    const normalizedConfig = asTrimmedString(config).toLowerCase();
    const directValue = asTrimmedString(valueMap[normalizedConfig]);
    if (directValue) {
        return directValue;
    }

    if (normalizedConfig === "relative") {
        return (
            asTrimmedString(valueMap.geo) ||
            asTrimmedString(valueMap.relative)
        );
    }

    if (normalizedConfig === "geo") {
        return (
            asTrimmedString(valueMap.geo) ||
            asTrimmedString(valueMap.relative)
        );
    }

    return asTrimmedString(valueMap.relative);
}

function resolveComparisonDisplayTimeRange({ globalConfig, bodyId, config }) {
    if (!isComparisonOverlayMappedBody(globalConfig, bodyId)) {
        return null;
    }

    const overlay = resolveComparisonOverlay(globalConfig);
    return resolveComparisonTimeRangeByOrigin(
        overlay?.displayTimeRangesByOrigin,
        config,
    );
}

function resolveComparisonSourceTimeRange({ globalConfig, bodyId, config }) {
    if (!isComparisonOverlayMappedBody(globalConfig, bodyId)) {
        return null;
    }

    const overlay = resolveComparisonOverlay(globalConfig);
    return resolveComparisonTimeRangeByOrigin(
        overlay?.sourceTimeRangesByOrigin,
        config,
    );
}

function mapComparisonBodyTimeMs({ globalConfig, bodyId, config, timeMs }) {
    const displayRange = resolveComparisonDisplayTimeRange({
        globalConfig,
        bodyId,
        config,
    });
    const sourceRange = resolveComparisonSourceTimeRange({
        globalConfig,
        bodyId,
        config,
    });

    if (!displayRange || !sourceRange) {
        return timeMs;
    }

    return mapOffsetTimeRange({
        timeMs,
        fromRange: displayRange,
        toRange: sourceRange,
    });
}

function resolveComparisonDisplayAvailabilityTimeRange({
    globalConfig,
    bodyId,
    config,
}) {
    const displayRange = resolveComparisonDisplayTimeRange({
        globalConfig,
        bodyId,
        config,
    });
    const sourceRange = resolveComparisonSourceTimeRange({
        globalConfig,
        bodyId,
        config,
    });
    if (!displayRange || !sourceRange) {
        return null;
    }

    return {
        startMs: displayRange.startMs,
        endMs: mapOffsetTimeRange({
            timeMs: sourceRange.endMs,
            fromRange: sourceRange,
            toRange: displayRange,
        }),
    };
}

function resolveComparisonOverlayNormalizationSupportBodyId({
    globalConfig,
    bodyId,
    config,
}) {
    if (!isComparisonOverlayBody(globalConfig, bodyId)) {
        return "";
    }

    const overlay = resolveComparisonOverlay(globalConfig);
    return normalizeBodyId(
        resolveComparisonBodyValueByOrigin(
            overlay?.normalizationSupportBodyIdsByOrigin,
            config,
        ),
    );
}

function resolveComparisonOverlayNormalizationSourceBodyId({
    globalConfig,
    bodyId,
    config,
}) {
    if (!isComparisonOverlayBody(globalConfig, bodyId)) {
        return "";
    }

    const overlay = resolveComparisonOverlay(globalConfig);
    return normalizeBodyId(
        resolveComparisonBodyValueByOrigin(
            overlay?.normalizationSourceBodyIdsByOrigin,
            config,
        ),
    );
}

function resolveComparisonDefaultVisibleCraftIds(globalConfig) {
    const overlay = resolveComparisonOverlay(globalConfig);
    if (!Array.isArray(overlay?.defaultVisibleCraftIds)) {
        return [];
    }

    const normalizedIds = [];
    const seen = new Set();
    for (const bodyId of overlay.defaultVisibleCraftIds) {
        const normalized = normalizeBodyId(bodyId);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        normalizedIds.push(normalized);
    }
    return normalizedIds;
}

function buildComparisonOverlayCraft({
    sourceCraft,
    primaryCraft,
    compareCraftId,
    missionFolder,
    missionLabel,
    missionShortLabel,
}) {
    const labelBase = asTrimmedString(
        sourceCraft?.viewLabel,
        asTrimmedString(
            sourceCraft?.name,
            asTrimmedString(
                sourceCraft?.mnemonic,
                asTrimmedString(sourceCraft?.id, "Craft"),
            ),
        ),
    );
    const missionPrefix = asTrimmedString(
        missionShortLabel,
        asTrimmedString(missionLabel, missionFolder),
    );
    const compositeLabel = missionPrefix ? `${missionPrefix} ${labelBase}` : labelBase;
    const overlayPalette = resolveComparisonOverlayPalette(primaryCraft);
    const spacecraftId = Number(sourceCraft?.spacecraft_id);

    return {
        id: compareCraftId,
        mnemonic: compareCraftId,
        aliases: [],
        primary: false,
        name: compositeLabel,
        viewLabel: compositeLabel,
        // Compare mode needs a stable overlay palette so both missions stay visually distinct.
        color: overlayPalette.color,
        orbitcolor: overlayPalette.orbitcolor,
        spacecraft_id: Number.isFinite(spacecraftId) ? spacecraftId : null,
        spacecraftModel:
            sourceCraft?.spacecraftModel && typeof sourceCraft.spacecraftModel === "object"
                ? { ...sourceCraft.spacecraftModel }
                : undefined,
        comparisonOverlay: true,
        comparisonMissionFolder: asTrimmedString(missionFolder),
        comparisonSourceCraftId: asTrimmedString(sourceCraft?.id),
        comparisonSourceMnemonic: asTrimmedString(sourceCraft?.mnemonic),
    };
}

export {
    COMPARISON_CRAFT_ID_PREFIX,
    buildComparisonOverlayCraft,
    buildComparisonOverlayCraftId,
    buildComparisonOverlaySupportBodyId,
    isComparisonOverlayBody,
    isComparisonOverlayMappedBody,
    mapComparisonBodyTimeMs,
    mapOffsetTimeRange,
    normalizeComparisonMissionParam,
    resolveComparisonDisplayAvailabilityTimeRange,
    resolveComparisonDefaultVisibleCraftIds,
    resolveComparisonDisplayTimeRange,
    resolveComparisonOverlayMappedBodyIds,
    resolveComparisonOverlayNormalizationSourceBodyId,
    resolveComparisonOverlayNormalizationSupportBodyId,
    resolveComparisonOverlay,
    resolveComparisonSourceTimeRange,
};
