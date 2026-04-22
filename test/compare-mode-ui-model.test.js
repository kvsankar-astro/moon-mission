import { describe, expect, it } from "vitest";

import { buildCompareModeUiModel } from "../src/platform/js/core/domain/compare-mode-ui-model.js";
import { UNIT_MODE_KM } from "../src/platform/js/core/domain/telemetry-display-model.js";

function formatMetric(value) {
    return Number(value).toFixed(1);
}

describe("compare mode ui model", () => {
    it("returns a disabled model when no comparison overlay is active", () => {
        expect(buildCompareModeUiModel({
            sceneState: null,
            globalConfig: { mission_name: "Primary Mission" },
            primaryBody: "EARTH",
            unitMode: UNIT_MODE_KM,
            formatMetric,
        })).toEqual({
            enabled: false,
            desktopTitle: "Mission Info",
            mobileTitle: "Mission Info",
            entries: [],
        });
    });

    it("builds compare telemetry cards for the primary and overlay missions", () => {
        const model = buildCompareModeUiModel({
            sceneState: {
                time: 1500,
                config: "geo",
                phase: "earth-bound",
                telemetryBodyId: "SC",
                telemetry: {
                    distancePrimary: 8000,
                    altitudePrimary: 1622,
                    velocityPrimary: 2,
                    distanceMoon: 376400,
                    altitudeMoon: 374663,
                    velocityMoon: 2.5,
                },
                bodies: {
                    EARTH: {
                        available: true,
                        position: { x: 0, y: 0, z: 0 },
                        velocity: { vx: 0, vy: 0, vz: 0 },
                    },
                    MOON: {
                        available: true,
                        position: { x: 384400, y: 0, z: 0 },
                        velocity: { vx: 0, vy: 1, vz: 0 },
                    },
                    SC: {
                        available: true,
                        position: { x: 8000, y: 0, z: 0 },
                        velocity: { vx: 0, vy: 2, vz: 0 },
                    },
                    CMP_ART1_CM: {
                        available: true,
                        position: { x: 386400, y: 0, z: 0 },
                        velocity: { vx: 0, vy: 1.5, vz: 0 },
                    },
                },
            },
            globalConfig: {
                mission_name: "Chandrayaan 3",
                mission_name_short: "CH3",
                is_lunar: true,
                primaryCraftId: "SC",
                crafts: [
                    {
                        id: "SC",
                        mnemonic: "SC",
                        viewLabel: "Vikram",
                        primary: true,
                    },
                    {
                        id: "CMP_ART1_CM",
                        mnemonic: "CMP_ART1_CM",
                        viewLabel: "ART1 Orion",
                        primary: false,
                    },
                ],
                comparisonOverlay: {
                    missionName: "Artemis I",
                    missionShortLabel: "ART1",
                    compareCraftId: "CMP_ART1_CM",
                    isLunarMission: true,
                    missionEventTimes: {
                        timeTransLunarInjection: 2100,
                        timeLunarOrbitInsertion: 2600,
                    },
                    displayTimeRangesByOrigin: {
                        geo: { startMs: 1000, endMs: 3000 },
                    },
                    sourceTimeRangesByOrigin: {
                        geo: { startMs: 2000, endMs: 4000 },
                    },
                },
            },
            primaryBody: "EARTH",
            unitMode: UNIT_MODE_KM,
            formatMetric,
        });

        expect(model.enabled).toBe(true);
        expect(model.desktopTitle).toBe("Mission Compare");
        expect(model.mobileTitle).toBe("Mission Compare");
        expect(model.entries).toHaveLength(2);
        expect(model.entries[0]).toMatchObject({
            id: "primary",
            roleLabel: "Primary",
            label: "CH3 Vikram",
            phaseText: "Earth Bound",
        });
        expect(model.entries[0].desktop.distanceEarth).toBe("8000.0");
        expect(model.entries[0].desktop.distanceMoon).toBe("376400.0");
        expect(model.entries[1]).toMatchObject({
            id: "secondary",
            roleLabel: "Additional",
            label: "ART1 Orion",
            phaseText: "Lunar Bound",
        });
        expect(model.entries[1].desktop.distanceEarth).toBe("386400.0");
        expect(model.entries[1].desktop.distanceMoon).toBe("2000.0");
        expect(model.entries[1].mobile.speed).toBe("1.5 km/s");
    });

    it("marks the overlay mission as outside the mission window when its craft is unavailable", () => {
        const model = buildCompareModeUiModel({
            sceneState: {
                time: 4500,
                config: "geo",
                phase: "lunar-orbit",
                telemetryBodyId: "SC",
                telemetry: {
                    distancePrimary: 10000,
                    altitudePrimary: 3622,
                    velocityPrimary: 2,
                },
                bodies: {
                    EARTH: {
                        available: true,
                        position: { x: 0, y: 0, z: 0 },
                        velocity: { vx: 0, vy: 0, vz: 0 },
                    },
                    MOON: {
                        available: true,
                        position: { x: 384400, y: 0, z: 0 },
                        velocity: { vx: 0, vy: 1, vz: 0 },
                    },
                    SC: {
                        available: true,
                        position: { x: 10000, y: 0, z: 0 },
                        velocity: { vx: 0, vy: 2, vz: 0 },
                    },
                    CMP_ART1_CM: {
                        available: false,
                        position: null,
                        velocity: null,
                    },
                },
            },
            globalConfig: {
                mission_name_short: "CH3",
                is_lunar: true,
                primaryCraftId: "SC",
                crafts: [
                    { id: "SC", mnemonic: "SC", viewLabel: "Vikram", primary: true },
                    { id: "CMP_ART1_CM", mnemonic: "CMP_ART1_CM", viewLabel: "ART1 Orion", primary: false },
                ],
                comparisonOverlay: {
                    missionShortLabel: "ART1",
                    compareCraftId: "CMP_ART1_CM",
                    isLunarMission: true,
                    missionEventTimes: {
                        timeTransLunarInjection: 2100,
                        timeLunarOrbitInsertion: 2600,
                    },
                    displayTimeRangesByOrigin: {
                        geo: { startMs: 1000, endMs: 3000 },
                    },
                    sourceTimeRangesByOrigin: {
                        geo: { startMs: 2000, endMs: 4000 },
                    },
                },
            },
            primaryBody: "EARTH",
            unitMode: UNIT_MODE_KM,
            formatMetric,
        });

        expect(model.entries[1].phaseText).toBe("Outside mission window");
        expect(model.entries[1].desktop.distanceEarth).toBe("");
        expect(model.entries[1].mobile.earth).toBe("--");
    });
});
