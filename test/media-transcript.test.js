import { describe, expect, it } from "vitest";

import {
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
});
