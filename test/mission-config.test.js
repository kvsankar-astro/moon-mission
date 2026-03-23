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

    it("reports validation errors for missing phase definitions", () => {
        const parsed = parseMissionConfig({
            spacecraft_mnemonic: "SC",
            phases: ["geo"],
        });
        const diagnostics = validateMissionConfig(parsed);
        expect(diagnostics.errors.length).toBeGreaterThan(0);
        expect(diagnostics.errors[0]).toContain("Phase 'geo'");
    });

    it("normalizes defaults for optional fields", () => {
        const parsed = parseMissionConfig({
            spacecraft_mnemonic: "TEST",
            phases: ["geo"],
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
        expect(normalized.geo.orbits_file).toBe("geo-TEST");
        expect(Array.isArray(normalized.eventConfigs.geo)).toBe(true);
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
            expect(normalized.phases.length).toBeGreaterThan(0);

            for (const phase of normalized.phases) {
                expect(normalized[phase], `Phase '${phase}' missing in normalized ${missionId}`).toBeDefined();
                expect(typeof normalized[phase].orbits_file).toBe("string");
                expect(Array.isArray(normalized.eventConfigs[phase])).toBe(true);
            }
        }
    });
});
