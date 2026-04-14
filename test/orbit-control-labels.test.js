import { describe, expect, it } from "vitest";
import {
    normalizeOriginMode,
    resolveBodyOrbitCopy,
    resolveCraftOrbitCopy,
} from "../src/platform/js/ui/orbit-control-labels.js";

describe("orbit-control-labels", () => {
    it("normalizes origin aliases", () => {
        expect(normalizeOriginMode("moon")).toBe("lunar");
        expect(normalizeOriginMode("lunar")).toBe("lunar");
        expect(normalizeOriginMode("relative")).toBe("relative");
        expect(normalizeOriginMode("earth")).toBe("geo");
        expect(normalizeOriginMode("")).toBe("geo");
    });

    it("resolves Moon orbit copy for geo and relative origins", () => {
        expect(resolveBodyOrbitCopy("geo")).toEqual({
            label: "Moon Orbit",
            title: "Toggle Moon orbit track",
        });
        expect(resolveBodyOrbitCopy("relative")).toEqual({
            label: "Moon Orbit",
            title: "Toggle Moon orbit track",
        });
    });

    it("resolves Earth orbit copy for lunar origin", () => {
        expect(resolveBodyOrbitCopy("lunar")).toEqual({
            label: "Earth Orbit",
            title: "Toggle Earth orbit track",
        });
    });

    it("keeps craft orbit copy origin-independent", () => {
        expect(resolveCraftOrbitCopy()).toEqual({
            label: "Craft Orbit",
            title: "Toggle visible craft orbit tracks",
        });
    });
});
