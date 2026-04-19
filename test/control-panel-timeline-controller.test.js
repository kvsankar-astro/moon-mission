import { describe, expect, it } from "vitest";

import { createControlPanelTimelineController } from "../src/platform/js/ui/control-panel-timeline-controller.js";

function createClassList(initialValues = []) {
    const values = new Set(initialValues);
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        contains(value) {
            return values.has(value);
        },
        toggle(value, force) {
            if (force === undefined) {
                if (values.has(value)) {
                    values.delete(value);
                    return false;
                }
                values.add(value);
                return true;
            }
            if (force) {
                values.add(value);
                return true;
            }
            values.delete(value);
            return false;
        },
    };
}

function createElement({
    classNames = [],
    dataset = {},
    rect = { top: 0, bottom: 0, width: 120, height: 40 },
    value = "",
} = {}) {
    const listeners = new Map();
    const attributes = {};
    return {
        dataset: { ...dataset },
        value,
        title: "",
        style: {},
        scrollLeft: 0,
        offsetWidth: rect.width,
        classList: createClassList(classNames),
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        dispatch(type, event = {}) {
            const handlers = listeners.get(type) || [];
            const fullEvent = {
                type,
                target: this,
                currentTarget: this,
                preventDefault() {},
                stopPropagation() {},
                ...event,
            };
            handlers.forEach((handler) => handler(fullEvent));
        },
        setAttribute(name, value) {
            attributes[name] = String(value);
        },
        getAttribute(name) {
            return attributes[name] || "";
        },
        getBoundingClientRect() {
            return rect;
        },
        scrollIntoView(options) {
            this.scrollIntoViewOptions = options;
        },
    };
}

function createHarness() {
    const rootStyleValues = new Map();
    const panel = createElement({
        classNames: ["control-panel"],
        rect: { top: 0, bottom: 60, width: 320, height: 60 },
    });
    const timelineDock = createElement({
        classNames: ["timeline-dock"],
        rect: { top: 700, bottom: 790, width: 320, height: 90 },
    });
    const toggleButton = createElement();
    const slider = createElement({ value: "2600" });
    const burnButtons = createElement();
    const carousel = createElement({ classNames: ["timeline-dock__event-carousel"] });
    const eventButtons = [
        createElement({ dataset: { eventIndex: "0", eventTimeMs: "1000" } }),
        createElement({ dataset: { eventIndex: "1", eventTimeMs: "2500" } }),
        createElement({ dataset: { eventIndex: "2", eventTimeMs: "5000" } }),
    ];
    const windowListeners = new Map();
    const resizeObservers = [];
    const mutationObservers = [];
    const timeouts = [];

    const documentRef = {
        documentElement: {
            style: {
                setProperty(name, value) {
                    rootStyleValues.set(name, value);
                },
            },
        },
        getElementById(id) {
            const mapping = {
                "control-panel": panel,
                "timeline-dock": timelineDock,
                "control-panel-toggle": toggleButton,
                "timeline-slider": slider,
                burnbuttons: burnButtons,
            };
            return mapping[id] || null;
        },
        querySelector(selector) {
            if (selector === "#timeline-dock .timeline-dock__event-carousel") return carousel;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === "#burnbuttons button[data-event-index]") return eventButtons;
            return [];
        },
    };

    const windowRef = {
        addEventListener(type, handler) {
            const handlers = windowListeners.get(type) || [];
            handlers.push(handler);
            windowListeners.set(type, handlers);
        },
        dispatch(type, event = {}) {
            const handlers = windowListeners.get(type) || [];
            handlers.forEach((handler) => handler(event));
        },
    };

    class ResizeObserverClass {
        constructor(callback) {
            this.callback = callback;
            resizeObservers.push(this);
        }

        observe(target) {
            this.target = target;
        }
    }

    class MutationObserverClass {
        constructor(callback) {
            this.callback = callback;
            mutationObservers.push(this);
        }

        observe(target, options) {
            this.target = target;
            this.options = options;
        }
    }

    const controller = createControlPanelTimelineController({
        documentRef,
        windowRef,
        requestAnimationFrameImpl(callback) {
            callback();
        },
        setTimeoutImpl(callback, delayMs) {
            timeouts.push(delayMs);
            callback();
            return delayMs;
        },
        clearTimeoutImpl() {},
        ResizeObserverClass,
        MutationObserverClass,
        matchMediaImpl() {
            return { matches: false };
        },
        nowImpl() {
            return 1000;
        },
    });

    return {
        controller,
        eventButtons,
        mutationObservers,
        panel,
        resizeObservers,
        rootStyleValues,
        timeouts,
        timelineDock,
        toggleButton,
    };
}

describe("createControlPanelTimelineController", () => {
    it("binds the toggle and syncs initial layout state", () => {
        const harness = createHarness();

        harness.controller.bind();

        expect(harness.toggleButton.dataset.bound).toBe("true");
        expect(harness.toggleButton.getAttribute("aria-expanded")).toBe("true");
        expect(harness.toggleButton.getAttribute("aria-label")).toBe("Pull down events carousel");
        expect(harness.rootStyleValues.get("--control-panel-visual-height")).toBe("60px");
        expect(harness.rootStyleValues.get("--timeline-dock-height")).toBe("90px");
        expect(harness.resizeObservers).toHaveLength(1);
        expect(harness.mutationObservers).toHaveLength(1);
        expect(harness.timeouts).toEqual([80, 180, 320, 520, 900]);
    });

    it("collapses the control panel and updates the shared visual height", () => {
        const harness = createHarness();

        harness.controller.bind();
        harness.controller.setControlPanelCollapsedState(true);

        expect(harness.panel.classList.contains("control-panel--collapsed")).toBe(true);
        expect(harness.rootStyleValues.get("--control-panel-visual-height")).toBe("0px");
    });

    it("toggles the timeline dock from the control button", () => {
        const harness = createHarness();

        harness.controller.bind();
        harness.toggleButton.dispatch("click");

        expect(harness.timelineDock.classList.contains("timeline-dock--events-collapsed")).toBe(true);
        expect(harness.toggleButton.getAttribute("aria-expanded")).toBe("false");
        expect(harness.toggleButton.title).toBe("Pull up events carousel");
    });

    it("focuses the next future event when opening a collapsed carousel", () => {
        const harness = createHarness();
        harness.timelineDock.classList.add("timeline-dock--events-collapsed");

        harness.controller.setTimelineEventCarouselExpandedState(true, {
            focusUpcoming: true,
            wiggleCue: false,
        });

        expect(harness.eventButtons[2].scrollIntoViewOptions?.inline).toBe("center");
        expect(harness.timelineDock.classList.contains("timeline-dock--events-collapsed")).toBe(false);
    });
});
