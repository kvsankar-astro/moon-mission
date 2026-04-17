import { describe, expect, it } from "vitest";

import { planTransientActiveEvent } from "../src/platform/js/core/domain/transient-active-event.js";

describe("transient active event planning", () => {
    it("latches the most recent crossed event during forward playback", () => {
        const result = planTransientActiveEvent({
            animTime: 5000,
            previousTimeMs: 1000,
            eventInfos: [
                { key: "burn-a", startTime: 2000, label: "Burn A" },
                { key: "burn-b", startTime: 4000, label: "Burn B" },
            ],
            nowWallTimeMs: 10000,
        });

        expect(result.activeEvent?.key).toBe("burn-b");
        expect(result.activeEvent?._shownAtWallTimeMs).toBe(10000);
        expect(result.nextLatch).toMatchObject({
            event: expect.objectContaining({ key: "burn-b" }),
            eventTimeMs: 4000,
            shownAtWallTimeMs: 10000,
        });
        expect(result.nextPreviousTimeMs).toBe(5000);
    });

    it("prefers a freshly windowed event over a crossed event during backward playback", () => {
        const result = planTransientActiveEvent({
            animTime: 3000,
            previousTimeMs: 9000,
            eventInfos: [
                { key: "burn-a", startTime: 2000, label: "Burn A" },
                { key: "burn-b", startTime: 7000, label: "Burn B" },
            ],
            nowWallTimeMs: 20000,
        });

        expect(result.activeEvent?.key).toBe("burn-a");
        expect(result.nextLatch?.eventTimeMs).toBe(2000);
    });

    it("keeps a latched event visible for the stable-ui window", () => {
        const result = planTransientActiveEvent({
            animTime: 9000,
            previousTimeMs: 8000,
            eventInfos: [],
            currentLatch: {
                event: { key: "burn-a", startTime: 4000, label: "Burn A" },
                eventTimeMs: 4000,
                shownAtWallTimeMs: 10000,
            },
            nowWallTimeMs: 11000,
            eventDisplayWindowMs: 2000,
            eventDisplayMinStableUiMs: 2000,
        });

        expect(result.activeEvent?.key).toBe("burn-a");
        expect(result.nextLatch).not.toBe(null);
    });

    it("clears a stale latch after both windows expire", () => {
        const result = planTransientActiveEvent({
            animTime: 9000,
            previousTimeMs: 8500,
            eventInfos: [],
            currentLatch: {
                event: { key: "burn-a", startTime: 4000, label: "Burn A" },
                eventTimeMs: 4000,
                shownAtWallTimeMs: 10000,
            },
            nowWallTimeMs: 13050,
            eventDisplayWindowMs: 2000,
            eventDisplayMinStableUiMs: 2000,
        });

        expect(result.activeEvent).toBe(null);
        expect(result.nextLatch).toBe(null);
    });
});
