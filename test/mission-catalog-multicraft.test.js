import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

function loadMissionCatalog() {
    const catalogPath = join(process.cwd(), "assets", "mission-catalog.json");
    return JSON.parse(readFileSync(catalogPath, "utf-8"));
}

function getMissionEntry(catalog, folder) {
    return (catalog.missions || []).find((entry) => entry.folder === folder);
}

describe("mission catalog combined multi-craft surfaces", () => {
    it("describes Chandrayaan 2 and 3 as combined missions without legacy URL fields", () => {
        const catalog = loadMissionCatalog();
        const ch2 = getMissionEntry(catalog, "chandrayaan2");
        const ch3 = getMissionEntry(catalog, "chandrayaan3");

        expect(ch2).not.toHaveProperty("key");
        expect(ch2).not.toHaveProperty("queryValue");
        expect(ch2).not.toHaveProperty("aliases");
        expect(ch2?.dimensions).toMatchObject({
            missionType: "Orbiter + Lander",
            craftClass: "Multi-Craft",
        });

        expect(ch3).not.toHaveProperty("key");
        expect(ch3).not.toHaveProperty("queryValue");
        expect(ch3).not.toHaveProperty("aliases");
        expect(ch3?.dimensions).toMatchObject({
            missionType: "Lander + Propulsion Module",
            craftClass: "Multi-Craft",
        });
    });

    it("describes GRAIL as the combined twin mission with folder-only identity", () => {
        const catalog = loadMissionCatalog();
        const grail = getMissionEntry(catalog, "grail");

        expect(grail).not.toHaveProperty("key");
        expect(grail).not.toHaveProperty("queryValue");
        expect(grail).not.toHaveProperty("aliases");
        expect(grail?.dimensions).toMatchObject({
            missionType: "Twin Orbiters",
            craftClass: "Multi-Craft",
        });
    });
});
