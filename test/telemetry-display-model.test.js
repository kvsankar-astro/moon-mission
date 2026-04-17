import { describe, expect, it } from "vitest";

import {
    buildTelemetryDisplayModel,
    resolveTelemetryUnitLabels,
    UNIT_MODE_KM,
    UNIT_MODE_MILES,
} from "../src/platform/js/core/domain/telemetry-display-model.js";

function formatMetric(value) {
    return Number(value).toFixed(1);
}

describe("telemetry display model", () => {
    it("returns empty desktop fields and placeholder mobile fields when telemetry is missing", () => {
        expect(buildTelemetryDisplayModel({
            telemetry: null,
            primaryBody: "EARTH",
            angleDegrees: 12.3,
            unitMode: UNIT_MODE_KM,
            formatMetric,
        })).toEqual({
            unitLabels: {
                distance: "km",
                speed: "km/s",
            },
            desktop: {
                distanceEarth: "",
                altitudeEarth: "",
                velocityEarth: "",
                distanceMoon: "",
                altitudeMoon: "",
                velocityMoon: "",
            },
            mobile: {
                earth: "--",
                moon: "--",
                speed: "--",
                angle: "--",
            },
        });
    });

    it("formats primary and secondary telemetry in kilometers", () => {
        const model = buildTelemetryDisplayModel({
            telemetry: {
                distancePrimary: 100,
                altitudePrimary: 25,
                velocityPrimary: 2,
                distanceMoon: 50,
                altitudeMoon: 5,
                velocityMoon: 1.5,
            },
            primaryBody: "EARTH",
            angleDegrees: 42.34,
            unitMode: UNIT_MODE_KM,
            formatMetric,
        });

        expect(model.desktop).toEqual({
            distanceEarth: "100.0",
            altitudeEarth: "25.0",
            velocityEarth: "2.0",
            distanceMoon: "50.0",
            altitudeMoon: "5.0",
            velocityMoon: "1.5",
        });
        expect(model.mobile).toEqual({
            earth: "100.0 km",
            moon: "50.0 km",
            speed: "2.0 km/s",
            angle: "42.3°",
        });
    });

    it("converts telemetry into miles and reuses primary values when orbiting the moon", () => {
        const model = buildTelemetryDisplayModel({
            telemetry: {
                distancePrimary: 10,
                altitudePrimary: 4,
                velocityPrimary: 0.5,
                distanceEarth: 384400,
                altitudeEarth: 378000,
                velocityEarth: 1.2,
            },
            primaryBody: "MOON",
            angleDegrees: null,
            unitMode: UNIT_MODE_MILES,
            formatMetric,
        });

        expect(model.desktop.distanceMoon).toBe("6.2");
        expect(model.desktop.altitudeMoon).toBe("2.5");
        expect(model.desktop.velocityMoon).toBe("1118.5");
        expect(model.desktop.distanceEarth).toBe("238855.1");
        expect(model.mobile.earth).toBe("238855.1 miles");
        expect(model.mobile.moon).toBe("6.2 miles");
        expect(model.mobile.speed).toBe("1118.5 miles/h");
        expect(model.mobile.angle).toBe("--");
    });

    it("resolves unit labels for each mode", () => {
        expect(resolveTelemetryUnitLabels(UNIT_MODE_KM)).toEqual({
            distance: "km",
            speed: "km/s",
        });
        expect(resolveTelemetryUnitLabels(UNIT_MODE_MILES)).toEqual({
            distance: "miles",
            speed: "miles/h",
        });
    });
});
