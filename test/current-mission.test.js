import { describe, expect, it } from "vitest";

import {
    parseMissionFolderFromDataPath,
    parseMissionKeyFromPathname,
    resolveCurrentMissionKey,
    resolveCurrentMissionKeys,
} from "../src/platform/js/core/domain/current-mission.js";

describe("current mission helpers", () => {
    it("parses mission folders from runtime data paths", () => {
        expect(parseMissionFolderFromDataPath("assets/artemis2/data/")).toBe("artemis2");
        expect(parseMissionFolderFromDataPath("https://example.com/assets/chandrayaan3/data/")).toBe("chandrayaan3");
    });

    it("parses clean mission folders from location pathnames", () => {
        expect(parseMissionKeyFromPathname("/artemis2/")).toBe("artemis2");
        expect(parseMissionKeyFromPathname("/chandrayaan3/index.html")).toBe("chandrayaan3");
        expect(parseMissionKeyFromPathname("/mission.html")).toBe("");
    });

    it("resolves the canonical folder from runtime data and clean paths only", () => {
        const windowRef = {
            location: {
                pathname: "/artemis2/",
                search: "?mode=compare",
            },
            missionConfig: {
                dataPath: "https://example.com/assets/artemis2/data/",
            },
        };
        expect(resolveCurrentMissionKey(windowRef)).toBe("artemis2");
        expect(Array.from(resolveCurrentMissionKeys(windowRef))).toEqual(["artemis2"]);

        const cleanWindow = {
            location: {
                pathname: "/artemis2/",
                search: "",
            },
            missionConfig: null,
        };
        expect(resolveCurrentMissionKey(cleanWindow)).toBe("artemis2");
    });
});
