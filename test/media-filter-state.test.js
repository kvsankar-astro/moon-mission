import { describe, expect, it } from "vitest";

import {
    buildMediaFilterModel,
    filterMediaItems,
} from "../src/platform/js/core/domain/media-filter-state.js";

const ITEMS = [
    {
        id: "a",
        enabled: true,
        kind: "image",
        crewCaptured: true,
        external: false,
        cameraId: "iphone",
        cameraLabel: "Crew iPhone",
    },
    {
        id: "b",
        enabled: true,
        kind: "image",
        crewCaptured: false,
        external: true,
        cameraId: "d5",
        cameraLabel: "D5 #1",
    },
    {
        id: "c",
        enabled: false,
        kind: "audioClip",
        crewCaptured: false,
        external: true,
        cameraId: "audio",
        cameraLabel: "Audio",
    },
];

describe("media filter state", () => {
    it("filters by audience and camera while ignoring disabled items", () => {
        expect(filterMediaItems(ITEMS, { audience: "crew" }).map((item) => item.id)).toEqual(["a"]);
        expect(filterMediaItems(ITEMS, { audience: "external" }).map((item) => item.id)).toEqual(["b"]);
        expect(filterMediaItems(ITEMS, { cameraId: "d5" }).map((item) => item.id)).toEqual(["b"]);
    });

    it("builds UI-facing filter counts", () => {
        const model = buildMediaFilterModel(ITEMS, { audience: "all", cameraId: "all" });

        expect(model.audienceOptions.find((option) => option.id === "all")?.count).toBe(2);
        expect(model.audienceOptions.find((option) => option.id === "crew")?.count).toBe(1);
        expect(model.cameraOptions.map((option) => option.id)).toEqual(["all", "iphone", "d5"]);
    });
});
