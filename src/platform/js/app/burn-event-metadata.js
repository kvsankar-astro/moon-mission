function asTrimmedString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeBurnDirection(value) {
    const normalized = asTrimmedString(value).toLowerCase();
    if (normalized === "prograde" || normalized === "retrograde" || normalized === "attitude") {
        return normalized;
    }
    return "";
}

function formatBurnDuration(durationSeconds, { unknownLabel = "Duration unpublished" } = {}) {
    const totalSeconds = Math.round(Number(durationSeconds));
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
        return unknownLabel;
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];

    if (hours > 0) parts.push(`${hours} h`);
    if (minutes > 0) parts.push(`${minutes} m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} s`);

    return parts.join(" ");
}

function inferBurnMetadata(eventLike) {
    const corpus = [
        eventLike?.label,
        eventLike?.infoText,
        eventLike?.hoverText,
    ].map((part) => asTrimmedString(part).toLowerCase()).join(" ");

    if (!corpus) {
        return { direction: "", typeLabel: "Burn" };
    }

    if (/(attitude|slew|reorient|re-orient|orientation|pointing|trim)/.test(corpus)) {
        return { direction: "attitude", typeLabel: "Attitude-control burn" };
    }

    if (/(trajectory correction|course correction|\brtc[- ]?\d|\botc[- ]?\d|\btcm\b)/.test(corpus)) {
        return { direction: "prograde", typeLabel: "Trajectory-correction burn" };
    }

    if (/(deorbit|retrograde|braking|capture|orbit insertion|lunar orbit insertion|descent|lower(?:ing)?|reduction)/.test(corpus)) {
        return { direction: "retrograde", typeLabel: "Retrograde burn" };
    }

    if (/(separation burn|separation|disposal burn|disposal)/.test(corpus)) {
        return { direction: "prograde", typeLabel: "Separation burn" };
    }

    if (/(raise|boost|trans[- ]?lunar|injection|departure|escape|perigee|apogee|perilune|apolune|raise burn)/.test(corpus)) {
        return { direction: "prograde", typeLabel: "Prograde burn" };
    }

    return { direction: "", typeLabel: "Burn" };
}

function containsCompactText(haystack, needle) {
    const compactHaystack = asTrimmedString(haystack).toLowerCase().replace(/\s+/g, "");
    const compactNeedle = asTrimmedString(needle).toLowerCase().replace(/\s+/g, "");
    if (!compactHaystack || !compactNeedle) return false;
    return compactHaystack.includes(compactNeedle);
}

function resolveBurnMetadata(eventLike) {
    if (!eventLike?.burnFlag) {
        return {
            direction: "",
            typeLabel: "",
            durationLabel: "",
            summaryLabel: "",
        };
    }

    const explicitDirection = normalizeBurnDirection(eventLike?.burnDirection);
    const explicitTypeLabel = asTrimmedString(eventLike?.burnTypeLabel);
    const inferred = inferBurnMetadata(eventLike);
    const direction = explicitDirection || inferred.direction;
    const typeLabel = explicitTypeLabel || inferred.typeLabel || (direction ? `${direction} burn` : "Burn");
    const durationLabel = formatBurnDuration(eventLike?.durationSeconds);
    const parts = [typeLabel];

    if (
        direction &&
        typeLabel &&
        !typeLabel.toLowerCase().includes(direction)
    ) {
        parts.push(direction.charAt(0).toUpperCase() + direction.slice(1));
    }

    if (durationLabel) {
        parts.push(durationLabel);
    }

    return {
        direction,
        typeLabel,
        durationLabel,
        summaryLabel: parts.filter(Boolean).join(" • "),
    };
}

function buildBurnSummary(eventLike, baseText = "") {
    const metadata = resolveBurnMetadata(eventLike);
    if (!metadata.summaryLabel) {
        return "";
    }

    const parts = [];
    if (metadata.typeLabel && !asTrimmedString(baseText).toLowerCase().includes(metadata.typeLabel.toLowerCase())) {
        parts.push(metadata.typeLabel);
    }

    if (
        metadata.direction &&
        metadata.typeLabel &&
        !metadata.typeLabel.toLowerCase().includes(metadata.direction) &&
        !asTrimmedString(baseText).toLowerCase().includes(metadata.direction)
    ) {
        parts.push(metadata.direction.charAt(0).toUpperCase() + metadata.direction.slice(1));
    }

    if (
        metadata.durationLabel &&
        !containsCompactText(baseText, metadata.durationLabel)
    ) {
        parts.push(metadata.durationLabel);
    }

    if (parts.length === 0) {
        return metadata.summaryLabel;
    }

    return parts.join(" • ");
}

function buildEventDisplayText(eventLike, baseText = "") {
    const text = asTrimmedString(baseText);
    const burnSummary = buildBurnSummary(eventLike, text);
    if (text && burnSummary) {
        return `${text} • ${burnSummary}`;
    }
    return text || burnSummary;
}

function buildEventHoverText(eventLike) {
    return buildEventDisplayText(
        eventLike,
        eventLike?.hoverText || eventLike?.infoText || eventLike?.label || "",
    );
}

function buildEventInfoText(eventLike) {
    return buildEventDisplayText(
        eventLike,
        eventLike?.infoText || eventLike?.label || "",
    );
}

function resolveBurnIndicatorAngle(eventLike, defaultAngle = 0) {
    const metadata = resolveBurnMetadata(eventLike);
    if (metadata.direction === "prograde") {
        return defaultAngle + 180;
    }
    if (metadata.direction === "retrograde") {
        return defaultAngle;
    }
    if (metadata.direction === "attitude") {
        return 0;
    }
    return defaultAngle;
}

function resolveBurnIndicatorShape(eventLike) {
    const metadata = resolveBurnMetadata(eventLike);
    if (metadata.direction === "attitude") {
        return "0 -14 14 0 0 14 -14 0";
    }
    return "3 9 3 -9 45 0";
}

function resolveBurnIndicatorFill(eventLike) {
    const metadata = resolveBurnMetadata(eventLike);
    if (metadata.direction === "retrograde") {
        return "#ff8a4d";
    }
    if (metadata.direction === "attitude") {
        return "#ffcf6a";
    }
    return "#ff4d4d";
}

function isBurnIndicatorVisibleAtTime(
    eventLike,
    currentTimeMs,
    {
        nowWallTimeMs = Date.now(),
        minimumInstantWallTimeMs = 500,
    } = {},
) {
    if (!eventLike?.burnFlag || !Number.isFinite(currentTimeMs)) {
        return false;
    }
    const rawStart = eventLike.startTime;
    const startTimeMs =
        rawStart instanceof Date
            ? rawStart.getTime()
            : Number.isFinite(rawStart)
                ? rawStart
                : new Date(rawStart).getTime();
    if (!Number.isFinite(startTimeMs)) {
        return false;
    }

    const durationSeconds = Number(eventLike.durationSeconds);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        if (currentTimeMs === startTimeMs) {
            return true;
        }
        const shownAtWallTimeMs = Number(eventLike?._shownAtWallTimeMs);
        return Number.isFinite(shownAtWallTimeMs)
            && Number.isFinite(nowWallTimeMs)
            && nowWallTimeMs >= shownAtWallTimeMs
            && (nowWallTimeMs - shownAtWallTimeMs) < minimumInstantWallTimeMs;
    }

    const endTimeMs = startTimeMs + Math.round(durationSeconds * 1000);
    return currentTimeMs >= startTimeMs && currentTimeMs < endTimeMs;
}

export {
    normalizeBurnDirection,
    formatBurnDuration,
    resolveBurnMetadata,
    buildEventHoverText,
    buildEventInfoText,
    resolveBurnIndicatorAngle,
    resolveBurnIndicatorShape,
    resolveBurnIndicatorFill,
    isBurnIndicatorVisibleAtTime,
};
