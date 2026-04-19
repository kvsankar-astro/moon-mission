import { describe, expect, it } from "vitest";

import { assembleMissionConfig } from "../src/platform/js/core/domain/mission-config-assembly.js";

describe("mission-config-assembly", () => {
    it("merges profile patches and manifest data before normalization", () => {
        const baseConfig = {
            spacecraft_mnemonic: "CH3",
            origins: ["geo"],
            geo: {
                center: "earth_center",
                orbits_file: "geo-CH3",
            },
            ui: {
                headerTitle: "Base Header",
                viewDefaults: {
                    planeSelection: "DEFAULT",
                },
            },
        };
        const profilePatch = {
            mission_name: "Chandrayaan 3",
            ui: {
                headerTitle: "Patched Header",
                viewDefaults: {
                    relativeDefaultPlaneSelection: "YZ",
                },
            },
        };
        const manifestData = {
            phases: {
                geo: {
                    artifacts: {},
                },
            },
        };

        const { config, warnings } = assembleMissionConfig({
            baseConfig,
            profilePatch,
            manifestData,
        });

        expect(warnings).toEqual([]);
        expect(config.mission_name).toBe("Chandrayaan 3");
        expect(config.ui.headerTitle).toBe("Patched Header");
        expect(config.ui.viewDefaults).toEqual({
            planeSelection: "DEFAULT",
            relativeDefaultPlaneSelection: "YZ",
        });
        expect(config.ephemeris_manifest).toEqual(manifestData);
        expect(baseConfig.ui.viewDefaults.relativeDefaultPlaneSelection).toBeUndefined();
        expect(baseConfig).not.toHaveProperty("ephemeris_manifest");
    });

    it("returns validation warnings alongside the normalized config", () => {
        const { config, warnings } = assembleMissionConfig({
            baseConfig: {
                spacecraft_mnemonic: "CH3",
                origins: ["geo"],
                geo: {
                    center: "earth_center",
                },
            },
        });

        expect(warnings).toEqual([
            "Origin 'geo' is missing 'orbits_file'; a default name will be synthesized.",
        ]);
        expect(config.geo.orbits_file).toBe("geo-CH3");
    });

    it("throws formatted diagnostics when validation fails", () => {
        expect(() => assembleMissionConfig({
            baseConfig: {
                spacecraft_mnemonic: "CH3",
                origins: ["geo"],
            },
        })).toThrow("Mission config validation failed:");
    });
});
