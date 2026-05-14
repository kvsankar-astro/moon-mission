import { describe, expect, it } from "vitest";

import { resolveMediaSelectionState } from "../src/platform/js/core/domain/media-selection-state.js";

const ITEMS = [
    { id: "launch", startTimeMs: Date.parse("2026-04-02T01:59:30Z"), title: "Launch" },
    { id: "earthrise", startTimeMs: Date.parse("2026-04-06T23:25:00Z"), title: "Earthrise" },
    { id: "splashdown", startTimeMs: Date.parse("2026-04-11T00:07:12Z"), title: "Splashdown" },
];

describe("resolveMediaSelectionState", () => {
    it("selects the latest media item at or before the current mission time", () => {
        const selection = resolveMediaSelectionState({
            items: ITEMS,
            timeMs: Date.parse("2026-04-06T23:24:20Z"),
            nearbyRadius: 1,
        });

        expect(selection.activeItem?.id).toBe("launch");
        expect(selection.previousItem).toBeNull();
        expect(selection.nextItem?.id).toBe("earthrise");
        expect(selection.nearbyItems.map((item) => item.id)).toEqual([
            "launch",
            "earthrise",
        ]);
    });
});
