import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "../src/platform/js/core/event-bus.js";

describe("event-bus", () => {
    it("validates event name and listener arguments for on()", () => {
        const eventBus = createEventBus();

        expect(() => eventBus.on("", () => {})).toThrow("eventName must be a non-empty string");
        expect(() => eventBus.on(42, () => {})).toThrow("eventName must be a non-empty string");
        expect(() => eventBus.on("frame", null)).toThrow("listener must be a function");
    });

    it("registers listeners and emits payloads", () => {
        const eventBus = createEventBus();
        const listener = vi.fn();
        const payload = { frame: 12 };

        eventBus.on("frame", listener);
        eventBus.emit("frame", payload);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(payload);
    });

    it("deduplicates identical listeners for the same event", () => {
        const eventBus = createEventBus();
        const listener = vi.fn();

        eventBus.on("frame", listener);
        eventBus.on("frame", listener);
        eventBus.emit("frame", "tick");

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("supports off() directly and via the unsubscribe function returned by on()", () => {
        const eventBus = createEventBus();
        const first = vi.fn();
        const second = vi.fn();
        const offSecond = eventBus.on("frame", second);

        eventBus.on("frame", first);
        eventBus.off("frame", first);
        offSecond();
        eventBus.emit("frame", 1);

        expect(first).not.toHaveBeenCalled();
        expect(second).not.toHaveBeenCalled();
        expect(() => eventBus.off("missing", first)).not.toThrow();
        expect(() => eventBus.off("frame", () => {})).not.toThrow();
    });

    it("supports once() and allows cancellation before first emit", () => {
        const eventBus = createEventBus();
        const onceListener = vi.fn();
        const cancelableListener = vi.fn();

        eventBus.once("frame", onceListener);
        const cancel = eventBus.once("frame", cancelableListener);

        cancel();
        eventBus.emit("frame", "first");
        eventBus.emit("frame", "second");

        expect(onceListener).toHaveBeenCalledTimes(1);
        expect(onceListener).toHaveBeenCalledWith("first");
        expect(cancelableListener).not.toHaveBeenCalled();
    });

    it("clear() removes all listeners across events", () => {
        const eventBus = createEventBus();
        const frameListener = vi.fn();
        const modeListener = vi.fn();

        eventBus.on("frame", frameListener);
        eventBus.on("mode", modeListener);
        eventBus.clear();

        eventBus.emit("frame", 1);
        eventBus.emit("mode", 2);

        expect(frameListener).not.toHaveBeenCalled();
        expect(modeListener).not.toHaveBeenCalled();
    });

    it("continues through the current emit snapshot when a listener unsubscribes another", () => {
        const eventBus = createEventBus();
        const callOrder = [];
        const second = vi.fn(() => {
            callOrder.push("second");
        });
        const first = vi.fn(() => {
            callOrder.push("first");
            eventBus.off("frame", second);
        });

        eventBus.on("frame", first);
        eventBus.on("frame", second);

        eventBus.emit("frame");
        eventBus.emit("frame");

        expect(callOrder).toEqual(["first", "second", "first"]);
    });

    it("does not invoke listeners added during an active emit until the next emit", () => {
        const eventBus = createEventBus();
        const callOrder = [];
        const late = vi.fn(() => {
            callOrder.push("late");
        });
        const first = vi.fn(() => {
            callOrder.push("first");
            eventBus.on("frame", late);
        });
        const second = vi.fn(() => {
            callOrder.push("second");
        });

        eventBus.on("frame", first);
        eventBus.on("frame", second);

        eventBus.emit("frame");
        eventBus.emit("frame");

        expect(callOrder).toEqual(["first", "second", "first", "second", "late"]);
        expect(late).toHaveBeenCalledTimes(1);
    });

    it("continues current emit callbacks even if clear() is called mid-dispatch", () => {
        const eventBus = createEventBus();
        const callOrder = [];
        const second = vi.fn(() => {
            callOrder.push("second");
        });
        const first = vi.fn(() => {
            callOrder.push("first");
            eventBus.clear();
        });

        eventBus.on("frame", first);
        eventBus.on("frame", second);

        eventBus.emit("frame");
        eventBus.emit("frame");

        expect(callOrder).toEqual(["first", "second"]);
    });
});
