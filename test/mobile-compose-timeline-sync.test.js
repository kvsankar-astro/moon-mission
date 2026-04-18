import { describe, expect, it } from "vitest";

import { createMobileComposeTimelineSync } from "../src/platform/js/ui/mobile-compose-timeline-sync.js";

function createSliderStub({ min = "0", max = "1000", value = "0" } = {}) {
    const listeners = new Map();
    const dispatchedEvents = [];
    return {
        min,
        max,
        value,
        dispatchedEvents,
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        dispatchEvent(event) {
            dispatchedEvents.push(event.type);
            const handlers = listeners.get(event.type) || [];
            handlers.forEach((handler) => handler.call(this, event));
            return true;
        },
    };
}

function createOutputStub() {
    return {
        textContent: "",
        value: "",
    };
}

function createMutationObserverHarness() {
    const instances = [];
    class MutationObserverStub {
        constructor(callback) {
            this.callback = callback;
            this.observe = (target, options) => {
                this.target = target;
                this.options = options;
            };
            instances.push(this);
        }

        trigger() {
            this.callback();
        }
    }
    return { MutationObserverStub, instances };
}

function createHarness({
    activeTab = "compose",
    timelineValue = "450",
    flybyWindow = { startMs: Number.NaN, endMs: Number.NaN },
    flybyTimeMs = 500,
} = {}) {
    const state = { activeTab };
    const mobileComposeTimelineSlider = createSliderStub({ value: "0" });
    const mobileComposeTimelineValue = createOutputStub();
    const mobileComposeTimelineLocal = createOutputStub();
    const timelineSlider = createSliderStub({
        min: "0",
        max: "1000",
        value: timelineValue,
    });
    const burnButtonsHost = {};
    const { MutationObserverStub, instances } = createMutationObserverHarness();
    const sync = createMobileComposeTimelineSync({
        mobileComposeTimelineSlider,
        mobileComposeTimelineValue,
        mobileComposeTimelineLocal,
        timelineSlider,
        burnButtonsHost,
        composeTimelineResolution: 1000,
        composeTimelineWindowMs: 200,
        getActiveTab: () => state.activeTab,
        readEventInfos: () => [{ key: "flyby" }],
        resolveFlybyWindowMs: () => flybyWindow,
        resolveFlybyTimeMs: () => flybyTimeMs,
        formatLocalDateTimeShort: (timeMs) => `Local ${timeMs}`,
        createInputEvent: () => ({ type: "input" }),
        createChangeEvent: () => ({ type: "change" }),
        MutationObserverRef: MutationObserverStub,
    });

    return {
        state,
        sync,
        timelineSlider,
        mobileComposeTimelineSlider,
        mobileComposeTimelineValue,
        mobileComposeTimelineLocal,
        instances,
    };
}

describe("createMobileComposeTimelineSync", () => {
    it("syncs the compose slider and labels from the desktop timeline state", () => {
        const harness = createHarness();

        harness.sync.sync();

        expect(harness.mobileComposeTimelineSlider.value).toBe("250");
        expect(harness.mobileComposeTimelineValue.textContent).toBe(new Date(450).toUTCString());
        expect(harness.mobileComposeTimelineLocal.textContent).toBe("Local: Local 450");
    });

    it("moves the desktop timeline when the compose slider is dragged and finalized", () => {
        const harness = createHarness();
        harness.sync.bind();
        harness.sync.sync();

        harness.mobileComposeTimelineSlider.value = "750";
        harness.mobileComposeTimelineSlider.dispatchEvent({ type: "input" });
        expect(harness.timelineSlider.value).toBe("550");
        expect(harness.timelineSlider.dispatchedEvents).toContain("input");

        harness.mobileComposeTimelineSlider.dispatchEvent({ type: "change" });
        expect(harness.timelineSlider.value).toBe("550");
        expect(harness.timelineSlider.dispatchedEvents).toContain("change");
    });

    it("only resyncs from the desktop timeline and burn-button observer while the compose tab is active", () => {
        const harness = createHarness({ activeTab: "mission" });
        harness.sync.bind();
        harness.sync.sync();

        harness.timelineSlider.value = "520";
        harness.timelineSlider.dispatchEvent({ type: "input" });
        expect(harness.mobileComposeTimelineValue.textContent).toBe(new Date(450).toUTCString());

        harness.state.activeTab = "compose";
        harness.timelineSlider.dispatchEvent({ type: "input" });
        expect(harness.mobileComposeTimelineValue.textContent).toBe(new Date(520).toUTCString());

        harness.timelineSlider.value = "580";
        harness.instances[0].trigger();
        expect(harness.mobileComposeTimelineValue.textContent).toBe(new Date(580).toUTCString());
        expect(harness.instances[0].options.attributeFilter).toEqual([
            "data-event-time-ms",
            "data-event-key",
            "title",
        ]);
    });
});
