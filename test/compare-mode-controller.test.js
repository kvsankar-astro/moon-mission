import { describe, expect, it, vi } from "vitest";

import { createCompareModeController } from "../src/platform/js/ui/compare-mode-controller.js";

function createInput(id, options = {}) {
    const listeners = new Map();
    return {
        id,
        checked: options.checked === true,
        disabled: options.disabled === true,
        title: options.title || "",
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            for (const handler of listeners.get(event.type) || []) {
                handler(event);
            }
        },
    };
}

function createSelect(id) {
    const listeners = new Map();
    const options = [];
    const select = {
        id,
        disabled: false,
        options,
        value: "",
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        appendChild(option) {
            options.push(option);
        },
        replaceChildren(...nextOptions) {
            options.length = 0;
            options.push(...nextOptions);
        },
        dispatchEvent(event) {
            for (const handler of listeners.get(event.type) || []) {
                handler(event);
            }
        },
    };
    return select;
}

function createHarness({
    search = "?mission=chandrayaan3",
    entries = [
        {
            folder: "chandrayaan3",
            queryValue: "chandrayaan3",
            card: { title: "Chandrayaan 3" },
        },
        {
            folder: "artemis1",
            queryValue: "artemis1",
            card: { title: "Artemis 1" },
        },
        {
            folder: "grail",
            queryValue: "grail",
            card: { title: "GRAIL" },
        },
    ],
    resolvedMissions = {},
} = {}) {
    const compareToggle = createInput("compare-mode-toggle");
    const compareSelect = createSelect("compare-mission-select");
    const byId = new Map([
        ["compare-mode-toggle", compareToggle],
        ["compare-mission-select", compareSelect],
    ]);

    const documentRef = {
        createElement(tagName) {
            return {
                tagName,
                disabled: false,
                selected: false,
                textContent: "",
                value: "",
            };
        },
        getElementById(id) {
            return byId.get(id) || null;
        },
    };
    const windowRef = {
        location: {
            search,
        },
        missionConfig: {
            dataPath: "assets/chandrayaan3/data/",
        },
        missionCatalog: {
            getEntries() {
                return entries;
            },
            resolveMission(value) {
                return resolvedMissions[String(value).toLowerCase()] || null;
            },
        },
    };

    const toggleCompareMode = vi.fn();
    const changeCompareMission = vi.fn();
    const controller = createCompareModeController({
        documentRef,
        windowRef,
        toggleCompareMode,
        changeCompareMission,
    });

    return {
        changeCompareMission,
        compareSelect,
        compareToggle,
        controller,
        toggleCompareMode,
    };
}

describe("compare mode controller", () => {
    it("populates alternate mission choices and syncs compare-mode URL state", () => {
        const harness = createHarness({
            search: "?mission=chandrayaan3&mode=compare&compareMission=grail",
        });

        harness.controller.bind();

        expect(harness.compareToggle.checked).toBe(true);
        expect(harness.compareToggle.disabled).toBe(false);
        expect(harness.compareSelect.options.map((option) => option.value)).toEqual([
            "artemis1",
            "grail",
        ]);
        expect(harness.compareSelect.value).toBe("grail");
    });

    it("canonicalizes compare mission aliases from the URL", () => {
        const harness = createHarness({
            search: "?mission=chandrayaan3&mode=compare&compareMission=art1",
            entries: [
                {
                    folder: "chandrayaan3",
                    queryValue: "chandrayaan3",
                    card: { title: "Chandrayaan 3" },
                },
                {
                    folder: "artemis1",
                    queryValue: "artemis1",
                    card: { title: "Artemis 1" },
                },
            ],
            resolvedMissions: {
                art1: {
                    folder: "artemis1",
                    queryValue: "artemis1",
                    card: { title: "Artemis 1" },
                },
            },
        });

        harness.controller.bind();

        expect(harness.compareSelect.value).toBe("artemis1");
    });

    it("calls the compare-mode toggle handler with the selected mission", () => {
        const harness = createHarness({
            search: "?mission=chandrayaan3&compareMission=artemis1",
        });

        harness.controller.bind();
        harness.compareToggle.checked = true;
        harness.compareToggle.dispatchEvent({
            type: "change",
            target: harness.compareToggle,
        });

        expect(harness.toggleCompareMode).toHaveBeenCalledWith({
            compareMission: "artemis1",
            enabled: true,
        });
    });

    it("calls the compare-mission change handler when the picker changes", () => {
        const harness = createHarness({
            search: "?mission=chandrayaan3&compareMission=artemis1",
        });

        harness.controller.bind();
        harness.compareSelect.value = "grail";
        harness.compareSelect.dispatchEvent({
            type: "change",
            target: harness.compareSelect,
        });

        expect(harness.changeCompareMission).toHaveBeenCalledWith({
            compareMission: "grail",
            compareEnabled: false,
        });
    });
});
