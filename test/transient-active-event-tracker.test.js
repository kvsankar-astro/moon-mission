import { describe, expect, it } from "vitest";

import {
    attachActiveEventToFramePlan,
    createTransientActiveEventTracker,
} from "../src/platform/js/app/transient-active-event-tracker.js";

describe("transient active event tracker", () => {
    it("patches both render and ui intents with the active event", () => {
        const activeEvent = { key: "burn-a" };
        const framePlan = attachActiveEventToFramePlan({
            framePlan: {
                renderIntent: {
                    sceneState: {},
                },
                uiIntent: {
                    sceneState: {},
                },
            },
            activeEvent,
        });

        expect(framePlan.renderIntent.sceneState.activeEvent).toBe(activeEvent);
        expect(framePlan.uiIntent.sceneState.activeEvent).toBe(activeEvent);
    });

    it("tracks latches per config and keeps events stable across frames", () => {
        let nowWallTimeMs = 10000;
        const tracker = createTransientActiveEventTracker({
            eventDisplayWindowMs: 2000,
            eventDisplayMinStableUiMs: 2000,
            getNowWallTimeMs: () => nowWallTimeMs,
        });

        const firstResult = tracker.applyToFramePlan({
            config: "geo",
            animTime: 5000,
            eventInfos: [
                { key: "burn-a", startTime: 4000, label: "Burn A" },
            ],
            framePlan: {
                renderIntent: { sceneState: {} },
                uiIntent: { sceneState: {} },
            },
        });

        expect(firstResult.activeEvent?.key).toBe("burn-a");
        expect(firstResult.framePlan.renderIntent.sceneState.activeEvent?.key).toBe("burn-a");

        nowWallTimeMs = 11000;
        const secondResult = tracker.applyToFramePlan({
            config: "geo",
            animTime: 9000,
            eventInfos: [],
            framePlan: {
                renderIntent: { sceneState: {} },
                uiIntent: { sceneState: {} },
            },
        });

        expect(secondResult.activeEvent?.key).toBe("burn-a");
        expect(secondResult.framePlan.uiIntent.sceneState.activeEvent?.key).toBe("burn-a");

        nowWallTimeMs = 14050;
        const thirdResult = tracker.applyToFramePlan({
            config: "geo",
            animTime: 9000,
            eventInfos: [],
            framePlan: {
                renderIntent: { sceneState: {} },
                uiIntent: { sceneState: {} },
            },
        });

        expect(thirdResult.activeEvent).toBe(null);
        expect(thirdResult.framePlan.renderIntent.sceneState.activeEvent).toBe(null);
    });
});
