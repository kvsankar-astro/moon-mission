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
        dispatchEvent: vi.fn(),
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

function createAudioMock() {
    const instances = [];
    class FakeAudio {
        constructor(src) {
            this.src = src;
            this.currentTime = 0;
            this.volume = 1;
            this.ended = false;
            this.listeners = new Map();
            this.play = vi.fn(() => Promise.resolve());
            this.pause = vi.fn();
            instances.push(this);
        }

        addEventListener(type, handler) {
            const handlers = this.listeners.get(type) || [];
            handlers.push(handler);
            this.listeners.set(type, handlers);
        }

        emit(type) {
            for (const handler of this.listeners.get(type) || []) {
                handler();
            }
        }
    }
    return {
        AudioMock: vi.fn((src) => new FakeAudio(src)),
        instances,
    };
}

describe("createMediaTimelineCoordination", () => {
    let originalDocument;
    let originalEvent;
    let originalHtmlInputElement;
    let originalWindow;
    let originalAudio;

    beforeEach(() => {
        originalDocument = globalThis.document;
        originalEvent = globalThis.Event;
        originalHtmlInputElement = globalThis.HTMLInputElement;
        originalWindow = globalThis.window;
        originalAudio = globalThis.Audio;
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
        globalThis.Audio = originalAudio;
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

    it("opens the media panel and seeks when a timeline media marker is selected", async () => {
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
            mediaMetadata: [
                {
                    file: "photo.jpg",
                    tags: ["gloves", "crew"],
                    subjects: ["gloved hands"],
                    bodies: ["Moon"],
                    sceneType: "crew",
                    qualityNotes: "Readable thumbnail.",
                },
            ],
            photos: [
                {
                    time: "2026-04-02 12:00:00",
                    file: "photo.jpg",
                    title: "Crew photo",
                    camera: "Canon EOS R5",
                    settings: "57mm · f/4 · 1/200 · ISO 1250",
                    enabled: true,
                },
            ],
        });
        const coordination = createMediaTimelineCoordination({
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:00:00Z"),
        });
        await flushPromises(8);
        const [, handler] = globalThis.document.addEventListener.mock.calls.find(([type]) => (
            type === "mission-media-marker-select"
        ));

        handler({
            detail: {
                marker: {
                    id: "photo.jpg",
                },
            },
        });

        expect(mocks.panelSetPanelState).toHaveBeenCalledWith("open");
        expect(Number(slider.value)).toBe(Date.parse("2026-04-02T16:00:00Z"));
        expect(sliderEvents).toEqual(["input", "change"]);
        expect(globalThis.document.dispatchEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "mission-media-item-select",
                detail: expect.objectContaining({
                    item: expect.objectContaining({
                        id: "photo.jpg",
                        title: "Crew photo",
                    }),
                }),
            }),
        );
    });

    it("seeks media selections by absolute mission time when the timeline view is zoomed", async () => {
        const sliderEvents = [];
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-03T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-03T12:00:00Z"));
        slider.value = "";
        slider.dispatchEvent = (event) => {
            sliderEvents.push({
                type: event.type,
                programmaticSeekTimeMs: Number(slider.dataset?.programmaticSeekTimeMs),
            });
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
        globalThis.document.getElementById = vi.fn((id) => (id === "timeline-slider" ? slider : null));
        mocks.loadMissionMediaManifest.mockResolvedValue({
            mediaBase: "https://media.example/",
            timelineTimezoneOffset: "-04:00",
            mediaMetadata: [
                {
                    file: "photo.jpg",
                    tags: ["gloves", "crew"],
                    subjects: ["gloved hands"],
                    bodies: ["Moon"],
                    sceneType: "crew",
                    qualityNotes: "Readable thumbnail.",
                },
            ],
            photos: [
                {
                    time: "2026-04-02 12:00:00",
                    file: "photo.jpg",
                    title: "Crew photo",
                    camera: "Canon EOS R5",
                    settings: "57mm · f/4 · 1/200 · ISO 1250",
                    enabled: true,
                },
            ],
        });
        const coordination = createMediaTimelineCoordination({
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-03T02:00:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "selectItem", value: "photo.jpg" });

        const targetTimeMs = Date.parse("2026-04-02T16:00:00Z");
        expect(Number(slider.value)).toBe(Date.parse("2026-04-03T00:00:00Z"));
        expect(Number(slider.dataset.currentTimeMs)).toBe(targetTimeMs);
        expect(sliderEvents).toEqual([
            { type: "input", programmaticSeekTimeMs: targetTimeMs },
            { type: "change", programmaticSeekTimeMs: targetTimeMs },
        ]);
        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.activeItem).toEqual(expect.objectContaining({
            id: "photo.jpg",
            focusSource: "user-selection",
            explicit: true,
            tags: ["gloves", "crew"],
            subjects: ["gloved hands"],
            bodies: ["Moon"],
            sceneType: "crew",
            qualityNotes: "Readable thumbnail.",
            exifLabel: "Canon EOS R5 - 57mm · f/4 · 1/200 · ISO 1250",
        }));
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

    it("stops active media playback when the media browser panel is closed", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = String(Date.parse("2026-04-02T16:00:00Z"));
        slider.dispatchEvent = vi.fn();
        const video = {
            pause: vi.fn(),
            dataset: {
                mediaItemId: "video:clip.mp4",
                mediaSourceUrl: "https://media.example/clip.mp4",
                sourceType: "mp4",
            },
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
                    file: "photo.jpg",
                    title: "Crew photo",
                    enabled: true,
                },
            ],
            videos: [
                {
                    id: "video:clip.mp4",
                    time: "2026-04-02 12:00:00",
                    file: "clip.mp4",
                    title: "Crew clip",
                    enabled: true,
                },
            ],
        });
        const coordination = createMediaTimelineCoordination({
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:00:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({
            type: "mediaPlaybackStarted",
            value: "video:clip.mp4",
            mediaKind: "videoClip",
            currentTime: 12,
        });

        const [, panelStateHandler] = globalThis.document.addEventListener.mock.calls.find(([type]) => (
            type === "mission-media-panel-state"
        ));
        panelStateHandler({
            detail: {
                state: "closed",
            },
        });

        expect(video.pause).toHaveBeenCalledTimes(1);
    });

    it("adds audio markers and seeks to an audio clip when selected", async () => {
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

        const latestMarkers = setTimelineMediaMarkers.mock.calls.at(-1)?.[0] || [];
        expect(latestMarkers.map((marker) => marker.mediaKind)).toContain("audioClip");
        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.thumbnailItems.map((item) => item.id)).toContain("audio:audio/clip.mp3");

        mocks.panelIntentHandler?.({ type: "selectItem", value: "audio:audio/clip.mp3" });

        expect(Number(slider.value)).toBe(Date.parse("2026-04-02T16:30:00Z"));
        expect(sliderEvents).toEqual(["input", "change"]);
    });

    it("focuses nearby media by mission time without making it an explicit selection", async () => {
        globalThis.window = {
            missionConfig: {
                dataPath: "assets/artemis2/data",
            },
        };
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
        const coordination = createMediaTimelineCoordination();

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:31:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "toggleMediaKind", value: "audioClip" });

        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.filterModel.mediaKinds).toEqual(["audioClip"]);
        expect(latestRender.focusSource).toBe("time-proximity");
        expect(latestRender.activeItem).toEqual(expect.objectContaining({
            id: "audio:audio/clip.mp3",
            kind: "audioClip",
            focusSource: "time-proximity",
            explicit: false,
        }));
        expect(latestRender.thumbnailItems).toContainEqual(expect.objectContaining({
            id: "audio:audio/clip.mp3",
            active: true,
        }));
        expect(latestRender.navigationModel).toEqual(expect.objectContaining({
            positionLabel: "1 of 1",
            previousEnabled: false,
            nextEnabled: false,
        }));
        expect(latestRender.playbackModel).toEqual(expect.objectContaining({
            showControls: true,
            playing: false,
        }));
        expect(latestRender.statusText).toBe("");
        expect(latestRender.statusText).not.toContain("Following mission time");
        expect(latestRender.statusText).not.toContain("Selected");
    });

    it("moves adjacent controls from the current time-proximity focus", async () => {
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
                    file: "photo-0.jpg",
                    title: "Photo 0",
                    enabled: true,
                },
                {
                    time: "2026-04-02 12:10:00",
                    file: "photo-10.jpg",
                    title: "Photo 10",
                    enabled: true,
                },
            ],
        });
        const coordination = createMediaTimelineCoordination({
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:04:00Z"),
        });
        await flushPromises(8);

        const initialRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(initialRender.activeItem).toEqual(expect.objectContaining({
            id: "photo-0.jpg",
            focusSource: "time-proximity",
            explicit: false,
        }));

        mocks.panelIntentHandler?.({ type: "selectAdjacentItem", value: "next" });

        expect(Number(slider.dataset.currentTimeMs)).toBe(Date.parse("2026-04-02T16:10:00Z"));
        expect(sliderEvents).toEqual(["input", "change"]);
        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.activeItem).toEqual(expect.objectContaining({
            id: "photo-10.jpg",
            focusSource: "user-selection",
            explicit: true,
        }));
        expect(latestRender.navigationModel).toEqual(expect.objectContaining({
            positionLabel: "2 of 2",
        }));
    });

    it("starts selected audio when animation play begins", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = "";
        slider.dispatchEvent = vi.fn();
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
        const { AudioMock } = createAudioMock();
        globalThis.Audio = AudioMock;
        mocks.loadMissionMediaManifest.mockResolvedValue({
            mediaBase: "https://media.example/",
            timelineTimezoneOffset: "-04:00",
            audio: [
                {
                    time: "2026-04-02 12:30:00",
                    file: "audio/clip.mp3",
                    desc: "Audio clip",
                    enabled: true,
                },
            ],
        });
        const playAnimation = vi.fn();
        const coordination = createMediaTimelineCoordination({
            playAnimation,
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });
        const audioStartMs = Date.parse("2026-04-02T16:30:00Z");

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:00:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "selectItem", value: "audio:audio/clip.mp3" });
        expect(AudioMock).not.toHaveBeenCalled();
        expect(Number(slider.dataset.currentTimeMs)).toBe(audioStartMs);

        const [, playStateHandler] = globalThis.document.addEventListener.mock.calls.find(([type]) => (
            type === "animation-play-state-updated"
        ));
        playStateHandler({ detail: { isPlaying: true } });

        expect(AudioMock).toHaveBeenCalledTimes(1);
        expect(playAnimation).not.toHaveBeenCalled();
        expect(Number(slider.dataset.currentTimeMs)).toBe(audioStartMs);
    });

    it("renders a bounded thumbnail window around mission time", async () => {
        globalThis.window = {
            missionConfig: {
                dataPath: "assets/artemis2/data",
            },
        };
        const photos = Array.from({ length: 90 }, (_, index) => {
            const hour = 12 + Math.floor(index / 60);
            const minute = index % 60;
            return {
                time: `2026-04-02 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
                file: `photo-${index}.jpg`,
                title: `Photo ${index}`,
                enabled: true,
            };
        });
        mocks.loadMissionMediaManifest.mockResolvedValue({
            mediaBase: "https://media.example/",
            timelineTimezoneOffset: "-04:00",
            photos,
        });
        const coordination = createMediaTimelineCoordination();

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T17:00:00Z"),
        });
        await flushPromises(8);

        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.mediaCountLabel).toBe("90");
        expect(latestRender.thumbnailItems).toHaveLength(64);
        expect(latestRender.thumbnailItems.map((item) => item.id)).toContain("photo-60.jpg");
        expect(latestRender.thumbnailItems).toContainEqual(expect.objectContaining({
            id: "photo-60.jpg",
            active: true,
        }));
        expect(latestRender.thumbnailItems.map((item) => item.id)).not.toContain("photo-0.jpg");
        expect(latestRender.statusText).toBe("");
    });

    it("surfaces enabled mission media streams as playable video items", async () => {
        globalThis.window = {
            missionConfig: {
                dataPath: "assets/artemis2/data",
            },
        };
        mocks.loadMissionMediaManifest.mockResolvedValue({
            mediaStreams: [
                {
                    id: "flyby-stream",
                    title: "Lunar flyby broadcast",
                    description: "Mission-long stream.",
                    enabled: true,
                    streamKind: "video",
                    sourceType: "hls",
                    sourceUrl: "assets/artemis2/media/streams/lunar-flyby/v1/master.m3u8",
                    sourceLabel: "NASA broadcast",
                    startTime: "2026-04-06T17:56:00Z",
                    durationSeconds: 36600.13,
                    syncStatus: "provisional",
                },
            ],
        });
        const coordination = createMediaTimelineCoordination();

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-06T17:56:00Z"),
        });
        await flushPromises(8);

        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.mediaCountLabel).toBe("1");
        expect(latestRender.activeItem).toMatchObject({
            id: "flyby-stream",
            kind: "videoClip",
            mediaStream: true,
            sourceType: "hls",
            videoAssetUrl: "assets/artemis2/media/streams/lunar-flyby/v1/master.m3u8",
            sourceLabel: "NASA broadcast",
            stageBadge: "Stream • Video • Exterior",
        });
        expect(latestRender.playbackModel).toMatchObject({
            playable: true,
            showControls: true,
        });
    });

    it("keeps the thumbnail window stable when selecting an item already away from the rail edge", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = "";
        slider.dispatchEvent = vi.fn();
        globalThis.HTMLInputElement = FakeInput;
        globalThis.Event = class {
            constructor(type) {
                this.type = type;
            }
        };
        globalThis.document.getElementById = vi.fn((id) => (id === "timeline-slider" ? slider : null));
        globalThis.window = {
            missionConfig: {
                dataPath: "assets/artemis2/data",
            },
        };
        const photos = Array.from({ length: 90 }, (_, index) => {
            const hour = 12 + Math.floor(index / 60);
            const minute = index % 60;
            return {
                time: `2026-04-02 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
                file: `photo-${index}.jpg`,
                title: `Photo ${index}`,
                enabled: true,
            };
        });
        mocks.loadMissionMediaManifest.mockResolvedValue({
            mediaBase: "https://media.example/",
            timelineTimezoneOffset: "-04:00",
            photos,
        });
        const coordination = createMediaTimelineCoordination();

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T17:00:00Z"),
        });
        await flushPromises(8);
        const initialRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        const initialFirstId = initialRender.thumbnailItems[0]?.id;

        mocks.panelIntentHandler?.({ type: "previewItem", value: "photo-62.jpg" });
        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T17:02:00Z"),
        });

        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.thumbnailItems[0]?.id).toBe(initialFirstId);
        expect(latestRender.thumbnailItems.find((item) => item.id === "photo-62.jpg")).toEqual(
            expect.objectContaining({ active: true }),
        );
    });

    it("downgrades explicit media selection back to time proximity when mission time moves away", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = "";
        slider.dispatchEvent = vi.fn();
        globalThis.HTMLInputElement = FakeInput;
        globalThis.Event = class {
            constructor(type) {
                this.type = type;
            }
        };
        globalThis.document.getElementById = vi.fn((id) => (id === "timeline-slider" ? slider : null));
        globalThis.window = {
            missionConfig: {
                dataPath: "assets/artemis2/data",
            },
        };
        mocks.loadMissionMediaManifest.mockResolvedValue({
            mediaBase: "https://media.example/",
            timelineTimezoneOffset: "-04:00",
            photos: [
                {
                    time: "2026-04-02 12:00:00",
                    file: "photo-0.jpg",
                    title: "Photo 0",
                    enabled: true,
                },
                {
                    time: "2026-04-02 12:10:00",
                    file: "photo-10.jpg",
                    title: "Photo 10",
                    enabled: true,
                },
            ],
        });
        const coordination = createMediaTimelineCoordination({
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:05:00Z"),
        });
        await flushPromises(8);

        const initialRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(initialRender.activeItem).toEqual(expect.objectContaining({
            id: "photo-0.jpg",
            focusSource: "time-proximity",
            explicit: false,
        }));

        mocks.panelIntentHandler?.({ type: "selectItem", value: "photo-0.jpg" });
        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:00:00Z"),
        });
        const selectedRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(selectedRender.activeItem).toEqual(expect.objectContaining({
            id: "photo-0.jpg",
            focusSource: "user-selection",
            explicit: true,
        }));

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:09:00Z"),
        });
        const movedRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(movedRender.activeItem).toEqual(expect.objectContaining({
            id: "photo-10.jpg",
            focusSource: "time-proximity",
            explicit: false,
        }));
    });

    it("keeps explicit selected media pinned while that media still covers mission time", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-02T09:00:00Z"));
        slider.max = String(Date.parse("2026-04-02T12:30:00Z"));
        slider.value = String(Date.parse("2026-04-02T10:30:00Z"));
        slider.dataset = {
            currentTimeMs: String(Date.parse("2026-04-02T10:30:00Z")),
        };
        slider.dispatchEvent = vi.fn();
        globalThis.HTMLInputElement = FakeInput;
        globalThis.Event = class {
            constructor(type) {
                this.type = type;
            }
        };
        globalThis.document.getElementById = vi.fn((id) => (id === "timeline-slider" ? slider : null));
        globalThis.window = {
            missionConfig: {
                dataPath: "assets/artemis2/data",
            },
        };
        mocks.loadMissionMediaManifest.mockResolvedValue({
            mediaBase: "https://media.example/",
            timelineTimezoneOffset: "+00:00",
            photos: [
                {
                    time: "2026-04-02 10:00:00",
                    file: "a.mp4",
                    title: "Video A",
                    enabled: true,
                    video: true,
                    durationSeconds: 7200,
                },
                {
                    time: "2026-04-02 10:30:00",
                    file: "b.mp4",
                    title: "Video B",
                    enabled: true,
                    video: true,
                    durationSeconds: 3600,
                },
                {
                    time: "2026-04-02 11:00:00",
                    file: "still.jpg",
                    title: "Image C",
                    enabled: true,
                },
            ],
            audio: [
                {
                    time: "2026-04-02 10:45:00",
                    file: "audio/d.mp3",
                    desc: "Audio D",
                    enabled: true,
                    durationSeconds: 900,
                },
            ],
        });
        const coordination = createMediaTimelineCoordination({
            getStartTime: () => Date.parse("2026-04-02T09:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-02T12:30:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T10:30:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "selectItem", value: "a.mp4" });
        const selectedRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(selectedRender.activeItem).toEqual(expect.objectContaining({
            id: "a.mp4",
            focusSource: "user-selection",
            explicit: true,
        }));

        slider.value = String(Date.parse("2026-04-02T11:00:00Z"));
        slider.dataset.currentTimeMs = String(Date.parse("2026-04-02T11:00:00Z"));
        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T11:00:00Z"),
        });
        const pinnedRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(pinnedRender.activeItem).toEqual(expect.objectContaining({
            id: "a.mp4",
            focusSource: "user-selection",
            explicit: true,
        }));
        expect(pinnedRender.activeItem?.id).not.toBe("still.jpg");
    });

    it("uses the filtered media scroller as explicit selection without autoplaying clips", async () => {
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
        const AudioMock = vi.fn();
        globalThis.Audio = AudioMock;
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
        const playAnimation = vi.fn();
        const coordination = createMediaTimelineCoordination({
            playAnimation,
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });
        const audioStartMs = Date.parse("2026-04-02T16:30:00Z");

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:31:00Z"),
        });
        await flushPromises(8);
        mocks.panelIntentHandler?.({ type: "toggleMediaKind", value: "audioClip" });

        mocks.panelIntentHandler?.({ type: "selectAdjacentItem", value: "next" });

        expect(Number(slider.value)).toBe(Date.parse("2026-04-02T16:31:00Z"));
        expect(sliderEvents).toEqual(["input", "change"]);
        expect(AudioMock).not.toHaveBeenCalled();
        expect(playAnimation).not.toHaveBeenCalled();

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: audioStartMs,
        });
        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.activeItem).toEqual(expect.objectContaining({
            id: "audio:audio/clip.mp3",
            kind: "audioClip",
        }));
        expect(latestRender.navigationModel).toEqual(expect.objectContaining({
            positionLabel: "1 of 1",
        }));
        expect(latestRender.playbackModel).toEqual(expect.objectContaining({
            showControls: true,
            playing: false,
        }));
    });

    it("pauses animation at commit when mission media is open and seek lands outside playable coverage", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = "";
        slider.dataset = {};
        slider.dispatchEvent = vi.fn();
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
                    durationSeconds: 900,
                },
            ],
        });

        let animationRunning = true;
        const pauseAnimation = vi.fn();
        const coordination = createMediaTimelineCoordination({
            pauseAnimation,
            getAnimationRunning: () => animationRunning,
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:00:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({
            type: "mediaPlaybackStarted",
            value: "clip.mp4",
            mediaKind: "videoClip",
            currentTime: 180,
        });
        const pauseCallsBeforeSeek = pauseAnimation.mock.calls.length;

        const [, panelStateHandler] = globalThis.document.addEventListener.mock.calls.find(([type]) => (
            type === "mission-media-panel-state"
        ));
        panelStateHandler({
            detail: {
                state: "open",
            },
        });

        const [, timelineSeekHandler] = globalThis.document.addEventListener.mock.calls.find(([type]) => (
            type === "mission-timeline-user-seek"
        ));
        timelineSeekHandler({
            detail: {
                phase: "commit",
                source: "timeline-event-marker",
                commit: true,
                timeMs: Date.parse("2026-04-02T17:00:00Z"),
            },
        });

        expect(video.pause).toHaveBeenCalled();
        expect(pauseAnimation.mock.calls.length).toBeGreaterThan(pauseCallsBeforeSeek);
    });

    it("seeks active audio to the manually selected mission time", async () => {
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
        const { AudioMock, instances } = createAudioMock();
        globalThis.Audio = AudioMock;
        mocks.loadMissionMediaManifest.mockResolvedValue({
            mediaBase: "https://media.example/",
            timelineTimezoneOffset: "-04:00",
            audio: [
                {
                    time: "2026-04-02 12:30:00",
                    file: "audio/clip.mp3",
                    desc: "Audio clip",
                    enabled: true,
                },
            ],
        });
        const coordination = createMediaTimelineCoordination({
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });
        const audioStartMs = Date.parse("2026-04-02T16:30:00Z");
        const manualTimeMs = audioStartMs + 120000;

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: audioStartMs,
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "selectItem", value: "audio:audio/clip.mp3" });
        mocks.panelIntentHandler?.({ type: "startActiveMediaFromBeginning" });
        const audio = instances[instances.length - 1];
        expect(audio).toBeTruthy();
        audio.emit("playing");

        slider.value = String(manualTimeMs);
        slider.dataset.currentTimeMs = String(manualTimeMs);
        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: manualTimeMs,
        });

        audio.currentTime = 8;
        audio.emit("timeupdate");

        expect(Number(slider.dataset.currentTimeMs)).toBe(manualTimeMs);
        expect(Number(slider.value)).toBe(manualTimeMs);
        expect(audio.currentTime).toBe(120);
        expect(audio.pause).not.toHaveBeenCalled();
        expect(sliderEvents).toEqual(["input", "change", "input", "change", "input"]);
    });

    it("clears audio playback state when the audio element fails", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = "";
        slider.dispatchEvent = vi.fn();
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
        const { AudioMock, instances } = createAudioMock();
        globalThis.Audio = AudioMock;
        mocks.loadMissionMediaManifest.mockResolvedValue({
            mediaBase: "https://media.example/",
            timelineTimezoneOffset: "-04:00",
            audio: [
                {
                    time: "2026-04-02 12:30:00",
                    file: "audio/clip.mp3",
                    desc: "Audio clip",
                    enabled: true,
                },
            ],
        });
        const pauseAnimation = vi.fn();
        const coordination = createMediaTimelineCoordination({
            pauseAnimation,
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:30:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "selectItem", value: "audio:audio/clip.mp3" });
        mocks.panelIntentHandler?.({ type: "startActiveMediaFromBeginning" });
        instances[0].emit("error");

        expect(pauseAnimation).toHaveBeenCalled();
        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.playbackModel).toEqual(expect.objectContaining({
            playing: false,
            showControls: true,
        }));
    });

    it("starts selected video when animation play begins", async () => {
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
        const setRealtimeSpeed = vi.fn();
        const coordination = createMediaTimelineCoordination({
            playAnimation,
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
        expect(video.play).not.toHaveBeenCalled();

        const [, playStateHandler] = globalThis.document.addEventListener.mock.calls.find(([type]) => (
            type === "animation-play-state-updated"
        ));
        playStateHandler({ detail: { isPlaying: true } });
        await flushPromises(2);

        expect(video.src).toBe("https://media.example/web/clip.mp4");
        expect(video.poster).toBe("https://media.example/web/clip-poster.jpg");
        expect(video.play).toHaveBeenCalledTimes(1);
        expect(setRealtimeSpeed).not.toHaveBeenCalled();
        expect(playAnimation).toHaveBeenCalled();
    });

    it("starts selected video from the current mission offset when media controls play", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = "";
        slider.dispatchEvent = vi.fn();
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
                    durationSeconds: 600,
                },
            ],
        });
        const playAnimation = vi.fn();
        const coordination = createMediaTimelineCoordination({
            playAnimation,
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T15:55:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "selectItem", value: "clip.mp4" });
        slider.dataset.currentTimeMs = String(Date.parse("2026-04-02T16:05:00Z"));
        slider.value = String(Date.parse("2026-04-02T16:05:00Z"));
        mocks.panelIntentHandler?.({ type: "toggleActiveMediaPlayback" });

        expect(video.currentTime).toBe(300);
        expect(video.play).toHaveBeenCalledTimes(1);
        expect(playAnimation).not.toHaveBeenCalled();
    });

    it("keeps in-range timeline position when selecting a playable video", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = String(Date.parse("2026-04-02T16:30:00Z"));
        slider.dataset = {
            currentTimeMs: String(Date.parse("2026-04-02T16:30:00Z")),
        };
        slider.dispatchEvent = vi.fn();
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
                    durationSeconds: 3600,
                },
            ],
        });
        const coordination = createMediaTimelineCoordination({
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:30:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "selectItem", value: "clip.mp4" });
        expect(Number(slider.value)).toBe(Date.parse("2026-04-02T16:30:00Z"));
        expect(video.play).not.toHaveBeenCalled();
    });

    it("uses frame-scrub preview instead of transport playback at high animation rates", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = "";
        slider.dispatchEvent = vi.fn();
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
                    durationSeconds: 600,
                },
            ],
        });
        const playAnimation = vi.fn();
        const coordination = createMediaTimelineCoordination({
            playAnimation,
            getAnimationSpeedMultiplier: () => 60,
            getAnimationRealtime: () => false,
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:10:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "selectItem", value: "clip.mp4" });
        const [, playStateHandler] = globalThis.document.addEventListener.mock.calls.find(([type]) => (
            type === "animation-play-state-updated"
        ));
        playStateHandler({ detail: { isPlaying: true } });
        await flushPromises(2);

        expect(video.play).not.toHaveBeenCalled();
        expect(video.pause).toHaveBeenCalled();
        expect(video.currentTime).toBe(0);
        expect(playAnimation).toHaveBeenCalled();
    });

    it("resumes transport playback when switching from high-speed scrub mode to realtime", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = "";
        slider.dispatchEvent = vi.fn();
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
        let speedMultiplier = 60;
        let isRealtime = false;
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
                    durationSeconds: 600,
                },
            ],
        });
        const coordination = createMediaTimelineCoordination({
            getAnimationSpeedMultiplier: () => speedMultiplier,
            getAnimationRealtime: () => isRealtime,
            getAnimationRunning: () => true,
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:10:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "selectItem", value: "clip.mp4" });
        const [, playStateHandler] = globalThis.document.addEventListener.mock.calls.find(([type]) => (
            type === "animation-play-state-updated"
        ));
        playStateHandler({ detail: { isPlaying: true } });
        await flushPromises(2);
        expect(video.play).not.toHaveBeenCalled();

        speedMultiplier = 60;
        isRealtime = true;
        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:10:01Z"),
        });
        await flushPromises(2);

        expect(video.play).toHaveBeenCalledTimes(1);
    });

    it("syncs mission time when native video playback starts", async () => {
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
                    file: "clip.mp4",
                    title: "Crew video",
                    enabled: true,
                    video: true,
                    durationSeconds: 30,
                },
            ],
        });
        const playAnimation = vi.fn();
        const setRealtimeSpeed = vi.fn();
        const coordination = createMediaTimelineCoordination({
            playAnimation,
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
        mocks.panelIntentHandler?.({
            type: "mediaPlaybackStarted",
            value: "clip.mp4",
            mediaKind: "videoClip",
            currentTime: 12,
        });

        expect(Number(slider.value)).toBe(Date.parse("2026-04-02T16:00:12Z"));
        expect(playAnimation).toHaveBeenCalled();
        expect(sliderEvents).toEqual(["input", "change", "input"]);
    });

    it("pauses mission animation while selected video playback is buffering", async () => {
        class FakeInput {}
        const slider = new FakeInput();
        slider.min = String(Date.parse("2026-04-01T00:00:00Z"));
        slider.max = String(Date.parse("2026-04-08T00:00:00Z"));
        slider.value = "";
        slider.dispatchEvent = vi.fn();
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
                    file: "clip.mp4",
                    title: "Crew video",
                    enabled: true,
                    video: true,
                    durationSeconds: 30,
                },
            ],
        });
        const playAnimation = vi.fn();
        const pauseAnimation = vi.fn();
        const coordination = createMediaTimelineCoordination({
            playAnimation,
            pauseAnimation,
            getStartTime: () => Date.parse("2026-04-01T00:00:00Z"),
            getLatestEndTime: () => Date.parse("2026-04-08T00:00:00Z"),
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T15:55:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "selectItem", value: "clip.mp4" });
        mocks.panelIntentHandler?.({
            type: "mediaPlaybackStarted",
            value: "clip.mp4",
            mediaKind: "videoClip",
            currentTime: 4,
        });
        expect(playAnimation).toHaveBeenCalledTimes(1);

        mocks.panelIntentHandler?.({
            type: "mediaPlaybackBuffering",
            value: "clip.mp4",
            mediaKind: "videoClip",
            currentTime: 7,
        });

        expect(pauseAnimation).toHaveBeenCalled();
        expect(Number(slider.dataset.currentTimeMs)).toBe(Date.parse("2026-04-02T16:00:07Z"));
        const bufferingRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(bufferingRender.playbackModel).toEqual(expect.objectContaining({
            buffering: true,
            playing: false,
            showControls: true,
        }));

        mocks.panelIntentHandler?.({
            type: "mediaPlaybackStarted",
            value: "clip.mp4",
            mediaKind: "videoClip",
            currentTime: 7,
        });
        expect(playAnimation).toHaveBeenCalledTimes(2);
    });
});
