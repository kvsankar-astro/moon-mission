import { describe, expect, it } from "vitest";

import { createTimelineDockController } from "../src/platform/js/app/timeline-dock-controller.js";

class FakeElement {
    constructor(tagName = "div") {
        this.tagName = tagName;
        this.children = [];
        this.className = "";
        this.style = {};
        this.attributes = {};
        this.textContent = "";
        this.title = "";
        this.value = "0";
        this.min = "0";
        this.max = "0";
        this.step = "1";
        this._innerHTML = "";
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
            contains: (name) => this.className.split(/\s+/).filter(Boolean).includes(name),
        };
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    addEventListener() {}

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
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");
        craftStrip.className = "timeline-dock__craft-strip timeline-dock__craft-strip--hidden";

        global.document = {
            getElementById(id) {
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
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");

        global.document = {
            getElementById(id) {
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
        };

        const controller = createTimelineDockController({});
        controller.setCrafts([{ id: "CH3L", label: "Vikram" }]);

        expect(craftStrip.classList.contains("timeline-dock__craft-strip--hidden")).toBe(true);
        expect(craftStrip.children).toHaveLength(0);
    });

    it("shows current time in inferred local timezone without UTC offset", () => {
        const slider = new FakeElement("input");
        const markers = new FakeElement("div");
        const startLabel = new FakeElement("span");
        const endLabel = new FakeElement("span");
        const currentLabel = new FakeElement("div");
        const craftStrip = new FakeElement("div");

        global.document = {
            getElementById(id) {
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
});
