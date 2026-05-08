import { describe, expect, it } from "vitest";

import { createTimelineDockController } from "../src/platform/js/app/timeline-dock-controller.js";

class FakeElement {
    constructor(tagName = "div") {
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
        this.children.push(child);
        return child;
    }

    addEventListener(type, handler) {
        const handlers = this.listeners.get(type) || [];
        handlers.push(handler);
        this.listeners.set(type, handlers);
    }

    dispatchEvent(event) {
        const handlers = this.listeners.get(event.type) || [];
        handlers.forEach((handler) => handler.call(this, event));
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(value) {
        this._innerHTML = value;
        this.children = [];
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
});
