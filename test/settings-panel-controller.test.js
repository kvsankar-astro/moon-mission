import { describe, expect, it, vi } from "vitest";

import { createSettingsPanelController } from "../src/platform/js/ui/settings-panel-controller.js";

function createClassList(initialValues = []) {
    const values = new Set(initialValues);
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        toggle(value, force) {
            if (force === undefined) {
                if (values.has(value)) {
                    values.delete(value);
                    return false;
                }
                values.add(value);
                return true;
            }
            if (force) {
                values.add(value);
                return true;
            }
            values.delete(value);
            return false;
        },
        contains(value) {
            return values.has(value);
        },
    };
}

function createElement({
    classNames = [],
    textContent = "",
    dataset = {},
    rect = { top: 0, bottom: 0, width: 100, height: 100 },
} = {}) {
    const listeners = new Map();
    const attributes = {};
    const selectorMap = new Map();
    const queryAllMap = new Map();
    const element = {
        textContent,
        dataset: { ...dataset },
        classList: createClassList(classNames),
        style: {},
        children: [],
        visible: false,
        scrollHeight: 0,
        querySelector(selector) {
            return selectorMap.get(selector) || null;
        },
        querySelectorAll(selector) {
            return queryAllMap.get(selector) || [];
        },
        setQuerySelector(selector, value) {
            selectorMap.set(selector, value);
        },
        setQuerySelectorAll(selector, value) {
            queryAllMap.set(selector, value);
        },
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        dispatch(type, event = {}) {
            const handlers = listeners.get(type) || [];
            const fullEvent = {
                type,
                target: element,
                preventDefault() {},
                ...event,
            };
            handlers.forEach((handler) => handler.call(element, fullEvent));
        },
        setAttribute(name, value) {
            attributes[name] = String(value);
        },
        getAttribute(name) {
            return attributes[name] || "";
        },
        removeAttribute(name) {
            delete attributes[name];
        },
        getBoundingClientRect() {
            return rect;
        },
        getClientRects() {
            return rect.width > 0 && rect.height > 0 ? [rect] : [];
        },
        contains(target) {
            return target === element;
        },
        closest() {
            return null;
        },
    };
    return element;
}

function createHarness({ mobile = false } = {}) {
    const settingsButton = createElement();
    const advancedButton = createElement();
    const controlPanel = createElement();
    const header = createElement({ rect: { top: 0, bottom: 60, width: 100, height: 60 } });
    const titleBar = createElement();
    const wrapper = createElement({ rect: { top: 65, bottom: 465, width: 320, height: 400 } });
    const title = createElement({ textContent: "Settings" });
    const cameraLegend = createElement();
    const viewLegend = createElement({ textContent: "View" });
    const panelManagerLegend = createElement({ textContent: "Panels" });
    const otherLegend = createElement();
    const cameraSection = createElement({ classNames: ["settings-section", "settings-section--camera"], dataset: { sectionKey: "camera" } });
    const viewSection = createElement({ classNames: ["settings-section", "settings-section--view"], dataset: { sectionKey: "view" } });
    const panelManagerSection = createElement({ classNames: ["settings-section", "settings-section--panel-manager"], dataset: { sectionKey: "panel-manager" } });
    const otherSection = createElement({ classNames: ["settings-section"], dataset: { sectionKey: "other" } });
    const viewOptions = createElement();
    const additionalCraftsOption = createElement({ classNames: ["settings-option"] });
    const auxPanelsOption = createElement({ classNames: ["settings-option"] });
    const fpsOption = createElement({ classNames: ["settings-option"] });
    const genericViewOption = createElement({ classNames: ["settings-option"] });
    const activeCraftRow = createElement();
    const orbitStyleOption = createElement({ classNames: ["settings-option--orbit-style"] });
    const trailControls = createElement({ classNames: ["settings-row--trail-controls"] });
    const settingsPanel = createElement({ classNames: ["settings-panel"] });
    const settingsPanelBody = createElement({ rect: { top: 110, bottom: 360, width: 280, height: 250 } });
    const sourceLine = createElement();
    const buttonHandlers = new Map();

    settingsPanel.visible = true;
    settingsPanelBody.scrollHeight = 420;
    wrapper.visible = false;

    wrapper.setQuerySelector(".ui-dialog-titlebar", titleBar);
    settingsPanel.setQuerySelector(".settings-panel__title", title);
    settingsPanel.setQuerySelector(".settings-section--view", viewSection);
    settingsPanel.setQuerySelector(".settings-section--panel-manager", panelManagerSection);
    settingsPanel.setQuerySelectorAll(".settings-section", [cameraSection, viewSection, panelManagerSection, otherSection]);

    cameraSection.setQuerySelector(".settings-section__title", cameraLegend);
    viewSection.setQuerySelector(".settings-section__title", viewLegend);
    panelManagerSection.setQuerySelector(".settings-section__title", panelManagerLegend);
    otherSection.setQuerySelector(".settings-section__title", otherLegend);
    viewSection.setQuerySelector(".settings-options", viewOptions);
    viewOptions.children = [genericViewOption, additionalCraftsOption, auxPanelsOption, fpsOption];

    const controls = {
        "view-additional-crafts": createElement(),
        "view-aux-camera-panels": createElement(),
        "view-fps": createElement(),
    };
    controls["view-additional-crafts"].closest = () => additionalCraftsOption;
    controls["view-aux-camera-panels"].closest = () => auxPanelsOption;
    controls["view-fps"].closest = () => fpsOption;

    const documentRef = {
        getElementById(id) {
            const mapping = {
                "settings-panel-button": settingsButton,
                "advanced-controls-pill": advancedButton,
                "settings-panel": settingsPanel,
                "settings-panel-body": settingsPanelBody,
                "control-panel": controlPanel,
                header,
                "active-craft-row": activeCraftRow,
                ...controls,
            };
            return mapping[id] || null;
        },
        querySelector(selector) {
            if (selector === ".settings-option--orbit-style") return orbitStyleOption;
            if (selector === ".settings-row--trail-controls") return trailControls;
            if (selector === "#blurb .desktoponly") return sourceLine;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === "#settings-panel .settings-section") {
                return [cameraSection, viewSection, panelManagerSection, otherSection];
            }
            return [];
        },
        addEventListener(type, handler) {
            const handlers = buttonHandlers.get(type) || [];
            handlers.push(handler);
            buttonHandlers.set(type, handlers);
        },
        dispatch(type, event = {}) {
            const handlers = buttonHandlers.get(type) || [];
            handlers.forEach((handler) => handler(event));
        },
    };

    const dialogApi = {
        init: vi.fn(),
        open: vi.fn(() => {
            wrapper.visible = true;
        }),
        close: vi.fn(() => {
            wrapper.visible = false;
        }),
        widgetElement: vi.fn(() => wrapper),
    };

    const setControlPanelCollapsedState = vi.fn((collapsed) => {
        controlPanel.classList.toggle("control-panel--collapsed", !!collapsed);
    });

    const windowRef = {
        innerWidth: mobile ? 500 : 1024,
        innerHeight: 800,
        addEventListener: vi.fn(),
        requestAnimationFrame: (callback) => callback(),
    };

    const controller = createSettingsPanelController({
        documentRef,
        windowRef,
        onClick: (id, handler) => {
            documentRef.getElementById(id)?.addEventListener("click", handler);
        },
        getMissionDialogApi: () => dialogApi,
        isMobileViewport: () => mobile,
        isElementLayoutVisible: (element) => !!element?.visible,
        setControlPanelCollapsedState,
        requestAnimationFrameImpl: (callback) => callback(),
    });

    return {
        controller,
        settingsButton,
        advancedButton,
        settingsPanel,
        settingsPanelBody,
        title,
        viewLegend,
        cameraLegend,
        panelManagerLegend,
        cameraSection,
        viewSection,
        panelManagerSection,
        otherSection,
        genericViewOption,
        additionalCraftsOption,
        auxPanelsOption,
        fpsOption,
        activeCraftRow,
        orbitStyleOption,
        trailControls,
        wrapper,
        dialogApi,
        controlPanel,
        setControlPanelCollapsedState,
        sourceLine,
        documentRef,
    };
}

describe("createSettingsPanelController", () => {
    it("opens the advanced panel with filtered presentation and synced launcher state", () => {
        const harness = createHarness();
        harness.controller.bind();

        harness.advancedButton.dispatch("click");

        expect(harness.dialogApi.init).toHaveBeenCalledTimes(1);
        expect(harness.dialogApi.open).toHaveBeenCalledTimes(1);
        expect(harness.dialogApi.init.mock.calls[0][1].title).toBe("Advanced");
        expect(harness.dialogApi.init.mock.calls[0][1].position.of).toBe("#advanced-controls-pill");
        expect(harness.wrapper.visible).toBe(true);
        expect(harness.settingsPanel.classList.contains("settings-panel--advanced")).toBe(true);
        expect(harness.title.textContent).toBe("Advanced");
        expect(harness.viewLegend.textContent).toBe("Craft / Display");
        expect(harness.otherSection.classList.contains("settings-panel__filtered-hidden")).toBe(true);
        expect(harness.cameraSection.classList.contains("settings-panel__filtered-hidden")).toBe(false);
        expect(harness.panelManagerSection.classList.contains("settings-panel__filtered-hidden")).toBe(true);
        expect(harness.genericViewOption.classList.contains("settings-panel__filtered-hidden")).toBe(true);
        expect(harness.additionalCraftsOption.classList.contains("settings-panel__filtered-hidden")).toBe(false);
        expect(harness.auxPanelsOption.classList.contains("settings-panel__filtered-hidden")).toBe(true);
        expect(harness.fpsOption.classList.contains("settings-panel__filtered-hidden")).toBe(false);
        expect(harness.cameraSection.classList.contains("settings-section--advanced-collapsible")).toBe(true);
        expect(harness.cameraSection.classList.contains("settings-section--collapsed")).toBe(false);
        expect(harness.viewSection.classList.contains("settings-section--collapsed")).toBe(true);
        expect(harness.panelManagerSection.classList.contains("settings-section--collapsed")).toBe(false);

        harness.viewLegend.dispatch("click");
        expect(harness.viewSection.classList.contains("settings-section--collapsed")).toBe(false);
        expect(harness.viewLegend.getAttribute("aria-expanded")).toBe("true");
        expect(harness.advancedButton.getAttribute("aria-expanded")).toBe("true");
        expect(harness.advancedButton.classList.contains("is-open")).toBe(true);
        expect(harness.settingsButton.getAttribute("aria-expanded")).toBe("false");
    });

    it("auto-collapses controls on mobile open and restores them when the same launcher closes", () => {
        const harness = createHarness({ mobile: true });
        harness.controller.bind();

        harness.settingsButton.dispatch("click");
        expect(harness.setControlPanelCollapsedState).toHaveBeenCalledWith(true);
        expect(harness.wrapper.style.maxWidth).toBe("320px");
        expect(harness.cameraSection.classList.contains("settings-section--mobile-collapsible")).toBe(true);
        expect(harness.cameraSection.classList.contains("settings-section--collapsed")).toBe(true);
        expect(harness.cameraLegend.getAttribute("role")).toBe("button");

        harness.settingsButton.dispatch("click");
        expect(harness.dialogApi.close).toHaveBeenCalledTimes(1);
        expect(harness.setControlPanelCollapsedState).toHaveBeenLastCalledWith(false);
        expect(harness.settingsButton.getAttribute("aria-expanded")).toBe("false");
    });

    it("resets the settings panel for mobile mode takeover", () => {
        const harness = createHarness();
        harness.controller.bind();
        harness.advancedButton.dispatch("click");

        harness.controller.resetForMobileMode();

        expect(harness.dialogApi.close).toHaveBeenCalledTimes(1);
        expect(harness.settingsPanel.style.display).toBe("none");
        expect(harness.settingsPanel.classList.contains("settings-panel--advanced")).toBe(false);
        expect(harness.title.textContent).toBe("Settings");
        expect(harness.advancedButton.getAttribute("aria-expanded")).toBe("false");
        expect(harness.settingsButton.getAttribute("aria-expanded")).toBe("false");
    });
});
