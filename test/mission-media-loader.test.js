import { describe, expect, it } from "vitest";

import { resolveLocalDevMediaManifestUrl } from "../src/platform/js/data/mission-media.js";

describe("mission media manifest loading", () => {
    it("uses the repo media manifest on localhost when dataPath points at the public asset bucket", () => {
        const windowRef = {
            location: {
                hostname: "127.0.0.1",
                origin: "http://127.0.0.1:7274",
                href: "http://127.0.0.1:7274/artemis2/",
            },
        };

        expect(resolveLocalDevMediaManifestUrl(
            "https://assets.sankara.net/moon-mission/assets/artemis2/data/media-manifest.json",
            windowRef,
        )).toBe("http://127.0.0.1:7274/assets/artemis2/data/media-manifest.json");
    });

    it("leaves production media manifest URLs unchanged", () => {
        const windowRef = {
            location: {
                hostname: "sankara.net",
                origin: "https://sankara.net",
                href: "https://sankara.net/astro/lunar-missions/artemis2/",
            },
        };
        const manifestUrl = "https://assets.sankara.net/moon-mission/assets/artemis2/data/media-manifest.json";

        expect(resolveLocalDevMediaManifestUrl(manifestUrl, windowRef)).toBe(manifestUrl);
    });
});
