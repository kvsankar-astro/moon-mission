import { describe, expect, it, vi } from "vitest";
import { buildMissionRuntimeWireupConfig } from "../src/platform/js/app/mission-runtime-wireup-config.js";

describe("buildMissionRuntimeWireupConfig", () => {
    it("keeps state slices, UI, and clock effects in separate ports", () => {
        const getConfig = vi.fn(() => "geo");
        const getAnimTime = vi.fn(() => 123);
        const setEventInfoText = vi.fn();
        const setEpochDisplay = vi.fn();
        const applyViewSettings = vi.fn();
        const clearLegacyTimeout = vi.fn();

        const result = buildMissionRuntimeWireupConfig({
            statePorts: {
                app: { getConfig },
                data: {},
                session: { getAnimTime },
                sceneView: {},
                sceneRuntime: {},
                interaction: {},
            },
            uiEffects: {
                setEventInfoText,
                setEpochDisplay,
            },
            applyViewSettings,
            clockEffects: {
                clearLegacyTimeout,
            },
        });

        expect(result.wiringPorts.statePort.getConfig).toBeUndefined();
        expect(result.wiringPorts.statePort.getAnimTime).toBeUndefined();
        expect(result.wiringPorts.statePort.app.getConfig).toBe(getConfig);
        expect(result.wiringPorts.statePort.session.getAnimTime).toBe(getAnimTime);
        expect(result.wiringPorts.statePort.app.setEventInfoText).toBeUndefined();
        expect(result.wiringPorts.statePort.session.clearLegacyTimeout).toBeUndefined();
        expect(result.wiringPorts.uiPort.setEventInfoText).toBe(setEventInfoText);
        expect(result.wiringPorts.uiPort.setEpochDisplay).toBe(setEpochDisplay);
        expect(result.wiringPorts.uiPort.applyViewSettings).toBe(applyViewSettings);
        expect(result.wiringPorts.statePort.sceneView.applyViewSettings).toBeUndefined();
        expect(result.wiringPorts.clockPort.clearLegacyTimeout).toBe(clearLegacyTimeout);
    });
});
