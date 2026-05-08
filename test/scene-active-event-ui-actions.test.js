import { describe, expect, it, vi } from "vitest";

import { createSceneActiveEventUiActions } from "../src/platform/js/app/scene-active-event-ui-actions.js";

function createClassList(initialValues = []) {
    const values = new Set(initialValues);
    return {
        add: vi.fn((value) => values.add(value)),
        remove: vi.fn((value) => values.delete(value)),
        contains: (value) => values.has(value),
    };
}

function createButtonStub({ eventKey = "", eventTimeMs = "", textContent = "", title = "" } = {}) {
    const attributes = { title };
    return {
        dataset: { eventKey, eventTimeMs },
        textContent,
        classList: createClassList(),
        getAttribute: vi.fn((name) => attributes[name] || ""),
        scrollIntoView: vi.fn(),
    };
}

function createD3Stub(styleCalls) {
    return {
        select(selector) {
            return {
                style(name, value) {
                    styleCalls.push({ selector, name, value });
                    return this;
                },
            };
        },
    };
}

describe("scene active event ui actions", () => {
    it("renders an active burn event, shows the burn indicator, and highlights the matching button", () => {
        const styleCalls = [];
        const burnButton = createButtonStub({
            eventKey: "tli-burn",
            eventTimeMs: "1000",
            textContent: "TLI Burn",
            title: "Trans-lunar injection",
        });
        const mobileText = {};
        const updateEventInfo = vi.fn();
        const clearEventInfo = vi.fn();
        const actions = createSceneActiveEventUiActions({
            d3: createD3Stub(styleCalls),
            updateEventInfo,
            clearEventInfo,
            setMobileText(id, text) {
                mobileText[id] = text;
            },
            documentRef: {
                querySelectorAll(selector) {
                    return selector === "#burnbuttons button[data-event-key]" ? [burnButton] : [];
                },
            },
            getNowWallTimeMs: () => 5000,
        });

        actions.updateActiveEvent({
            time: 1000,
            activeEvent: {
                key: "tli-burn",
                label: "TLI",
                infoText: "Trans-lunar injection",
                burnFlag: true,
                durationSeconds: 10,
                startTime: 1000,
            },
        });

        expect(styleCalls).toEqual([
            {
                selector: "#burng",
                name: "visibility",
                value: "visible",
            },
        ]);
        expect(updateEventInfo).toHaveBeenCalledTimes(1);
        expect(updateEventInfo.mock.calls[0][0]).toContain("Trans-lunar injection");
        expect(clearEventInfo).not.toHaveBeenCalled();
        expect(mobileText["mobile-mission-event"]).toContain("Trans-lunar injection");
        expect(burnButton.classList.contains("burnbutton--active-event")).toBe(true);
        expect(burnButton.classList.contains("burnbutton--time-boundary")).toBe(false);
        expect(burnButton.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it("marks the previous and next event buttons as dashed boundaries between events", () => {
        const styleCalls = [];
        const firstButton = createButtonStub({
            eventKey: "earthset",
            eventTimeMs: "1000",
            textContent: "Earthset",
        });
        const secondButton = createButtonStub({
            eventKey: "earthrise",
            eventTimeMs: "2000",
            textContent: "Earthrise",
        });
        const updateEventInfo = vi.fn();
        const clearEventInfo = vi.fn();
        const actions = createSceneActiveEventUiActions({
            d3: createD3Stub(styleCalls),
            updateEventInfo,
            clearEventInfo,
            setMobileText() {},
            documentRef: {
                querySelectorAll(selector) {
                    return selector === "#burnbuttons button[data-event-key]"
                        ? [firstButton, secondButton]
                        : [];
                },
            },
        });

        actions.updateActiveEvent({
            time: 1500,
            activeEvent: null,
        });

        expect(firstButton.classList.contains("burnbutton--time-boundary")).toBe(true);
        expect(secondButton.classList.contains("burnbutton--time-boundary")).toBe(true);
        expect(firstButton.classList.contains("burnbutton--active-event")).toBe(false);
        expect(secondButton.classList.contains("burnbutton--active-event")).toBe(false);
        expect(firstButton.scrollIntoView).not.toHaveBeenCalled();
        expect(secondButton.scrollIntoView).not.toHaveBeenCalled();
    });

    it("clears the active event shell when no event is present after a highlighted event", () => {
        const styleCalls = [];
        const burnButton = createButtonStub({
            eventKey: "loi-burn",
            eventTimeMs: "2000",
            textContent: "LOI Burn",
            title: "Lunar orbit insertion",
        });
        const mobileText = {};
        const updateEventInfo = vi.fn();
        const clearEventInfo = vi.fn();
        const actions = createSceneActiveEventUiActions({
            d3: createD3Stub(styleCalls),
            updateEventInfo,
            clearEventInfo,
            setMobileText(id, text) {
                mobileText[id] = text;
            },
            documentRef: {
                querySelectorAll(selector) {
                    return selector === "#burnbuttons button[data-event-key]" ? [burnButton] : [];
                },
            },
            getNowWallTimeMs: () => 5000,
        });

        actions.updateActiveEvent({
            time: 2000,
            activeEvent: {
                key: "loi-burn",
                label: "LOI",
                infoText: "Lunar orbit insertion",
                burnFlag: true,
                durationSeconds: 10,
                startTime: 2000,
            },
        });
        actions.updateActiveEvent({
            time: 3000,
            activeEvent: null,
        });

        expect(styleCalls).toEqual([
            {
                selector: "#burng",
                name: "visibility",
                value: "visible",
            },
            {
                selector: "#burng",
                name: "visibility",
                value: "hidden",
            },
        ]);
        expect(clearEventInfo).toHaveBeenCalledTimes(1);
        expect(mobileText["mobile-mission-event"]).toBe("No active event");
        expect(burnButton.classList.contains("burnbutton--active-event")).toBe(false);
    });
});
