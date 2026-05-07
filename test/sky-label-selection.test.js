import { describe, expect, it } from "vitest";

import {
    selectSkyLabelCandidates,
} from "../src/platform/js/core/domain/sky-label-selection.js";

describe("selectSkyLabelCandidates", () => {
    it("selects the brightest visible fraction of projected star labels", () => {
        const candidates = [
            { text: "dim", magnitude: 5, point: { x: 10, y: 10 } },
            { text: "bright", magnitude: 1, point: { x: 20, y: 20 } },
            { text: "middle", magnitude: 3, point: { x: 30, y: 30 } },
            { text: "brightest", magnitude: -1, point: { x: 40, y: 40 } },
            { text: "faint", magnitude: 6, point: { x: 50, y: 50 } },
            { text: "other", magnitude: 4, point: { x: 60, y: 60 } },
            { text: "other 2", magnitude: 4.2, point: { x: 70, y: 70 } },
            { text: "other 3", magnitude: 4.4, point: { x: 80, y: 80 } },
            { text: "other 4", magnitude: 4.6, point: { x: 90, y: 90 } },
            { text: "other 5", magnitude: 4.8, point: { x: 100, y: 100 } },
        ];

        expect(selectSkyLabelCandidates(candidates).map((candidate) => candidate.text))
            .toEqual(["brightest", "bright"]);
    });

    it("ignores invalid projections and respects the max label count", () => {
        const candidates = [
            { text: "bad point", magnitude: 0, point: { x: Number.NaN, y: 2 } },
            { text: "", magnitude: 0, point: { x: 1, y: 2 } },
            { text: "brightest", magnitude: -1, point: { x: 1, y: 2 } },
            { text: "bright", magnitude: 0, point: { x: 2, y: 3 } },
            { text: "hidden", magnitude: -2, point: { x: 4, y: 5 }, visible: false },
        ];

        expect(selectSkyLabelCandidates(candidates, { visibleFraction: 1, maxCount: 1 }))
            .toEqual([{ text: "brightest", magnitude: -1, point: { x: 1, y: 2 } }]);
    });
});
