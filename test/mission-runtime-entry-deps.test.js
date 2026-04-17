import { describe, expect, it, vi } from "vitest";

vi.mock("../src/platform/js/ui/dom-helpers.js", () => ({
    readCheckedRadioValue: vi.fn(() => "ZX"),
    toggleVisibilityById: vi.fn(),
}));

import { readCheckedRadioValue, toggleVisibilityById } from "../src/platform/js/ui/dom-helpers.js";
import {
    createMissionRuntimeEffects,
    createMissionRuntimeEntryContext,
    createMissionRuntimeStaticDepsContext,
    createMissionRuntimeWireupContext,
    createMissionStatePortsContext,
    createModeSwitchWireupActions,
} from "../src/platform/js/app/mission-runtime-entry-deps.js";

describe("mission runtime entry dependency builders", () => {
    it("builds the mission state-port context with the runtime bootstrap accessor", () => {
        const getRuntimeBootstrapActions = vi.fn();
        const sceneViewStateActions = { getPlaneVariablesState: vi.fn() };
        const ctx = createMissionStatePortsContext(
            {
                missionStateCells: { foo: "bar" },
                runtimeFlags: { joyRide: false, landing: false },
                animationScenes: { geo: {} },
                orbitDataProcessed: { geo: true },
                chebyshevData: {},
                chebyshevDataLoaded: {},
                npzData: {},
                npzDataLoaded: {},
                landingNpzData: {},
                landingNpzLoaded: {},
                landingChebyshevData: {},
                landingChebyshevLoaded: {},
                planetProperties: {},
                ephemerisStatuses: {},
                resolveBodySource: vi.fn(),
                getActiveEphemerisSource: vi.fn(),
                sceneViewStateActions,
                AnimationScene: { SCENE_STATE_INIT_DONE: 42 },
            },
            { getRuntimeBootstrapActions },
        );

        expect(ctx.state).toEqual({ foo: "bar" });
        expect(ctx.runtimeFlags).toEqual({ joyRide: false, landing: false });
        expect(ctx.getRuntimeBootstrapActions).toBe(getRuntimeBootstrapActions);
        expect(ctx.getAnimationSceneInitDone()).toBe(42);
        expect(ctx.getPlaneVariablesState).toBe(sceneViewStateActions.getPlaneVariablesState);
    });

    it("builds UI and clock effects without leaking them into state ports", () => {
        const clearTimeoutFn = vi.fn();
        const d3Text = vi.fn();
        const d3Html = vi.fn();
        const d3 = {
            select: vi.fn(() => ({
                text: d3Text,
                html: d3Html,
            })),
        };

        const { missionUiEffects, missionClockEffects } = createMissionRuntimeEffects(
            { d3 },
            {
                interaction: {
                    getLegacyTimeoutHandle: vi.fn(() => 99),
                },
            },
            { clearTimeoutFn },
        );

        missionUiEffects.setEventInfoText("hello");
        missionUiEffects.setEpochDisplay({ epochJD: "jd", epochDate: "date" });
        missionClockEffects.clearLegacyTimeout();

        expect(d3.select).toHaveBeenCalledWith("#eventinfo");
        expect(d3.select).toHaveBeenCalledWith("#epochjd");
        expect(d3.select).toHaveBeenCalledWith("#epochdate");
        expect(clearTimeoutFn).toHaveBeenCalledWith(99);
    });

    it("maps mode-switch actions into the wireup contract", () => {
        const modeSwitchActions = {
            switchDimension: vi.fn(),
            switchToGeo: vi.fn(),
            switchToLunar: vi.fn(),
        };

        expect(createModeSwitchWireupActions(modeSwitchActions)).toEqual({
            handleDimensionSwitch: modeSwitchActions.switchDimension,
            handleModeSwitchToGeo: modeSwitchActions.switchToGeo,
            handleModeSwitchToLunar: modeSwitchActions.switchToLunar,
        });
    });

    it("builds the runtime wireup context from static deps, bridge deps, and effects", () => {
        const missionStatePorts = { app: { getConfig: vi.fn() } };
        const missionUiEffects = { setEventInfoText: vi.fn() };
        const missionClockEffects = { clearLegacyTimeout: vi.fn() };
        const staticWireupDeps = { staticOnly: true };
        const bridgeActions = { bridgeOnly: true };
        const sceneViewStateActions = { sceneViewOnly: true };
        const readPlaneSelection = vi.fn();
        const toggleStatsVisibility = vi.fn();

        const context = createMissionRuntimeWireupContext(
            {
                staticWireupDeps,
                bridgeActions,
                sceneViewStateActions,
                modeSwitchActions: {
                    switchDimension: vi.fn(),
                    switchToGeo: vi.fn(),
                    switchToLunar: vi.fn(),
                },
                isRelativeMode: vi.fn(),
                initAnimation: vi.fn(),
                animateLoop: vi.fn(),
                isTestMode: true,
                readPlaneSelection,
                toggleStatsVisibility,
            },
            {
                missionStatePorts,
                missionUiEffects,
                missionClockEffects,
            },
        );

        expect(context.staticOnly).toBe(true);
        expect(context.bridgeOnly).toBe(true);
        expect(context.sceneViewOnly).toBe(true);
        expect(context.statePorts).toBe(missionStatePorts);
        expect(context.uiEffects).toBe(missionUiEffects);
        expect(context.clockEffects).toBe(missionClockEffects);
        expect(context.handleDimensionSwitch).toEqual(expect.any(Function));
        expect(context.handleModeSwitchToGeo).toEqual(expect.any(Function));
        expect(context.handleModeSwitchToLunar).toEqual(expect.any(Function));
        expect(context.readPlaneSelection).toBe(readPlaneSelection);
        expect(context.toggleStatsVisibility).toBe(toggleStatsVisibility);
    });

    it("builds the static-deps context expected by runtime static deps", () => {
        const context = createMissionRuntimeStaticDepsContext({
            d3: {},
            d3SelectAll: vi.fn(),
            THREE: {},
            Astronomy: {},
            windowRef: {},
            documentRef: {},
            consoleRef: {},
            SwiperClass: class Swiper {},
            formatMetric: vi.fn(),
            animationScenes: {},
            animation3DControllers: {},
            animation2DControllers: {},
            orbitDataLoaded: {},
            orbitDataProcessed: {},
            chebyshevData: {},
            chebyshevDataLoaded: {},
            npzData: {},
            npzDataLoaded: {},
            ephemerisRecords: {},
            ephemerisStatuses: {},
            planetProperties: {},
            animationController: {},
            AnimationScene: class AnimationScene {},
            SceneHandlerClass: class SceneHandler {},
            bindInfoPanelControls: vi.fn(),
            updateEphemerisPanel: vi.fn(),
            pixelsPerAU: 123,
            render: vi.fn(),
            processOrbitData: vi.fn(),
        });

        expect(context.PIXELS_PER_AU).toBe(123);
        expect(context.render).toEqual(expect.any(Function));
        expect(context.processOrbitData).toEqual(expect.any(Function));
        expect(context.bindInfoPanelControls).toEqual(expect.any(Function));
    });

    it("builds the browser entry context and keeps DOM helper access local to that layer", () => {
        const staticWireupDeps = { staticOnly: true };
        const entryContext = createMissionRuntimeEntryContext(
            {
                d3: {},
                missionStateCells: {},
                runtimeFlags: {},
                animationScenes: {},
                orbitDataProcessed: {},
                chebyshevData: {},
                chebyshevDataLoaded: {},
                npzData: {},
                npzDataLoaded: {},
                landingNpzData: {},
                landingNpzLoaded: {},
                landingChebyshevData: {},
                landingChebyshevLoaded: {},
                planetProperties: {},
                ephemerisStatuses: {},
                resolveBodySource: vi.fn(),
                getActiveEphemerisSource: vi.fn(),
                sceneViewStateActions: {},
                AnimationScene: class AnimationScene {},
                bridgeActions: {},
                modeSwitchActions: {},
                animateLoop: vi.fn(),
                initAnimation: vi.fn(),
                isRelativeMode: vi.fn(),
                isTestMode: true,
            },
            { staticWireupDeps },
        );

        expect(entryContext.staticWireupDeps).toBe(staticWireupDeps);
        expect(entryContext.readPlaneSelection()).toBe("ZX");
        entryContext.toggleStatsVisibility();
        expect(readCheckedRadioValue).toHaveBeenCalledWith("plane", "DEFAULT");
        expect(toggleVisibilityById).toHaveBeenCalledWith("stats");
    });
});
