const ALIGNMENT_ROLE_PRIMARY = "primary";
const ALIGNMENT_ROLE_COMPARISON = "comparison";

function asTrimmedString(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeKey(value) {
    return asTrimmedString(value).toLowerCase();
}

function resolveAlignmentRole(eventInfo) {
    return normalizeKey(
        eventInfo?.timelineRole ||
        (eventInfo?.comparisonEvent ? ALIGNMENT_ROLE_COMPARISON : ALIGNMENT_ROLE_PRIMARY),
    );
}

function resolveAlignmentOptionValue(eventInfo) {
    return normalizeKey(eventInfo?.timelineSourceKey || eventInfo?.key);
}

function resolveAlignmentOptionLabel(eventInfo) {
    return asTrimmedString(
        eventInfo?.timelineLabel,
        asTrimmedString(eventInfo?.label, "Event"),
    );
}

function isNowAlignmentEvent(eventInfo) {
    return (
        eventInfo?.kind === "now" ||
        normalizeKey(eventInfo?.timelineSourceKey || eventInfo?.key) === "now"
    );
}

function collectCompareAlignmentOptions(eventInfos, { comparison = false } = {}) {
    const targetRole = comparison
        ? ALIGNMENT_ROLE_COMPARISON
        : ALIGNMENT_ROLE_PRIMARY;
    const seen = new Set();
    const options = [];

    for (const eventInfo of Array.isArray(eventInfos) ? eventInfos : []) {
        if (resolveAlignmentRole(eventInfo) !== targetRole) {
            continue;
        }

        const value = resolveAlignmentOptionValue(eventInfo);
        if (!value || isNowAlignmentEvent(eventInfo) || seen.has(value)) {
            continue;
        }

        seen.add(value);
        options.push({
            value,
            label: resolveAlignmentOptionLabel(eventInfo),
        });
    }

    return options;
}

function buildCompareAlignmentOptions(eventInfos) {
    return {
        primaryOptions: collectCompareAlignmentOptions(eventInfos),
        comparisonOptions: collectCompareAlignmentOptions(eventInfos, {
            comparison: true,
        }),
    };
}

export {
    ALIGNMENT_ROLE_COMPARISON,
    ALIGNMENT_ROLE_PRIMARY,
    buildCompareAlignmentOptions,
    collectCompareAlignmentOptions,
};
