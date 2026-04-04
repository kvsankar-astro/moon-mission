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
    it("advances at 1 min/sec in base non-realtime mode", () => {
        const controller = createController();

        controller.tick(1000);
        expect(controller.getTime()).toBe(60 * 1000);

        controller.tick(2000);
        expect(controller.getTime()).toBe(120 * 1000);
    });

    it("advances at 1 sec/sec in realtime mode", () => {
        const controller = createController();
        controller.setRealtimeSpeed();

        controller.tick(1000);
        expect(controller.getTime()).toBe(1000);

        controller.tick(2000);
        expect(controller.getTime()).toBe(2000);
    });
});
