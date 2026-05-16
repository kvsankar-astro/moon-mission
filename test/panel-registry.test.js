import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadPanelRegistry() {
    vi.resetModules();
    return import("../src/platform/js/app/panel-registry.js");
}

function registerBasePanel(registry, overrides = {}) {
    return registry.registerMissionPanel({
        id: "demo:panel",
        title: "Demo Panel",
        builtIn: true,
        available: true,
        state: "closed",
        sortOrder: 10,
        actions: {
            open: vi.fn(),
        },
        ...overrides,
    });
}

describe("panel registry subscriptions", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("does not notify subscribers for repeated unchanged updateMissionPanel calls", async () => {
        const registry = await loadPanelRegistry();
        const firstOpen = vi.fn();
        const secondOpen = vi.fn();
        const restore = vi.fn();
        registerBasePanel(registry, {
            actions: {
                open: firstOpen,
                restore,
            },
        });
        const listener = vi.fn();
        const unsubscribe = registry.subscribeMissionPanels(listener);
        listener.mockClear();

        registry.updateMissionPanel("demo:panel", {
            title: "Demo Panel",
            builtIn: true,
            available: true,
            state: "closed",
            sortOrder: 10,
            actions: {
                open: secondOpen,
            },
        });

        expect(listener).not.toHaveBeenCalled();
        expect(registry.invokeMissionPanelAction("demo:panel", "open")).toBe(true);
        expect(registry.invokeMissionPanelAction("demo:panel", "restore")).toBe(true);
        expect(firstOpen).not.toHaveBeenCalled();
        expect(secondOpen).toHaveBeenCalledTimes(1);
        expect(restore).toHaveBeenCalledTimes(1);
        unsubscribe();
    });

    it("does not notify subscribers when registerMissionPanel re-registers an unchanged snapshot", async () => {
        const registry = await loadPanelRegistry();
        const firstRestore = vi.fn();
        const secondRestore = vi.fn();
        registerBasePanel(registry, {
            actions: {
                restore: firstRestore,
            },
        });
        const listener = vi.fn();
        const unsubscribe = registry.subscribeMissionPanels(listener);
        listener.mockClear();

        registry.registerMissionPanel({
            id: "demo:panel",
            title: "Demo Panel",
            builtIn: true,
            available: true,
            state: "closed",
            sortOrder: 10,
            actions: {
                restore: secondRestore,
            },
        });

        expect(listener).not.toHaveBeenCalled();
        expect(registry.invokeMissionPanelAction("demo:panel", "restore")).toBe(true);
        expect(firstRestore).not.toHaveBeenCalled();
        expect(secondRestore).toHaveBeenCalledTimes(1);
        unsubscribe();
    });

    it.each([
        ["state", { state: "open" }, { state: "open" }],
        ["title", { title: "Renamed Panel" }, { title: "Renamed Panel" }],
        ["availability", { available: false }, { available: false }],
    ])("notifies subscribers when %s changes", async (_label, patch, expected) => {
        const registry = await loadPanelRegistry();
        registerBasePanel(registry);
        const listener = vi.fn();
        const unsubscribe = registry.subscribeMissionPanels(listener);
        listener.mockClear();

        registry.updateMissionPanel("demo:panel", patch);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0][0]).toMatchObject(expected);
        unsubscribe();
    });
});
