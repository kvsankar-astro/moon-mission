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

    it("supports wheel zoom plus playhead drag and click seeking on the timeline strip", () => {
        const dockRoot = new FakeElement("div");
        const trackWrap = new FakeElement("div", { left: 100, width: 800, height: 42 });
        const scrubLane = new FakeElement("div", { left: 100, width: 800, height: 30 });
        const timeClickLane = new FakeElement("div", { left: 100, width: 800, height: 18 });
        const slider = new FakeElement("input", { left: 100, width: 800, height: 24 });
        const markers = new FakeElement("div");
        const timeLabels = new FakeElement("div", { left: 100, width: 800, height: 14 });
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const seekTimes = [];

        timeClickLane.appendChild(slider);
        scrubLane.appendChild(timeLabels);
        trackWrap.appendChild(timeClickLane);
        trackWrap.appendChild(scrubLane);
        trackWrap.appendChild(markers);

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-time-click-lane") return timeClickLane;
                if (id === "timeline-scrub-lane") return scrubLane;
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
        const timeBeforePan = slider.dataset.currentTimeMs;

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 1,
            pointerType: "mouse",
            button: 0,
            clientX: 500,
            target: scrubLane,
        });
        expect(seekTimes).toHaveLength(0);
        trackWrap.dispatchEvent({
            type: "pointermove",
            pointerId: 1,
            pointerType: "mouse",
            clientX: 600,
            target: scrubLane,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 1,
            pointerType: "mouse",
            clientX: 600,
            target: scrubLane,
        });

        expect(Number(slider.min)).toBeLessThan(zoomedMin);
        expect(dockRoot.classList.contains("timeline-dock--timeline-dragging")).toBe(false);
        expect(seekTimes).toHaveLength(0);
        expect(slider.dataset.currentTimeMs).toBe(timeBeforePan);

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 2,
            pointerType: "mouse",
            button: 0,
            clientX: 700,
            target: timeClickLane,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 2,
            pointerType: "mouse",
            clientX: 700,
            target: timeClickLane,
        });

        expect(seekTimes).toHaveLength(1);
        const committedSeeks = seekTimes.filter((entry) => entry.commit === true);
        expect(committedSeeks.length).toBe(1);
        const lastSeek = seekTimes[seekTimes.length - 1];
        expect(lastSeek.commit).toBe(true);
        expect(lastSeek.timeMs).toBeGreaterThan(Number(slider.min));
        expect(lastSeek.timeMs).toBeLessThan(Number(slider.max));

        const inertScrubClickEvent = {
            type: "pointerdown",
            pointerId: 3,
            pointerType: "mouse",
            button: 0,
            clientX: 700,
            target: scrubLane,
        };
        trackWrap.dispatchEvent(inertScrubClickEvent);

        expect(inertScrubClickEvent.defaultPrevented).toBe(true);
        expect(dockRoot.classList.contains("timeline-dock--timeline-dragging")).toBe(true);
        expect(seekTimes).toHaveLength(1);
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 3,
            pointerType: "mouse",
            clientX: 700,
            target: scrubLane,
        });
        expect(dockRoot.classList.contains("timeline-dock--timeline-dragging")).toBe(false);
        expect(seekTimes).toHaveLength(1);
    });

    it("drags the visible playhead to seek the timeline time", () => {
        const dockRoot = new FakeElement("div");
        const trackWrap = new FakeElement("div", { left: 100, top: 100, width: 800, height: 76 });
        const timeClickLane = new FakeElement("div", { left: 100, top: 126, width: 800, height: 16 });
        const scrubLane = new FakeElement("div", { left: 100, top: 152, width: 800, height: 24 });
        const slider = new FakeElement("input", { left: 100, top: 126, width: 800, height: 16 });
        const playhead = new FakeElement("div", { left: 498, top: 108, width: 4, height: 68 });
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const seekTimes = [];
        const dispatchedEvents = [];

        timeClickLane.appendChild(slider);
        timeClickLane.appendChild(playhead);
        trackWrap.appendChild(timeClickLane);
        trackWrap.appendChild(scrubLane);
        trackWrap.appendChild(markers);

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-playhead") return playhead;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-time-click-lane") return timeClickLane;
                if (id === "timeline-scrub-lane") return scrubLane;
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

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 31,
            pointerType: "mouse",
            button: 0,
            clientX: 500,
            clientY: 140,
            target: playhead,
        });
        trackWrap.dispatchEvent({
            type: "pointermove",
            pointerId: 31,
            pointerType: "mouse",
            clientX: 660,
            clientY: 140,
            target: playhead,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 31,
            pointerType: "mouse",
            clientX: 660,
            clientY: 140,
            target: playhead,
        });

        expect(seekTimes).toEqual([
            { timeMs: 700, commit: false },
            { timeMs: 700, commit: true },
        ]);
        expect(dispatchedEvents.map((event) => event.detail)).toEqual([
            { phase: "update", source: "timeline-playhead", commit: false, timeMs: 700 },
            { phase: "end", source: "timeline-playhead", commit: true, timeMs: 700 },
        ]);
        expect(slider.dataset.currentTimeMs).toBe("700");
    });

    it("still seeks when clicking a marker hitbox away from the visible glyph", () => {
        const dockRoot = new FakeElement("div");
        const trackWrap = new FakeElement("div", { left: 100, width: 800, height: 42 });
        const timeClickLane = new FakeElement("div", { left: 100, width: 800, height: 18 });
        const scrubLane = new FakeElement("div", { left: 100, width: 800, height: 30 });
        const slider = new FakeElement("input", { left: 100, width: 800, height: 24 });
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const seekTimes = [];

        timeClickLane.appendChild(slider);
        trackWrap.appendChild(timeClickLane);
        trackWrap.appendChild(scrubLane);
        trackWrap.appendChild(markers);

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-time-click-lane") return timeClickLane;
                if (id === "timeline-scrub-lane") return scrubLane;
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
        controller.setEvents([
            { key: "event-mid", startTime: new Date(500), label: "Midpoint Event", clickable: true },
        ]);

        const marker = markers.children[0];
        const markerCenterX = 500;
        const markerHitboxButNotGlyphX = markerCenterX + 20;

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 9,
            pointerType: "mouse",
            button: 0,
            clientX: markerHitboxButNotGlyphX,
            target: marker,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 9,
            pointerType: "mouse",
            clientX: markerHitboxButNotGlyphX,
            target: marker,
        });

        expect(seekTimes).toHaveLength(1);
        expect(seekTimes[0].commit).toBe(true);
        expect(seekTimes[0].timeMs).toBeGreaterThan(500);
    });

    it("seeks when clicking the empty media marker lane", () => {
        const dockRoot = new FakeElement("div");
        const trackWrap = new FakeElement("div", { left: 100, width: 800, height: 42 });
        const scrubLane = new FakeElement("div", { left: 100, width: 800, height: 30 });
        const timeClickLane = new FakeElement("div", { left: 100, width: 800, height: 18 });
        const slider = new FakeElement("input", { left: 100, width: 800, height: 24 });
        const markers = new FakeElement("div");
        const mediaMarkers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const seekTimes = [];

        scrubLane.appendChild(slider);
        trackWrap.appendChild(scrubLane);
        trackWrap.appendChild(markers);
        trackWrap.appendChild(mediaMarkers);

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-media-markers") return mediaMarkers;
                if (id === "timeline-scrub-lane") return scrubLane;
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

        const laneClickX = 700;
        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 12,
            pointerType: "mouse",
            button: 0,
            clientX: laneClickX,
            target: mediaMarkers,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 12,
            pointerType: "mouse",
            clientX: laneClickX,
            target: mediaMarkers,
        });

        expect(seekTimes).toEqual([
            { timeMs: 750, commit: true },
        ]);
    });

    it("selects and seeks media segments from direct media-lane clicks", () => {
        const dockRoot = new FakeElement("div");
        const trackWrap = new FakeElement("div", { left: 100, top: 100, width: 800, height: 76 });
        const mediaMarkers = new FakeElement("div", { left: 100, top: 100, width: 800, height: 18 });
        const markers = new FakeElement("div", { left: 100, top: 123, width: 800, height: 20 });
        const timeClickLane = new FakeElement("div", { left: 100, top: 126, width: 800, height: 16 });
        const scrubLane = new FakeElement("div", { left: 100, top: 152, width: 800, height: 24 });
        const slider = new FakeElement("input", { left: 100, top: 126, width: 800, height: 16 });
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const seekTimes = [];
        const dispatchedEvents = [];

        timeClickLane.appendChild(slider);
        trackWrap.appendChild(mediaMarkers);
        trackWrap.appendChild(markers);
        trackWrap.appendChild(timeClickLane);
        trackWrap.appendChild(scrubLane);

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
                if (id === "timeline-time-click-lane") return timeClickLane;
                if (id === "timeline-scrub-lane") return scrubLane;
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
        controller.setMediaMarkers([
            {
                id: "earthrise-video",
                startTimeMs: 200,
                endTimeMs: 500,
                label: "Earthrise Video",
                mediaKind: "videoClip",
                mediaDisplayMode: "segment",
                clickable: true,
            },
            {
                id: "earthrise-photo",
                startTimeMs: 200,
                endTimeMs: 500,
                label: "Earthrise Photo",
                mediaKind: "image",
                mediaDisplayMode: "segment",
                clickable: true,
            },
        ]);
        mediaMarkers.children[0].rect = { left: 260, top: 100, width: 240, height: 10 };
        mediaMarkers.children[1].rect = { left: 260, top: 100, width: 240, height: 10 };
        const visibleVideoMarker = mediaMarkers.children[0];

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 13,
            pointerType: "mouse",
            button: 0,
            clientX: 420,
            clientY: 108,
            target: visibleVideoMarker,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 13,
            pointerType: "mouse",
            clientX: 420,
            clientY: 108,
            target: visibleVideoMarker,
        });

        expect(seekTimes).toEqual([{ timeMs: 400, commit: true }]);
        expect(dispatchedEvents).toHaveLength(2);
        expect(dispatchedEvents[0].type).toBe("mission-timeline-user-seek");
        expect(dispatchedEvents[0].detail.source).toBe("timeline-media-marker");
        expect(dispatchedEvents[0].detail.timeMs).toBe(400);
        expect(dispatchedEvents[1].type).toBe("mission-media-marker-select");
        expect(dispatchedEvents[1].detail.marker.id).toBe("earthrise-video");
        expect(dispatchedEvents[1].detail.timeMs).toBe(400);

        delete global.CustomEvent;
    });

    it("uses pointer coordinates to keep click and scrub bands distinct", () => {
        const dockRoot = new FakeElement("div");
        const trackWrap = new FakeElement("div", { left: 100, top: 100, width: 800, height: 76 });
        const mediaMarkers = new FakeElement("div", { left: 100, top: 100, width: 800, height: 18 });
        const markers = new FakeElement("div", { left: 100, top: 123, width: 800, height: 20 });
        const timeClickLane = new FakeElement("div", { left: 100, top: 126, width: 800, height: 16 });
        const scrubLane = new FakeElement("div", { left: 100, top: 152, width: 800, height: 24 });
        const slider = new FakeElement("input", { left: 100, top: 126, width: 800, height: 16 });
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const seekTimes = [];

        timeClickLane.appendChild(slider);
        trackWrap.appendChild(mediaMarkers);
        trackWrap.appendChild(markers);
        trackWrap.appendChild(timeClickLane);
        trackWrap.appendChild(scrubLane);

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-media-markers") return mediaMarkers;
                if (id === "timeline-time-click-lane") return timeClickLane;
                if (id === "timeline-scrub-lane") return scrubLane;
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

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 21,
            pointerType: "mouse",
            button: 0,
            clientX: 500,
            clientY: 146,
            target: trackWrap,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 21,
            pointerType: "mouse",
            clientX: 500,
            clientY: 146,
            target: trackWrap,
        });
        expect(seekTimes).toHaveLength(0);

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 22,
            pointerType: "mouse",
            button: 0,
            clientX: 500,
            clientY: 134,
            target: trackWrap,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 22,
            pointerType: "mouse",
            clientX: 500,
            clientY: 134,
            target: trackWrap,
        });
        expect(seekTimes).toEqual([{ timeMs: 500, commit: true }]);

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 23,
            pointerType: "mouse",
            button: 0,
            clientX: 300,
            clientY: 164,
            target: trackWrap,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 23,
            pointerType: "mouse",
            clientX: 300,
            clientY: 164,
            target: trackWrap,
        });
        expect(seekTimes).toEqual([{ timeMs: 500, commit: true }]);

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 24,
            pointerType: "mouse",
            button: 0,
            clientX: 300,
            clientY: 164,
            target: trackWrap,
        });
        trackWrap.dispatchEvent({
            type: "pointermove",
            pointerId: 24,
            pointerType: "mouse",
            clientX: 500,
            clientY: 164,
            target: trackWrap,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 24,
            pointerType: "mouse",
            clientX: 500,
            clientY: 164,
            target: trackWrap,
        });
        expect(seekTimes).toEqual([
            { timeMs: 500, commit: true },
        ]);
    });

    it("does not seek when grab-bar pointer input arrives before controller range state", () => {
        const dockRoot = new FakeElement("div");
        const trackWrap = new FakeElement("div", { left: 100, width: 800, height: 42 });
        const scrubLane = new FakeElement("div", { left: 100, width: 800, height: 30 });
        const timeClickLane = new FakeElement("div", { left: 100, width: 800, height: 18 });
        const slider = new FakeElement("input", { left: 100, width: 800, height: 24 });
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const seekTimes = [];

        slider.min = "1000";
        slider.max = "2000";
        slider.value = "1200";
        timeClickLane.appendChild(slider);
        trackWrap.appendChild(timeClickLane);
        trackWrap.appendChild(scrubLane);
        trackWrap.appendChild(markers);

        global.document = {
            getElementById(id) {
                if (id === "timeline-dock") return dockRoot;
                if (id === "timeline-slider") return slider;
                if (id === "timeline-markers") return markers;
                if (id === "timeline-time-click-lane") return timeClickLane;
                if (id === "timeline-scrub-lane") return scrubLane;
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

        trackWrap.dispatchEvent({
            type: "pointerdown",
            pointerId: 42,
            pointerType: "mouse",
            button: 0,
            clientX: 300,
            target: scrubLane,
        });

        expect(seekTimes).toHaveLength(0);

        trackWrap.dispatchEvent({
            type: "pointermove",
            pointerId: 42,
            pointerType: "mouse",
            clientX: 500,
            target: scrubLane,
        });
        trackWrap.dispatchEvent({
            type: "pointerup",
            pointerId: 42,
            pointerType: "mouse",
            clientX: 500,
            target: scrubLane,
        });

        expect(seekTimes).toEqual([]);
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

    it("emits a timeline seek event when clicking a reachable timeline event marker", () => {
        const dockRoot = new FakeElement("div");
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        const dispatchedEvents = [];
        const selectedMarkers = [];
        const onMarkerSelect = (eventInfo, index) => {
            selectedMarkers.push({ eventInfo, index });
        };

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

        const controller = createTimelineDockController({
            onMarkerSelect,
        });
        controller.setRange({
            startTimeMs: 0,
            endTimeMs: 1000,
            stepMs: 100,
        });
        controller.setEvents([
            {
                key: "event-1",
                startTime: new Date(500),
                label: "Event 1",
                clickable: true,
            },
        ]);

        markers.children[0].dispatchEvent({ type: "click" });

        expect(dispatchedEvents).toHaveLength(1);
        expect(dispatchedEvents[0].type).toBe("mission-timeline-user-seek");
        expect(dispatchedEvents[0].detail.phase).toBe("commit");
        expect(dispatchedEvents[0].detail.source).toBe("timeline-event-marker");
        expect(dispatchedEvents[0].detail.timeMs).toBe(500);
        expect(selectedMarkers).toHaveLength(1);
        expect(selectedMarkers[0]).toEqual(expect.objectContaining({
            eventInfo: expect.objectContaining({
                key: "event-1",
            }),
            index: 0,
        }));

        delete global.CustomEvent;
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
            {
                id: "earthshine-video",
                startTimeMs: 200,
                endTimeMs: 500,
                label: "Earthshine Video",
                hoverText: "Earthshine Video • 30s",
                mediaKind: "videoClip",
                mediaDisplayMode: "segment",
                clickable: true,
            },
            {
                id: "mission-audio",
                startTimeMs: -100,
                endTimeMs: 100,
                label: "Mission Audio",
                hoverText: "Mission Audio • Approx. 30s",
                mediaKind: "audioClip",
                mediaDisplayMode: "segment",
                durationEstimated: true,
                clickable: true,
            },
        ]);

        expect(mediaMarkers.children).toHaveLength(3);
        expect(mediaMarkers.children[0].className).toContain("timeline-dock__media-marker");
        expect(mediaMarkers.children[0].className).not.toContain("timeline-dock__media-marker--segment");
        expect(mediaMarkers.children[0].className).toContain("timeline-dock__media-marker--selected");
        expect(mediaMarkers.children[0].title).toBe("Earthrise • Crew iPhone");
        expect(mediaMarkers.children[1].className).toContain("timeline-dock__media-marker--segment");
        expect(mediaMarkers.children[1].className).toContain("timeline-dock__media-marker--videoClip");
        expect(mediaMarkers.children[1].style.left).toBe("20%");
        expect(mediaMarkers.children[1].style.width).toBe("30%");
        expect(mediaMarkers.children[2].className).toContain("timeline-dock__media-marker--segment");
        expect(mediaMarkers.children[2].className).toContain("timeline-dock__media-marker--audioClip");
        expect(mediaMarkers.children[2].className).toContain("timeline-dock__media-marker--estimated");
        expect(mediaMarkers.children[2].className).toContain("timeline-dock__media-marker--segment-clipped-start");
        expect(mediaMarkers.children[2].style.left).toBe("0%");
        expect(mediaMarkers.children[2].style.width).toBe("10%");
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

        expect(dispatchedEvents).toHaveLength(2);
        expect(dispatchedEvents[0].type).toBe("mission-timeline-user-seek");
        expect(dispatchedEvents[0].detail.phase).toBe("commit");
        expect(dispatchedEvents[0].detail.source).toBe("timeline-media-marker");
        expect(dispatchedEvents[0].detail.timeMs).toBe(500);
        expect(dispatchedEvents[1].type).toBe("mission-media-marker-select");
        expect(dispatchedEvents[1].detail.marker.id).toBe("earthset-photo");
        expect(dispatchedEvents[1].detail.timeMs).toBe(500);

        delete global.CustomEvent;
    });
});
