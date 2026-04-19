import { describe, expect, it, vi } from "vitest";

import { createFocusPillController } from "../src/platform/js/ui/focus-pill-controller.js";

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
    const attributes = new Map();
    return {
        id,
        checked: options.checked === true,
        disabled: options.disabled === true,
        hidden: options.hidden === true,
        textContent: options.textContent || "",
        dataset: { ...(options.dataset || {}) },
        scrollLeft: 0,
        classList: createClassList(options.classes || []),
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = listeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
        click() {
            this.clicked = true;
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
            this[name] = String(value);
        },
        closest(selector) {
            if (selector === ".header-pill-group") {
                return options.closestHeaderGroup || null;
            }
            return null;
        },
    };
}

function createHarness(options = {}) {
    const rafQueue = [];
    const documentListeners = new Map();
    const observerInstances = [];
    let splashdownVisible = options.splashdownVisible === true;
    let composerVisible = options.composerVisible === true;
    let groundTrackVisible = options.groundTrackVisible === true;

    class FakeMutationObserver {
        constructor(callback) {
            this.callback = callback;
            observerInstances.push(this);
        }

        observe(target, config) {
            this.target = target;
            this.config = config;
        }
    }

    const flybyGroup = createElement("flyby-group");
    const flybyWrap = createElement("flyby-pill-wrap", { closestHeaderGroup: flybyGroup });
    const flybyPill = createElement("flyby-pill");
    const splashdownPill = createElement("focus-pill-splashdown");
    const tertiaryRow = createElement("header-pill-strip-tertiary");
    const auxPanelsToggle = createElement("view-aux-camera-panels");
    const burnButtonsHost = createElement("burnbuttons");
    const composerChip = createElement("composer-chip", { textContent: "Flyby" });

    const byId = new Map([
        ["flyby-pill-wrap", flybyWrap],
        ["flyby-pill", flybyPill],
        ["focus-pill-splashdown", splashdownPill],
        ["header-pill-strip-tertiary", tertiaryRow],
        ["view-aux-camera-panels", auxPanelsToggle],
        ["burnbuttons", burnButtonsHost],
    ]);

    const documentRef = {
        getElementById(id) {
            return byId.get(id) || null;
        },
        querySelector(selector) {
            if (selector === "#aux-camera-views .aux-camera-view[data-mode=\"composer\"]:not([hidden])") {
                return composerVisible ? { id: "composer-view" } : null;
            }
            if (selector === "#ground-track-panel:not(.ground-track-panel--hidden)") {
                return groundTrackVisible ? { id: "ground-track-panel" } : null;
            }
            if (selector === "#aux-camera-views .aux-camera-chip--composer-tab") {
                return options.hasComposerTab === false ? null : composerChip;
            }
            return null;
        },
        querySelectorAll(selector) {
            if (selector === "#burnbuttons button[data-event-key]") {
                return splashdownVisible
                    ? [createElement("splashdown-button", { dataset: { eventKey: "splashdown" } })]
                    : [];
            }
            if (selector === "#aux-camera-views .aux-camera-chip") {
                return [composerChip];
            }
            return [];
        },
        addEventListener(type, handler) {
            if (!documentListeners.has(type)) documentListeners.set(type, []);
            documentListeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = documentListeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
    };

    const windowRef = {
        location: {
            search: options.search || "?mission=artemis2",
        },
        requestAnimationFrame(callback) {
            rafQueue.push(callback);
        },
    };

    const invokeMissionPanelAction = vi.fn(() => options.restoreComposer === true);
    const setView = vi.fn();
    const createCustomEvent = (type) => ({ type });
    const controller = createFocusPillController({
        createCustomEvent,
        documentRef,
        invokeMissionPanelAction,
        MutationObserverImpl: FakeMutationObserver,
        requestAnimationFrameImpl(callback) {
            rafQueue.push(callback);
        },
        setView,
        windowRef,
    });

    function flushRaf() {
        while (rafQueue.length) {
            const callback = rafQueue.shift();
            callback();
        }
    }

    return {
        auxPanelsToggle,
        composerChip,
        controller,
        documentRef,
        flushRaf,
        flybyGroup,
        flybyPill,
        invokeMissionPanelAction,
        observerInstances,
        setComposerVisible(value) {
            composerVisible = value;
        },
        setGroundTrackVisible(value) {
            groundTrackVisible = value;
        },
        setSplashdownVisible(value) {
            splashdownVisible = value;
        },
        setView,
        splashdownPill,
        tertiaryRow,
    };
}

describe("createFocusPillController", function () {
    it("syncs initial focus pill visibility and active state for Artemis II", function () {
        const harness = createHarness({
            composerVisible: true,
            groundTrackVisible: true,
            splashdownVisible: true,
        });

        harness.controller.bind();
        harness.flushRaf();

        expect(harness.flybyPill.hidden).toBe(false);
        expect(harness.splashdownPill.hidden).toBe(false);
        expect(harness.flybyGroup.hidden).toBe(false);
        expect(harness.flybyPill.classList.contains("is-active")).toBe(true);
        expect(harness.splashdownPill.classList.contains("is-active")).toBe(true);
        expect(harness.tertiaryRow.scrollLeft).toBe(0);
    });

    it("opens the composer flow from the flyby pill", function () {
        const harness = createHarness({
            composerVisible: false,
            restoreComposer: false,
        });

        harness.controller.bind();
        harness.auxPanelsToggle.checked = false;
        harness.flybyPill.dispatchEvent({ type: "click" });
        harness.flushRaf();

        expect(harness.auxPanelsToggle.checked).toBe(true);
        expect(harness.setView).toHaveBeenCalled();
        expect(harness.invokeMissionPanelAction).toHaveBeenCalledWith(
            "aux:earth-rise-composer",
            "restore",
        );
        expect(harness.composerChip.clicked).toBe(true);
    });

    it("dispatches the splashdown open event only for Artemis II", function () {
        const harness = createHarness({
            search: "?mission=artemis2",
        });
        const dispatchSpy = vi.spyOn(harness.documentRef, "dispatchEvent");

        harness.controller.bind();
        harness.splashdownPill.dispatchEvent({ type: "click" });

        expect(dispatchSpy).toHaveBeenCalledWith({ type: "ground-track-panel-open" });
    });

    it("re-syncs visibility when burn button mutations change splashdown availability", function () {
        const harness = createHarness({
            splashdownVisible: false,
        });

        harness.controller.bind();
        expect(harness.splashdownPill.hidden).toBe(true);

        harness.setSplashdownVisible(true);
        harness.observerInstances[0].callback();
        harness.flushRaf();

        expect(harness.splashdownPill.hidden).toBe(false);
    });
});
