import { describe, expect, it, vi } from "vitest";

import { createPlanePillController } from "../src/platform/js/ui/plane-pill-controller.js";

function createClassList(initial = []) {
    const values = new Set(initial);
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
            if (force === true) {
                values.add(value);
                return true;
            }
            if (force === false) {
                values.delete(value);
                return false;
            }
            if (values.has(value)) {
                values.delete(value);
                return false;
            }
            values.add(value);
            return true;
        },
    };
}

function createElement(id, options = {}) {
    const listeners = new Map();
    return {
        id,
        checked: options.checked === true,
        classList: createClassList(options.classes || []),
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = listeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
        setAttribute(name, value) {
            this[name] = value;
        },
    };
}

function createHarness() {
    const defaultPill = createElement("plane-pill-default");
    const xyPill = createElement("plane-pill-xy");
    const defaultInput = createElement("checkbox-lock-default", { checked: true });
    const xyInput = createElement("checkbox-lock-xy");
    const panLeft = createElement("panleft");
    const canvasWrapper = createElement("canvas-wrapper");
    const byId = new Map([
        ["plane-pill-default", defaultPill],
        ["plane-pill-xy", xyPill],
        ["checkbox-lock-default", defaultInput],
        ["checkbox-lock-xy", xyInput],
        ["panleft", panLeft],
        ["canvas-wrapper", canvasWrapper],
    ]);
    const windowListeners = new Map();

    const documentRef = {
        getElementById(id) {
            return byId.get(id) || null;
        },
    };
    const windowRef = {
        addEventListener(type, handler) {
            if (!windowListeners.has(type)) windowListeners.set(type, []);
            windowListeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = windowListeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
    };
    const controlBackend = {
        commitPlaneSelection: vi.fn(),
    };
    const planePillPairs = [
        ["plane-pill-default", "checkbox-lock-default", "DEFAULT"],
        ["plane-pill-xy", "checkbox-lock-xy", "XY"],
    ];

    const controller = createPlanePillController({
        controlBackend,
        documentRef,
        planePillPairs,
        windowRef,
    });

    return {
        canvasWrapper,
        controller,
        controlBackend,
        defaultInput,
        defaultPill,
        panLeft,
        windowRef,
        xyInput,
        xyPill,
    };
}

describe("createPlanePillController", function () {
    it("syncs the initially checked plane input to the matching pill", function () {
        const harness = createHarness();

        harness.controller.bind();

        expect(harness.defaultPill.classList.contains("is-active")).toBe(true);
        expect(harness.defaultPill["aria-pressed"]).toBe("true");
        expect(harness.xyPill.classList.contains("is-active")).toBe(false);
    });

    it("commits plane selection when a plane pill is clicked", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.xyPill.dispatchEvent({ type: "click" });

        expect(harness.controlBackend.commitPlaneSelection).toHaveBeenCalledWith("XY");
    });

    it("releases a non-default preset after manual navigation and restores on input change", function () {
        const harness = createHarness();

        harness.defaultInput.checked = false;
        harness.xyInput.checked = true;
        harness.controller.bind();
        expect(harness.xyPill.classList.contains("is-active")).toBe(true);

        harness.panLeft.dispatchEvent({ type: "click" });
        expect(harness.xyPill.classList.contains("is-active")).toBe(false);
        expect(harness.xyPill["aria-pressed"]).toBe("false");

        harness.xyInput.dispatchEvent({ type: "change" });
        expect(harness.xyPill.classList.contains("is-active")).toBe(true);
        expect(harness.xyPill["aria-pressed"]).toBe("true");
    });

    it("releases a non-default preset after a meaningful scene drag", function () {
        const harness = createHarness();

        harness.defaultInput.checked = false;
        harness.xyInput.checked = true;
        harness.controller.bind();

        harness.canvasWrapper.dispatchEvent({
            type: "pointerdown",
            clientX: 10,
            clientY: 10,
            isPrimary: true,
            pointerId: 1,
        });
        harness.windowRef.dispatchEvent({
            type: "pointermove",
            clientX: 20,
            clientY: 20,
            pointerId: 1,
        });

        expect(harness.xyPill.classList.contains("is-active")).toBe(false);
        expect(harness.xyPill["aria-pressed"]).toBe("false");
    });
});
