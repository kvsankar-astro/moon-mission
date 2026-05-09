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
            photos: [
                {
                    time: "2026-04-02 12:00:00",
                    file: "photo.jpg",
                    title: "Crew photo",
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
            photos: [
                {
                    time: "2026-04-02 12:00:00",
                    file: "photo.jpg",
                    title: "Crew photo",
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
        expect(latestRender.thumbnailItems.map((item) => item.id)).toContain("audio:audio/clip.mp3");

        mocks.panelIntentHandler?.({ type: "selectItem", value: "audio:audio/clip.mp3" });

        expect(Number(slider.value)).toBe(Date.parse("2026-04-02T16:30:00Z"));
        expect(sliderEvents).toEqual(["input", "change"]);
    });

    it("does not select media just because filters narrow to audio", async () => {
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

        mocks.panelIntentHandler?.({ type: "toggleMediaKind", value: "image" });
        mocks.panelIntentHandler?.({ type: "toggleMediaKind", value: "videoClip" });

        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.filterModel.mediaKinds).toEqual(["audioClip"]);
        expect(latestRender.activeItem).toBeNull();
        expect(latestRender.stageEmptyText).toBe("Select a filtered media item to preview.");
        expect(latestRender.navigationModel).toEqual(expect.objectContaining({
            positionLabel: "1 filtered - none selected",
            previousEnabled: false,
            nextEnabled: true,
        }));
        expect(latestRender.statusText).toBe("Filtered to 1 media entry. Select one to preview.");
        expect(latestRender.statusText).not.toContain("Following mission time");
        expect(latestRender.statusText).not.toContain("Selected");
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
        expect(latestRender.thumbnailItems.map((item) => item.id)).not.toContain("photo-0.jpg");
        expect(latestRender.statusText).toBe("Filtered to 90 media entries. Select one to preview.");
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
        mocks.panelIntentHandler?.({ type: "toggleMediaKind", value: "image" });
        mocks.panelIntentHandler?.({ type: "toggleMediaKind", value: "videoClip" });

        mocks.panelIntentHandler?.({ type: "selectAdjacentItem", value: "next" });

        expect(Number(slider.value)).toBe(audioStartMs);
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
            showStartOptions: true,
            playing: false,
        }));
    });

    it("does not let audio time updates pull the mission time back after a manual timeline move", async () => {
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
        const audio = instances[0];
        expect(audio).toBeTruthy();

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
        expect(audio.pause).toHaveBeenCalledTimes(1);
        expect(sliderEvents).toEqual(["input", "change"]);
    });

    it("does not treat unknown-duration audio clips as active indefinitely", async () => {
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

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: Date.parse("2026-04-02T16:40:00Z"),
        });
        await flushPromises(8);

        mocks.panelIntentHandler?.({ type: "toggleAudio" });

        expect(AudioMock).not.toHaveBeenCalled();
        expect(playAnimation).not.toHaveBeenCalled();
        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.audioModel).toEqual(expect.objectContaining({
            nowLabel: "",
            enabled: true,
        }));
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
        instances[0].emit("error");

        expect(pauseAnimation).toHaveBeenCalled();
        const latestRender = mocks.panelRender.mock.calls.at(-1)?.[0] || {};
        expect(latestRender.playbackModel).toEqual(expect.objectContaining({
            playing: false,
            showStartOptions: true,
        }));
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
