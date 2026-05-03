import { describe, expect, it } from "vitest";

import { createDesktopChromeAutohideController } from "../src/platform/js/ui/desktop-chrome-autohide.js";

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
        tagName: options.tagName || "DIV",
        textContent: options.textContent || "",
        style: {},
        hovered: !!options.hovered,
        visible: options.visible !== false,
        classList: createClassList(options.classes || []),
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = listeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
        matches(selector) {
            if (selector === ":hover") return this.hovered;
            if (selector === '[role="slider"]') return false;
            if (selector === ".panel-manager-menu.is-open") {
                return this.classList.contains("panel-manager-menu") && this.classList.contains("is-open");
            }
            return false;
        },
        querySelector(selector) {
            if (selector === ":hover" && options.hoveredDescendant) return {};
            return null;
        },
        closest(selector) {
            if (options.closestSelectors?.includes(selector)) return this;
            return null;
        },
    };
}

function createHarness(overrides = {}) {
    const documentListeners = new Map();
    const windowListeners = new Map();
    const elements = new Map();
    const timers = new Map();
    let nextTimerId = 1;

    const animateButton = createElement("animate", { tagName: "BUTTON", textContent: "Pause" });
    const infoPanel = createElement("info-panel", {
        classes: overrides.infoPanelHidden === false ? [] : ["info-panel--hidden"],
        visible: overrides.infoPanelVisible !== false,
    });
    const shortcutPanel = createElement("shortcut-panel", {
        classes: overrides.shortcutPanelHidden === false ? [] : ["shortcut-panel--hidden"],
        visible: overrides.shortcutPanelVisible !== false,
    });
    const settingsPanel = createElement("settings-panel", { visible: true });
    const panelMenu = createElement("panel-menu", {
        classes: overrides.panelMenuOpen ? ["panel-manager-menu", "is-open"] : ["panel-manager-menu"],
        visible: overrides.panelMenuVisible !== false,
    });

    elements.set("animate", animateButton);
    elements.set("info-panel", infoPanel);
    elements.set("shortcut-panel", shortcutPanel);
    elements.set("settings-panel", settingsPanel);

    const body = { classList: createClassList(overrides.mobileShellEnabled ? ["mobile-shell-enabled"] : []) };
    const documentRef = {
        body,
        visibilityState: overrides.visibilityState || "visible",
        activeElement: overrides.activeElement || null,
        getElementById(id) {
            return elements.get(id) || null;
        },
        addEventListener(type, handler) {
            if (!documentListeners.has(type)) documentListeners.set(type, []);
            documentListeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = documentListeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
        querySelectorAll(selector) {
            if (selector === ".panel-manager-menu.is-open" && panelMenu.matches(selector)) {
                return [panelMenu];
            }
            return [];
        },
        querySelector(selector) {
            if (selector === ".panel-manager-menu.is-open" && panelMenu.matches(selector)) {
                return panelMenu;
            }
            return null;
        },
    };

    const windowRef = {
        innerWidth: overrides.innerWidth || 1024,
        addEventListener(type, handler) {
            if (!windowListeners.has(type)) windowListeners.set(type, []);
            windowListeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = windowListeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
        setTimeout(callback) {
            const id = nextTimerId++;
            timers.set(id, callback);
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        },
    };

    const headerStates = [];
    const controlStates = [];
    const controller = createDesktopChromeAutohideController({
        documentRef,
        windowRef,
        autoHideDelayMs: 1,
        getMissionDialogApi: () => ({
            widgetElement() {
                return overrides.settingsWrapper || null;
            },
        }),
        isElementLayoutVisible(element) {
            return !!element?.visible;
        },
        isInteractiveInputTarget(target) {
            return target?.tagName === "INPUT";
        },
        isMobileViewport() {
            return !!overrides.mobileViewport;
        },
        isSettingsPanelOpen() {
            return !!overrides.settingsPanelOpen;
        },
        meaningfulActivityKeys: new Set([" ", "ArrowLeft", "ArrowRight"]),
        requestAnimationFrameImpl(callback) {
            callback();
        },
        setControlPanelCollapsedState(value) {
            controlStates.push(!!value);
        },
        setHeaderPillStripAutoCollapsedState(value) {
            headerStates.push(!!value);
        },
    });

    function flushTimers() {
        const callbacks = Array.from(timers.values());
        timers.clear();
        callbacks.forEach((callback) => callback());
    }

    return {
        controller,
        documentRef,
        flushTimers,
        headerStates,
        controlStates,
        infoPanel,
        shortcutPanel,
        windowRef,
    };
}

describe("createDesktopChromeAutohideController", function () {
    it("auto-hides chrome while animation is playing on desktop", function () {
        const harness = createHarness();

        harness.controller.bind();
        expect(harness.headerStates).toEqual([false]);
        expect(harness.controlStates).toEqual([false]);

        harness.flushTimers();
        expect(harness.headerStates).toEqual([false, true]);
        expect(harness.controlStates).toEqual([false, true]);
    });

    it("reveals and reschedules chrome on user activity", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.flushTimers();

        harness.documentRef.dispatchEvent({ type: "pointermove" });
        expect(harness.headerStates).toEqual([false, true, false]);
        expect(harness.controlStates).toEqual([false, true, false]);

        harness.flushTimers();
        expect(harness.headerStates).toEqual([false, true, false, true]);
        expect(harness.controlStates).toEqual([false, true, false, true]);
    });

    it("suppresses autohide while blocking UI is open", function () {
        const harness = createHarness({
            infoPanelHidden: false,
            infoPanelVisible: true,
        });

        harness.controller.bind();
        harness.flushTimers();

        expect(harness.headerStates).toEqual([false]);
        expect(harness.controlStates).toEqual([false]);
    });

    it("disables autohide when mission UI config turns it off", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.documentRef.dispatchEvent({
            type: "mission-ui-config-updated",
            detail: { ui: { desktopChromeAutoHideEnabled: false } },
        });
        harness.flushTimers();

        expect(harness.headerStates).toEqual([false, false]);
        expect(harness.controlStates).toEqual([false, false]);
    });

    it("does not override header strip state on mobile viewports", function () {
        const harness = createHarness({
            mobileViewport: true,
        });

        harness.controller.bind();
        harness.flushTimers();
        harness.documentRef.dispatchEvent({ type: "pointermove" });
        harness.windowRef.dispatchEvent({ type: "resize" });

        expect(harness.headerStates).toEqual([]);
        expect(harness.controlStates).toEqual([false, false, false]);
    });
});
