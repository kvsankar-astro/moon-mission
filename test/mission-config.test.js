import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
    normalizeMissionConfig,
    parseMissionConfig,
    validateMissionConfig,
} from "../src/platform/js/core/domain/mission-config.js";

describe("mission-config pipeline", () => {
    it("rejects non-object mission configs", () => {
        expect(() => parseMissionConfig(null)).toThrow("Mission config must be a JSON object");
        expect(() => parseMissionConfig([])).toThrow("Mission config must be a JSON object");
    });

    it("reports validation errors for missing origin definitions", () => {
        const parsed = parseMissionConfig({
            spacecraft_mnemonic: "SC",
            origins: ["geo"],
        });
        const diagnostics = validateMissionConfig(parsed);
        expect(diagnostics.errors.length).toBeGreaterThan(0);
        expect(diagnostics.errors[0]).toContain("Origin 'geo'");
    });

    it("normalizes defaults for optional fields", () => {
        const parsed = parseMissionConfig({
            spacecraft_mnemonic: "TEST",
            origins: ["geo"],
            geo: {
                center: "earth_center",
            },
        });
        const diagnostics = validateMissionConfig(parsed);
        expect(diagnostics.errors).toEqual([]);

        const normalized = normalizeMissionConfig(parsed);
        expect(normalized.mission_name).toBe("TEST");
        expect(normalized.mission_name_short).toBe("TEST");
        expect(normalized.ephemeris_source).toBe("chebyshev");
        expect(normalized.origins).toEqual(["geo"]);
        expect(normalized.primaryCraftId).toBe("SC");
        expect(normalized.crafts).toHaveLength(1);
        expect(normalized.crafts[0].mnemonic).toBe("TEST");
        expect(normalized.phases).toBeUndefined();
        expect(normalized.geo.orbits_file).toBe("geo-TEST");
        expect(Array.isArray(normalized.eventConfigs.geo)).toBe(true);
    });

    it("normalizes explicit crafts and preserves a primary craft alias", () => {
        const parsed = parseMissionConfig({
            primaryCraftId: "ORB",
            crafts: [
                {
                    id: "orb",
                    mnemonic: "CH2O",
                    spacecraft_id: -153,
                    spans: {
                        lunar: {
                            startTime: "2019-08-20T00:00:00Z",
                            endTime: "2019-09-01T00:00:00Z",
                        },
                    },
                },
                {
                    id: "vik",
                    mnemonic: "C2V",
                    spacecraft_id: -153,
                    spans: {
                        lunar: {
                            startTime: "2019-09-02T07:45:00Z",
                            endTime: "2019-09-07T00:00:00Z",
                        },
                    },
                },
            ],
            origins: ["geo", "lunar"],
            geo: { center: "earth_center" },
            lunar: { center: "moon_center" },
        });

        const normalized = normalizeMissionConfig(parsed);
        expect(normalized.primaryCraftId).toBe("ORB");
        expect(normalized.spacecraft_mnemonic).toBe("CH2O");
        expect(normalized.spacecraft_id).toBe(-153);
        expect(normalized.crafts).toHaveLength(2);
        expect(normalized.crafts[0].id).toBe("ORB");
        expect(normalized.crafts[0].primary).toBe(true);
        expect(normalized.crafts[0].aliases).toContain("SC");
        expect(normalized.crafts[1].id).toBe("VIK");
        expect(normalized.crafts[1].spans.lunar.startTime).toBe("2019-09-02T07:45:00Z");
    });

    it("validates and normalizes all repository mission configs", () => {
        const missionIds = [
            "apollo10-lm",
            "apollo11-sivb",
            "artemis1",
            "chandrayaan2",
            "chandrayaan3",
        ];

        for (const missionId of missionIds) {
            const configPath = join(process.cwd(), "assets", missionId, "data", "config.json");
            const raw = JSON.parse(readFileSync(configPath, "utf-8"));
            const parsed = parseMissionConfig(raw);
            const diagnostics = validateMissionConfig(parsed);
            expect(diagnostics.errors, `Config errors for ${missionId}`).toEqual([]);

            const normalized = normalizeMissionConfig(parsed);
            expect(normalized.spacecraft_mnemonic.length).toBeGreaterThan(0);
            expect(normalized.origins.length).toBeGreaterThan(0);

            for (const origin of normalized.origins) {
                expect(normalized[origin], `Origin '${origin}' missing in normalized ${missionId}`).toBeDefined();
                expect(typeof normalized[origin].orbits_file).toBe("string");
                expect(Array.isArray(normalized.eventConfigs[origin])).toBe(true);
            }
        }
    });
});
