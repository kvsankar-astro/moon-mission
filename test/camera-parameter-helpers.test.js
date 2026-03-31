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
});
