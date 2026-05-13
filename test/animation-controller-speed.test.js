import { describe, expect, it } from "vitest";

import { AnimationController } from "../src/platform/js/animation/animation-controller.js";
import { TIME_CONSTANTS as TC } from "../src/platform/js/core/constants.js";

function createController() {
    const controller = new AnimationController();
    controller.configure({
        startTime: 0,
        endTime: 30 * TC.MILLI_SECONDS_PER_HOUR,
        stepDurationMs: TC.ONE_MINUTE_MS,
    });
    controller.setTime(0, false);
    controller.play();
    return controller;
}

describe("AnimationController speed timing", () => {
    it("advances at 1 min/sec after leaving realtime mode", () => {
        const controller = createController();
        controller.faster();

        controller.tick(1000);
        expect(controller.getTime()).toBe(0);

        controller.tick(2000);
        expect(controller.getTime()).toBe(60 * 1000);
    });

    it("advances at 1 min/sec in discrete simulation mode", () => {
        const controller = createController();
        controller.resetSpeed();

        controller.tick(1000);
        expect(controller.getTime()).toBe(0);

        controller.tick(2000);
        expect(controller.getTime()).toBe(60 * 1000);
    });

    it("does not apply stale paused frame time after playback resumes", () => {
        const controller = new AnimationController();
        controller.configure({
            startTime: 0,
            endTime: 30 * TC.MILLI_SECONDS_PER_HOUR,
            stepDurationMs: TC.ONE_MINUTE_MS,
        });
        controller.setRealtimeSpeed();
        controller.setTime(5000, false);

        controller.tick(1000);
        controller.play();
        controller.tick(61000);

        expect(controller.getTime()).toBe(5000);

        controller.tick(62000);
        expect(controller.getTime()).toBe(6000);
    });
});
