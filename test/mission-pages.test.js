import { describe, expect, it } from "vitest";

import { getAppRoot, renderMissionPageForFolder } from "../scripts/lib/mission-pages.mjs";

describe("mission page generation", () => {
    it("renders canonical Artemis II mission HTML without redirect shells", () => {
        const html = renderMissionPageForFolder("artemis2", { appRoot: getAppRoot() });

        expect(html).toContain('<base href="../">');
        expect(html).toContain('window.__MISSION_PAGE_PRESET = {"canonicalUrl":"https://sankara.net/astro/lunar-missions/artemis2/"');
        expect(html).not.toContain('"queryValue"');
        expect(html).toContain('rel="canonical" href="https://sankara.net/astro/lunar-missions/artemis2/"');
        expect(html).toContain('content="https://sankara.net/astro/lunar-missions/artemis2/" data-mission-meta="og-url"');
        expect(html).not.toContain("http-equiv=\"refresh\"");
        expect(html).not.toContain("Redirecting to Artemis 2 mission animation");
    });

    it("renders clean mission pages for non-Artemis missions too", () => {
        const html = renderMissionPageForFolder("chandrayaan3", { appRoot: getAppRoot() });

        expect(html).toContain('window.__MISSION_PAGE_PRESET = {"canonicalUrl":"https://sankara.net/astro/lunar-missions/chandrayaan3/"');
        expect(html).not.toContain('"queryValue"');
        expect(html).toContain('rel="canonical" href="https://sankara.net/astro/lunar-missions/chandrayaan3/"');
        expect(html).toContain("Chandrayaan 3 Lunar Mission Orbit Animation");
    });
});
