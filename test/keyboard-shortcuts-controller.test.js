import { describe, expect, it } from "vitest";

import { createKeyboardShortcutsController } from "../src/platform/js/ui/keyboard-shortcuts-controller.js";

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
    const element = {
        id,
        tagName: options.tagName || "DIV",
        disabled: !!options.disabled,
        style: {},
        dataset: {},
        isContentEditable: !!options.isContentEditable,
        classList: createClassList(options.classes || []),
        children: [],
        parent: null,
        clickCount: 0,
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            event.target = event.target || element;
            const handlers = listeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
            return !event.defaultPrevented;
        },
        contains(target) {
            let current = target;
            while (current) {
                if (current === element) return true;
                current = current.parent || null;
            }
            return false;
        },
        appendChild(child) {
            child.parent = element;
            element.children.push(child);
        },
        click() {
            element.clickCount += 1;
        },
        getBoundingClientRect() {
            return options.rect || { top: 100, bottom: 120, right: 220, width: 120, height: 40 };
        },
    };
    return element;
}

function createDocumentHarness() {
    const listeners = new Map();
    const elements = new Map();
    const documentRef = {
        getElementById(id) {
            return elements.get(id) || null;
        },
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = listeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
    };
    return {
        documentRef,
        elements,
    };
}

function createHarness() {
    const { documentRef, elements } = createDocumentHarness();
    const windowListeners = new Map();
    const windowRef = {
        innerWidth: 1024,
        innerHeight: 768,
        addEventListener(type, handler) {
            if (!windowListeners.has(type)) windowListeners.set(type, []);
            windowListeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = windowListeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
    };

    const shortcutButton = createElement("shortcut-help", {
        tagName: "BUTTON",
        rect: { top: 120, bottom: 148, right: 240, width: 48, height: 28 },
    });
    const shortcutPanel = createElement("shortcut-panel", {
        classes: ["shortcut-panel--hidden"],
        rect: { top: 0, bottom: 180, right: 200, width: 200, height: 180 },
    });
    const animateButton = createElement("animate", { tagName: "BUTTON" });
    const backwardButton = createElement("backward", { tagName: "BUTTON" });
    const outside = createElement("outside");
    const textInput = createElement("text-input", { tagName: "INPUT" });

    elements.set(shortcutButton.id, shortcutButton);
    elements.set(shortcutPanel.id, shortcutPanel);
    elements.set(animateButton.id, animateButton);
    elements.set(backwardButton.id, backwardButton);
    elements.set(textInput.id, textInput);

    const syntheticPressCalls = [];
    const controller = createKeyboardShortcutsController({
        documentRef,
        windowRef,
        onClick(id, handler) {
            documentRef.getElementById(id)?.addEventListener("click", handler);
        },
        isInteractiveInputTarget(target) {
            return target?.tagName === "INPUT";
        },
        dispatchSyntheticPress(target, pointerType) {
            syntheticPressCalls.push({ id: target.id, pointerType });
            return true;
        },
    });

    return {
        animateButton,
        backwardButton,
        controller,
        documentRef,
        outside,
        shortcutButton,
        shortcutPanel,
        syntheticPressCalls,
        textInput,
        windowRef,
    };
}

function createKeyEvent(key, options = {}) {
    return {
        type: "keydown",
        key,
        code: options.code || "",
        shiftKey: !!options.shiftKey,
        ctrlKey: !!options.ctrlKey,
        metaKey: !!options.metaKey,
        altKey: !!options.altKey,
        target: options.target || null,
        defaultPrevented: false,
        preventDefault() {
            this.defaultPrevented = true;
        },
    };
}

describe("createKeyboardShortcutsController", function () {
    it("toggles, positions, and closes the shortcut panel", function () {
        const harness = createHarness();
        harness.controller.bind();

        harness.shortcutButton.dispatchEvent({ type: "click", target: harness.shortcutButton });
        expect(harness.shortcutPanel.classList.contains("shortcut-panel--hidden")).toBe(false);
        expect(harness.shortcutPanel.style.left).toBe("40px");
        expect(harness.shortcutPanel.style.top).toBe("156px");

        harness.windowRef.innerWidth = 500;
        harness.windowRef.dispatchEvent({ type: "resize" });
        expect(harness.shortcutPanel.style.left).toBe("40px");

        harness.documentRef.dispatchEvent({ type: "pointerdown", target: harness.outside });
        expect(harness.shortcutPanel.classList.contains("shortcut-panel--hidden")).toBe(true);
    });

    it("routes keyboard playback shortcuts to the right controls", function () {
        const harness = createHarness();
        harness.controller.bind();

        const toggleEvent = createKeyEvent("?");
        harness.documentRef.dispatchEvent(toggleEvent);
        expect(toggleEvent.defaultPrevented).toBe(true);
        expect(harness.shortcutPanel.classList.contains("shortcut-panel--hidden")).toBe(false);

        const playEvent = createKeyEvent(" ");
        harness.documentRef.dispatchEvent(playEvent);
        expect(playEvent.defaultPrevented).toBe(true);
        expect(harness.animateButton.clickCount).toBe(1);

        const backwardEvent = createKeyEvent("ArrowLeft");
        harness.documentRef.dispatchEvent(backwardEvent);
        expect(backwardEvent.defaultPrevented).toBe(true);
        expect(harness.syntheticPressCalls).toEqual([{ id: "backward", pointerType: "mouse" }]);

        const escapeEvent = createKeyEvent("Escape");
        harness.documentRef.dispatchEvent(escapeEvent);
        expect(harness.shortcutPanel.classList.contains("shortcut-panel--hidden")).toBe(true);
    });

    it("ignores shortcut keys while focus is inside interactive inputs", function () {
        const harness = createHarness();
        harness.controller.bind();

        const event = createKeyEvent(" ", { target: harness.textInput });
        harness.documentRef.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(harness.animateButton.clickCount).toBe(0);
        expect(harness.syntheticPressCalls).toEqual([]);
    });
});
