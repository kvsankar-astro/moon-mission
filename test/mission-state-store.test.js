import { describe, expect, it } from "vitest";
import { createMissionStateStore } from "../assets/platform/js/core/state/mission-state-store.js";

function createCell(initialValue) {
    let value = initialValue;
    return {
        get: () => value,
        set: (nextValue) => {
            value = nextValue;
        },
    };
}

function createReadonlyCell(value) {
    return {
        get: () => value,
        set: () => {},
    };
}

function createStateCells() {
    return {
        globalConfig: createCell({ phases: ["geo", "lunar"] }),
        config: createCell("geo"),
        currentDimension: createCell("3D"),
        previousDimension: createCell(null),
        dimensionChanged: createCell(false),
        svgContainer: createCell(null),
        dataLoaded: createCell(false),
        svgX: createCell(0),
        svgY: createCell(0),
        svgWidth: createCell(0),
        svgHeight: createCell(0),
        offsetx: createCell(0),
        offsety: createCell(0),
        landingDataLoaded: createCell(false),
        epochJD: createCell(null),
        epochDate: createCell(null),
        startTime: createCell(null),
        endTime: createCell(null),
        endTimeSC: createCell(null),
        latestEndTime: createCell(null),
        timelineTotalSteps: createCell(null),
        ticksPerAnimationStep: createCell(null),
        PIXELS_PER_AU: createCell(null),
        defaultCameraDistance: createCell(0),
        trackWidth: createCell(null),
        earthRadius: createCell(null),
        moonRadius: createCell(null),
        startLandingTime: createCell(null),
        endLandingTime: createCell(null),
        frameMode: createReadonlyCell("inertial"),
        animTime: createCell(0),
        craftData: createCell({}),
        eventInfos: createCell([]),
        ephemerisSource: createCell("chebyshev"),
        bodyEphemerisSources: createCell({}),
        timeTransLunarInjection: createCell(null),
        timeLunarOrbitInsertion: createCell(null),
        theSceneHandler: createCell(null),
        startLandingFlag: createCell(false),
        viewOrbit: createCell(true),
        viewOrbitDescent: createCell(false),
        viewCraters: createCell(false),
        viewXYZAxes: createCell(false),
        viewPoles: createCell(false),
        viewPolarAxes: createCell(false),
        viewSky: createCell(true),
        viewMoonSOI: createCell(false),
        viewEclipticPlane: createCell(false),
        viewEquatorialPlane: createCell(false),
        viewFPS: createCell(false),
        animDate: createCell(null),
        mousedownTimeout: createCell(0),
        timeoutHandleZoom: createCell(null),
        mouseDown: createCell(false),
        missionStartCalled: createCell(false),
        timeoutHandle: createReadonlyCell(null),
        animationRunning: createReadonlyCell(false),
        svgRect: createCell(null),
        sunLongitude: createCell(0),
        craftId: createReadonlyCell("SC"),
    };
}

function createStore() {
    const runtimeFlags = {
        joyRide: false,
        landing: false,
    };

    const animationScenes = {
        geo: { planetsForLocations: ["EARTH"] },
        lunar: { planetsForLocations: ["MOON"] },
    };

    const planeState = {
        xFactor: 1,
        yFactor: 1,
        xVariable: "x",
        yVariable: "y",
    };

    const state = createStateCells();

    return {
        runtimeFlags,
        store: createMissionStateStore({
            state,
            runtimeFlags,
            animationScenes,
            orbitDataProcessed: { geo: true, lunar: false },
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
            resolveBodySource: ({ bodyId }) => bodyId,
            getActiveEphemerisSource: () => "chebyshev",
            getPlaneVariablesState: () => planeState,
            getZoomFactorState: () => 1,
            getPanXState: () => 0,
            getPanYState: () => 0,
            getPlaneSelectionState: () => "DEFAULT",
            setPlaneVariablesState: (next) => {
                planeState.xFactor = next.xFactor;
                planeState.yFactor = next.yFactor;
                planeState.xVariable = next.xVariable;
                planeState.yVariable = next.yVariable;
            },
            getRuntimeBootstrapActions: () => ({
                toggleLanding: () => {},
            }),
            getAnimationSceneInitDone: () => true,
            syncPlaneStateForConfig: () => {},
        }),
    };
}

describe("createMissionStateStore", () => {
    it("updates and reads state without DOM dependencies", () => {
        const { store } = createStore();
        expect(store.getConfig()).toBe("geo");
        store.setConfig("lunar");
        expect(store.getConfig()).toBe("lunar");
    });

    it("manages runtime flags through state transitions", () => {
        const { store, runtimeFlags } = createStore();
        expect(store.getJoyRideFlag()).toBe(false);
        store.setJoyRideFlag(true);
        expect(store.getJoyRideFlag()).toBe(true);
        expect(runtimeFlags.joyRide).toBe(true);
    });

    it("does not expose UI or timer side effects", () => {
        const { store } = createStore();
        expect(store.setEventInfoText).toBeUndefined();
        expect(store.setEpochDisplay).toBeUndefined();
        expect(store.clearLegacyTimeout).toBeUndefined();
    });
});
