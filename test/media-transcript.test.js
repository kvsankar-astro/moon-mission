import { describe, expect, it } from "vitest";

import {
    findTranscriptSegmentForHighlight,
    findTranscriptSegmentAtTime,
    formatTranscriptSegmentCaption,
    normalizeTranscriptDocument,
} from "../src/platform/js/core/domain/media-transcript.js";

describe("media transcript domain", () => {
    it("normalizes publishable transcript segments and strips display artifacts", () => {
        const transcript = normalizeTranscriptDocument({
            source: "broadcast",
            schemaVersion: 3,
            segments: [
                {
                    id: 1,
                    startSeconds: 10,
                    endSeconds: 12,
                    displaySpeaker: "Donald J. Trump",
                    text: "SECRETARY POMPEO: Today you've made history.",
                    status: "ok",
                },
                {
                    id: 2,
                    startSeconds: 12,
                    endSeconds: 13,
                    displaySpeaker: "Narrator",
                    text: "Transcription by CastingWords",
                    status: "hallucination",
                },
            ],
        });

        expect(transcript.segments).toHaveLength(1);
        expect(transcript.segments[0].text).toBe("Today you've made history.");
        expect(formatTranscriptSegmentCaption(transcript.segments[0])).toBe(
            "Donald J. Trump: Today you've made history.",
        );
    });

    it("finds the active segment on the combined broadcast timeline", () => {
        const transcript = normalizeTranscriptDocument({
            segments: [
                { id: 2, startSeconds: 20, endSeconds: 25, text: "second", status: "ok" },
                { id: 1, startSeconds: 10, endSeconds: 15, text: "first", status: "ok" },
            ],
        });

        expect(findTranscriptSegmentAtTime(transcript.segments, 12)?.text).toBe("first");
        expect(findTranscriptSegmentAtTime(transcript.segments, 22)?.text).toBe("second");
        expect(findTranscriptSegmentAtTime(transcript.segments, 16)).toBe(null);
    });

    it("uses tight display timing when present instead of raw whisper boundaries", () => {
        const transcript = normalizeTranscriptDocument({
            schemaVersion: 4,
            displayTimingMethod: {
                withWords: "displayStartSeconds = words[0].start; displayEndSeconds = words[-1].end + 0.15s",
            },
            segments: [
                {
                    id: 3223,
                    startSeconds: 31540,
                    endSeconds: 31961,
                    displayStartSeconds: 31540,
                    displayEndSeconds: 31542.31,
                    text: "for the day before they head into their sleep period.",
                    status: "ok",
                },
            ],
        });

        expect(transcript.schemaVersion).toBe(4);
        expect(transcript.displayTimingMethod).toEqual(expect.objectContaining({
            withWords: expect.any(String),
        }));
        expect(findTranscriptSegmentAtTime(transcript.segments, 31541)?.id).toBe(3223);
        expect(findTranscriptSegmentAtTime(transcript.segments, 31600)).toBe(null);
    });

    it("keeps zero-duration raw transcript segments when display timing is valid", () => {
        const transcript = normalizeTranscriptDocument({
            schemaVersion: 4,
            segments: [
                {
                    id: 946,
                    startSeconds: 8752,
                    endSeconds: 8752,
                    displayStartSeconds: 8752,
                    displayEndSeconds: 8752.05,
                    displaySpeaker: "Leah Cheshier-Mustachio",
                    text: "Thanks for that.",
                    status: "ok",
                },
            ],
        });

        expect(transcript.segments).toHaveLength(1);
        expect(findTranscriptSegmentAtTime(transcript.segments, 8752.02)?.id).toBe(946);
    });

    it("uses a forgiving highlight window for very short transcript lines", () => {
        const transcript = normalizeTranscriptDocument({
            schemaVersion: 4,
            segments: [
                {
                    id: 1,
                    startSeconds: 10,
                    endSeconds: 10,
                    displayStartSeconds: 10,
                    displayEndSeconds: 10.05,
                    text: "Copy.",
                    status: "ok",
                },
                {
                    id: 2,
                    startSeconds: 14,
                    endSeconds: 16,
                    displayStartSeconds: 14,
                    displayEndSeconds: 16,
                    text: "Next line.",
                    status: "ok",
                },
            ],
        });

        expect(findTranscriptSegmentAtTime(transcript.segments, 10.8)).toBe(null);
        expect(findTranscriptSegmentForHighlight(transcript.segments, 10.8)?.id).toBe(1);
        expect(findTranscriptSegmentForHighlight(transcript.segments, 13.8)).toBe(null);
        expect(findTranscriptSegmentForHighlight(transcript.segments, 14.2)?.id).toBe(2);
    });
});
