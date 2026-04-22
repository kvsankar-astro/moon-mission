import { afterEach, describe, expect, it, vi } from "vitest";

import { createRelativeModeActions } from "../src/platform/js/app/relative-mode.js";

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalSessionStorage = globalThis.sessionStorage;

function createSessionStorageMock() {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
    };
}

function createHarness({
    href = "https://example.com/mission.html?mission=chandrayaan3",
    compareMission = "artemis1",
    comparePrimaryEvent = "",
    compareSecondaryEvent = "",
    isRelativeMode = false,
    isCompareMode = false,
    originMode = "geo",
    currentAnimTime = 1234,
    relativeSelected = false,
} = {}) {
    const compareSelect = { value: compareMission };
    const comparePrimaryEventSelect = { value: comparePrimaryEvent };
    const compareSecondaryEventSelect = { value: compareSecondaryEvent };
    const history = { replaceState: vi.fn() };
    const originRelative = { checked: !!relativeSelected };

    globalThis.window = {
        history,
        location: { href },
    };
    globalThis.document = {
        getElementById(id) {
            if (id === "compare-mission-select") {
                return compareSelect;
            }
            if (id === "compare-primary-event-select") {
                return comparePrimaryEventSelect;
            }
            if (id === "compare-secondary-event-select") {
                return compareSecondaryEventSelect;
            }
            if (id === "origin-relative") {
                return originRelative;
            }
            return null;
        },
        querySelector() {
            return null;
        },
    };
    globalThis.sessionStorage = createSessionStorageMock();

    const actions = createRelativeModeActions({
        isRelativeMode,
        isCompareMode,
        setChecked: vi.fn(),
        readOriginMode: () => originMode,
        getToggleMode: () => vi.fn(),
        getCurrentAnimTime: () => currentAnimTime,
    });

    return {
        actions,
        compareSelect,
        comparePrimaryEventSelect,
        compareSecondaryEventSelect,
        history,
        originRelative,
    };
}

afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.sessionStorage = originalSessionStorage;
});

describe("relative mode actions", () => {
    it("navigates into compare mode with the selected comparison mission and event-pair alignment", () => {
        const { actions } = createHarness({
            href: "https://example.com/mission.html?mission=chandrayaan3",
            comparePrimaryEvent: "tli",
            compareSecondaryEvent: "loi",
        });

        actions.toggleCompareMode({ enabled: true });

        const nextUrl = new URL(globalThis.window.location.href);
        expect(nextUrl.searchParams.get("mode")).toBe("compare");
        expect(nextUrl.searchParams.get("compareMission")).toBe("artemis1");
        expect(nextUrl.searchParams.get("comparePrimaryEvent")).toBe("tli");
        expect(nextUrl.searchParams.get("compareSecondaryEvent")).toBe("loi");
        expect(nextUrl.searchParams.get("origin")).toBe("geo");
        expect(globalThis.sessionStorage.getItem("mission.animTimeOverride")).toBe("1234");
        expect(globalThis.sessionStorage.getItem("cy3.animTimeOverride")).toBe("1234");
    });

    it("keeps compare mode when switching to the relative origin from geo compare", () => {
        const { actions } = createHarness({
            href: "https://example.com/mission.html?mission=chandrayaan3&mode=compare&compareMission=artemis1&origin=geo",
            isCompareMode: true,
            originMode: "geo",
            relativeSelected: true,
        });

        actions.toggleRelativeMode();

        const nextUrl = new URL(globalThis.window.location.href);
        expect(nextUrl.searchParams.get("mode")).toBe("compare");
        expect(nextUrl.searchParams.get("compareMission")).toBe("artemis1");
        expect(nextUrl.searchParams.get("origin")).toBe(null);
    });

    it("updates the comparison mission in-place when compare mode is not active", () => {
        const { actions, history } = createHarness({
            href: "https://example.com/mission.html?mission=chandrayaan3&compareMission=artemis1",
        });

        actions.changeCompareMission({ compareMission: "grail" });

        expect(history.replaceState).toHaveBeenCalledTimes(1);
        const nextUrl = new URL(history.replaceState.mock.calls[0][2]);
        expect(nextUrl.searchParams.get("mode")).toBe(null);
        expect(nextUrl.searchParams.get("compareMission")).toBe("grail");
    });

    it("clears alignment params when the user returns to launch/start alignment", () => {
        const { actions, history } = createHarness({
            href: "https://example.com/mission.html?mission=chandrayaan3&compareMission=artemis1&comparePrimaryEvent=tli&compareSecondaryEvent=loi",
        });

        actions.changeCompareAlignment({
            primaryEventKey: "",
            secondaryEventKey: "",
        });

        expect(history.replaceState).toHaveBeenCalledTimes(1);
        const nextUrl = new URL(history.replaceState.mock.calls[0][2]);
        expect(nextUrl.searchParams.get("comparePrimaryEvent")).toBe(null);
        expect(nextUrl.searchParams.get("compareSecondaryEvent")).toBe(null);
    });

    it("keeps compare mode active through the URL-driven origin switch path", () => {
        const { actions } = createHarness({
            href: "https://example.com/mission.html?mission=chandrayaan3&mode=compare&compareMission=artemis1",
            isCompareMode: true,
            originMode: "lunar",
        });

        actions.toggleModeGuarded();

        const nextUrl = new URL(globalThis.window.location.href);
        expect(nextUrl.searchParams.get("mode")).toBe("compare");
        expect(nextUrl.searchParams.get("compareMission")).toBe("artemis1");
        expect(nextUrl.searchParams.get("origin")).toBe("lunar");
    });

    it("drops back to inertial geo when compare mode is disabled from geo compare", () => {
        const { actions } = createHarness({
            href: "https://example.com/mission.html?mission=chandrayaan3&mode=compare&compareMission=artemis1&origin=geo",
            isCompareMode: true,
            originMode: "geo",
        });

        actions.toggleCompareMode({ enabled: false });

        const nextUrl = new URL(globalThis.window.location.href);
        expect(nextUrl.searchParams.get("mode")).toBe(null);
        expect(nextUrl.searchParams.get("compareMission")).toBe("artemis1");
        expect(nextUrl.searchParams.get("origin")).toBe("geo");
    });
});
