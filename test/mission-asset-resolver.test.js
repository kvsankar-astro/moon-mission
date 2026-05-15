import { describe, expect, it } from "vitest";
import {
    extractEphemerisManifest,
    resolveDataPathUrl,
    resolveLandingChebyshevAssetUrl,
    resolveLandingNpzAssetUrl,
    resolveMissionConfigUrl,
    resolveMissionManifestUrl,
    resolveOrbitAssetUrls,
    resolveOrbitMetaAssetUrl,
    resolveOrbitNpzAssetUrl,
    resolveOrbitSunChebyshevAssetUrl,
} from "../src/platform/js/core/domain/mission-asset-resolver.js";

describe("mission-asset-resolver", () => {
    it("normalizes and joins data path URLs", () => {
        expect(resolveDataPathUrl("assets/mission/data/", "geo-cheb.json")).toBe(
            "assets/mission/data/geo-cheb.json",
        );
        expect(resolveDataPathUrl("assets\\mission\\data", ".\\geo-cheb.json")).toBe(
            "assets/mission/data/geo-cheb.json",
        );
        expect(resolveDataPathUrl("assets/mission/data/", "/shared/file.json")).toBe(
            "/shared/file.json",
        );
        expect(resolveDataPathUrl("assets/mission/data/", "https://cdn.test/file.json")).toBe(
            "https://cdn.test/file.json",
        );
    });

    it("returns mission config and manifest URLs from data path", () => {
        expect(resolveMissionConfigUrl("assets/ch3/data/")).toBe("assets/ch3/data/config.json");
        expect(resolveMissionConfigUrl("https://assets.sankara.net/moon-mission/assets/ch3/data/")).toBe(
            "https://assets.sankara.net/moon-mission/assets/ch3/data/config.json",
        );
        expect(resolveMissionManifestUrl("assets/ch3/data/")).toBe(
            "assets/ch3/data/ephemeris-manifest.json",
        );
        expect(resolveMissionConfigUrl("")).toBeNull();
    });

    it("extracts manifest from snake_case and camelCase config keys", () => {
        const snake = { ephemeris_manifest: { phases: {} } };
        const camel = { ephemerisManifest: { phases: {} } };
        expect(extractEphemerisManifest(snake)).toBe(snake.ephemeris_manifest);
        expect(extractEphemerisManifest(camel)).toBe(camel.ephemerisManifest);
    });

    it("resolves orbit urls using manifest first then legacy fallback", () => {
        const manifest = {
            phases: {
                geo: {
                    artifacts: {
                        json: { runtime: "manifest/geo.json" },
                        chebyshev: { runtime: "manifest/geo-cheb.json" },
                    },
                },
            },
        };

        expect(
            resolveOrbitAssetUrls({
                dataPath: "assets/ch3/data/",
                manifest,
                phaseKey: "geo",
                phaseConfig: { orbits_file: "legacy-geo" },
            }),
        ).toEqual({
            orbitsJson: "assets/ch3/data/manifest/geo.json",
            orbitsCheb: "assets/ch3/data/manifest/geo-cheb.json",
        });

        expect(
            resolveOrbitAssetUrls({
                dataPath: "assets/ch3/data/",
                manifest: null,
                phaseKey: "geo",
                phaseConfig: { orbits_file: "legacy-geo" },
            }),
        ).toEqual({
            orbitsJson: "assets/ch3/data/legacy-geo.json",
            orbitsCheb: "assets/ch3/data/legacy-geo-cheb.json",
        });
    });

    it("resolves orbit NPZ URL using manifest first then legacy fallback", () => {
        const manifest = {
            phases: {
                lunar: {
                    artifacts: {
                        npz: { runtime: "manifest/lunar.npz" },
                    },
                },
            },
        };
        expect(
            resolveOrbitNpzAssetUrl({
                dataPath: "assets/ch3/data/",
                manifest,
                phaseKey: "lunar",
                phaseConfig: { orbits_file: "legacy-lunar" },
            }),
        ).toBe("assets/ch3/data/manifest/lunar.npz");

        expect(
            resolveOrbitNpzAssetUrl({
                dataPath: "assets/ch3/data/",
                manifest: null,
                phaseKey: "lunar",
                phaseConfig: { orbits_file: "legacy-lunar" },
            }),
        ).toBe("assets/ch3/data/legacy-lunar.npz");
    });

    it("resolves orbit Sun Chebyshev URL using manifest first then legacy fallback", () => {
        const manifest = {
            phases: {
                geo: {
                    artifacts: {
                        sun_chebyshev: { runtime: "manifest/geo-sun-cheb.json" },
                    },
                },
            },
        };

        expect(
            resolveOrbitSunChebyshevAssetUrl({
                dataPath: "assets/ch3/data/",
                manifest,
                phaseKey: "geo",
                phaseConfig: { orbits_file: "legacy-geo" },
            }),
        ).toBe("assets/ch3/data/manifest/geo-sun-cheb.json");

        expect(
            resolveOrbitSunChebyshevAssetUrl({
                dataPath: "assets/ch3/data/",
                manifest: null,
                phaseKey: "geo",
                phaseConfig: { orbits_file: "legacy-geo" },
            }),
        ).toBe("assets/ch3/data/legacy-geo-sun-cheb.json");
    });

    it("resolves orbit style metadata only from explicit sidecar config", () => {
        expect(
            resolveOrbitMetaAssetUrl({
                dataPath: "assets/ch3/data/",
                manifest: {
                    phases: {
                        geo: {
                            artifacts: {
                                meta: { runtime: "manifest/geo-meta.json" },
                            },
                        },
                    },
                },
                phaseKey: "geo",
                phaseConfig: { orbits_file: "legacy-geo" },
            }),
        ).toBeNull();

        expect(
            resolveOrbitMetaAssetUrl({
                dataPath: "assets/ch3/data/",
                manifest: null,
                phaseKey: "geo",
                phaseConfig: { orbit_style_file: "geo-style.json" },
            }),
        ).toBe("assets/ch3/data/geo-style.json");
    });

    it("resolves landing URLs with specific phase manifest precedence", () => {
        const manifest = {
            phases: {
                "landing-hr": {
                    artifacts: {
                        chebyshev: { runtime: "manifest/landing-hr-cheb.json" },
                        npz: { runtime: "manifest/landing-hr.npz" },
                    },
                },
                landing: {
                    artifacts: {
                        chebyshev: { runtime: "manifest/landing-cheb.json" },
                        npz: { runtime: "manifest/landing.npz" },
                    },
                },
            },
        };

        expect(
            resolveLandingChebyshevAssetUrl({
                dataPath: "assets/ch3/data/",
                manifest,
                configData: { spacecraft_mnemonic: "CH3" },
                cfgKey: "hr",
            }),
        ).toBe("assets/ch3/data/manifest/landing-hr-cheb.json");
        expect(
            resolveLandingNpzAssetUrl({
                dataPath: "assets/ch3/data/",
                manifest,
                configData: { spacecraft_mnemonic: "CH3" },
                cfgKey: "hr",
            }),
        ).toBe("assets/ch3/data/manifest/landing-hr.npz");
    });

    it("falls back to synthesized landing file names when manifest is absent", () => {
        const configData = {
            spacecraft_mnemonic: "CH3",
        };
        expect(
            resolveLandingChebyshevAssetUrl({
                dataPath: "assets/ch3/data",
                manifest: null,
                configData,
                cfgKey: "hr",
            }),
        ).toBe("assets/ch3/data/landing-CH3-hr-cheb.json");
        expect(
            resolveLandingNpzAssetUrl({
                dataPath: "assets/ch3/data",
                manifest: null,
                configData,
                cfgKey: "hr",
            }),
        ).toBe("assets/ch3/data/landing-CH3-hr.npz");
    });

    it("prefers the primary craft mnemonic for synthesized landing file names", () => {
        const configData = {
            spacecraft_mnemonic: "SC",
            primaryCraftId: "CH3L",
            crafts: [
                { id: "CH3L", mnemonic: "CH3", primary: true },
                { id: "CH3O", mnemonic: "CH3O", primary: false },
            ],
        };

        expect(
            resolveLandingChebyshevAssetUrl({
                dataPath: "assets/ch3/data",
                manifest: null,
                configData,
                cfgKey: "geo",
            }),
        ).toBe("assets/ch3/data/landing-CH3-geo-cheb.json");
    });
});
