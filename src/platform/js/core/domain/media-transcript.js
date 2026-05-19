const HIDDEN_TRANSCRIPT_STATUSES = new Set(["silent", "hallucination", "garbled"]);

function asTrimmedString(value) {
    if (typeof value !== "string") return "";
    return value.trim();
}

function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function normalizeTranscriptSpeaker(value) {
    const speaker = asTrimmedString(value);
    if (!speaker) return "";
    if (/^(unknown|unattributed speech|unidentified)$/i.test(speaker)) return "";
    return speaker;
}

function normalizeTranscriptText(value) {
    return asTrimmedString(value)
        .replace(/^\s*(?:SECRETARY\s+POMPEO|PRESIDENT\s+DONALD\s+J\.?)[:,]?\s*/i, "")
        .replace(/\s+/g, " ");
}

function normalizeTranscriptSegment(segment) {
    if (!segment || typeof segment !== "object" || Array.isArray(segment)) return null;
    const rawStartSeconds = toFiniteNumber(segment.startSeconds);
    const rawEndSeconds = toFiniteNumber(segment.endSeconds);
    const rawDisplayStartSeconds = toFiniteNumber(segment.displayStartSeconds);
    const rawDisplayEndSeconds = toFiniteNumber(segment.displayEndSeconds);
    const displayStartSeconds = Number.isFinite(rawDisplayStartSeconds)
        ? rawDisplayStartSeconds
        : rawStartSeconds;
    const displayEndSeconds = Number.isFinite(rawDisplayEndSeconds)
        ? rawDisplayEndSeconds
        : rawEndSeconds;
    const startSeconds = Number.isFinite(rawStartSeconds) ? rawStartSeconds : displayStartSeconds;
    const endSeconds = Number.isFinite(rawEndSeconds) ? rawEndSeconds : displayEndSeconds;
    const text = normalizeTranscriptText(segment.text);
    const status = asTrimmedString(segment.status || "ok").toLowerCase();
    if (
        !Number.isFinite(displayStartSeconds)
        || !Number.isFinite(displayEndSeconds)
        || displayEndSeconds <= displayStartSeconds
        || !Number.isFinite(startSeconds)
        || !Number.isFinite(endSeconds)
        || !text
        || HIDDEN_TRANSCRIPT_STATUSES.has(status)
    ) {
        return null;
    }
    return {
        id: segment.id,
        startSeconds,
        endSeconds,
        displayStartSeconds,
        displayEndSeconds,
        speaker: asTrimmedString(segment.speaker),
        displaySpeaker: asTrimmedString(segment.displaySpeaker),
        text,
        status,
        speakerConfidence: asTrimmedString(segment.speakerConfidence),
        originPart: asTrimmedString(segment.originPart),
        originStartSeconds: toFiniteNumber(segment.originStartSeconds),
    };
}

function normalizeTranscriptDocument(documentData) {
    const data = documentData && typeof documentData === "object" ? documentData : {};
    const segments = (Array.isArray(data.segments) ? data.segments : [])
        .map(normalizeTranscriptSegment)
        .filter(Boolean)
        .sort((a, b) => (
            a.displayStartSeconds - b.displayStartSeconds
            || a.displayEndSeconds - b.displayEndSeconds
            || a.startSeconds - b.startSeconds
        ));
    return {
        source: asTrimmedString(data.source),
        schemaVersion: toFiniteNumber(data.schemaVersion),
        durationHms: asTrimmedString(data.durationHms),
        timeBase: asTrimmedString(data.timeBase),
        displayTimingMethod: data.displayTimingMethod && typeof data.displayTimingMethod === "object"
            ? data.displayTimingMethod
            : null,
        speakers: data.speakers && typeof data.speakers === "object" && !Array.isArray(data.speakers)
            ? data.speakers
            : {},
        segments,
    };
}

function findTranscriptSegmentAtTime(segments, seconds) {
    const safeSeconds = Number(seconds);
    if (!Array.isArray(segments) || !Number.isFinite(safeSeconds)) return null;
    let low = 0;
    let high = segments.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const segment = segments[mid];
        if (safeSeconds < segment.displayStartSeconds) {
            high = mid - 1;
        } else if (safeSeconds >= segment.displayEndSeconds) {
            low = mid + 1;
        } else {
            return segment;
        }
    }
    return null;
}

function findTranscriptSegmentForHighlight(segments, seconds, {
    holdSeconds = 1.25,
    minimumVisibleSeconds = 1.2,
} = {}) {
    const safeSeconds = Number(seconds);
    if (!Array.isArray(segments) || !Number.isFinite(safeSeconds)) return null;
    let low = 0;
    let high = segments.length - 1;
    let candidateIndex = -1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const segment = segments[mid];
        if (safeSeconds < segment.displayStartSeconds) {
            high = mid - 1;
        } else {
            candidateIndex = mid;
            low = mid + 1;
        }
    }
    if (candidateIndex < 0) return null;
    const segment = segments[candidateIndex];
    if (safeSeconds < segment.displayEndSeconds) return segment;
    const duration = Math.max(0, segment.displayEndSeconds - segment.displayStartSeconds);
    const readableEnd = Math.max(
        segment.displayEndSeconds + Math.max(0, Number(holdSeconds) || 0),
        segment.displayStartSeconds + Math.max(duration, Number(minimumVisibleSeconds) || 0),
    );
    const nextStart = Number(segments[candidateIndex + 1]?.displayStartSeconds);
    const cappedReadableEnd = Number.isFinite(nextStart) ? Math.min(readableEnd, nextStart) : readableEnd;
    return safeSeconds < cappedReadableEnd ? segment : null;
}

function formatTranscriptSegmentCaption(segment) {
    if (!segment) return "";
    const text = normalizeTranscriptText(segment.text);
    if (!text) return "";
    const speaker = normalizeTranscriptSpeaker(segment.displaySpeaker || segment.speaker);
    return speaker ? `${speaker}: ${text}` : text;
}

export {
    findTranscriptSegmentForHighlight,
    findTranscriptSegmentAtTime,
    formatTranscriptSegmentCaption,
    normalizeTranscriptDocument,
};
