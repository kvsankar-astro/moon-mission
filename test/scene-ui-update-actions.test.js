import { describe, expect, it, vi } from "vitest";

const updateTelemetry = vi.fn();
const updatePhaseIndicator = vi.fn();
const updateActiveEvent = vi.fn();
const disposeTelemetry = vi.fn();

vi.mock("../src/platform/js/app/scene-telemetry-ui-actions.js", () => ({
    createSceneTelemetryUiActions: vi.fn(() => ({
        updateTelemetry,
        dispose: disposeTelemetry,
    })),
}));

vi.mock("../src/platform/js/app/scene-phase-ui-actions.js", () => ({
    createScenePhaseUiActions: vi.fn(() => ({
        updatePhaseIndicator,
    })),
}));

vi.mock("../src/platform/js/app/scene-active-event-ui-actions.js", () => ({
    createSceneActiveEventUiActions: vi.fn(() => ({
        updateActiveEvent,
    })),
}));

import { createSceneUiUpdateActions } from "../src/platform/js/app/scene-ui-update-actions.js";

describe("scene ui update actions", () => {
    it("forwards dispose to telemetry actions", () => {
        const actions = createSceneUiUpdateActions({
            d3: {},
            formatMetric: (value) => value,
            updateEventInfo: () => {},
            clearEventInfo: () => {},
        });

        actions.dispose();

        expect(disposeTelemetry).toHaveBeenCalledTimes(1);
    });
});
