import { describe, expect, it, vi } from "vitest";

import { createCameraPillController } from "../src/platform/js/ui/camera-pill-controller.js";

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
        name: options.name || "",
        value: options.value || "",
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
    const documentListeners = new Map();
    const positionSelect = createElement("camera-position", { value: "manual" });
    const lookSelect = createElement("camera-look", { value: "earth" });
    const followEarth = createElement("follow-pill-earth");
    const followMoon = createElement("follow-pill-moon");
    const followCraft = createElement("follow-pill-craft");
    const viewFree = createElement("view-pill-free");
    const viewEarthMoon = createElement("view-pill-earth-moon");
    const viewMoonEarth = createElement("view-pill-moon-earth");
    const viewCraftMoon = createElement("view-pill-craft-moon");
    const viewCraftEarth = createElement("view-pill-craft-earth");
    const positionManual = createElement("camera-position-pill-manual", {
        name: "camera-position-pill",
        value: "manual",
        checked: true,
    });
    const positionCraft = createElement("camera-position-pill-spacecraft", {
        name: "camera-position-pill",
        value: "spacecraft",
    });
    const lookManual = createElement("camera-look-pill-manual", {
        name: "camera-look-pill",
        value: "manual",
    });
    const lookEarth = createElement("camera-look-pill-earth", {
        name: "camera-look-pill",
        value: "earth",
        checked: true,
    });
    const lookMoon = createElement("camera-look-pill-moon", {
        name: "camera-look-pill",
        value: "moon",
    });

    const allElements = [
        positionSelect,
        lookSelect,
        followEarth,
        followMoon,
        followCraft,
        viewFree,
        viewEarthMoon,
        viewMoonEarth,
        viewCraftMoon,
        viewCraftEarth,
        positionManual,
        positionCraft,
        lookManual,
        lookEarth,
        lookMoon,
    ];
    const byId = new Map(allElements.map((element) => [element.id, element]));
    const byName = new Map([
        ["camera-position-pill", [positionManual, positionCraft]],
        ["camera-look-pill", [lookManual, lookEarth, lookMoon]],
    ]);

    const documentRef = {
        getElementById(id) {
            return byId.get(id) || null;
        },
        querySelector(selector) {
            const match = selector.match(/^input\[name="(.+)"\]:checked$/);
            if (!match) return null;
            return (byName.get(match[1]) || []).find((element) => element.checked) || null;
        },
        querySelectorAll(selector) {
            const match = selector.match(/^input\[name="(.+)"\]$/);
            if (!match) return [];
            return byName.get(match[1]) || [];
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

    const controlBackend = {
        commitCameraLookMode: vi.fn(),
        commitCameraPair: vi.fn(),
        commitCameraPositionMode: vi.fn(),
    };

    const controller = createCameraPillController({
        controlBackend,
        documentRef,
    });

    return {
        controlBackend,
        controller,
        documentRef,
        followCraft,
        followEarth,
        lookEarth,
        lookMoon,
        lookSelect,
        positionCraft,
        positionManual,
        positionSelect,
        viewCraftMoon,
        viewEarthMoon,
    };
}

describe("createCameraPillController", function () {
    it("syncs the initial follow and view pill state from the camera selects", function () {
        const harness = createHarness();

        harness.controller.bind();

        expect(harness.followEarth.classList.contains("is-active")).toBe(true);
        expect(harness.followEarth["aria-pressed"]).toBe("true");
        expect(harness.viewEarthMoon.classList.contains("is-active")).toBe(false);
    });

    it("commits camera mode changes from the select controls", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.positionSelect.value = "spacecraft";
        harness.positionSelect.dispatchEvent({
            type: "change",
            target: harness.positionSelect,
            detail: { preserveManualRelease: true },
        });

        expect(harness.controlBackend.commitCameraPositionMode).toHaveBeenCalledWith(
            "spacecraft",
            {
                sourceId: "camera-position",
                sourceName: "camera-position",
                preserveManualRelease: true,
            },
        );
    });

    it("releases an active follow pill back to manual look", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.followEarth.dispatchEvent({ type: "click" });

        expect(harness.controlBackend.commitCameraPair).toHaveBeenCalledWith(
            "manual",
            "manual",
            { preserveManualRelease: true },
        );
    });

    it("activates a semantic view pill and re-syncs after camera updates", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.viewCraftMoon.dispatchEvent({ type: "click" });

        expect(harness.controlBackend.commitCameraPair).toHaveBeenCalledWith(
            "spacecraft",
            "moon",
        );

        harness.positionSelect.value = "spacecraft";
        harness.lookSelect.value = "moon";
        harness.positionManual.checked = false;
        harness.positionCraft.checked = true;
        harness.lookEarth.checked = false;
        harness.lookMoon.checked = true;
        harness.documentRef?.dispatchEvent?.({ type: "camera-from-to-ui-updated" });

        expect(harness.viewCraftMoon.classList.contains("is-active")).toBe(true);
        expect(harness.followEarth.classList.contains("is-active")).toBe(false);
    });
});
