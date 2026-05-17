import { describe, expect, it, vi } from "vitest";
import {
    createMissionStatePorts,
    createMissionStateStore,
    flattenMissionStatePorts,
} from "../src/platform/js/core/state/mission-state-store.js";

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
        globalConfig: createCell({ origins: ["geo", "lunar"] }),
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
        viewLunarCraters: createCell(false),
        lunarCraterShowAllEnabled: createCell(false),
        lunarCraterHoverEnabled: createCell(false),
        viewMoonLatLonGrid: createCell(false),
        viewMoonLatLonLabels: createCell(true),
        viewMoonLatLonHover: createCell(false),
        lunarCraterHoverLabels: createCell(true),
        lunarCraterDisplayMode: createCell("hover"),
        lunarCraterMinDiameterKm: createCell(80),
        lunarCraterMaxDiameterKm: createCell(600),
        lunarCraterHoverMinDiameterKm: createCell(0),
        lunarCraterHoverMaxDiameterKm: createCell(600),
        lunarFeatureTypeFilters: createCell({}),
        lunarFeatureSearchQuery: createCell(""),
        lunarFeatureExcludedKeys: createCell([]),
        lunarFeatureHoverTypeFilters: createCell({}),
        lunarFeatureHoverSearchQuery: createCell(""),
        lunarFeatureHoverExcludedKeys: createCell([]),
        viewXYZAxes: createCell(false),
        viewPoles: createCell(false),
        viewPolarAxes: createCell(false),
        viewSky: createCell(true),
        viewConstellationLines: createCell(false),
        viewMoonSOI: createCell(false),
        viewMoonHillSphere: createCell(false),
        viewMoonOsculatingOrbit: createCell(false),
        viewBodyHalos: createCell(true),
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

function createStore(overrides = {}) {
    const runtimeFlags =
        overrides.runtimeFlags ||
        {
            joyRide: false,
            landing: false,
        };

    const animationScenes =
        overrides.animationScenes ||
        {
            geo: { planetsForLocations: ["EARTH"] },
            lunar: { planetsForLocations: ["MOON"] },
        };

    const planeState =
        overrides.planeState ||
        {
            xFactor: 1,
            yFactor: 1,
            xVariable: "x",
            yVariable: "y",
        };

    const state = overrides.state || createStateCells();
    const landingNpzData = overrides.landingNpzData || {};
    const landingNpzLoaded = overrides.landingNpzLoaded || {};
    const landingChebyshevData = overrides.landingChebyshevData || {};
    const landingChebyshevLoaded = overrides.landingChebyshevLoaded || {};
    const runtimeBootstrapActions =
        overrides.runtimeBootstrapActions ||
        {
            toggleLanding: () => {},
        };
    const syncPlaneStateForConfig = overrides.syncPlaneStateForConfig || (() => {});

    return {
        runtimeFlags,
        state,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        runtimeBootstrapActions,
        syncPlaneStateForConfig,
        store: createMissionStateStore({
            state,
            runtimeFlags,
            animationScenes,
            orbitDataProcessed: overrides.orbitDataProcessed || { geo: true, lunar: false },
            chebyshevData: overrides.chebyshevData || {},
            chebyshevDataLoaded: overrides.chebyshevDataLoaded || {},
            npzData: overrides.npzData || {},
            npzDataLoaded: overrides.npzDataLoaded || {},
            landingNpzData,
            landingNpzLoaded,
            landingChebyshevData,
            landingChebyshevLoaded,
            planetProperties: overrides.planetProperties || {},
            ephemerisStatuses: overrides.ephemerisStatuses || {},
            resolveBodySource: overrides.resolveBodySource || (({ bodyId }) => bodyId),
            getActiveEphemerisSource: overrides.getActiveEphemerisSource || (() => "chebyshev"),
            getPlaneVariablesState: overrides.getPlaneVariablesState || (() => planeState),
            getZoomFactorState: overrides.getZoomFactorState || (() => 1),
            getPanXState: overrides.getPanXState || (() => 0),
            getPanYState: overrides.getPanYState || (() => 0),
            getPlaneSelectionState: overrides.getPlaneSelectionState || (() => "DEFAULT"),
            setPlaneVariablesState:
                overrides.setPlaneVariablesState ||
                ((next) => {
                    planeState.xFactor = next.xFactor;
                    planeState.yFactor = next.yFactor;
                    planeState.xVariable = next.xVariable;
                    planeState.yVariable = next.yVariable;
                }),
            getRuntimeBootstrapActions: overrides.getRuntimeBootstrapActions || (() => runtimeBootstrapActions),
            getAnimationSceneInitDone: overrides.getAnimationSceneInitDone || (() => true),
            syncPlaneStateForConfig,
        }),
    };
}

function createPorts(overrides = {}) {
    const storeContext = createStore(overrides);
    return {
        ...storeContext,
        ports: createMissionStatePorts({
            state: storeContext.state,
            runtimeFlags: storeContext.runtimeFlags,
            animationScenes: overrides.animationScenes || {
                geo: { planetsForLocations: ["EARTH"] },
                lunar: { planetsForLocations: ["MOON"] },
            },
            orbitDataProcessed: overrides.orbitDataProcessed || { geo: true, lunar: false },
            chebyshevData: overrides.chebyshevData || {},
            chebyshevDataLoaded: overrides.chebyshevDataLoaded || {},
            npzData: overrides.npzData || {},
            npzDataLoaded: overrides.npzDataLoaded || {},
            landingNpzData: storeContext.landingNpzData,
            landingNpzLoaded: storeContext.landingNpzLoaded,
            landingChebyshevData: storeContext.landingChebyshevData,
            landingChebyshevLoaded: storeContext.landingChebyshevLoaded,
            planetProperties: overrides.planetProperties || {},
            ephemerisStatuses: overrides.ephemerisStatuses || {},
            resolveBodySource: overrides.resolveBodySource || (({ bodyId }) => bodyId),
            getActiveEphemerisSource: overrides.getActiveEphemerisSource || (() => "chebyshev"),
            getPlaneVariablesState: overrides.getPlaneVariablesState || (() => ({
                xFactor: 1,
                yFactor: 1,
                xVariable: "x",
                yVariable: "y",
            })),
            getZoomFactorState: overrides.getZoomFactorState || (() => 1),
            getPanXState: overrides.getPanXState || (() => 0),
            getPanYState: overrides.getPanYState || (() => 0),
            getPlaneSelectionState: overrides.getPlaneSelectionState || (() => "DEFAULT"),
            setPlaneVariablesState: overrides.setPlaneVariablesState || (() => {}),
            getRuntimeBootstrapActions:
                overrides.getRuntimeBootstrapActions ||
                (() => storeContext.runtimeBootstrapActions),
            getAnimationSceneInitDone: overrides.getAnimationSceneInitDone || (() => true),
            syncPlaneStateForConfig: storeContext.syncPlaneStateForConfig,
        }),
    };
}

describe("createMissionStateStore", () => {
    it("keeps the flat store as a compatibility wrapper around explicit state ports", () => {
        const { ports } = createPorts();
        const store = flattenMissionStatePorts(ports);

        expect(store.getConfig).toBe(ports.app.getConfig);
        expect(store.setConfig).toBe(ports.app.setConfig);
        expect(store.getEventInfos).toBe(ports.data.getEventInfos);
        expect(store.setAnimTime).toBe(ports.session.setAnimTime);
        expect(store.getViewSky).toBe(ports.sceneView.getViewSky);
        expect(store.toggleLanding).toBe(ports.sceneRuntime.toggleLanding);
        expect(store.getMissionStartCalled).toBe(ports.interaction.getMissionStartCalled);
    });

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

    it("falls back to animation scene keys when global config has no origins", () => {
        const { store } = createStore({
            animationScenes: {
                phaseA: { planetsForLocations: ["EARTH"] },
                phaseB: { planetsForLocations: ["MOON"] },
            },
        });

        store.setGlobalConfig({});

        expect(store.getConfigsList()).toEqual(["phaseA", "phaseB"]);
    });

    it("uses configured global origins and excludes landing in getConfigsList", () => {
        const { store } = createStore({
            animationScenes: {
                fallbackA: { planetsForLocations: ["EARTH"] },
                fallbackB: { planetsForLocations: ["MOON"] },
            },
        });

        store.setGlobalConfig({ origins: ["geo", "landing", "lunar"] });

        expect(store.getConfigsList()).toEqual(["geo", "lunar"]);
    });

    it("setViewFlags updates every view state cell", () => {
        const { store, state } = createStore();
        const nextFlags = {
            viewOrbit: false,
            viewOrbitDescent: true,
            viewCraters: true,
            viewLunarCraters: true,
            viewMoonLatLonGrid: true,
            viewMoonLatLonLabels: false,
            viewMoonLatLonHover: true,
            lunarCraterHoverLabels: false,
            lunarCraterDisplayMode: "always",
            lunarCraterMinDiameterKm: 40,
            lunarCraterMaxDiameterKm: 120,
            viewXYZAxes: true,
            viewPoles: true,
            viewPolarAxes: true,
            viewSky: false,
            viewConstellationLines: false,
            viewMoonSOI: true,
            viewMoonHillSphere: true,
            viewMoonOsculatingOrbit: true,
            viewBodyHalos: false,
            viewEclipticPlane: true,
            viewEquatorialPlane: true,
            viewFPS: true,
        };

        store.setViewFlags(nextFlags);

        expect(state.viewOrbit.get()).toBe(false);
        expect(state.viewOrbitDescent.get()).toBe(true);
        expect(state.viewCraters.get()).toBe(true);
        expect(state.viewLunarCraters.get()).toBe(true);
        expect(state.viewMoonLatLonGrid.get()).toBe(true);
        expect(state.viewMoonLatLonLabels.get()).toBe(false);
        expect(state.viewMoonLatLonHover.get()).toBe(true);
        expect(state.lunarCraterHoverLabels.get()).toBe(false);
        expect(state.lunarCraterDisplayMode.get()).toBe("always");
        expect(state.lunarCraterMinDiameterKm.get()).toBe(40);
        expect(state.lunarCraterMaxDiameterKm.get()).toBe(120);
        expect(state.viewXYZAxes.get()).toBe(true);
        expect(state.viewPoles.get()).toBe(true);
        expect(state.viewPolarAxes.get()).toBe(true);
        expect(state.viewSky.get()).toBe(false);
        expect(state.viewConstellationLines.get()).toBe(false);
        expect(state.viewMoonSOI.get()).toBe(true);
        expect(state.viewMoonHillSphere.get()).toBe(true);
        expect(state.viewMoonOsculatingOrbit.get()).toBe(true);
        expect(state.viewBodyHalos.get()).toBe(false);
        expect(state.viewEclipticPlane.get()).toBe(true);
        expect(state.viewEquatorialPlane.get()).toBe(true);
        expect(state.viewFPS.get()).toBe(true);
    });

    it("setViewFlags preserves unspecified view state cells when patch is partial", () => {
        const { store, state } = createStore();
        state.viewOrbit.set(true);
        state.viewSky.set(true);
        state.viewConstellationLines.set(true);

        store.setViewFlags({
            viewSky: false,
        });

        expect(state.viewSky.get()).toBe(false);
        expect(state.viewOrbit.get()).toBe(true);
        expect(state.viewConstellationLines.get()).toBe(true);
    });

    it("onConfigChanged delegates to syncPlaneStateForConfig with new config", () => {
        const syncPlaneStateForConfig = vi.fn();
        const { store } = createStore({ syncPlaneStateForConfig });

        store.onConfigChanged("lunar");

        expect(syncPlaneStateForConfig).toHaveBeenCalledTimes(1);
        expect(syncPlaneStateForConfig).toHaveBeenCalledWith("lunar");
    });

    it("passes body sources and default source to getBodySource and resolveBodySourceFn", () => {
        const resolveBodySource = vi.fn(({ bodyId, bodySources, defaultSpacecraftSource }) => {
            return bodySources[bodyId] || defaultSpacecraftSource;
        });
        const { store } = createStore({ resolveBodySource });

        store.setBodyEphemerisSources({ MOON: "npz" });
        store.setEphemerisSource("chebyshev");

        expect(store.getBodySource("MOON")).toBe("npz");
        expect(store.resolveBodySourceFn("EARTH")).toBe("chebyshev");
        expect(resolveBodySource).toHaveBeenNthCalledWith(1, {
            bodyId: "MOON",
            bodySources: { MOON: "npz" },
            defaultSpacecraftSource: "chebyshev",
        });
        expect(resolveBodySource).toHaveBeenNthCalledWith(2, {
            bodyId: "EARTH",
            bodySources: { MOON: "npz" },
            defaultSpacecraftSource: "chebyshev",
        });
    });

    it("stores and reads landing data buckets per config through explicit and active config getters", () => {
        const { store } = createStore();

        store.setLandingNpzLoaded("geo", true);
        store.setLandingNpzData("geo", { phase: "geo-npz" });
        store.setLandingNpzLoaded("lunar", false);
        store.setLandingNpzData("lunar", { phase: "lunar-npz" });
        store.setLandingChebyshevLoaded("geo", false);
        store.setLandingChebyshevData("geo", { phase: "geo-cheb" });
        store.setLandingChebyshevLoaded("lunar", true);
        store.setLandingChebyshevData("lunar", { phase: "lunar-cheb" });

        expect(store.getLandingNpzDataByConfig("geo")).toEqual({ phase: "geo-npz" });
        expect(store.getLandingNpzDataByConfig("lunar")).toEqual({ phase: "lunar-npz" });
        expect(store.getLandingNpzLoadedByConfig("geo")).toBe(true);
        expect(store.getLandingNpzLoadedByConfig("lunar")).toBe(false);
        expect(store.getLandingChebyshevDataByConfig("geo")).toEqual({ phase: "geo-cheb" });
        expect(store.getLandingChebyshevDataByConfig("lunar")).toEqual({ phase: "lunar-cheb" });
        expect(store.getLandingChebyshevLoadedByConfig("geo")).toBe(false);
        expect(store.getLandingChebyshevLoadedByConfig("lunar")).toBe(true);

        store.setConfig("geo");
        expect(store.getLandingNpzLoaded()).toBe(true);
        expect(store.getLandingNpzData()).toEqual({ phase: "geo-npz" });
        expect(store.getLandingChebyshevLoaded()).toBe(false);
        expect(store.getLandingChebyshevData()).toEqual({ phase: "geo-cheb" });

        store.setConfig("lunar");
        expect(store.getLandingNpzLoaded()).toBe(false);
        expect(store.getLandingNpzData()).toEqual({ phase: "lunar-npz" });
        expect(store.getLandingChebyshevLoaded()).toBe(true);
        expect(store.getLandingChebyshevData()).toEqual({ phase: "lunar-cheb" });
    });

    it("toggleLanding delegates to runtime bootstrap actions", () => {
        const toggleLanding = vi.fn();
        const { store } = createStore({
            runtimeBootstrapActions: { toggleLanding },
        });

        store.toggleLanding();

        expect(toggleLanding).toHaveBeenCalledTimes(1);
    });
});

describe("createMissionStatePorts", () => {
    it("exposes the split runtime ports without UI or timer side effects", () => {
        const { ports } = createPorts();

        expect(Object.keys(ports).sort()).toEqual([
            "app",
            "data",
            "interaction",
            "sceneRuntime",
            "sceneView",
            "session",
        ]);
        expect(ports.app.getConfig()).toBe("geo");
        expect(ports.session.getJoyRideFlag()).toBe(false);
        expect(ports.data.getEphemerisSource()).toBe("chebyshev");
        expect(ports.sceneRuntime.getSceneHandler()).toBeNull();
        expect(ports.interaction.getLegacyTimeoutHandle()).toBeNull();
        expect(ports.app.setEventInfoText).toBeUndefined();
        expect(ports.session.clearLegacyTimeout).toBeUndefined();
    });
});

