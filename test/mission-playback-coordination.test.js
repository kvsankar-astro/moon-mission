import { describe, expect, it, vi } from "vitest";

import {
    buildActiveCraftControlState,
    buildTimelineDockState,
    createAnimationControllerCallbacks,
    createMissionPlaybackUiShell,
    formatSimRateLabel,
} from "../src/platform/js/app/mission-playback-coordination.js";

function createMissionConfig() {
    return {
        crafts: [
            {
                id: "SC",
                mnemonic: "SC",
                viewLabel: "Orbiter",
                orbitcolor: "#fff",
                primary: true,
            },
            {
                id: "LM",
                mnemonic: "LM",
                viewLabel: "Lander",
                color: "#0f0",
                primary: false,
            },
        ],
        landing: {
            enabled: true,
        },
    };
}

function createClassList(initialValues = []) {
    const values = new Set(initialValues);
    return {
        add: (value) => values.add(value),
        remove: (value) => values.delete(value),
        toggle: (value, enabled) => {
            if (enabled) {
                values.add(value);
                return;
            }
            values.delete(value);
        },
        contains: (value) => values.has(value),
    };
}

function createElementStub(overrides = {}) {
    const listeners = {};
    const attributes = {};
    return {
        dataset: {},
        classList: createClassList(),
        innerHTML: "",
        textContent: "",
        title: "",
        value: "",
        disabled: false,
        addEventListener: vi.fn((eventName, handler) => {
            listeners[eventName] = handler;
        }),
        setAttribute: vi.fn((name, value) => {
            attributes[name] = value;
        }),
        appendChild: vi.fn(),
        ...overrides,
        _listeners: listeners,
        _attributes: attributes,
    };
}

describe("mission playback coordination", () => {
    it("formats simulation speed labels across canned and derived rates", () => {
        expect(formatSimRateLabel(1, true)).toBe("1 sec/sec");
        expect(formatSimRateLabel(300, false)).toBe("5 min/sec");
        expect(formatSimRateLabel(7200, false)).toBe("2 hr/sec");
        expect(formatSimRateLabel(172800, false)).toBe("2 day/sec");
    });

    it("builds dock state from the current scene and mission craft metadata", () => {
        const eventInfos = [{ key: "burn-a" }];
        const state = buildTimelineDockState({
            scene: {
                planetsForLocations: ["EARTH", "SC", "LM"],
                viewAdditionalCrafts: true,
                activeCraftId: "LM",
                stepDurationInMilliSeconds: 45000,
            },
            globalConfig: createMissionConfig(),
            startTime: 1000,
            latestEndTime: 900,
            animTime: 2500,
            eventInfos,
            defaultStepMs: 60000,
            maxTimelineStepMs: 1000,
        });

        expect(state.range).toEqual({
            startTimeMs: 1000,
            endTimeMs: 1000,
            stepMs: 1000,
        });
        expect(state.currentTime).toBe(2500);
        expect(state.events).toBe(eventInfos);
        expect(state.presentation).toEqual({
            compareMode: false,
            label: "",
            detail: "",
            title: "",
        });
        expect(state.crafts).toEqual([
            {
                id: "SC",
                label: "Orbiter",
                roleLabel: "Primary",
                color: "#fff",
                active: false,
            },
            {
                id: "LM",
                label: "Lander",
                roleLabel: "Additional",
                color: "#0f0",
                active: true,
            },
        ]);
    });

    it("builds active-craft selector state for multi-craft and single-craft missions", () => {
        const multiCraftState = buildActiveCraftControlState({
            globalConfig: createMissionConfig(),
            scene: {
                planetsForLocations: ["EARTH", "SC", "LM"],
                viewAdditionalCrafts: true,
                activeCraftId: "LM",
            },
        });
        expect(multiCraftState).toEqual({
            showAdditionalCraftOption: true,
            showDescentOrbitOption: true,
            clearAdditionalCraftToggle: false,
            additionalCraftsEnabled: true,
            showSelectorRow: true,
            options: [
                { value: "SC", label: "Orbiter" },
                { value: "LM", label: "Lander" },
            ],
            optionSignature: "SC:Orbiter|LM:Lander",
            activeCraftId: "LM",
        });

        const singleCraftState = buildActiveCraftControlState({
            globalConfig: {
                crafts: [
                    {
                        id: "SC",
                        mnemonic: "SC",
                        primary: true,
                    },
                ],
                landing: {
                    enabled: false,
                },
            },
            scene: {
                planetsForLocations: ["EARTH", "SC"],
            },
        });
        expect(singleCraftState).toEqual({
            showAdditionalCraftOption: false,
            showDescentOrbitOption: false,
            clearAdditionalCraftToggle: true,
            additionalCraftsEnabled: false,
            showSelectorRow: false,
            options: [],
            optionSignature: "",
            activeCraftId: "",
        });
    });

    it("creates animation controller callbacks that keep session state and shell sync aligned", () => {
        const runtimeSessionState = {
            setAnimTime: vi.fn(),
            setAnimationRunning: vi.fn(),
        };
        const bridgeActions = {
            setLocation: vi.fn(),
        };
        const syncTimelineDock = vi.fn();
        const syncActiveCraftControl = vi.fn();
        const updateD3ElementText = vi.fn();
        const updateTransportControlsUI = vi.fn();
        const dispatchAnimationPlayStateUpdated = vi.fn();
        const dispatchMissionTimelineUserSeek = vi.fn();
        const setView = vi.fn();
        const updateSpeedControlsUI = vi.fn();
        const eventBus = {
            emit: vi.fn(),
        };

        const callbacks = createAnimationControllerCallbacks({
            runtimeSessionState,
            bridgeActions,
            syncTimelineDock,
            syncActiveCraftControl,
            updateD3ElementText,
            updateTransportControlsUI,
            dispatchAnimationPlayStateUpdated,
            dispatchMissionTimelineUserSeek,
            getSetView: () => setView,
            updateSpeedControlsUI,
            eventBus,
        });

        callbacks.onTimeChange(1234);
        callbacks.onTimeChange(2345, {
            seekEvent: true,
            phase: "commit",
            source: "transport-forward",
            commit: true,
        });
        callbacks.onPlayStateChange(true);
        callbacks.onSpeedChange(300, false);

        expect(runtimeSessionState.setAnimTime).toHaveBeenCalledWith(1234);
        expect(runtimeSessionState.setAnimTime).toHaveBeenCalledWith(2345);
        expect(bridgeActions.setLocation).toHaveBeenCalledTimes(2);
        expect(syncTimelineDock).toHaveBeenCalledTimes(2);
        expect(syncActiveCraftControl).toHaveBeenCalledTimes(2);
        expect(dispatchMissionTimelineUserSeek).toHaveBeenCalledWith({
            phase: "commit",
            source: "transport-forward",
            commit: true,
            timeMs: 2345,
        });
        expect(runtimeSessionState.setAnimationRunning).toHaveBeenCalledWith(true);
        expect(updateD3ElementText).toHaveBeenCalledWith("#animate", "⏸");
        expect(updateTransportControlsUI).toHaveBeenCalledWith(true);
        expect(dispatchAnimationPlayStateUpdated).toHaveBeenCalledWith(true);
        expect(setView).toHaveBeenCalledTimes(1);
        expect(updateSpeedControlsUI).toHaveBeenCalledWith(300, false);
        expect(eventBus.emit).toHaveBeenNthCalledWith(1, "animation:timeChanged", { time: 1234 });
        expect(eventBus.emit).toHaveBeenNthCalledWith(2, "animation:timeChanged", { time: 2345 });
        expect(eventBus.emit).toHaveBeenNthCalledWith(3, "animation:play", { isPlaying: true });
        expect(eventBus.emit).toHaveBeenNthCalledWith(4, "animation:speedChanged", {
            multiplier: 300,
            isRealtime: false,
        });
    });

    it("syncs playback startup through the extracted shell and binds the now button once", () => {
        const transportCluster = createElementStub();
        const additionalCraftOption = createElementStub({
            classList: createClassList(["settings-option--hidden"]),
        });
        const additionalCraftToggle = createElementStub({
            checked: false,
        });
        const descentOrbitOption = createElementStub({
            classList: createClassList(["settings-option--hidden"]),
        });
        const row = createElementStub({
            classList: createClassList(["settings-row--hidden"]),
        });
        const selectOptions = [];
        const select = createElementStub({
            appendChild: vi.fn((option) => {
                selectOptions.push(option);
            }),
        });
        const slowerButton = createElementStub();
        const realtimeButton = createElementStub();
        const fasterButton = createElementStub();
        const nowButton = createElementStub();
        const dispatchedEvents = [];
        const documentElements = {
            "additional-crafts-option": additionalCraftOption,
            "view-additional-crafts": additionalCraftToggle,
            "orbit-descent-option": descentOrbitOption,
            "active-craft-row": row,
            "active-craft-select": select,
            slower: slowerButton,
            realtime: realtimeButton,
            faster: fasterButton,
            missionnow: nowButton,
        };
        const documentRef = {
            getElementById: (id) => documentElements[id] || null,
            querySelector: (selector) =>
                selector === ".controls-cluster--transport" ? transportCluster : null,
            dispatchEvent: vi.fn((event) => {
                dispatchedEvents.push(event);
            }),
            createElement: vi.fn(() => ({
                value: "",
                textContent: "",
            })),
        };
        const controller = {
            bind: vi.fn(),
            setMode: vi.fn(),
            setRange: vi.fn(),
            setCurrentTime: vi.fn(),
            setEvents: vi.fn(),
            setCrafts: vi.fn(),
        };
        const createTimelineDockControllerImpl = vi.fn(() => controller);
        const goToNow = vi.fn();
        const syncTimelineEventButtons = vi.fn();
        class TestCustomEvent {
            constructor(type, init) {
                this.type = type;
                this.detail = init.detail;
            }
        }

        const shell = createMissionPlaybackUiShell({
            documentRef,
            CustomEventClass: TestCustomEvent,
            createTimelineDockControllerImpl,
            getAnimationController: () => ({
                setTime: vi.fn(),
                goToEvent: vi.fn(),
            }),
            getSetView: () => vi.fn(),
            getAnimationScenes: () => ({
                geo: {
                    planetsForLocations: ["EARTH", "SC", "LM"],
                    viewAdditionalCrafts: true,
                    activeCraftId: "LM",
                    stepDurationInMilliSeconds: 90000,
                },
            }),
            getConfig: () => "geo",
            getGlobalConfig: () => createMissionConfig(),
            getStartTime: () => 1000,
            getLatestEndTime: () => 5000,
            getAnimTime: () => 3000,
            getEventInfos: () => [{ key: "burn-a" }],
            getTimelineEventInfos: () => [{ key: "timeline-burn-a" }],
            getIsCompareMode: () => true,
            syncTimelineEventButtons,
            defaultStepMs: 60000,
            maxTimelineStepMs: 1000,
            updateEventInfo: vi.fn(),
            clearEventInfo: vi.fn(),
        });

        shell.syncPlaybackStartup({
            isRunning: true,
            speedMultiplier: 300,
            isRealtimeSpeed: false,
            goToNow,
        });
        shell.syncPlaybackStartup({
            isRunning: true,
            speedMultiplier: 300,
            isRealtimeSpeed: false,
            goToNow,
        });

        expect(createTimelineDockControllerImpl).toHaveBeenCalledTimes(1);
        expect(controller.bind).toHaveBeenCalledTimes(1);
        expect(controller.setMode).toHaveBeenCalledWith({
            compareMode: true,
            label: "Comparison Time",
            detail: "Fictional / relative",
            title: "Comparing Primary and Comparison with preserved mission pacing on a shared elapsed-time timeline.",
        });
        expect(controller.setRange).toHaveBeenCalledWith({
            startTimeMs: 1000,
            endTimeMs: 5000,
            stepMs: 1000,
        });
        expect(controller.setCurrentTime).toHaveBeenCalledWith(3000);
        expect(controller.setEvents).toHaveBeenCalledWith([{ key: "timeline-burn-a" }]);
        expect(controller.setCrafts).toHaveBeenCalledWith([
            {
                id: "SC",
                label: "Orbiter",
                roleLabel: "Primary",
                color: "#fff",
                active: false,
            },
            {
                id: "LM",
                label: "Lander",
                roleLabel: "Additional",
                color: "#0f0",
                active: true,
            },
        ]);
        expect(transportCluster.classList.contains("is-playing")).toBe(true);
        expect(realtimeButton.textContent).toBe("5 min/sec");
        expect(dispatchedEvents[0]).toMatchObject({
            type: "animation-play-state-updated",
            detail: { isPlaying: true },
        });
        expect(selectOptions).toHaveLength(2);
        expect(select.value).toBe("LM");
        expect(additionalCraftToggle.checked).toBe(true);
        expect(additionalCraftOption.classList.contains("settings-option--hidden")).toBe(false);
        expect(descentOrbitOption.classList.contains("settings-option--hidden")).toBe(false);
        expect(row.classList.contains("settings-row--hidden")).toBe(false);
        expect(nowButton.addEventListener).toHaveBeenCalledTimes(1);
        expect(syncTimelineEventButtons).toHaveBeenCalledWith([{ key: "timeline-burn-a" }]);

        nowButton._listeners.click();
        expect(goToNow).toHaveBeenCalledTimes(1);
    });

    it("pauses transport when timeline event markers are selected without seeking twice", () => {
        let dockOptions = null;
        const animationController = {
            setTime: vi.fn(),
            pause: vi.fn(),
        };
        const createTimelineDockControllerImpl = vi.fn((options) => {
            dockOptions = options;
            return {
                bind: vi.fn(),
                setMode: vi.fn(),
                setRange: vi.fn(),
                setCurrentTime: vi.fn(),
                setEvents: vi.fn(),
                setCrafts: vi.fn(),
            };
        });

        const shell = createMissionPlaybackUiShell({
            documentRef: {
                getElementById: () => null,
                querySelector: () => null,
                createElement: vi.fn(() => ({
                    value: "",
                    textContent: "",
                })),
            },
            CustomEventClass: class {},
            createTimelineDockControllerImpl,
            getAnimationController: () => animationController,
            getSetView: () => vi.fn(),
            getAnimationScenes: () => ({ geo: {} }),
            getConfig: () => "geo",
            getGlobalConfig: () => createMissionConfig(),
            getStartTime: () => 1000,
            getLatestEndTime: () => 5000,
            getAnimTime: () => 3000,
            getEventInfos: () => [],
            defaultStepMs: 60000,
            maxTimelineStepMs: 1000,
            updateEventInfo: vi.fn(),
            clearEventInfo: vi.fn(),
        });

        shell.ensureTimelineDockController();
        dockOptions.onSeekTime(2500, true);
        dockOptions.onMarkerSelect({ key: "burn-a" }, 0);

        expect(animationController.setTime).toHaveBeenCalledWith(2500);
        expect(animationController.pause).toHaveBeenCalledTimes(1);
        expect(animationController.setTime).toHaveBeenCalledTimes(1);
    });
});
