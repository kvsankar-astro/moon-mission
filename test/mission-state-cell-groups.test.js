import { describe, expect, it } from "vitest";

import {
    createMissionInteractionStateCells,
    createMissionSessionStateCells,
    createMissionViewStateCells,
} from "../src/platform/js/app/mission-state-cell-groups.js";

describe("mission state cell groups", () => {
    it("builds writable and readonly view-state cells", () => {
        const state = {
            config: "geo",
            currentDimension: "3D",
            previousDimension: "2D",
            dimensionChanged: false,
            viewAuxiliaryPanels: true,
            viewOrbit: true,
            viewOrbitDescent: false,
            viewCraters: false,
            viewLunarCraters: false,
            lunarCraterHoverLabels: true,
            lunarCraterDisplayMode: "hover",
            lunarCraterLimit: 120,
            viewXYZAxes: false,
            viewPoles: false,
            viewPolarAxes: false,
            viewSky: true,
            viewConstellationLines: false,
            viewMoonSOI: false,
            viewMoonHillSphere: false,
            viewBodyHalos: true,
            viewMoonOsculatingOrbit: false,
            viewEclipticPlane: false,
            viewEquatorialPlane: false,
            viewFPS: false,
            orbitStyle: "trail",
            trailTrackBrightness2D: 1,
            trailTrackBrightness3D: 0.5,
            trailTailBrightness2D: 0.25,
            trailTailBrightness3D: 0.1,
        };
        let effectiveOrbitStyle = "trail";
        const runtimeViewState = {
            getConfig: () => state.config,
            setConfig: (value) => { state.config = value; },
            getCurrentDimension: () => state.currentDimension,
            setCurrentDimension: (value) => { state.currentDimension = value; },
            getPreviousDimension: () => state.previousDimension,
            setPreviousDimension: (value) => { state.previousDimension = value; },
            getDimensionChanged: () => state.dimensionChanged,
            setDimensionChanged: (value) => { state.dimensionChanged = value; },
            getViewAuxiliaryPanels: () => state.viewAuxiliaryPanels,
            setViewAuxiliaryPanels: (value) => { state.viewAuxiliaryPanels = value; },
            getViewOrbit: () => state.viewOrbit,
            setViewOrbit: (value) => { state.viewOrbit = value; },
            getViewOrbitDescent: () => state.viewOrbitDescent,
            setViewOrbitDescent: (value) => { state.viewOrbitDescent = value; },
            getViewCraters: () => state.viewCraters,
            setViewCraters: (value) => { state.viewCraters = value; },
            getViewLunarCraters: () => state.viewLunarCraters,
            setViewLunarCraters: (value) => { state.viewLunarCraters = value; },
            getLunarCraterHoverLabels: () => state.lunarCraterHoverLabels,
            setLunarCraterHoverLabels: (value) => { state.lunarCraterHoverLabels = value; },
            getLunarCraterDisplayMode: () => state.lunarCraterDisplayMode,
            setLunarCraterDisplayMode: (value) => { state.lunarCraterDisplayMode = value; },
            getLunarCraterLimit: () => state.lunarCraterLimit,
            setLunarCraterLimit: (value) => { state.lunarCraterLimit = value; },
            getViewXYZAxes: () => state.viewXYZAxes,
            setViewXYZAxes: (value) => { state.viewXYZAxes = value; },
            getViewPoles: () => state.viewPoles,
            setViewPoles: (value) => { state.viewPoles = value; },
            getViewPolarAxes: () => state.viewPolarAxes,
            setViewPolarAxes: (value) => { state.viewPolarAxes = value; },
            getViewSky: () => state.viewSky,
            setViewSky: (value) => { state.viewSky = value; },
            getViewConstellationLines: () => state.viewConstellationLines,
            setViewConstellationLines: (value) => { state.viewConstellationLines = value; },
            getViewMoonSOI: () => state.viewMoonSOI,
            setViewMoonSOI: (value) => { state.viewMoonSOI = value; },
            getViewMoonHillSphere: () => state.viewMoonHillSphere,
            setViewMoonHillSphere: (value) => { state.viewMoonHillSphere = value; },
            getViewBodyHalos: () => state.viewBodyHalos,
            setViewBodyHalos: (value) => { state.viewBodyHalos = value; },
            getViewMoonOsculatingOrbit: () => state.viewMoonOsculatingOrbit,
            setViewMoonOsculatingOrbit: (value) => { state.viewMoonOsculatingOrbit = value; },
            getViewEclipticPlane: () => state.viewEclipticPlane,
            setViewEclipticPlane: (value) => { state.viewEclipticPlane = value; },
            getViewEquatorialPlane: () => state.viewEquatorialPlane,
            setViewEquatorialPlane: (value) => { state.viewEquatorialPlane = value; },
            getViewFPS: () => state.viewFPS,
            setViewFPS: (value) => { state.viewFPS = value; },
            getOrbitStyle: () => state.orbitStyle,
            setOrbitStyle: (value) => { state.orbitStyle = value; },
            getTrailTrackBrightness2D: () => state.trailTrackBrightness2D,
            setTrailTrackBrightness2D: (value) => { state.trailTrackBrightness2D = value; },
            getTrailTrackBrightness3D: () => state.trailTrackBrightness3D,
            setTrailTrackBrightness3D: (value) => { state.trailTrackBrightness3D = value; },
            getTrailTailBrightness2D: () => state.trailTailBrightness2D,
            setTrailTailBrightness2D: (value) => { state.trailTailBrightness2D = value; },
            getTrailTailBrightness3D: () => state.trailTailBrightness3D,
            setTrailTailBrightness3D: (value) => { state.trailTailBrightness3D = value; },
        };

        const cells = createMissionViewStateCells(
            runtimeViewState,
            () => effectiveOrbitStyle,
        );

        expect(cells.config.get()).toBe("geo");
        cells.config.set("lunar");
        expect(state.config).toBe("lunar");

        expect(cells.viewOrbit.get()).toBe(true);
        cells.viewOrbit.set(false);
        expect(state.viewOrbit).toBe(false);
        cells.viewLunarCraters.set(true);
        expect(state.viewLunarCraters).toBe(true);
        cells.lunarCraterHoverLabels.set(false);
        cells.lunarCraterDisplayMode.set("always");
        cells.lunarCraterLimit.set(250);
        expect(state.lunarCraterHoverLabels).toBe(false);
        expect(state.lunarCraterDisplayMode).toBe("always");
        expect(state.lunarCraterLimit).toBe(250);

        expect(cells.effectiveOrbitStyle.get()).toBe("trail");
        effectiveOrbitStyle = "classic";
        expect(cells.effectiveOrbitStyle.get()).toBe("classic");
        cells.effectiveOrbitStyle.set("ignored");
        expect(cells.effectiveOrbitStyle.get()).toBe("classic");
    });

    it("builds session and interaction state cells with the expected mutability", () => {
        const sessionState = {
            animTime: 100,
            animationRunning: true,
        };
        const interactionState = {
            startLandingFlag: false,
            mousedownTimeout: 25,
            timeoutHandleZoom: null,
            mouseDown: false,
            missionStartCalled: false,
            legacyTimeoutHandle: 42,
        };
        const runtimeSessionState = {
            getAnimTime: () => sessionState.animTime,
            setAnimTime: (value) => { sessionState.animTime = value; },
            getAnimationRunning: () => sessionState.animationRunning,
        };
        const runtimeInteractionState = {
            getStartLandingFlag: () => interactionState.startLandingFlag,
            setStartLandingFlag: (value) => { interactionState.startLandingFlag = value; },
            getMouseDownTimeout: () => interactionState.mousedownTimeout,
            setMouseDownTimeout: (value) => { interactionState.mousedownTimeout = value; },
            getTimeoutHandleZoom: () => interactionState.timeoutHandleZoom,
            setTimeoutHandleZoom: (value) => { interactionState.timeoutHandleZoom = value; },
            getMouseDown: () => interactionState.mouseDown,
            setMouseDown: (value) => { interactionState.mouseDown = value; },
            getMissionStartCalled: () => interactionState.missionStartCalled,
            setMissionStartCalled: (value) => { interactionState.missionStartCalled = value; },
            getLegacyTimeoutHandle: () => interactionState.legacyTimeoutHandle,
        };

        const sessionCells = createMissionSessionStateCells(runtimeSessionState);
        const interactionCells = createMissionInteractionStateCells(runtimeInteractionState);

        sessionCells.animTime.set(250);
        expect(sessionState.animTime).toBe(250);
        sessionCells.animationRunning.set(false);
        expect(sessionState.animationRunning).toBe(true);

        interactionCells.startLandingFlag.set(true);
        interactionCells.timeoutHandleZoom.set("zoom-timeout");
        interactionCells.timeoutHandle.set("ignored");

        expect(interactionState.startLandingFlag).toBe(true);
        expect(interactionState.timeoutHandleZoom).toBe("zoom-timeout");
        expect(interactionState.legacyTimeoutHandle).toBe(42);
    });
});
