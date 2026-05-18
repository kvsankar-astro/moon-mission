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
    const startSeconds = toFiniteNumber(segment.startSeconds);
    const endSeconds = toFiniteNumber(segment.endSeconds);
    const text = normalizeTranscriptText(segment.text);
    const status = asTrimmedString(segment.status || "ok").toLowerCase();
    if (
        !Number.isFinite(startSeconds)
        || !Number.isFinite(endSeconds)
        || endSeconds <= startSeconds
        || !text
        || HIDDEN_TRANSCRIPT_STATUSES.has(status)
    ) {
        return null;
    }
    return {
        id: segment.id,
        startSeconds,
        endSeconds,
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
        .sort((a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds);
    return {
        source: asTrimmedString(data.source),
        schemaVersion: toFiniteNumber(data.schemaVersion),
        durationHms: asTrimmedString(data.durationHms),
        timeBase: asTrimmedString(data.timeBase),
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
        if (safeSeconds < segment.startSeconds) {
            high = mid - 1;
        } else if (safeSeconds >= segment.endSeconds) {
            low = mid + 1;
        } else {
            return segment;
        }
    }
    return null;
}

function formatTranscriptSegmentCaption(segment) {
    if (!segment) return "";
    const text = normalizeTranscriptText(segment.text);
    if (!text) return "";
    const speaker = normalizeTranscriptSpeaker(segment.displaySpeaker || segment.speaker);
    return speaker ? `${speaker}: ${text}` : text;
}

export {
    findTranscriptSegmentAtTime,
    formatTranscriptSegmentCaption,
    normalizeTranscriptDocument,
};
