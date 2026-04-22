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
    isRelativeMode = false,
    isCompareMode = false,
    originMode = "geo",
    currentAnimTime = 1234,
} = {}) {
    const compareSelect = { value: compareMission };
    const history = { replaceState: vi.fn() };

    globalThis.window = {
        history,
        location: { href },
    };
    globalThis.document = {
        getElementById(id) {
            if (id === "compare-mission-select") {
                return compareSelect;
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
        history,
    };
}

afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.sessionStorage = originalSessionStorage;
});

describe("relative mode actions", () => {
    it("navigates into compare mode with the selected comparison mission", () => {
        const { actions } = createHarness({
            href: "https://example.com/mission.html?mission=chandrayaan3",
        });

        actions.toggleCompareMode({ enabled: true });

        const nextUrl = new URL(globalThis.window.location.href);
        expect(nextUrl.searchParams.get("mode")).toBe("compare");
        expect(nextUrl.searchParams.get("compareMission")).toBe("artemis1");
        expect(globalThis.sessionStorage.getItem("mission.animTimeOverride")).toBe("1234");
        expect(globalThis.sessionStorage.getItem("cy3.animTimeOverride")).toBe("1234");
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

    it("exits compare mode through the URL-driven origin switch path", () => {
        const { actions } = createHarness({
            href: "https://example.com/mission.html?mission=chandrayaan3&mode=compare&compareMission=artemis1",
            isRelativeMode: true,
            isCompareMode: true,
            originMode: "lunar",
        });

        actions.toggleModeGuarded();

        const nextUrl = new URL(globalThis.window.location.href);
        expect(nextUrl.searchParams.get("mode")).toBe(null);
        expect(nextUrl.searchParams.get("compareMission")).toBe("artemis1");
        expect(globalThis.sessionStorage.getItem("mission.originOverride")).toBe("lunar");
        expect(globalThis.sessionStorage.getItem("cy3.originOverride")).toBe("lunar");
    });
});
