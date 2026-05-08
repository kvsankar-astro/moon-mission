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
        batch: 2,
        cameraId: "iphone",
        cameraLabel: "Crew iPhone",
    },
    {
        id: "b",
        enabled: true,
        kind: "image",
        crewCaptured: false,
        external: true,
        batch: 1,
        cameraId: "d5",
        cameraLabel: "D5 #1",
    },
    {
        id: "c",
        enabled: false,
        kind: "audioClip",
        crewCaptured: false,
        external: true,
        batch: 0,
        cameraId: "audio",
        cameraLabel: "Audio",
    },
    {
        id: "d",
        enabled: true,
        kind: "videoClip",
        crewCaptured: true,
        external: false,
        batch: 1,
        cameraId: "z9",
        cameraLabel: "Z9",
    },
];

describe("media filter state", () => {
    it("filters by audience and camera while ignoring disabled items", () => {
        expect(filterMediaItems(ITEMS, { audience: "crew" }).map((item) => item.id)).toEqual(["a", "d"]);
        expect(filterMediaItems(ITEMS, { audience: "external" }).map((item) => item.id)).toEqual(["b"]);
        expect(filterMediaItems(ITEMS, { cameraId: "d5" }).map((item) => item.id)).toEqual(["b"]);
    });

    it("matches upstream quick filters and multi-select camera buttons", () => {
        expect(filterMediaItems(ITEMS, { quick: "new" }).map((item) => item.id)).toEqual(["a"]);
        expect(filterMediaItems(ITEMS, { quick: "videos" }).map((item) => item.id)).toEqual(["d"]);
        expect(filterMediaItems(ITEMS, { cameraIds: ["iphone", "z9"] }).map((item) => item.id)).toEqual(["a", "d"]);
    });

    it("builds UI-facing filter counts", () => {
        const model = buildMediaFilterModel(ITEMS, { audience: "all", cameraId: "all" });

        expect(model.quickOptions.find((option) => option.id === "all")?.count).toBe(3);
        expect(model.quickOptions.find((option) => option.id === "crew")?.count).toBe(2);
        expect(model.quickOptions.find((option) => option.id === "new")?.count).toBe(1);
        expect(model.videoOption.count).toBe(1);
        expect(model.cameraOptions.map((option) => option.id)).toEqual(["all", "iphone", "d5", "z9"]);
        expect(model.cameraButtonOptions.map((option) => option.id)).toEqual(["d5a", "d5b", "z9", "gopro", "iphone"]);
    });
});
