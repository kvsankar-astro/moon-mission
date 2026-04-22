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

function createClassList(initialValues = []) {
    const values = new Set(initialValues);
    return {
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

function createRow(id) {
    return {
        id,
        hidden: false,
        classList: createClassList(),
    };
}

function createBurnButton({
    eventSourceKey,
    timelineRole = "primary",
    textContent,
    comparison = timelineRole === "comparison",
}) {
    return {
        dataset: {
            eventSourceKey,
            timelineRole,
        },
        textContent,
        classList: createClassList(comparison ? ["burnbutton--comparison"] : []),
        getAttribute(name) {
            if (name === "data-event-source-key") {
                return eventSourceKey;
            }
            if (name === "data-timeline-role") {
                return timelineRole;
            }
            return "";
        },
    };
}

function createHarness({
    search = "?mission=chandrayaan3",
    burnButtons = [],
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
    const compareAlignmentRow = createRow("compare-alignment-row");
    const comparePrimaryEventSelect = createSelect("compare-primary-event-select");
    const compareSecondaryEventSelect = createSelect("compare-secondary-event-select");
    const burnButtonsHost = createRow("burnbuttons");
    const byId = new Map([
        ["compare-mode-toggle", compareToggle],
        ["compare-mission-select", compareSelect],
        ["compare-alignment-row", compareAlignmentRow],
        ["compare-primary-event-select", comparePrimaryEventSelect],
        ["compare-secondary-event-select", compareSecondaryEventSelect],
        ["burnbuttons", burnButtonsHost],
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
        querySelectorAll(selector) {
            if (selector === "#burnbuttons button[data-event-source-key]") {
                return burnButtons;
            }
            return [];
        },
    };
    const windowRef = {
        location: {
            search,
        },
        MutationObserver: undefined,
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
    const changeCompareAlignment = vi.fn();
    const controller = createCompareModeController({
        documentRef,
        windowRef,
        toggleCompareMode,
        changeCompareMission,
        changeCompareAlignment,
    });

    return {
        changeCompareAlignment,
        changeCompareMission,
        compareAlignmentRow,
        comparePrimaryEventSelect,
        compareSelect,
        compareSecondaryEventSelect,
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
        expect(harness.compareAlignmentRow.hidden).toBe(true);
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
            primaryEventKey: undefined,
            secondaryEventKey: undefined,
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
            primaryEventKey: undefined,
            secondaryEventKey: undefined,
        });
    });

    it("preserves URL-driven alignment when the compare selectors are not yet available", () => {
        const harness = createHarness({
            search: "?mission=chandrayaan3&compareMission=artemis1&comparePrimaryEvent=tli&compareSecondaryEvent=loi",
        });

        harness.controller.bind();
        harness.compareToggle.checked = true;
        harness.compareToggle.dispatchEvent({
            type: "change",
            target: harness.compareToggle,
        });

        expect(harness.toggleCompareMode).toHaveBeenCalledWith({
            compareMission: "artemis1",
            primaryEventKey: undefined,
            secondaryEventKey: undefined,
            enabled: true,
        });
    });

    it("populates alignment controls from burn buttons and dispatches alignment changes", () => {
        const harness = createHarness({
            burnButtons: [
                createBurnButton({
                    eventSourceKey: "launch",
                    timelineRole: "primary",
                    textContent: "CH3: Launch",
                }),
                createBurnButton({
                    eventSourceKey: "tli",
                    timelineRole: "primary",
                    textContent: "CH3: TLI",
                }),
                createBurnButton({
                    eventSourceKey: "launch",
                    timelineRole: "comparison",
                    textContent: "A1: Launch",
                }),
                createBurnButton({
                    eventSourceKey: "loi",
                    timelineRole: "comparison",
                    textContent: "A1: LOI",
                }),
            ],
            search: "?mission=chandrayaan3&mode=compare&compareMission=artemis1&comparePrimaryEvent=tli&compareSecondaryEvent=loi",
        });

        harness.controller.bind();

        expect(harness.compareAlignmentRow.hidden).toBe(false);
        expect(harness.comparePrimaryEventSelect.options.map((option) => option.value)).toEqual([
            "",
            "launch",
            "tli",
        ]);
        expect(harness.compareSecondaryEventSelect.options.map((option) => option.value)).toEqual([
            "",
            "launch",
            "loi",
        ]);
        expect(harness.comparePrimaryEventSelect.value).toBe("tli");
        expect(harness.compareSecondaryEventSelect.value).toBe("loi");

        harness.comparePrimaryEventSelect.value = "";
        harness.compareSecondaryEventSelect.value = "";
        harness.compareSecondaryEventSelect.dispatchEvent({
            type: "change",
            target: harness.compareSecondaryEventSelect,
        });

        expect(harness.changeCompareAlignment).toHaveBeenCalledWith({
            compareEnabled: true,
            primaryEventKey: "",
            secondaryEventKey: "",
        });
    });
});
