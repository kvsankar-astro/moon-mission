import { afterEach, describe, expect, it, vi } from "vitest";

import {
    createBackgroundMediaPanelActions,
    resolveActiveBackgroundItem,
    resolveBackgroundPlaybackButtonState,
    resolveBackgroundCandidates,
    resolveBackgroundPlaybackMode,
    resolveNearestInactiveBackgroundItem,
} from "../src/platform/js/app/background-media-panel.js";

describe("background media panel helpers", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.document;
        delete globalThis.window;
        delete globalThis.localStorage;
    });

    it("selects the highest-priority background video active at mission time", () => {
        const timeMs = Date.parse("2026-04-06T18:00:00Z");
        const items = [
            {
                id: "image",
                kind: "image",
                playbackRoles: ["background"],
                assetUrl: "image.jpg",
                startTimeMs: timeMs - 1000,
                endTimeMs: timeMs + 1000,
            },
            {
                id: "low-priority",
                kind: "videoClip",
                playbackRoles: ["background"],
                assetUrl: "low.mp4",
                startTimeMs: timeMs - 1000,
                endTimeMs: timeMs + 1000,
                backgroundPlayback: {
                    enabled: true,
                    priority: 1,
                },
            },
            {
                id: "high-priority",
                kind: "videoClip",
                playbackRoles: ["background"],
                assetUrl: "high.mp4",
                startTimeMs: timeMs - 1000,
                endTimeMs: timeMs + 1000,
                backgroundPlayback: {
                    enabled: true,
                    priority: 10,
                },
            },
        ];

        expect(resolveBackgroundCandidates(items).map((item) => item.id)).toEqual([
            "high-priority",
            "low-priority",
        ]);
        expect(resolveActiveBackgroundItem(items, timeMs)?.id).toBe("high-priority");
    });

    it("ignores background videos outside their authored time range", () => {
        const timeMs = Date.parse("2026-04-06T18:00:00Z");
        const items = [
            {
                id: "future",
                kind: "videoClip",
                playbackRoles: ["background"],
                assetUrl: "future.mp4",
                startTimeMs: timeMs + 1000,
                endTimeMs: timeMs + 5000,
            },
        ];

        expect(resolveActiveBackgroundItem(items, timeMs)).toBeNull();
    });

    it("finds the next or most recently ended video for out-of-range status", () => {
        const timeMs = Date.parse("2026-04-06T18:00:00Z");
        const items = [
            {
                id: "past",
                kind: "videoClip",
                playbackRoles: ["background"],
                assetUrl: "past.mp4",
                startTimeMs: timeMs - 10000,
                endTimeMs: timeMs - 5000,
            },
            {
                id: "future",
                kind: "videoClip",
                playbackRoles: ["background"],
                assetUrl: "future.mp4",
                startTimeMs: timeMs + 1000,
                endTimeMs: timeMs + 5000,
            },
        ];

        expect(resolveNearestInactiveBackgroundItem(items, timeMs)).toEqual(expect.objectContaining({
            item: expect.objectContaining({ id: "future" }),
            relation: "before",
            deltaMs: 1000,
        }));
        expect(resolveNearestInactiveBackgroundItem(items, timeMs + 10000)).toEqual(expect.objectContaining({
            item: expect.objectContaining({ id: "future" }),
            relation: "after",
            deltaMs: 5000,
        }));
    });

    it("runs only with animation and mutes while foreground audio is active", () => {
        expect(resolveBackgroundPlaybackMode({
            panelState: "open",
            playbackEnabled: true,
            animationRunning: true,
            foregroundMediaActive: true,
            foregroundMediaKind: "audioClip",
        })).toBe("muted-for-foreground");

        expect(resolveBackgroundPlaybackMode({
            panelState: "open",
            playbackEnabled: true,
            animationRunning: true,
            foregroundMediaActive: true,
            foregroundMediaKind: "",
        })).toBe("muted-for-foreground");

        expect(resolveBackgroundPlaybackMode({
            panelState: "open",
            playbackEnabled: true,
            animationRunning: false,
            foregroundMediaActive: false,
        })).toBe("ready");

        expect(resolveBackgroundPlaybackMode({
            panelState: "open",
            playbackEnabled: true,
            animationRunning: true,
            foregroundMediaActive: false,
        })).toBe("playing");
    });

    it("mutes broadcast audio while a foreground video is active", () => {
        expect(resolveBackgroundPlaybackMode({
            panelState: "open",
            playbackEnabled: true,
            animationRunning: true,
            foregroundMediaActive: true,
            foregroundMediaKind: "videoClip",
        })).toBe("muted-for-foreground");
    });

    it("labels the broadcast transport by enabled and animation state", () => {
        expect(resolveBackgroundPlaybackButtonState({
            playbackEnabled: false,
            animationRunning: false,
        })).toEqual(expect.objectContaining({
            label: "Play broadcast",
            pressed: false,
        }));

        expect(resolveBackgroundPlaybackButtonState({
            playbackEnabled: true,
            animationRunning: false,
        })).toEqual(expect.objectContaining({
            label: "Resume broadcast",
            pressed: true,
        }));

        expect(resolveBackgroundPlaybackButtonState({
            playbackEnabled: true,
            animationRunning: true,
        })).toEqual(expect.objectContaining({
            label: "Pause broadcast",
            pressed: true,
        }));
    });

    it("does not hard-seek on every transport render while local playback is close to mission time", () => {
        const nodes = new Map();
        const makeClassList = () => ({
            toggle: vi.fn(),
            contains: vi.fn(() => false),
        });
        const makeNode = (id) => ({
            id,
            hidden: false,
            textContent: "",
            title: "",
            dataset: {},
            style: {},
            classList: makeClassList(),
            setAttribute: vi.fn(),
            addEventListener: vi.fn(),
            focus: vi.fn(),
            replaceChildren: vi.fn(),
            appendChild: vi.fn(),
            querySelector: vi.fn(() => null),
            getBoundingClientRect: vi.fn(() => ({ bottom: 80 })),
        });
        const video = makeNode("background-media-video");
        let currentTime = 10;
        let currentTimeWrites = 0;
        Object.defineProperty(video, "currentTime", {
            get: () => currentTime,
            set: (value) => {
                currentTimeWrites += 1;
                currentTime = Number(value);
            },
        });
        video.paused = false;
        video.play = vi.fn(() => Promise.resolve());
        video.pause = vi.fn(() => {
            video.paused = true;
        });
        video.load = vi.fn();
        video.canPlayType = vi.fn(() => "");
        video.getAttribute = vi.fn((name) => (name === "src" ? video.src || "" : ""));
        video.removeAttribute = vi.fn((name) => {
            delete video[name];
        });
        nodes.set("background-media-video", video);
        [
            "background-media-panel",
            "background-media-panel-wrapper",
            "background-video-status",
            "background-video-status-text",
            "background-media-empty",
            "background-media-live",
            "background-media-title",
            "background-media-status",
            "background-media-controls",
            "background-media-enable",
            "background-media-mute",
            "background-media-panel-expand",
            "background-media-panel-close",
        ].forEach((id) => {
            if (!nodes.has(id)) nodes.set(id, makeNode(id));
        });

        globalThis.document = {
            getElementById: vi.fn((id) => nodes.get(id) || null),
            querySelector: vi.fn(() => ({ getBoundingClientRect: () => ({ bottom: 80 }) })),
            addEventListener: vi.fn(),
            createElement: vi.fn((tagName) => makeNode(tagName)),
        };
        globalThis.window = {
            innerWidth: 1400,
            innerHeight: 900,
            missionConfig: { dataPath: "assets/artemis2/data/" },
            addEventListener: vi.fn(),
            setTimeout: vi.fn(() => 1),
            clearTimeout: vi.fn(),
        };
        const storage = new Map();
        globalThis.localStorage = {
            getItem: vi.fn((key) => storage.get(key) || null),
            setItem: vi.fn((key, value) => storage.set(key, value)),
        };

        const startTimeMs = Date.parse("2026-04-06T16:58:14Z");
        const actions = createBackgroundMediaPanelActions({
            getAnimationRunning: () => true,
            getAnimationRealtime: () => true,
        });
        actions.setMissionContext({
            available: true,
            configData: {
                ui: {
                    panels: {
                        defaults: {
                            "workflow:background-media": {
                                enabled: true,
                                defaultState: "open",
                            },
                        },
                    },
                },
            },
        });
        const [, enablePlayback] = nodes.get("background-media-enable").addEventListener.mock.calls.find(([type]) => type === "click");
        enablePlayback();
        actions.render({
            items: [{
                id: "broadcast",
                kind: "videoClip",
                enabled: true,
                assetUrl: "broadcast.mp4",
                playbackRoles: ["background"],
                startTimeMs,
                endTimeMs: startTimeMs + 600000,
                backgroundPlayback: {
                    enabled: true,
                },
            }],
            timeMs: startTimeMs + 10000,
            animationRunning: true,
        });

        currentTimeWrites = 0;
        currentTime = 10.4;
        actions.render({
            items: [{
                id: "broadcast",
                kind: "videoClip",
                enabled: true,
                assetUrl: "broadcast.mp4",
                playbackRoles: ["background"],
                startTimeMs,
                endTimeMs: startTimeMs + 600000,
                backgroundPlayback: {
                    enabled: true,
                },
            }],
            timeMs: startTimeMs + 11000,
            animationRunning: true,
        });

        expect(currentTimeWrites).toBe(0);
        expect(video.load).toHaveBeenCalledTimes(1);
    });

    it("binds broadcast dragging even when the first setup runs before panel DOM exists", () => {
        const nodes = new Map();
        const documentListeners = new Map();
        const storage = new Map();
        const makeClassList = () => ({
            toggle: vi.fn(),
            contains: vi.fn(() => false),
        });
        const makeNode = (id) => {
            const listeners = new Map();
            const node = {
                id,
                hidden: false,
                textContent: "",
                title: "",
                dataset: {},
                style: {},
                offsetLeft: 8,
                offsetTop: 80,
                offsetWidth: 546,
                offsetHeight: 300,
                classList: makeClassList(),
                setAttribute: vi.fn(),
                focus: vi.fn(),
                replaceChildren: vi.fn(),
                appendChild: vi.fn(),
                querySelector: vi.fn(() => null),
                setPointerCapture: vi.fn(),
                hasPointerCapture: vi.fn(() => true),
                releasePointerCapture: vi.fn(),
                closest: vi.fn(() => null),
                addEventListener(type, handler) {
                    const handlers = listeners.get(type) || [];
                    handlers.push(handler);
                    listeners.set(type, handlers);
                },
                dispatchEvent(event) {
                    if (!event.target) event.target = node;
                    if (typeof event.preventDefault !== "function") {
                        event.preventDefault = vi.fn();
                    }
                    for (const handler of listeners.get(event.type) || []) {
                        handler.call(node, event);
                    }
                },
                getBoundingClientRect() {
                    return {
                        left: Number.parseFloat(node.style.left) || node.offsetLeft,
                        top: Number.parseFloat(node.style.top) || node.offsetTop,
                        width: Number.parseFloat(node.style.width) || node.offsetWidth,
                        height: Number.parseFloat(node.style.height) || node.offsetHeight,
                        bottom: 80,
                    };
                },
            };
            return node;
        };

        globalThis.localStorage = {
            getItem: vi.fn((key) => storage.get(key) || null),
            setItem: vi.fn((key, value) => storage.set(key, value)),
        };
        globalThis.window = {
            innerWidth: 1400,
            innerHeight: 900,
            missionConfig: { dataPath: "assets/artemis2/data/" },
            addEventListener: vi.fn(),
            setTimeout: vi.fn(() => 1),
            clearTimeout: vi.fn(),
        };
        globalThis.document = {
            getElementById: vi.fn((id) => nodes.get(id) || null),
            querySelector: vi.fn(() => ({ getBoundingClientRect: () => ({ bottom: 80 }) })),
            createElement: vi.fn((tagName) => makeNode(tagName)),
            addEventListener(type, handler) {
                const handlers = documentListeners.get(type) || [];
                handlers.push(handler);
                documentListeners.set(type, handlers);
            },
        };

        const actions = createBackgroundMediaPanelActions();
        const missionContext = {
            available: true,
            configData: {
                ui: {
                    panels: {
                        defaults: {
                            "workflow:background-media": {
                                enabled: true,
                                defaultState: "open",
                            },
                        },
                    },
                },
            },
        };
        actions.setMissionContext(missionContext);

        const panel = makeNode("background-media-panel");
        const header = makeNode("background-media-panel-header");
        panel.querySelector = vi.fn((selector) => (
            selector === ".background-media-panel__header" ? header : null
        ));
        nodes.set("background-media-panel", panel);
        nodes.set("background-media-panel-wrapper", makeNode("background-media-panel-wrapper"));
        [
            "background-media-panel-close",
            "background-media-panel-expand",
            "background-media-enable",
            "background-media-mute",
            "background-media-video",
        ].forEach((id) => nodes.set(id, makeNode(id)));

        actions.setMissionContext(missionContext);

        header.dispatchEvent({
            type: "pointerdown",
            pointerId: 4,
            button: 0,
            clientX: 40,
            clientY: 50,
            target: header,
        });
        for (const handler of documentListeners.get("pointermove") || []) {
            handler({
                type: "pointermove",
                pointerId: 4,
                clientX: 100,
                clientY: 90,
                preventDefault: vi.fn(),
            });
        }
        actions.setMissionContext(missionContext);

        expect(panel.style.left).toBe("68px");
        expect(panel.style.top).toBe("128px");

        for (const handler of documentListeners.get("pointerup") || []) {
            handler({
                type: "pointerup",
                pointerId: 4,
                preventDefault: vi.fn(),
            });
        }

        expect(panel.style.left).toBe("68px");
        expect(panel.style.top).toBe("128px");
        const savedLayout = JSON.parse(storage.get("moon-mission:panel-layout:v1:artemis2"));
        expect(savedLayout.panels["workflow:background-media"].rect).toEqual(expect.objectContaining({
            left: 68,
            top: 128,
        }));
    });
});
