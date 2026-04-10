import { describe, expect, it } from "vitest";

import { computePreferredCameraDistance } from "../src/platform/js/app/camera-parameter-helpers.js";

describe("computePreferredCameraDistance", () => {
    it("uses fixed orbit-size defaults when no mission override exists", () => {
        const result = computePreferredCameraDistance({
            missionConfig: "geo",
            defaultCameraDistance: 600,
        });

        expect(result.position.x).toBe(0);
        expect(result.position.y).toBe(0);
        expect(result.position.z).toBeCloseTo(401.60712874037545, 6);
    });

    it("uses mission-config camera defaults when provided", () => {
        const result = computePreferredCameraDistance({
            missionConfig: "geo",
            defaultCameraDistance: 600,
            globalConfig: {
                ui: {
                    cameraDefaults: {
                        geo: {
                            positionScale: { x: -1.1, y: 0.15, z: 0.15 },
                        },
                    },
                },
            },
        });

        expect(result.position).toEqual({
            x: -660,
            y: 90,
            z: 90,
        });
    });

    it("uses client-specific profile when provided", () => {
        const result = computePreferredCameraDistance({
            missionConfig: "geo",
            originKey: "geo",
            clientKey: "mobile",
            defaultCameraDistance: 600,
            globalConfig: {
                ui: {
                    cameraDefaults: {
                        geo: {
                            desktop: { positionScale: { x: -1, y: 0, z: 0 } },
                            mobile: {
                                position: { x: 10, y: 20, z: 30 },
                                up: { x: 0, y: 1, z: 0 },
                                lookTarget: { x: 1, y: 2, z: 3 },
                                pinEarthBelowPanel: true,
                            },
                        },
                    },
                },
            },
        });

        expect(result.position).toEqual({ x: 10, y: 20, z: 30 });
        expect(result.up).toEqual({ x: 0, y: 1, z: 0 });
        expect(result.lookTarget).toEqual({ x: 1, y: 2, z: 3 });
        expect(result.pinEarthBelowPanel).toBe(true);
    });

    it("prefers absolute XYZ tuple when provided", () => {
        const result = computePreferredCameraDistance({
            missionConfig: "geo",
            defaultCameraDistance: 600,
            globalConfig: {
                ui: {
                    cameraDefaults: {
                        geo: {
                            position: { x: -4200, y: 1800, z: 900 },
                            positionScale: { x: -1.1, y: 0.15, z: 0.15 },
                        },
                    },
                },
            },
        });

        expect(result.position).toEqual({
            x: -4200,
            y: 1800,
            z: 900,
        });
    });

    it("supports per-origin camera defaults for relative origin key", () => {
        const result = computePreferredCameraDistance({
            missionConfig: "geo",
            originKey: "relative",
            defaultCameraDistance: 600,
            globalConfig: {
                ui: {
                    cameraDefaults: {
                        relative: {
                            positionScale: { x: -0.25, y: 0.5, z: 0.75 },
                        },
                    },
                },
            },
        });

        expect(result.position).toEqual({
            x: -150,
            y: 300,
            z: 450,
        });
    });

    it("uses a wider systemic fallback framing for lunar origin than geo", () => {
        const geoResult = computePreferredCameraDistance({
            missionConfig: "geo",
            originKey: "geo",
            defaultCameraDistance: 600,
        });
        const lunarResult = computePreferredCameraDistance({
            missionConfig: "lunar",
            originKey: "lunar",
            defaultCameraDistance: 600,
        });

        expect(lunarResult.position.z).toBeGreaterThan(geoResult.position.z);
    });

    it("falls back to fixed orbit-size defaults when no client profile exists", () => {
        const previousWindow = global.window;
        global.window = {
            innerWidth: 390,
            missionConfig: {
                dataPath: "assets/artemis2/data/",
            },
        };

        const result = computePreferredCameraDistance({
            missionConfig: "geo",
            defaultCameraDistance: 600,
        });

        expect(result.position.x).toBe(0);
        expect(result.position.y).toBe(0);
        expect(result.position.z).toBeCloseTo(401.60712874037545, 6);

        if (typeof previousWindow === "undefined") {
            delete global.window;
        } else {
            global.window = previousWindow;
        }
    });
});
