import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

function loadMissionCatalog() {
    const catalogPath = join(process.cwd(), "assets", "mission-catalog.json");
    return JSON.parse(readFileSync(catalogPath, "utf-8"));
}

function getMissionEntry(catalog, key) {
    return (catalog.missions || []).find((entry) => entry.key === key);
}

describe("mission catalog combined multi-craft surfaces", () => {
    it("describes Chandrayaan 2 and 3 as combined missions", () => {
        const catalog = loadMissionCatalog();
        const ch2 = getMissionEntry(catalog, "ch2");
        const ch3 = getMissionEntry(catalog, "ch3");

        expect(ch2?.aliases).toEqual(expect.arrayContaining(["chandrayaan2", "ch2", "cy2"]));
        expect(ch2?.aliases).not.toEqual(
            expect.arrayContaining(["chandrayaan2-vikram", "c2v"]),
        );
        expect(ch2?.dimensions).toMatchObject({
            missionType: "Orbiter + Lander",
            craftClass: "Multi-Craft",
        });

        expect(ch3?.aliases).toEqual(expect.arrayContaining(["chandrayaan3", "ch3", "cy3"]));
        expect(ch3?.aliases).not.toEqual(
            expect.arrayContaining(["chandrayaan3-vikram", "c3v"]),
        );
        expect(ch3?.dimensions).toMatchObject({
            missionType: "Lander + Propulsion Module",
            craftClass: "Multi-Craft",
        });
    });

    it("describes GRAIL as the combined twin mission without legacy aliases", () => {
        const catalog = loadMissionCatalog();
        const grail = getMissionEntry(catalog, "grail");

        expect(grail?.aliases).toEqual(["grail"]);
        expect(grail?.dimensions).toMatchObject({
            missionType: "Twin Orbiters",
            craftClass: "Multi-Craft",
        });
    });
});
