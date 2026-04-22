import { describe, expect, it } from "vitest";

import { createComparePanelController } from "../src/platform/js/ui/compare-panel-controller.js";

function createClassList(initialValues = []) {
    const values = new Set(initialValues);
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        toggle(value, enabled) {
            if (enabled) {
                values.add(value);
                return;
            }
            values.delete(value);
        },
        contains(value) {
            return values.has(value);
        },
    };
}

function createButton(id, rect = { left: 100, top: 20, bottom: 44 }) {
    const listeners = new Map();
    const attributes = new Map();
    return {
        id,
        disabled: false,
        classList: createClassList(),
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            for (const handler of listeners.get(event.type) || []) {
                handler(event);
            }
        },
        setAttribute(name, value) {
            attributes.set(name, value);
        },
        getAttribute(name) {
            return attributes.get(name) || null;
        },
        getBoundingClientRect() {
            return rect;
        },
        contains(target) {
            return target === this;
        },
    };
}

function createHarness() {
    const compareButton = createButton("compare-pill-button");
    const closeButton = createButton("compare-panel-close");
    const comparePanel = {
        id: "compare-panel",
        style: {},
        classList: createClassList(["compare-panel--hidden"]),
        getBoundingClientRect() {
            return { width: 320, height: 180 };
        },
        contains(target) {
            return target === this || target === closeButton;
        },
    };
    const comparePanelWrapper = {
        id: "compare-panel-wrapper",
        hidden: true,
    };

    const byId = new Map([
        ["compare-pill-button", compareButton],
        ["compare-panel-close", closeButton],
        ["compare-panel", comparePanel],
        ["compare-panel-wrapper", comparePanelWrapper],
    ]);

    const documentListeners = new Map();
    const windowListeners = new Map();
    const documentRef = {
        getElementById(id) {
            return byId.get(id) || null;
        },
        addEventListener(type, handler) {
            if (!documentListeners.has(type)) documentListeners.set(type, []);
            documentListeners.get(type).push(handler);
        },
    };
    const windowRef = {
        innerWidth: 1280,
        innerHeight: 720,
        addEventListener(type, handler) {
            if (!windowListeners.has(type)) windowListeners.set(type, []);
            windowListeners.get(type).push(handler);
        },
    };

    const controller = createComparePanelController({
        documentRef,
        windowRef,
    });

    return {
        closeButton,
        compareButton,
        comparePanel,
        comparePanelWrapper,
        controller,
        dispatchDocumentEvent(type, event) {
            for (const handler of documentListeners.get(type) || []) {
                handler(event);
            }
        },
        dispatchWindowEvent(type, event) {
            for (const handler of windowListeners.get(type) || []) {
                handler(event);
            }
        },
    };
}

describe("compare panel controller", () => {
    it("opens and closes the compare panel from the compare pill", () => {
        const harness = createHarness();
        harness.controller.bind();

        harness.compareButton.dispatchEvent({
            type: "click",
            preventDefault() {},
        });

        expect(harness.controller.isComparePanelOpen()).toBe(true);
        expect(harness.comparePanelWrapper.hidden).toBe(false);
        expect(harness.comparePanel.classList.contains("compare-panel--hidden")).toBe(false);
        expect(harness.compareButton.getAttribute("aria-expanded")).toBe("true");
        expect(harness.comparePanel.style.left).toBeTruthy();
        expect(harness.comparePanel.style.top).toBeTruthy();

        harness.dispatchDocumentEvent("pointerdown", {
            target: { id: "outside-node" },
        });

        expect(harness.controller.isComparePanelOpen()).toBe(false);
        expect(harness.comparePanelWrapper.hidden).toBe(true);
        expect(harness.compareButton.getAttribute("aria-expanded")).toBe("false");
    });

    it("repositions on resize and closes on escape", () => {
        const harness = createHarness();
        harness.controller.bind();
        harness.controller.openPanel();

        harness.compareButton.getBoundingClientRect = () => ({
            left: 1180,
            top: 660,
            bottom: 690,
        });
        harness.dispatchWindowEvent("resize", {});

        expect(Number.parseInt(harness.comparePanel.style.left, 10)).toBeLessThan(1180);
        expect(Number.parseInt(harness.comparePanel.style.top, 10)).toBeLessThan(690);

        harness.dispatchDocumentEvent("keydown", { key: "Escape" });
        expect(harness.controller.isComparePanelOpen()).toBe(false);
    });
});
