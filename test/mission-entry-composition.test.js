import { describe, expect, it, vi } from "vitest";

import {
    bindMissionPlaybackStartup,
    createMissionPlaybackRuntime,
} from "../src/platform/js/app/mission-entry-composition.js";

describe("mission entry composition", () => {
    it("creates the playback runtime and binds startup sync through the window load event", () => {
        const eventBus = { emit: vi.fn() };
        const syncTimelineDock = vi.fn();
        const syncActiveCraftControl = vi.fn();
        const updateSpeedControlsUI = vi.fn();
        const updateTransportControlsUI = vi.fn();
        const dispatchAnimationPlayStateUpdated = vi.fn();
        const syncPlaybackStartup = vi.fn();
        const captured = {};
        let loadHandler = null;

        class TestAnimationController {
            constructor(callbacks) {
                captured.callbacks = callbacks;
                this.goToNow = vi.fn();
            }

            getIsRunning() {
                return true;
            }

            getSpeedMultiplier() {
                return 300;
            }

            getIsRealtimeSpeed() {
                return false;
            }
        }

        const runtime = createMissionPlaybackRuntime({
            windowRef: {
                addEventListener: vi.fn((eventName, handler) => {
                    if (eventName === "load") {
                        loadHandler = handler;
                    }
                }),
            },
            documentRef: {},
            CustomEventClass: class CustomEvent {},
            runtimeSessionState: { setAnimTime: vi.fn(), setAnimationRunning: vi.fn() },
            bridgeActions: { setLocation: vi.fn() },
            updateD3ElementText: vi.fn(),
            getSetView: vi.fn(),
            getAnimationScenes: vi.fn(),
            getConfig: vi.fn(),
            getGlobalConfig: vi.fn(),
            getStartTime: vi.fn(),
            getLatestEndTime: vi.fn(),
            getAnimTime: vi.fn(),
            getEventInfos: vi.fn(),
            defaultStepMs: 60000,
            maxTimelineStepMs: 1000,
            updateEventInfo: vi.fn(),
            clearEventInfo: vi.fn(),
            createEventBusImpl: vi.fn(() => eventBus),
            createMissionPlaybackUiShellImpl: vi.fn((ctx) => {
                captured.getAnimationController = ctx.getAnimationController;
                captured.playbackCtx = ctx;
                return {
                    syncTimelineDock,
                    syncActiveCraftControl,
                    updateSpeedControlsUI,
                    updateTransportControlsUI,
                    dispatchAnimationPlayStateUpdated,
                    syncPlaybackStartup,
                };
            }),
            createAnimationControllerCallbacksImpl: vi.fn((ctx) => {
                captured.callbackCtx = ctx;
                return { onTimeChange: vi.fn() };
            }),
            AnimationControllerClass: TestAnimationController,
        });

        expect(runtime.eventBus).toBe(eventBus);
        expect(runtime.animationController).toBeInstanceOf(TestAnimationController);
        expect(runtime.syncTimelineDock).toBe(syncTimelineDock);
        expect(runtime.syncActiveCraftControl).toBe(syncActiveCraftControl);
        expect(captured.getAnimationController()).toBe(runtime.animationController);
        expect(captured.callbackCtx.eventBus).toBe(eventBus);
        expect(captured.callbackCtx.syncTimelineDock).toBe(syncTimelineDock);
        expect(captured.callbackCtx.syncActiveCraftControl).toBe(syncActiveCraftControl);
        expect(captured.callbackCtx.updateSpeedControlsUI).toBe(updateSpeedControlsUI);
        expect(captured.callbackCtx.updateTransportControlsUI).toBe(updateTransportControlsUI);
        expect(captured.callbackCtx.dispatchAnimationPlayStateUpdated).toBe(
            dispatchAnimationPlayStateUpdated,
        );

        loadHandler();

        expect(syncPlaybackStartup).toHaveBeenCalledWith({
            isRunning: true,
            speedMultiplier: 300,
            isRealtimeSpeed: false,
            goToNow: expect.any(Function),
        });

        syncPlaybackStartup.mock.calls[0][0].goToNow();
        expect(runtime.animationController.goToNow).toHaveBeenCalledTimes(1);
    });

    it("skips playback startup binding when the window hook is unavailable", () => {
        const animationController = {
            getIsRunning: vi.fn(),
            getSpeedMultiplier: vi.fn(),
            getIsRealtimeSpeed: vi.fn(),
            goToNow: vi.fn(),
        };
        const syncPlaybackStartup = vi.fn();

        bindMissionPlaybackStartup({
            windowRef: null,
            animationController,
            syncPlaybackStartup,
        });

        expect(syncPlaybackStartup).not.toHaveBeenCalled();
    });
});
