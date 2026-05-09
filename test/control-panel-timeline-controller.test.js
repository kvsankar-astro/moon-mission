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

function createHarness({
    desktopTimeline = false,
} = {}) {
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
    const mediaToggleButton = createElement();
    const slider = createElement({ value: "2600" });
    const markers = createElement();
    const mediaMarkers = createElement();
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
    const panelActions = [];

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
                "timeline-media-toggle": mediaToggleButton,
                "timeline-slider": slider,
                "timeline-markers": markers,
                "timeline-media-markers": mediaMarkers,
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
        matchMediaImpl(query) {
            if (query === "(min-width: 601px)") {
                return { matches: desktopTimeline };
            }
            return { matches: false };
        },
        invokeMissionPanelActionImpl(id, action) {
            panelActions.push({ id, action });
            return true;
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
        markers,
        mediaMarkers,
        mediaToggleButton,
        panelActions,
        toggleButton,
    };
}

describe("createControlPanelTimelineController", () => {
    it("binds the toggle and syncs initial layout state", () => {
        const harness = createHarness();

        harness.controller.bind();

        expect(harness.toggleButton.dataset.bound).toBe("true");
        expect(harness.mediaToggleButton.dataset.bound).toBe("true");
        expect(harness.timelineDock.classList.contains("timeline-dock--events-collapsed")).toBe(true);
        expect(harness.toggleButton.getAttribute("aria-expanded")).toBe("false");
        expect(harness.toggleButton.getAttribute("aria-pressed")).toBe("false");
        expect(harness.toggleButton.getAttribute("aria-label")).toBe("Show event track");
        expect(harness.mediaToggleButton.getAttribute("aria-pressed")).toBe("false");
        expect(harness.markers.hidden).toBe(true);
        expect(harness.mediaMarkers.hidden).toBe(true);
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

        expect(harness.timelineDock.classList.contains("timeline-dock--events-collapsed")).toBe(false);
        expect(harness.markers.hidden).toBe(false);
        expect(harness.mediaMarkers.hidden).toBe(true);
        expect(harness.toggleButton.getAttribute("aria-expanded")).toBe("true");
        expect(harness.toggleButton.getAttribute("aria-pressed")).toBe("true");
        expect(harness.toggleButton.title).toBe("Hide event track");
    });

    it("toggles media markers separately on desktop", () => {
        const harness = createHarness({ desktopTimeline: true });

        harness.controller.bind();

        expect(harness.timelineDock.classList.contains("timeline-dock--events-collapsed")).toBe(true);
        expect(harness.markers.hidden).toBe(true);
        expect(harness.mediaToggleButton.disabled).toBe(false);
        expect(harness.mediaToggleButton.getAttribute("aria-pressed")).toBe("false");
        expect(harness.mediaMarkers.hidden).toBe(true);

        harness.mediaToggleButton.dispatch("click");

        expect(harness.timelineDock.classList.contains("timeline-dock--events-collapsed")).toBe(true);
        expect(harness.markers.hidden).toBe(true);
        expect(harness.mediaToggleButton.getAttribute("aria-pressed")).toBe("true");
        expect(harness.mediaMarkers.hidden).toBe(false);
        expect(harness.panelActions).toEqual([
            { id: "workflow:media-browser", action: "open" },
            { id: "aux:earth-rise-composer", action: "restoreGuided" },
        ]);
    });

    it("keeps the media toggle disabled off desktop", () => {
        const harness = createHarness({ desktopTimeline: false });

        harness.controller.bind();

        expect(harness.mediaToggleButton.disabled).toBe(true);
        expect(harness.mediaToggleButton.getAttribute("aria-disabled")).toBe("true");
        expect(harness.mediaToggleButton.title).toBe("Media track is desktop-only for now");
        expect(harness.mediaMarkers.hidden).toBe(true);
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
        expect(harness.markers.hidden).toBe(false);
        expect(harness.mediaMarkers.hidden).toBe(true);
    });
});
