import { describe, expect, it } from "vitest";

import {
    isCurrentTimeWithinMissionSpan,
    isStartupViewSceneReady,
    planStartupViewReapply,
    resolveStartupAnimationMode,
} from "../src/platform/js/app/startup-animation-plan.js";

describe("startup animation plan", () => {
    it("detects whether the current time falls inside the mission span", () => {
        expect(isCurrentTimeWithinMissionSpan({
            nowTimeMs: 150,
            startTime: 100,
            latestEndTime: 200,
        })).toBe(true);

        expect(isCurrentTimeWithinMissionSpan({
            nowTimeMs: 250,
            startTime: 100,
            latestEndTime: 200,
        })).toBe(false);
    });

    it("starts at now on reset when the current time is inside the mission span", () => {
        expect(resolveStartupAnimationMode({
            flags: { reset: true },
            nowTimeMs: 150,
            startTime: 100,
            latestEndTime: 200,
        })).toEqual({
            type: "start-now",
            animTime: 150,
            shouldSetRealtimeSpeed: true,
            shouldPlayAnimation: true,
        });
    });

    it("prefers the startup override when reset happens outside the mission span", () => {
        expect(resolveStartupAnimationMode({
            flags: {
                reset: true,
                startupAnimTimeOverride: 175,
            },
            nowTimeMs: 250,
            startTime: 100,
            latestEndTime: 200,
        })).toEqual({
            type: "set-time",
            animTime: 175,
        });
    });

    it("falls back to mission start or a plain location refresh when no override exists", () => {
        expect(resolveStartupAnimationMode({
            flags: { reset: true },
            nowTimeMs: 250,
            startTime: 100,
            latestEndTime: 200,
        })).toEqual({
            type: "mission-start",
        });

        expect(resolveStartupAnimationMode({
            flags: { reset: false },
            nowTimeMs: 250,
            startTime: 100,
            latestEndTime: 200,
        })).toEqual({
            type: "refresh-location",
        });
    });

    it("plans startup view reapply decisions from readiness state", () => {
        expect(isStartupViewSceneReady({
            needs3DReady: false,
            scene: null,
            isSceneOrbitRenderable: () => false,
        })).toBe(true);

        expect(isStartupViewSceneReady({
            needs3DReady: true,
            scene: {
                initialized3D: true,
            },
            isSceneOrbitRenderable: () => true,
        })).toBe(true);

        expect(planStartupViewReapply({
            runId: 2,
            latestRunId: 1,
            hasSetView: true,
            sceneReady: false,
            attemptsRemaining: 10,
        })).toEqual({ type: "skip" });

        expect(planStartupViewReapply({
            runId: 1,
            latestRunId: 1,
            hasSetView: true,
            sceneReady: true,
            attemptsRemaining: 10,
        })).toEqual({ type: "apply" });

        expect(planStartupViewReapply({
            runId: 1,
            latestRunId: 1,
            hasSetView: true,
            sceneReady: false,
            attemptsRemaining: 0,
        })).toEqual({ type: "apply" });

        expect(planStartupViewReapply({
            runId: 1,
            latestRunId: 1,
            hasSetView: true,
            sceneReady: false,
            attemptsRemaining: 10,
        })).toEqual({ type: "retry" });
    });
});
