import { describe, expect, it } from "vitest";

import {
    buildSceneTelemetryUiState,
    buildTelemetryUnitControlModel,
    UNIT_MODE_KM,
    UNIT_MODE_MILES,
} from "../src/platform/js/core/domain/scene-telemetry-ui-state.js";

function formatMetric(value) {
    return Number(value).toFixed(1);
}

describe("scene telemetry ui state", () => {
    it("builds telemetry display text and active unit controls together", () => {
        const state = buildSceneTelemetryUiState({
            telemetry: {
                distancePrimary: 100,
                altitudePrimary: 25,
                velocityPrimary: 2,
                distanceMoon: 50,
                altitudeMoon: 5,
                velocityMoon: 1.5,
            },
            primaryBody: "EARTH",
            angleDegrees: 90,
            unitMode: UNIT_MODE_KM,
            formatMetric,
        });

        expect(state.telemetryDisplayModel.desktop).toEqual({
            distanceEarth: "100.0",
            altitudeEarth: "25.0",
            velocityEarth: "2.0",
            distanceMoon: "50.0",
            altitudeMoon: "5.0",
            velocityMoon: "1.5",
        });
        expect(state.telemetryDisplayModel.mobile).toEqual({
            earth: "100.0 km",
            moon: "50.0 km",
            speed: "2.0 km/s",
            angle: "90.0°",
        });
        expect(state.unitControlModel.unitLabels).toEqual({
            distance: "km",
            speed: "km/s",
        });
        expect(state.unitControlModel.buttons).toEqual([
            { id: "stats-unit-km", isActive: true, ariaPressed: "true" },
            { id: "stats-unit-miles", isActive: false, ariaPressed: "false" },
            { id: "mobile-unit-km", isActive: true, ariaPressed: "true" },
            { id: "mobile-unit-miles", isActive: false, ariaPressed: "false" },
        ]);
    });

    it("normalizes invalid modes back to kilometers", () => {
        expect(buildTelemetryUnitControlModel("bogus")).toEqual({
            unitLabels: {
                distance: "km",
                speed: "km/s",
            },
            buttons: [
                { id: "stats-unit-km", isActive: true, ariaPressed: "true" },
                { id: "stats-unit-miles", isActive: false, ariaPressed: "false" },
                { id: "mobile-unit-km", isActive: true, ariaPressed: "true" },
                { id: "mobile-unit-miles", isActive: false, ariaPressed: "false" },
            ],
        });
    });

    it("marks the miles controls active when miles mode is selected", () => {
        expect(buildTelemetryUnitControlModel(UNIT_MODE_MILES).buttons).toEqual([
            { id: "stats-unit-km", isActive: false, ariaPressed: "false" },
            { id: "stats-unit-miles", isActive: true, ariaPressed: "true" },
            { id: "mobile-unit-km", isActive: false, ariaPressed: "false" },
            { id: "mobile-unit-miles", isActive: true, ariaPressed: "true" },
        ]);
    });
});
