import { describe, expect, it } from "vitest";
import {
    getManifestPhases,
    resolveManifestGeneratedArtifact,
    resolveManifestRuntimeArtifact,
    toLandingPhaseKey,
} from "../src/platform/js/core/domain/ephemeris-manifest.js";

const manifest = {
    format: "ephemeris-manifest",
    version: "1.0",
    mission: "sample",
    phases: {
        geo: {
            tolerance_km: 5,
            artifacts: {
                npz: {
                    runtime: "geo-SC.npz",
                    generated: "data-generated/sample/geo-SC.npz",
                },
                chebyshev: {
                    runtime: "geo-SC-cheb.json",
                    generated: "assets/sample/data/geo-SC-cheb.json",
                },
            },
        },
        "landing-geo": {
            tolerance_km: 2,
            artifacts: {
                npz: {
                    runtime: "landing-SC-geo.npz",
                    generated: "data-generated/sample/landing-SC-geo.npz",
                },
            },
        },
    },
};

describe("ephemeris-manifest domain helpers", () => {
    it("returns phases map for valid manifests", () => {
        expect(Object.keys(getManifestPhases(manifest))).toEqual(["geo", "landing-geo"]);
    });

    it("resolves runtime artifacts from structured entries", () => {
        expect(resolveManifestRuntimeArtifact(manifest, "geo", "npz")).toBe("geo-SC.npz");
        expect(resolveManifestRuntimeArtifact(manifest, "geo", "chebyshev")).toBe("geo-SC-cheb.json");
    });

    it("resolves generated artifacts from structured entries", () => {
        expect(resolveManifestGeneratedArtifact(manifest, "geo", "npz")).toBe("data-generated/sample/geo-SC.npz");
    });

    it("normalizes landing phase keys from config keys", () => {
        expect(toLandingPhaseKey("geo")).toBe("landing-geo");
        expect(toLandingPhaseKey("landing-lunar")).toBe("landing-lunar");
        expect(toLandingPhaseKey(null)).toBe("landing");
    });
});
