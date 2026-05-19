import { afterEach, describe, expect, it } from "vitest";

import {
    createDockviewHeaderActionsRenderer,
    createDockviewTabContextMenuItems,
    calculateDefaultDockviewWorkspaceSizes,
    clampShellRect,
    getDefaultShellRect,
    getDockviewSpikeStorageKey,
    getDockviewSpikeShellStorageKey,
    isDesktopDockviewViewport,
    isDockviewSpikeEnabled,
    readDockviewSpikeShellRect,
    resolveDockviewPopoutUrl,
} from "../src/platform/js/app/experimental-dockview-host.js";

describe("experimental Dockview host helpers", () => {
    afterEach(() => {
        delete globalThis.window;
        delete globalThis.document;
        delete globalThis.localStorage;
    });

    it("enables the workspace by default on desktop", () => {
        expect(isDesktopDockviewViewport({ innerWidth: 900 })).toBe(true);
        expect(isDockviewSpikeEnabled("", { innerWidth: 900 })).toBe(true);
    });

    it("keeps explicit Dockview and legacy panel flags as overrides", () => {
        expect(isDockviewSpikeEnabled("?dockPanels=1", { innerWidth: 500 })).toBe(true);
        expect(isDockviewSpikeEnabled("?dockPanels=true", { innerWidth: 500 })).toBe(true);
        expect(isDockviewSpikeEnabled("?dockPanels=yes", { innerWidth: 500 })).toBe(true);

        expect(isDockviewSpikeEnabled("?dockPanels=0", { innerWidth: 900 })).toBe(false);
        expect(isDockviewSpikeEnabled("?dockPanels=false", { innerWidth: 900 })).toBe(false);
        expect(isDockviewSpikeEnabled("?legacyPanels=1", { innerWidth: 900 })).toBe(false);
        expect(isDockviewSpikeEnabled("?legacyPanels=true&dockPanels=1", { innerWidth: 900 })).toBe(false);
    });

    it("does not enable the workspace by default on mobile", () => {
        expect(isDesktopDockviewViewport({ innerWidth: 600 })).toBe(false);
        expect(isDockviewSpikeEnabled("", { innerWidth: 600 })).toBe(false);
    });

    it("uses the current mission in the experimental storage key", () => {
        globalThis.window = {
            location: {
                pathname: "/artemis2/",
            },
        };

        expect(getDockviewSpikeStorageKey()).toBe("moon-mission:dockview-spike:v7:artemis2");
    });

    it("uses a separate shell geometry storage key", () => {
        globalThis.window = {
            location: {
                pathname: "/artemis2/",
            },
        };

        expect(getDockviewSpikeShellStorageKey()).toBe("moon-mission:dockview-spike:v7:artemis2:shell");
    });

    it("clamps shell geometry inside the viewport", () => {
        const windowRef = {
            innerWidth: 1000,
            innerHeight: 700,
        };

        expect(clampShellRect({
            left: -50,
            top: -20,
            width: 2000,
            height: 2000,
        }, windowRef)).toEqual({
            left: 12,
            top: 12,
            width: 976,
            height: 676,
        });
    });

    it("falls back to default shell geometry when saved state is invalid", () => {
        const windowRef = {
            innerWidth: 1440,
            innerHeight: 900,
        };
        globalThis.localStorage = {
            getItem: () => "{bad-json",
        };

        expect(readDockviewSpikeShellRect("bad-key", windowRef)).toEqual(getDefaultShellRect(windowRef));
    });

    it("resolves the popout page next to mission routes", () => {
        expect(resolveDockviewPopoutUrl({
            href: "http://127.0.0.1:7274/artemis2/",
        })).toBe("/popout.html");
        expect(resolveDockviewPopoutUrl({
            href: "https://sankara.net/astro/lunar-missions/artemis2/",
        })).toBe("/astro/lunar-missions/popout.html");
    });

    it("keeps the default main scene wider than tall on desktop layouts", () => {
        const sizes = calculateDefaultDockviewWorkspaceSizes(1440, 760);

        expect(sizes.main).toBeGreaterThan(760);
        expect(sizes.auxRail).toBeLessThan(200);
    });

    it("renders compact Dockview header actions for maximize, float, and popout", () => {
        globalThis.document = {
            createElement: (tagName) => ({
                tagName,
                children: [],
                className: "",
                style: {},
                dataset: {},
                type: "",
                title: "",
                setAttribute(key, value) {
                    this[key] = value;
                },
                appendChild(child) {
                    this.children.push(child);
                    return child;
                },
                addEventListener() {},
                replaceChildren(...children) {
                    this.children = children;
                },
            }),
        };

        const renderer = createDockviewHeaderActionsRenderer({ popoutUrl: "/popout.html" });
        renderer.init({
            group: {},
            api: {},
            containerApi: {},
        });

        expect(renderer.element.children).toHaveLength(3);
        expect(renderer.element.className).toBe("experimental-dockview-host__header-actions");
    });

    it("adds Dockview tab menu actions for external window workflows", () => {
        const addFloatingGroup = () => {};
        const addPopoutGroup = () => {};

        expect(createDockviewTabContextMenuItems({
            panel: { id: "workflow:media-browser" },
            group: {
                api: {},
                element: {
                    getBoundingClientRect: () => ({ left: 0, top: 0 }),
                },
            },
            api: { addFloatingGroup, addPopoutGroup },
        }).map((item) => (typeof item === "string" ? item : item.label))).toEqual([
            "Maximize Group",
            "Float Group",
            "Open in New Window",
            "separator",
            "close",
            "closeOthers",
            "closeAll",
        ]);
    });
});
