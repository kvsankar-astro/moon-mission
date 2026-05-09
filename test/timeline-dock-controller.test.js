import { describe, expect, it } from "vitest";

import { createTimelineDockController } from "../src/platform/js/app/timeline-dock-controller.js";

class FakeElement {
    constructor(tagName = "div", rect = { width: 720, height: 40 }) {
        this.tagName = tagName;
        this.children = [];
        this.className = "";
        this.style = {};
        this.dataset = {};
        this.attributes = {};
        this.textContent = "";
        this.title = "";
        this.value = "0";
        this.min = "0";
        this.max = "0";
        this.step = "1";
        this._innerHTML = "";
        this.hidden = false;
        this.disabled = false;
        this.parentElement = null;
        this.rect = rect;
        this.listeners = new Map();
        this.classList = {
            add: (...names) => {
                const set = new Set(this.className.split(/\s+/).filter(Boolean));
                for (const name of names) set.add(name);
                this.className = Array.from(set).join(" ");
            },
            remove: (...names) => {
                const set = new Set(this.className.split(/\s+/).filter(Boolean));
                for (const name of names) set.delete(name);
                this.className = Array.from(set).join(" ");
            },
            toggle: (name, enabled) => {
                if (enabled) {
                    this.classList.add(name);
                    return;
                }
                this.classList.remove(name);
            },
            contains: (name) => this.className.split(/\s+/).filter(Boolean).includes(name),
        };
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    addEventListener(type, handler) {
        const handlers = this.listeners.get(type) || [];
        handlers.push(handler);
        this.listeners.set(type, handlers);
    }

    dispatchEvent(event) {
        if (!event.target) event.target = this;
        if (typeof event.preventDefault !== "function") {
            event.preventDefault = () => {
                event.defaultPrevented = true;
            };
        }
        const handlers = this.listeners.get(event.type) || [];
        handlers.forEach((handler) => handler.call(this, event));
    }

    setPointerCapture(pointerId) {
        this.capturedPointerId = pointerId;
    }

    releasePointerCapture(pointerId) {
        if (this.capturedPointerId === pointerId) {
            delete this.capturedPointerId;
        }
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    getAttribute(name) {
        return this.attributes[name] || "";
    }

    removeAttribute(name) {
        delete this.attributes[name];
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(value) {
        this._innerHTML = value;
        this.children = [];
    }

    getBoundingClientRect() {
        return this.rect;
    }
}

describe("createTimelineDockController", () => {
    it("renders craft chips for multiple visible crafts", () => {
        const dockRoot = new FakeElement("div");
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const modeLabel = new FakeElement("div");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        craftStrip.className = "timeline-dock__craft-strip timeline-dock__craft-strip--hidden";

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-start-label") return startLabel;
                if (id === "timeline-end-label") return endLabel;
                if (id === "timeline-mode-label") return modeLabel;
                if (id === "timeline-current-label") return currentLabel;
                if (id === "timeline-craft-strip") return craftStrip;
                return null;
            },
            createElement(tagName) {
                return new FakeElement(tagName);
            },
        };

        const controller = createTimelineDockController({});
        controller.setCrafts([
            {
                id: "CH3L",
                label: "Vikram",
                color: "#f472b6",
                roleLabel: "Primary",
                active: true,
            },
            {
                id: "CH3O",
                label: "Propulsion Module",
                color: "#38bdf8",
                roleLabel: "Additional",
                active: false,
            },
        ]);

        expect(craftStrip.classList.contains("timeline-dock__craft-strip--hidden")).toBe(false);
        expect(craftStrip.children).toHaveLength(2);
        expect(craftStrip.children[0].className).toContain("timeline-dock__craft-chip--active");
        expect(craftStrip.children[0].children[0].className).toBe("timeline-dock__craft-swatch");
        expect(craftStrip.children[0].children[0].style.backgroundColor).toBe("#f472b6");
        expect(craftStrip.children[0].children[1].textContent).toBe("Vikram");
        expect(craftStrip.children[1].children[2].textContent).toBe("Additional");
    });

    it("hides the craft strip when zero or one craft is visible", () => {
        const dockRoot = new FakeElement("div");
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const modeLabel = new FakeElement("div");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-start-label") return startLabel;
                if (id === "timeline-end-label") return endLabel;
                if (id === "timeline-mode-label") return modeLabel;
                if (id === "timeline-current-label") return currentLabel;
                if (id === "timeline-craft-strip") return craftStrip;
                return null;
            },
            createElement(tagName) {
                return new FakeElement(tagName);
            },
        };

        const controller = createTimelineDockController({});
        controller.setCrafts([{ id: "CH3L", label: "Vikram" }]);

        expect(craftStrip.classList.contains("timeline-dock__craft-strip--hidden")).toBe(true);
        expect(craftStrip.children).toHaveLength(0);
    });

    it("shows current time in inferred local timezone without UTC offset", () => {
        const dockRoot = new FakeElement("div");
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const modeLabel = new FakeElement("div");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-start-label") return startLabel;
                if (id === "timeline-end-label") return endLabel;
                if (id === "timeline-mode-label") return modeLabel;
                if (id === "timeline-current-label") return currentLabel;
                if (id === "timeline-craft-strip") return craftStrip;
                return null;
            },
            createElement(tagName) {
                return new FakeElement(tagName);
            },
        };

        const controller = createTimelineDockController({});
        const timestamp = Date.UTC(2026, 3, 2, 12, 34, 56);
        controller.setRange({
            startTimeMs: timestamp - 1000,
            endTimeMs: timestamp + 1000,
            stepMs: 1000,
        });
        controller.setCurrentTime(timestamp);

        expect(currentLabel.textContent).not.toMatch(/UTC[+-]\d{2}:\d{2}$/);
        expect(slider.attributes["aria-valuetext"]).toBe(currentLabel.textContent);
        expect(startLabel.innerHTML).toMatch(/UTC[+-]\d{2}:\d{2}</);
    });

    it("renders progressive time labels and lets scale controls zoom and pan the visible window", () => {
        const dockRoot = new FakeElement("div");
        const slider = new FakeElement("input", { width: 860, height: 40 });
        const markers = new FakeElement("div");
        const timeLabels = new FakeElement("div", { width: 860, height: 14 });
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const modeLabel = new FakeElement("div");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const panLeftButton = new FakeElement("button");
        const scaleContractButton = new FakeElement("button");
        const scaleResetButton = new FakeElement("button");
        const scaleExpandButton = new FakeElement("button");
        const panRightButton = new FakeElement("button");

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-time-labels") return timeLabels;
                if (id === "timeline-start-label") return startLabel;
                if (id === "timeline-end-label") return endLabel;
                if (id === "timeline-mode-label") return modeLabel;
                if (id === "timeline-current-label") return currentLabel;
                if (id === "timeline-craft-strip") return craftStrip;
                if (id === "timeline-pan-left") return panLeftButton;
                if (id === "timeline-scale-contract") return scaleContractButton;
                if (id === "timeline-scale-reset") return scaleResetButton;
                if (id === "timeline-scale-expand") return scaleExpandButton;
                if (id === "timeline-pan-right") return panRightButton;
                return null;
            },
            createElement(tagName) {
                return new FakeElement(tagName);
            },
        };

        const controller = createTimelineDockController({});
        controller.bind();
        controller.setRange({
            startTimeMs: new Date(2026, 3, 1, 0, 0, 0).getTime(),
            endTimeMs: new Date(2026, 3, 12, 0, 0, 0).getTime(),
            stepMs: 60000,
        });
        controller.setEvents([
            { key: "early", startTime: new Date(2026, 3, 2, 0, 0, 0), label: "Early" },
            { key: "middle", startTime: new Date(2026, 3, 6, 12, 0, 0), label: "Middle" },
            { key: "late", startTime: new Date(2026, 3, 10, 0, 0, 0), label: "Late" },
        ]);

        const initialCount = timeLabels.children.length;
        const initialStart = startLabel.innerHTML;
        expect(initialCount).toBeGreaterThan(0);
        expect(timeLabels.children[0].className).toBe("timeline-dock__time-label");
        expect(timeLabels.children[0].textContent).toMatch(/^Apr \d+$/);
        expect(scaleResetButton.disabled).toBe(true);
        expect(markers.children).toHaveLength(3);

        scaleExpandButton.dispatchEvent({ type: "click" });

        expect(startLabel.innerHTML).not.toBe(initialStart);
        expect(markers.children.length).toBeLessThan(3);
        expect(scaleResetButton.disabled).toBe(false);
        expect(scaleContractButton.disabled).toBe(false);

        const zoomedStart = startLabel.innerHTML;
        panRightButton.dispatchEvent({ type: "click" });

        expect(startLabel.innerHTML).not.toBe(zoomedStart);
        expect(panLeftButton.disabled).toBe(false);

        scaleResetButton.dispatchEvent({ type: "click" });

        expect(timeLabels.children.length).toBe(initialCount);
        expect(startLabel.innerHTML).toBe(initialStart);
        expect(markers.children).toHaveLength(3);
        expect(scaleResetButton.disabled).toBe(true);
    });

    it("supports wheel zoom, drag panning, and click seeking on the timeline strip", () => {
        const dockRoot = new FakeElement("div");
        const trackWrap = new FakeElement("div", { left: 100, width: 800, height: 42 });
        const slider = new FakeElement("input", { left: 100, width: 800, height: 24 });
        const markers = new FakeElement("div");
        const timeLabels = new FakeElement("div", { left: 100, width: 800, height: 14 });
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const seekTimes = [];

        trackWrap.appendChild(slider);
        trackWrap.appendChild(markers);
        trackWrap.appendChild(timeLabels);

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-time-labels") return timeLabels;
                if (id === "timeline-start-label") return startLabel;
                if (id === "timeline-end-label") return endLabel;
                if (id === "timeline-current-label") return currentLabel;
                if (id === "timeline-craft-strip") return craftStrip;
                return null;
            },
            createElement(tagName) {
                return new FakeElement(tagName);
            },
        };

        const controller = createTimelineDockController({
            onSeekTime(timeMs, commit) {
                seekTimes.push({ timeMs, commit });
            },
        });
        controller.bind();
        controller.setRange({
            startTimeMs: 0,
            endTimeMs: 1000,
            stepMs: 1,
        });
        controller.setCurrentTime(500);

        const fullSpan = Number(slider.max) - Number(slider.min);
        trackWrap.dispatchEvent({
            type: "wheel",
            deltaX: 0,
            deltaY: -100,
            deltaMode: 0,
            clientX: 500,
        });

        const zoomedMin = Number(slider.min);
        const zoomedSpan = Number(slider.max) - zoomedMin;
        expect(zoomedSpan).toBeLessThan(fullSpan);
        expect(dockRoot.classList.contains("timeline-dock--zoomed")).toBe(true);

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 1,
            pointerType: "mouse",
            button: 0,
            clientX: 500,
        });
        trackWrap.dispatchEvent({
            type: "pointermove",
            pointerId: 1,
            pointerType: "mouse",
            clientX: 600,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 1,
            pointerType: "mouse",
            clientX: 600,
        });

        expect(Number(slider.min)).toBeLessThan(zoomedMin);
        expect(dockRoot.classList.contains("timeline-dock--timeline-dragging")).toBe(false);

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 2,
            pointerType: "mouse",
            button: 0,
            clientX: 700,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 2,
            pointerType: "mouse",
            clientX: 700,
        });

        expect(seekTimes).toHaveLength(1);
        expect(seekTimes[0].commit).toBe(true);
        expect(seekTimes[0].timeMs).toBeGreaterThan(Number(slider.min));
        expect(seekTimes[0].timeMs).toBeLessThan(Number(slider.max));

        const thumbDownEvent = {
            type: "pointerdown",
            pointerId: 3,
            pointerType: "mouse",
            button: 0,
            clientX: 700,
            target: slider,
        };
        trackWrap.dispatchEvent(thumbDownEvent);

        expect(thumbDownEvent.defaultPrevented).not.toBe(true);
        expect(dockRoot.classList.contains("timeline-dock--timeline-dragging")).toBe(false);
    });

    it("switches to explicit compare-mode labels and styles comparison markers", () => {
        const dockRoot = new FakeElement("div");
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const modeLabel = new FakeElement("div");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-start-label") return startLabel;
                if (id === "timeline-end-label") return endLabel;
                if (id === "timeline-mode-label") return modeLabel;
                if (id === "timeline-current-label") return currentLabel;
                if (id === "timeline-craft-strip") return craftStrip;
                return null;
            },
            createElement(tagName) {
                return new FakeElement(tagName);
            },
        };

        const controller = createTimelineDockController({});
        controller.setMode({
            compareMode: true,
            label: "Comparison Time",
            detail: "Fictional / relative",
            title: "Aligned mission comparison",
        });
        controller.setRange({
            startTimeMs: 0,
            endTimeMs: 3600000,
            stepMs: 60000,
        });
        controller.setEvents([
            {
                key: "compare-burn",
                startTime: new Date(900000),
                timelineLabel: "CM: TLI",
                timelineHoverText: "CM • Tue, Jan 01, 2024 • TLI",
                comparisonEvent: true,
                burnFlag: true,
            },
        ]);
        controller.setCurrentTime(900000);

        expect(dockRoot.classList.contains("timeline-dock--compare")).toBe(true);
        expect(modeLabel.hidden).toBe(false);
        expect(modeLabel.textContent).toContain("Comparison Time");
        expect(currentLabel.textContent).toContain("Comparison Elapsed");
        expect(currentLabel.textContent).toContain("T+15m");
        expect(startLabel.innerHTML).toContain("Start");
        expect(startLabel.innerHTML).toContain("T+0");
        expect(endLabel.innerHTML).toContain("End");
        expect(endLabel.innerHTML).toContain("T+1h");
        expect(markers.children).toHaveLength(1);
        expect(markers.children[0].className).toContain("timeline-dock__marker--comparison");
        expect(markers.children[0].title).not.toContain(" - ");
        expect(slider.attributes["aria-valuetext"]).toContain("Comparison elapsed time");
    });

    it("marks bracketing event markers as dashed boundaries between events", () => {
        const dockRoot = new FakeElement("div");
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const modeLabel = new FakeElement("div");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-start-label") return startLabel;
                if (id === "timeline-end-label") return endLabel;
                if (id === "timeline-mode-label") return modeLabel;
                if (id === "timeline-current-label") return currentLabel;
                if (id === "timeline-craft-strip") return craftStrip;
                return null;
            },
            createElement(tagName) {
                return new FakeElement(tagName);
            },
        };

        const controller = createTimelineDockController({});
        controller.setRange({
            startTimeMs: 0,
            endTimeMs: 3000,
            stepMs: 1,
        });
        controller.setEvents([
            { key: "e1", startTime: new Date(1000), label: "E1" },
            { key: "e2", startTime: new Date(2000), label: "E2" },
        ]);
        controller.setCurrentTime(1500);

        expect(markers.children[0].className).toContain("timeline-dock__marker--time-boundary");
        expect(markers.children[1].className).toContain("timeline-dock__marker--time-boundary");
        expect(markers.children[0].className).not.toContain("timeline-dock__marker--current-event");
        expect(markers.children[1].className).not.toContain("timeline-dock__marker--current-event");

        controller.setCurrentTime(1000);

        expect(markers.children[0].className).toContain("timeline-dock__marker--current-event");
        expect(markers.children[0].className).not.toContain("timeline-dock__marker--time-boundary");
        expect(markers.children[1].className).not.toContain("timeline-dock__marker--time-boundary");
    });

    it("uses programmatic seek precision when range input values snap to the step grid", () => {
        const dockRoot = new FakeElement("div");
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const modeLabel = new FakeElement("div");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const seekTimes = [];

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-start-label") return startLabel;
                if (id === "timeline-end-label") return endLabel;
                if (id === "timeline-mode-label") return modeLabel;
                if (id === "timeline-current-label") return currentLabel;
                if (id === "timeline-craft-strip") return craftStrip;
                return null;
            },
            createElement(tagName) {
                return new FakeElement(tagName);
            },
        };

        const controller = createTimelineDockController({
            onSeekTime(timeMs) {
                seekTimes.push(timeMs);
            },
        });
        controller.setRange({
            startTimeMs: 1000,
            endTimeMs: 3000,
            stepMs: 100,
        });
        controller.setEvents([
            { key: "e1", startTime: new Date(1234), label: "E1" },
            { key: "e2", startTime: new Date(2000), label: "E2" },
        ]);
        controller.bind();

        slider.value = "1200";
        slider.dataset.programmaticSeekTimeMs = "1234";
        slider.dispatchEvent({ type: "input" });

        expect(seekTimes).toEqual([1234]);
        expect(slider.dataset.currentTimeMs).toBe("1234");
        expect(markers.children[0].className).toContain("timeline-dock__marker--current-event");
        expect(markers.children[0].className).not.toContain("timeline-dock__marker--time-boundary");
    });

    it("renders media markers on a separate rail", () => {
        const dockRoot = new FakeElement("div");
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const mediaMarkers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const modeLabel = new FakeElement("div");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-media-markers") return mediaMarkers;
                if (id === "timeline-start-label") return startLabel;
                if (id === "timeline-end-label") return endLabel;
                if (id === "timeline-mode-label") return modeLabel;
                if (id === "timeline-current-label") return currentLabel;
                if (id === "timeline-craft-strip") return craftStrip;
                return null;
            },
            createElement(tagName) {
                return new FakeElement(tagName);
            },
            dispatchEvent() {},
        };

        const controller = createTimelineDockController({});
        controller.setRange({
            startTimeMs: 0,
            endTimeMs: 1000,
            stepMs: 100,
        });
        controller.setMediaMarkers([
            {
                id: "earthrise",
                startTimeMs: 500,
                label: "Earthrise",
                hoverText: "Earthrise • Crew iPhone",
                mediaKind: "image",
                selected: true,
                clickable: true,
            },
        ]);

        expect(mediaMarkers.children).toHaveLength(1);
        expect(mediaMarkers.children[0].className).toContain("timeline-dock__media-marker");
        expect(mediaMarkers.children[0].className).toContain("timeline-dock__media-marker--selected");
        expect(mediaMarkers.children[0].title).toBe("Earthrise • Crew iPhone");
    });

    it("emits a media marker selection event when clicking a reachable media marker", () => {
        const dockRoot = new FakeElement("div");
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const mediaMarkers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const dispatchedEvents = [];

        global.CustomEvent = class {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        };
        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-media-markers") return mediaMarkers;
                if (id === "timeline-start-label") return startLabel;
                if (id === "timeline-end-label") return endLabel;
                if (id === "timeline-current-label") return currentLabel;
                if (id === "timeline-craft-strip") return craftStrip;
                return null;
            },
            createElement(tagName) {
                return new FakeElement(tagName);
            },
            dispatchEvent(event) {
                dispatchedEvents.push(event);
            },
        };

        const controller = createTimelineDockController({});
        controller.setRange({
            startTimeMs: 0,
            endTimeMs: 1000,
            stepMs: 100,
        });
        controller.setMediaMarkers([
            {
                id: "earthset-photo",
                startTimeMs: 500,
                label: "Earthset Photo",
                mediaKind: "image",
                clickable: true,
            },
        ]);

        mediaMarkers.children[0].dispatchEvent({ type: "click" });

        expect(dispatchedEvents).toHaveLength(1);
        expect(dispatchedEvents[0].type).toBe("mission-media-marker-select");
        expect(dispatchedEvents[0].detail.marker.id).toBe("earthset-photo");

        delete global.CustomEvent;
    });
});
