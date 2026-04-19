import { describe, expect, it, vi } from "vitest";

import { createCachedResourceLoader } from "../src/platform/js/data/cached-resource-loader.js";

describe("cached-resource-loader", () => {
    it("deduplicates concurrent loads and reuses the resolved value", async () => {
        let resolveLoad;
        const pendingLoad = new Promise((resolve) => {
            resolveLoad = resolve;
        });
        const load = vi.fn(() => pendingLoad);
        const loader = createCachedResourceLoader({
            label: "loadThing",
            load,
        });

        const pendingA = loader("asset.json");
        const pendingB = loader("asset.json");
        resolveLoad({ ok: true });

        const [valueA, valueB] = await Promise.all([pendingA, pendingB]);
        const valueC = await loader("asset.json");

        expect(load).toHaveBeenCalledTimes(1);
        expect(valueA).toEqual({ ok: true });
        expect(valueB).toBe(valueA);
        expect(valueC).toBe(valueA);
    });

    it("clears failed promises so retries can succeed", async () => {
        const load = vi
            .fn()
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce({ recovered: true });
        const loader = createCachedResourceLoader({
            label: "loadThing",
            load,
        });

        await expect(loader("asset.json")).rejects.toThrow("boom");
        await expect(loader("asset.json")).resolves.toEqual({ recovered: true });
        expect(load).toHaveBeenCalledTimes(2);
    });

    it("requires a url argument", async () => {
        const loader = createCachedResourceLoader({
            label: "loadThing",
            load: async () => ({}),
        });

        await expect(loader("")).rejects.toThrow("loadThing(url) requires a URL");
    });
});
