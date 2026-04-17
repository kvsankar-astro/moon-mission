import { describe, expect, it, vi } from "vitest";
import {
    createMissionRuntimeRoot,
    createSyncedRuntimeViewActions,
    publishMissionRuntimeGlobals,
} from "../src/platform/js/app/mission-runtime-root.js";

describe("mission runtime root", () => {
    it("wraps runtime view actions with playback UI resync hooks", () => {
        const callOrder = [];
        const missionRuntimeWireup = {
            toggleMode: vi.fn(() => callOrder.push("toggleMode")),
            setDimensionTop: vi.fn(() => callOrder.push("setDimensionTop")),
            setView: vi.fn(() => callOrder.push("setView")),
        };
        const syncTimelineDock = vi.fn(() => callOrder.push("syncTimelineDock"));
        const syncActiveCraftControl = vi.fn(() => callOrder.push("syncActiveCraftControl"));

        const actions = createSyncedRuntimeViewActions({
            missionRuntimeWireup,
            syncTimelineDock,
            syncActiveCraftControl,
        });

        actions.toggleMode("3D");
        actions.setDimensionTop("2D");
        actions.setView("geo");

        expect(missionRuntimeWireup.toggleMode).toHaveBeenCalledWith("3D");
        expect(missionRuntimeWireup.setDimensionTop).toHaveBeenCalledWith("2D");
        expect(missionRuntimeWireup.setView).toHaveBeenCalledWith("geo");
        expect(syncTimelineDock).toHaveBeenCalledTimes(3);
        expect(syncActiveCraftControl).toHaveBeenCalledTimes(3);
        expect(callOrder).toEqual([
            "toggleMode",
            "syncTimelineDock",
            "syncActiveCraftControl",
            "setDimensionTop",
            "syncTimelineDock",
            "syncActiveCraftControl",
            "setView",
            "syncTimelineDock",
            "syncActiveCraftControl",
        ]);
    });

    it("builds handlers first, then wires the synced runtime view actions", () => {
        const captured = {};
        const syncTimelineDock = vi.fn();
        const syncActiveCraftControl = vi.fn();
        const missionRuntimeWireup = {
            toggleMode: vi.fn(),
            setDimensionTop: vi.fn(),
            setView: vi.fn(),
        };

        const result = createMissionRuntimeRoot({
            handlersEntryContext: { handlersOnly: true },
            wireupEntryContext: { wireupOnly: true },
            syncTimelineDock,
            syncActiveCraftControl,
            createMissionRuntimeHandlersEntryImpl: vi.fn((context) => {
                captured.getSetView = context.getSetView;
                captured.getSetDimensionTop = context.getSetDimensionTop;
                captured.getMissionRuntimeWireup = context.getMissionRuntimeWireup;
                return {
                    initAnimation: vi.fn(),
                    processOrbitData: vi.fn(),
                    animateLoop: vi.fn(),
                    main: vi.fn(),
                };
            }),
            createMissionRuntimeWireupEntryImpl: vi.fn((context) => {
                captured.wireupContext = context;
                return { missionRuntimeWireup };
            }),
        });

        expect(captured.wireupContext.handlersOnly).toBeUndefined();
        expect(captured.wireupContext.wireupOnly).toBe(true);
        expect(captured.wireupContext.processOrbitData).toBe(result.processOrbitData);
        expect(captured.wireupContext.animateLoop).toBe(result.animateLoop);
        expect(captured.wireupContext.initAnimation).toBe(result.initAnimation);
        expect(captured.getMissionRuntimeWireup()).toBe(missionRuntimeWireup);
        expect(captured.getSetView()).toBe(result.setView);
        expect(captured.getSetDimensionTop()).toBe(result.setDimensionTop);

        result.toggleMode("relative");
        result.setDimensionTop("2D");
        result.setView("moon");

        expect(missionRuntimeWireup.toggleMode).toHaveBeenCalledWith("relative");
        expect(missionRuntimeWireup.setDimensionTop).toHaveBeenCalledWith("2D");
        expect(missionRuntimeWireup.setView).toHaveBeenCalledWith("moon");
        expect(syncTimelineDock).toHaveBeenCalledTimes(3);
        expect(syncActiveCraftControl).toHaveBeenCalledTimes(3);
    });

    it("publishes globals and binds the mission load handler only when a window is present", () => {
        const addEventListener = vi.fn();
        const windowRef = { addEventListener };
        const animationScenes = { geo: {} };
        const AnimationScene = class AnimationScene {};
        const main = vi.fn();

        publishMissionRuntimeGlobals({
            windowRef,
            animationScenes,
            AnimationScene,
            main,
        });
        publishMissionRuntimeGlobals({
            windowRef: null,
            animationScenes,
            AnimationScene,
            main,
        });

        expect(windowRef.animationScenes).toBe(animationScenes);
        expect(windowRef.AnimationScene).toBe(AnimationScene);
        expect(addEventListener).toHaveBeenCalledWith("load", main);
        expect(addEventListener).toHaveBeenCalledTimes(1);
    });
});
