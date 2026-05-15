import { describe, expect, it } from "vitest";
import {
    DEFAULT_RUNTIME_ASSET_BASE_URL,
    resolveRuntimeAssetBaseUrl,
    resolveRuntimeAssetUrl,
} from "../src/platform/js/core/domain/runtime-asset-url.js";

describe("runtime-asset-url", () => {
    it("uses assets.sankara.net moon-mission prefix by default", () => {
        expect(resolveRuntimeAssetBaseUrl({ globalObject: {} })).toBe(DEFAULT_RUNTIME_ASSET_BASE_URL);
        expect(resolveRuntimeAssetUrl("assets/artemis2/data/config.json", { globalObject: {} })).toBe(
            "https://assets.sankara.net/moon-mission/assets/artemis2/data/config.json",
        );
    });

    it("uses explicit global asset base overrides", () => {
        const globalObject = {
            MOON_MISSION_ASSET_BASE_URL: "https://cdn.example.test/lunar",
        };
        expect(resolveRuntimeAssetBaseUrl({ globalObject })).toBe("https://cdn.example.test/lunar/");
        expect(resolveRuntimeAssetUrl("/images/moon/map.jpg", { globalObject })).toBe(
            "https://cdn.example.test/lunar/images/moon/map.jpg",
        );
    });

    it("uses mission config asset base overrides", () => {
        const globalObject = {
            missionConfig: {
                assetBaseUrl: "https://assets.example.test/site-assets/",
            },
        };
        expect(resolveRuntimeAssetUrl("images/earth/map.jpg", { globalObject })).toBe(
            "https://assets.example.test/site-assets/images/earth/map.jpg",
        );
    });

    it("keeps absolute and special URLs unchanged", () => {
        expect(resolveRuntimeAssetUrl("https://example.test/file.jpg", { globalObject: {} })).toBe(
            "https://example.test/file.jpg",
        );
        expect(resolveRuntimeAssetUrl("//example.test/file.jpg", { globalObject: {} })).toBe(
            "//example.test/file.jpg",
        );
        expect(resolveRuntimeAssetUrl("data:text/plain,hello", { globalObject: {} })).toBe(
            "data:text/plain,hello",
        );
    });
});
