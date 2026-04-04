import { describe, expect, it } from "vitest";

import { computePreferredCameraDistance } from "../src/platform/js/app/camera-parameter-helpers.js";

describe("computePreferredCameraDistance", () => {
    it("uses legacy defaults when no mission override exists", () => {
        const result = computePreferredCameraDistance({
            missionConfig: "geo",
            defaultCameraDistance: 600,
        });

        expect(result.position).toEqual({
            x: -100,
            y: -20,
            z: 25,
        });
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

    it("uses mobile Artemis 2 top-down camera placement in geo mode", () => {
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
            globalConfig: {
                mission_name_short: "Artemis 2",
            },
        });

        expect(result.position.x).toBe(0);
        expect(result.position.y).toBe(0);
        expect(result.position.z).toBeGreaterThan(0);
        expect(result.up).toEqual({ x: 0, y: 1, z: 0 });
        expect(result.lookTarget).toEqual({ x: 0, y: -80, z: 0 });

        if (typeof previousWindow === "undefined") {
            delete global.window;
        } else {
            global.window = previousWindow;
        }
    });
});
