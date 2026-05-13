import { afterEach, describe, expect, it } from "vitest";

import {
    createMediaBrowserPanelActions,
    resolveRangeValueAtClientX,
} from "../src/platform/js/app/media-browser-panel.js";

class FakeRangeInput {
    constructor() {
        this.listeners = new Map();
        this.attributes = {};
        this.hidden = false;
        this.disabled = false;
        this.min = "0";
        this.max = "0";
        this.step = "0.25";
        this.value = "0";
        this.rect = { left: 100, width: 400, height: 20 };
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
        for (const handler of this.listeners.get(event.type) || []) {
            handler.call(this, event);
        }
    }

    getBoundingClientRect() {
        return this.rect;
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    setPointerCapture(pointerId) {
        this.capturedPointerId = pointerId;
    }

    releasePointerCapture(pointerId) {
        if (this.capturedPointerId === pointerId) {
            delete this.capturedPointerId;
        }
    }
}

class FakePanel {
    constructor() {
        this.listeners = new Map();
        const styleValues = new Map();
        this.style = {
            getPropertyValue: (name) => styleValues.get(name) || "",
            setProperty: (name, value) => {
                styleValues.set(name, value);
            },
        };
        this.dataset = {};
        this.offsetWidth = 672;
        this.offsetHeight = 480;
        this._classes = new Set();
        this.classList = {
            add: (...names) => names.forEach((name) => this._classes.add(name)),
            remove: (...names) => names.forEach((name) => this._classes.delete(name)),
            contains: (name) => this._classes.has(name),
            toggle: (name, enabled) => {
                if (enabled) this._classes.add(name);
                else this._classes.delete(name);
            },
        };
    }

    addEventListener(type, handler) {
        const handlers = this.listeners.get(type) || [];
        handlers.push(handler);
        this.listeners.set(type, handlers);
    }

    querySelector() {
        return null;
    }

    getBoundingClientRect() {
        return {
            left: 8,
            top: 80,
            width: this.offsetWidth,
            height: this.offsetHeight,
        };
    }
}

describe("media browser panel timeline", () => {
    afterEach(() => {
        delete global.document;
        delete global.CustomEvent;
        delete global.window;
    });

    it("resolves clicked range positions to stepped media seconds", () => {
        const slider = new FakeRangeInput();
        slider.min = "0";
        slider.max = "100";
        slider.step = "0.25";

        expect(resolveRangeValueAtClientX(slider, 100)).toBe(0);
        expect(resolveRangeValueAtClientX(slider, 388)).toBe(72);
        expect(resolveRangeValueAtClientX(slider, 600)).toBe(100);
    });

    it("emits media seek intents on direct pointer clicks", () => {
        const slider = new FakeRangeInput();
        const panelElement = new FakePanel();
        const intents = [];

        global.window = {
            innerWidth: 1280,
            innerHeight: 800,
        };
        global.document = {
            getElementById(id) {
                if (id === "media-browser-media-timeline") return slider;
                if (id === "media-browser-panel") return panelElement;
                return null;
            },
            addEventListener() {},
            dispatchEvent() {},
        };

        const panel = createMediaBrowserPanelActions({
            onIntent(intent) {
                intents.push(intent);
            },
        });

        panel.render({
            playbackModel: {
                showControls: true,
                seekEnabled: true,
                elapsedSeconds: 0,
                durationSeconds: 100,
            },
        });

        slider.dispatchEvent({
            type: "pointerdown",
            pointerId: 7,
            pointerType: "mouse",
            button: 0,
            clientX: 300,
        });
        slider.dispatchEvent({
            type: "pointerup",
            pointerId: 7,
            pointerType: "mouse",
            button: 0,
            clientX: 300,
        });

        expect(intents).toEqual([
            { type: "mediaSeekTime", value: 50, finalize: false },
            { type: "mediaSeekTime", value: 50, finalize: true },
        ]);
        expect(slider.value).toBe("50");
        expect(slider.capturedPointerId).toBeUndefined();
    });
});
