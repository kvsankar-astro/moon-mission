import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    loadMissionMediaManifest: vi.fn(),
    panelRender: vi.fn(),
    panelSetMissionContext: vi.fn(),
    panelSetPanelState: vi.fn(),
    panelIntentHandler: null,
}));

vi.mock("../src/platform/js/data/mission-media.js", () => ({
    loadMissionMediaManifest: mocks.loadMissionMediaManifest,
}));

vi.mock("../src/platform/js/app/media-browser-panel.js", () => ({
    MEDIA_BROWSER_PANEL_ID: "workflow:media-browser",
    createMediaBrowserPanelActions: vi.fn((options = {}) => {
        mocks.panelIntentHandler = options.onIntent;
        return {
            render: mocks.panelRender,
            setMissionContext: mocks.panelSetMissionContext,
            setPanelState: mocks.panelSetPanelState,
        };
    }),
}));

import { createMediaTimelineCoordination } from "../src/platform/js/app/media-timeline-coordination.js";

async function flushPromises(count = 1) {
    for (let index = 0; index < count; index += 1) {
        await Promise.resolve();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function createDocumentStub() {
    return {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getElementById: vi.fn(() => null),
    };
}

function createMissionConfig({ mediaEnabled } = {}) {
    return {
        mission_name: "Test Mission",
        ui: {
            panels: {
                defaults: {
                    "workflow:media-browser": {
                        enabled: mediaEnabled,
                        defaultState: "closed",
                    },
                },
            },
        },
    };
}

describe("createMediaTimelineCoordination", () => {
    let originalDocument;
    let originalEvent;
    let originalHtmlInputElement;
    let originalWindow;

    beforeEach(() => {
        originalDocument = globalThis.document;
        originalEvent = globalThis.Event;
        originalHtmlInputElement = globalThis.HTMLInputElement;
        originalWindow = globalThis.window;
        globalThis.document = createDocumentStub();
        mocks.loadMissionMediaManifest.mockReset();
        mocks.panelRender.mockReset();
        mocks.panelSetMissionContext.mockReset();
        mocks.panelSetPanelState.mockReset();
        mocks.panelIntentHandler = null;
    });

    afterEach(() => {
        globalThis.document = originalDocument;
        globalThis.Event = originalEvent;
        globalThis.HTMLInputElement = originalHtmlInputElement;
        globalThis.window = originalWindow;
    });

    it("does not load or bind mission media when the workflow panel is not enabled by config", () => {
        const setTimelineMediaMarkers = vi.fn();
        const coordination = createMediaTimelineCoordination({
            setTimelineMediaMarkers,
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: false }),
            animTime: 1234,
        });

        expect(mocks.loadMissionMediaManifest).not.toHaveBeenCalled();
        expect(globalThis.document.addEventListener).not.toHaveBeenCalled();
        expect(setTimelineMediaMarkers).toHaveBeenCalledWith([]);
        expect(mocks.panelSetMissionContext).toHaveBeenCalledWith(expect.objectContaining({
            available: false,
            mediaCount: 0,
        }));
        expect(mocks.panelRender).toHaveBeenCalledWith(expect.objectContaining({
            statusText: "Mission media is disabled for this mission.",
        }));
    });

    it("loads and binds mission media when the workflow panel is explicitly enabled", () => {
        mocks.loadMissionMediaManifest.mockResolvedValue(null);
        const coordination = createMediaTimelineCoordination();

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: 1234,
        });

        expect(mocks.loadMissionMediaManifest).toHaveBeenCalledTimes(1);
        expect(globalThis.document.addEventListener).toHaveBeenCalledWith(
            "mission-media-marker-select",
            expect.any(Function),
        );
    });

    it("releases the media marker listener when config disables the workflow panel", () => {
        mocks.loadMissionMediaManifest.mockResolvedValue(null);
        const coordination = createMediaTimelineCoordination();

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: 1234,
        });
        const [, handler] = globalThis.document.addEventListener.mock.calls[0];

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: false }),
            animTime: 2345,
        });

        expect(globalThis.document.removeEventListener).toHaveBeenCalledWith(
            "mission-media-marker-select",
            handler,
        );
    });

    it("adds audio markers when audio is enabled and seeks to an audio clip when selected", async () => {
        const sliderEvents = [];
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = "";
        slider.dispatchEvent = (event) => sliderEvents.push(event.type);
        globalThis.HTMLInputElement = FakeInput;
        globalThis.Event = class {
            constructor(type) {
                this.type = type;
            }
        };
        globalThis.window = {
            missionConfig: {
                dataPath: "assets/artemis2/data",
            },
        };
        globalThis.document.getElementById = vi.fn((id) => (id === "timeline-slider" ? slider : null));
        mocks.loadMissionMediaManifest.mockResolvedValue({
            mediaBase: "https://media.example/",
            timelineTimezoneOffset: "-04:00",
            photos: [
                {
                    time: "2026-04-02 12:00:00",
                    file: "photo.jpg",
                    title: "Crew photo",
                    enabled: true,
                },
            ],
            audio: [
                {
                    time: "2026-04-02 12:30:00",
                    file: "audio/clip.mp3",
                    desc: "Audio clip",
                    enabled: true,
                },
            ],
        });
        const setTimelineMediaMarkers = vi.fn();
        const coordination = createMediaTimelineCoordination({
            setTimelineMediaMarkers,
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:00:00Z"),
        });
        await flushPromises(8);
        expect(setTimelineMediaMarkers.mock.calls.some(([markers]) => (
            markers || []
        ).some((marker) => marker.mediaKind === "image"))).toBe(true);

        mocks.panelIntentHandler?.({ type: "toggleAudio" });
        await flushPromises(2);

        const latestMarkers = setTimelineMediaMarkers.mock.calls.at(-1)?.[0] || [];
        expect(latestMarkers.map((marker) => marker.mediaKind)).toContain("audioClip");
        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.nearbyItems.map((item) => item.id)).toContain("audio:audio/clip.mp3");

        mocks.panelIntentHandler?.({ type: "selectItem", value: "audio:audio/clip.mp3" });

        expect(Number(slider.value)).toBe(Date.parse("2026-04-02T16:30:00Z"));
        expect(sliderEvents).toEqual(["input", "change"]);
    });

    it("plays selected video media with the animation clock and pauses animation when media pauses", async () => {
        const sliderEvents = [];
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = "";
        slider.dispatchEvent = (event) => sliderEvents.push(event.type);
        const video = {
            dataset: {},
            src: "",
            poster: "",
            currentTime: 0,
            getAttribute(name) {
                return name === "src" ? this.src : "";
            },
            play: vi.fn(() => Promise.resolve()),
            pause: vi.fn(),
            load: vi.fn(),
        };
        globalThis.HTMLInputElement = FakeInput;
        globalThis.Event = class {
            constructor(type) {
                this.type = type;
            }
        };
        globalThis.window = {
            missionConfig: {
                dataPath: "assets/artemis2/data",
            },
        };
        globalThis.document.getElementById = vi.fn((id) => {
            if (id === "timeline-slider") return slider;
            if (id === "media-browser-video") return video;
            return null;
        });
        mocks.loadMissionMediaManifest.mockResolvedValue({
            mediaBase: "https://media.example/",
            timelineTimezoneOffset: "-04:00",
            photos: [
                {
                    time: "2026-04-02 12:00:00",
                    file: "clip.mp4",
                    title: "Crew video",
                    enabled: true,
                    video: true,
                },
            ],
        });
        const playAnimation = vi.fn();
        const pauseAnimation = vi.fn();
        const setRealtimeSpeed = vi.fn();
        const coordination = createMediaTimelineCoordination({
            playAnimation,
            pauseAnimation,
            setRealtimeSpeed,
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T15:55:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "selectItem", value: "clip.mp4" });

        expect(Number(slider.value)).toBe(Date.parse("2026-04-02T16:00:00Z"));
        expect(video.src).toBe("https://media.example/web/clip.mp4");
        expect(video.poster).toBe("https://media.example/web/clip-poster.jpg");
        expect(video.play).toHaveBeenCalledTimes(1);
        expect(setRealtimeSpeed).toHaveBeenCalled();
        expect(playAnimation).toHaveBeenCalled();

        mocks.panelIntentHandler?.({
            type: "mediaPlaybackTimeUpdate",
            value: "clip.mp4",
            currentTime: 12,
        });
        expect(Number(slider.value)).toBe(Date.parse("2026-04-02T16:00:12Z"));

        mocks.panelIntentHandler?.({ type: "mediaPlaybackPaused", value: "clip.mp4" });
        expect(pauseAnimation).toHaveBeenCalledTimes(1);
    });
});
