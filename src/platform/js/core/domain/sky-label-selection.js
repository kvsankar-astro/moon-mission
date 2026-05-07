const DEFAULT_VISIBLE_FRACTION = 0.2;
const DEFAULT_MAX_LABEL_COUNT = 36;

function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : Number.NaN;
}

function isProjectedLabelCandidate(candidate) {
    const point = candidate?.point || null;
    const text = String(candidate?.text || "").trim();
    const magnitude = toFiniteNumber(candidate?.magnitude);
    return (
        candidate?.visible !== false &&
        text.length > 0 &&
        Number.isFinite(magnitude) &&
        Number.isFinite(toFiniteNumber(point?.x)) &&
        Number.isFinite(toFiniteNumber(point?.y))
    );
}

function selectSkyLabelCandidates(
    candidates,
    {
        visibleFraction = DEFAULT_VISIBLE_FRACTION,
        maxCount = DEFAULT_MAX_LABEL_COUNT,
    } = {},
) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return [];
    }
    const rawFraction = Number(visibleFraction);
    const rawMaxCount = Number(maxCount);
    const fraction = Number.isFinite(rawFraction) ? Math.min(Math.max(rawFraction, 0), 1) : 0;
    const limit = Number.isFinite(rawMaxCount) ? Math.max(0, Math.floor(rawMaxCount)) : 0;
    if (fraction <= 0 || limit <= 0) {
        return [];
    }

    const visible = candidates.filter(isProjectedLabelCandidate);
    if (visible.length === 0) {
        return [];
    }

    const targetCount = Math.min(visible.length, limit, Math.max(1, Math.ceil(visible.length * fraction)));
    return visible
        .slice()
        .sort((a, b) => {
            const magnitudeDelta = Number(a.magnitude) - Number(b.magnitude);
            if (magnitudeDelta !== 0) {
                return magnitudeDelta;
            }
            return String(a.text || "").localeCompare(String(b.text || ""));
        })
        .slice(0, targetCount);
}

export {
    selectSkyLabelCandidates,
};
