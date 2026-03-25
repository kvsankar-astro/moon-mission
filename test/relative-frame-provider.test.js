import { describe, expect, it } from "vitest";

import { getRelativeFrameQuaternion } from "../src/platform/js/data/relative-frame-provider.js";

describe("getRelativeFrameQuaternion", () => {
    it("returns normalized quaternion from FRAME_ROT chebyshev series", () => {
        const q = getRelativeFrameQuaternion({
            chebyshevData: {
                geo: {
                    FRAME_ROT: {
                        segments: [
                            {
                                t_start: 2451545.0,
                                t_end: 2451546.0,
                                cw: [2],
                                cx: [0],
                                cy: [0],
                                cz: [0],
                            },
                        ],
                    },
                },
            },
            config: "geo",
            // JD epoch for 2451545.5
            timeMs: (2451545.5 - 2440587.5) * 86400000,
        });

        expect(q).toBeTruthy();
        expect(q.w).toBeCloseTo(1, 12);
        expect(q.x).toBeCloseTo(0, 12);
        expect(q.y).toBeCloseTo(0, 12);
        expect(q.z).toBeCloseTo(0, 12);
    });

    it("returns null when FRAME_ROT data is unavailable", () => {
        const q = getRelativeFrameQuaternion({
            chebyshevData: { geo: {} },
            config: "geo",
            timeMs: Date.now(),
        });
        expect(q).toBeNull();
    });
});

