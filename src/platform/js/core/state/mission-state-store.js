import { resolveLandingDataOriginKeys } from "../domain/origin-compat.js";

function createMissionStateStore(ctx) {
    const {
        state,
        runtimeFlags,
        animationScenes,
        orbitDataProcessed,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        planetProperties,
        ephemerisStatuses,
        resolveBodySource,
        getActiveEphemerisSource,
        getPlaneVariablesState,
        getZoomFactorState,
        getPanXState,
        getPanYState,
        getPlaneSelectionState,
        setPlaneVariablesState,
        getRuntimeBootstrapActions,
        getAnimationSceneInitDone,
        syncPlaneStateForConfig,
    } = ctx;

    const getState = (key) => state[key].get();
    const setState = (key, value) => state[key].set(value);
    const setBooleanStateIfDefined = (key, value) => {
        if (value === undefined) return;
        setState(key, Boolean(value));
    };

    return {
        getGlobalConfig: () => getState("globalConfig"),
        setGlobalConfig: (value) => {
            setState("globalConfig", value);
        },
        getConfig: () => getState("config"),
        setConfig: (val) => {
            setState("config", val);
        },
        getCurrentDimension: () => getState("currentDimension"),
        setCurrentDimension: (val) => {
            setState("currentDimension", val);
        },
        getPreviousDimension: () => getState("previousDimension"),
        setPreviousDimension: (val) => {
            setState("previousDimension", val);
        },
        setDimensionChanged: (val) => {
            setState("dimensionChanged", val);
        },
        getDimensionChanged: () => getState("dimensionChanged"),
        setSvgContainer: (val) => {
            setState("svgContainer", val);
        },
        getSvgContainer: () => getState("svgContainer"),
        setDataLoaded: (val) => {
            setState("dataLoaded", val);
        },
        getDataLoaded: () => getState("dataLoaded"),
        setSvgX: (val) => {
            setState("svgX", val);
        },
        setSvgY: (val) => {
            setState("svgY", val);
        },
        setSvgWidth: (val) => {
            setState("svgWidth", val);
        },
        getSvgWidth: () => getState("svgWidth"),
        setSvgHeight: (val) => {
            setState("svgHeight", val);
        },
        getSvgHeight: () => getState("svgHeight"),
        setOffsetX: (val) => {
            setState("offsetx", val);
        },
        setOffsetY: (val) => {
            setState("offsety", val);
        },
        getOffsetX: () => getState("offsetx"),
        getOffsetY: () => getState("offsety"),
        getEphemerisSource: () => getState("ephemerisSource"),
        getBodiesForConfig: (cfg = getState("config")) => animationScenes[cfg]?.planetsForLocations || [],
        getBodySource: (bodyId) =>
            resolveBodySource({
                bodyId,
                bodySources: getState("bodyEphemerisSources"),
                defaultSpacecraftSource: getState("ephemerisSource"),
            }),
        getConfigsList: () => {
            const fallbackOrigins = Object.keys(animationScenes);
            return resolveLandingDataOriginKeys(getState("globalConfig"), {
                fallbackOriginKeys: fallbackOrigins,
            });
        },
        getLandingDataLoaded: () => getState("landingDataLoaded"),
        setLandingDataLoaded: (val) => {
            setState("landingDataLoaded", val);
        },
        setLandingNpzLoaded: (cfg, val) => {
            landingNpzLoaded[cfg] = val;
        },
        setLandingNpzData: (cfg, val) => {
            landingNpzData[cfg] = val;
        },
        setLandingChebyshevLoaded: (cfg, val) => {
            landingChebyshevLoaded[cfg] = val;
        },
        setLandingChebyshevData: (cfg, val) => {
            landingChebyshevData[cfg] = val;
        },
        getZoomFactor: () => getZoomFactorState(getState("config")),
        setEpochJD: (val) => {
            setState("epochJD", val);
        },
        setEpochDate: (val) => {
            setState("epochDate", val);
        },
        getStartTime: () => getState("startTime"),
        setStartTime: (value) => {
            setState("startTime", value);
        },
        getEndTimeSC: () => getState("endTimeSC"),
        setEndTime: (value) => {
            setState("endTime", value);
        },
        setEndTimeSC: (value) => {
            setState("endTimeSC", value);
        },
        setLatestEndTime: (value) => {
            setState("latestEndTime", value);
        },
        getLatestEndTime: () => getState("latestEndTime"),
        setTimelineTotalSteps: (value) => {
            setState("timelineTotalSteps", value);
        },
        setTicksPerAnimationStep: (value) => {
            setState("ticksPerAnimationStep", value);
        },
        setPixelsPerAU: (value) => {
            setState("PIXELS_PER_AU", value);
        },
        getPixelsPerAU: () => getState("PIXELS_PER_AU"),
        setDefaultCameraDistance: (value) => {
            setState("defaultCameraDistance", value);
        },
        getDefaultCameraDistance: () => getState("defaultCameraDistance"),
        setTrackWidth: (value) => {
            setState("trackWidth", value);
        },
        setEarthRadius: (value) => {
            setState("earthRadius", value);
        },
        getEarthRadius: () => getState("earthRadius"),
        setMoonRadius: (value) => {
            setState("moonRadius", value);
        },
        getMoonRadius: () => getState("moonRadius"),
        getStartLandingTime: () => getState("startLandingTime"),
        setStartLandingTime: (value) => {
            setState("startLandingTime", value);
        },
        getEndLandingTime: () => getState("endLandingTime"),
        setEndLandingTime: (value) => {
            setState("endLandingTime", value);
        },
        getLandingNpzLoaded: (cfg = getState("config")) => !!landingNpzLoaded[cfg],
        getLandingNpzData: (cfg = getState("config")) => landingNpzData[cfg],
        getLandingChebyshevLoaded: (cfg = getState("config")) => !!landingChebyshevLoaded[cfg],
        getLandingChebyshevData: (cfg = getState("config")) => landingChebyshevData[cfg],
        getFrameMode: () => getState("frameMode"),
        getActiveEphemerisSource,
        resolveBodySourceFn: (bodyId) =>
            resolveBodySource({
                bodyId,
                bodySources: getState("bodyEphemerisSources"),
                defaultSpacecraftSource: getState("ephemerisSource"),
            }),
        getJoyRideFlag: () => runtimeFlags.joyRide,
        setJoyRideFlag: (val) => {
            runtimeFlags.joyRide = val;
        },
        getLandingFlag: () => runtimeFlags.landing,
        setLandingFlag: (val) => {
            runtimeFlags.landing = val;
        },
        getAnimTime: () => getState("animTime"),
        setAnimTime: (val) => {
            setState("animTime", val);
        },
        getPlaneVariables: () => {
            const vars = getPlaneVariablesState(getState("config"));
            return {
                xFactor: vars.xFactor,
                yFactor: vars.yFactor,
                xVariable: vars.xVariable,
                yVariable: vars.yVariable,
            };
        },
        getEpochJD: () => getState("epochJD"),
        getEpochDate: () => getState("epochDate"),
        getXFactor: () => getPlaneVariablesState(getState("config")).xFactor,
        getYFactor: () => getPlaneVariablesState(getState("config")).yFactor,
        getXVariable: () => getPlaneVariablesState(getState("config")).xVariable,
        getYVariable: () => getPlaneVariablesState(getState("config")).yVariable,
        getCraftData: () => getState("craftData"),
        setCraftData: (value) => {
            setState("craftData", value);
        },
        getPanX: () => getPanXState(getState("config")),
        getPanY: () => getPanYState(getState("config")),
        getPlaneSelection: () => getPlaneSelectionState(getState("config")),
        setPlaneVariables: (planeConfig) => {
            setPlaneVariablesState(planeConfig, getState("config"));
        },
        getPlanetProperties: () => planetProperties,
        setEventInfos: (value) => {
            setState("eventInfos", value);
        },
        getEventInfos: () => getState("eventInfos"),
        getEphemerisSourceFromData: () => getState("ephemerisSource"),
        setEphemerisSource: (value) => {
            setState("ephemerisSource", value);
        },
        setBodyEphemerisSources: (value) => {
            setState("bodyEphemerisSources", value);
        },
        setEphemerisStatusesForConfig: (cfg, status) => {
            ephemerisStatuses[cfg] = status;
        },
        setTimeTransLunarInjection: (value) => {
            setState("timeTransLunarInjection", value);
        },
        getTimeTransLunarInjection: () => getState("timeTransLunarInjection"),
        setTimeLunarOrbitInsertion: (value) => {
            setState("timeLunarOrbitInsertion", value);
        },
        getTimeLunarOrbitInsertion: () => getState("timeLunarOrbitInsertion"),
        getSceneHandler: () => getState("theSceneHandler"),
        setSceneHandler: (value) => {
            setState("theSceneHandler", value);
        },
        getBurnButtonHandler: () => getRuntimeBootstrapActions()?.burnButtonHandler,
        setSceneState: (cfg, stateValue) => {
            if (animationScenes[cfg]) {
                animationScenes[cfg].state = stateValue;
            }
        },
        getSceneStateInitDone: () => getAnimationSceneInitDone(),
        getStartLandingFlag: () => getState("startLandingFlag"),
        clearStartLandingFlag: () => {
            setState("startLandingFlag", false);
        },
        toggleLanding: () => getRuntimeBootstrapActions().toggleLanding(),
        setViewFlags: (view = {}) => {
            setBooleanStateIfDefined("viewAuxiliaryPanels", view.viewAuxiliaryPanels);
            setBooleanStateIfDefined("viewOrbit", view.viewOrbit);
            setBooleanStateIfDefined("viewOrbitDescent", view.viewOrbitDescent);
            setBooleanStateIfDefined("viewCraters", view.viewCraters);
            setBooleanStateIfDefined("viewXYZAxes", view.viewXYZAxes);
            setBooleanStateIfDefined("viewPoles", view.viewPoles);
            setBooleanStateIfDefined("viewPolarAxes", view.viewPolarAxes);
            setBooleanStateIfDefined("viewSky", view.viewSky);
            setBooleanStateIfDefined("viewConstellationLines", view.viewConstellationLines);
            setBooleanStateIfDefined("viewMoonSOI", view.viewMoonSOI);
            setBooleanStateIfDefined("viewMoonHillSphere", view.viewMoonHillSphere);
            setBooleanStateIfDefined("viewBodyHalos", view.viewBodyHalos);
            setBooleanStateIfDefined("viewMoonOsculatingOrbit", view.viewMoonOsculatingOrbit);
            setBooleanStateIfDefined("viewEclipticPlane", view.viewEclipticPlane);
            setBooleanStateIfDefined("viewEquatorialPlane", view.viewEquatorialPlane);
            setBooleanStateIfDefined("viewFPS", view.viewFPS);
            if (view.orbitStyle === "classic" || view.orbitStyle === "trail") {
                setState("orbitStyle", view.orbitStyle);
            }
            if (Number.isFinite(view.trailTrackBrightness2D)) {
                setState("trailTrackBrightness2D", view.trailTrackBrightness2D);
            }
            if (Number.isFinite(view.trailTrackBrightness3D)) {
                setState("trailTrackBrightness3D", view.trailTrackBrightness3D);
            }
            if (Number.isFinite(view.trailTailBrightness2D)) {
                setState("trailTailBrightness2D", view.trailTailBrightness2D);
            }
            if (Number.isFinite(view.trailTailBrightness3D)) {
                setState("trailTailBrightness3D", view.trailTailBrightness3D);
            }
        },
        onConfigChanged: (newConfig) => {
            syncPlaneStateForConfig(newConfig);
        },
        getAnimDate: () => getState("animDate"),
        setAnimDate: (value) => {
            setState("animDate", value);
        },
        getPlaneVariablesStateForConfig: () => getPlaneVariablesState(getState("config")),
        getZoomFactorStateForConfig: () => getZoomFactorState(getState("config")),
        getPanXStateForConfig: () => getPanXState(getState("config")),
        getPanYStateForConfig: () => getPanYState(getState("config")),
        isOrbitDataProcessed: (cfg) => orbitDataProcessed[cfg],
        getChebyshevData: () => chebyshevData,
        getChebyshevDataLoaded: () => chebyshevDataLoaded,
        getNpzData: () => npzData,
        getNpzDataLoaded: () => npzDataLoaded,
        getLandingNpzDataByConfig: (cfg) => landingNpzData[cfg],
        getLandingNpzLoadedByConfig: (cfg) => landingNpzLoaded[cfg],
        getLandingChebyshevDataByConfig: (cfg) => landingChebyshevData[cfg],
        getLandingChebyshevLoadedByConfig: (cfg) => landingChebyshevLoaded[cfg],
        getMissionTimes: () => ({
            timeTransLunarInjection: getState("timeTransLunarInjection"),
            timeLunarOrbitInsertion: getState("timeLunarOrbitInsertion"),
        }),
        getBodySources: () => getState("bodyEphemerisSources"),
        getActiveEphemerisSourceForConfig: (cfg) => getActiveEphemerisSource(cfg),
        setSunLongitude: (value) => {
            setState("sunLongitude", value);
        },
        getCraftId: () => getState("craftId"),
        getAnimationScenes: () => animationScenes,
        getMouseDownTimeout: () => getState("mousedownTimeout"),
        setMouseDownTimeout: (val) => {
            setState("mousedownTimeout", val);
        },
        getTimeoutHandleZoom: () => getState("timeoutHandleZoom"),
        setTimeoutHandleZoom: (handle) => {
            setState("timeoutHandleZoom", handle);
        },
        setMouseDown: (value) => {
            setState("mouseDown", value);
        },
        getViewSky: () => getState("viewSky"),
        getViewConstellationLines: () => getState("viewConstellationLines"),
        getOrbitStyle: () => getState("orbitStyle"),
        getEffectiveOrbitStyle: () =>
            typeof state.effectiveOrbitStyle?.get === "function"
                ? state.effectiveOrbitStyle.get()
                : getState("orbitStyle"),
        getTrailTrackBrightness2D: () => getState("trailTrackBrightness2D"),
        getTrailTrackBrightness3D: () => getState("trailTrackBrightness3D"),
        getTrailTailBrightness2D: () => getState("trailTailBrightness2D"),
        getTrailTailBrightness3D: () => getState("trailTailBrightness3D"),
        setMissionStartCalled: (val) => {
            setState("missionStartCalled", val);
        },
        getMissionStartCalled: () => getState("missionStartCalled"),
        getAnimationRunning: () => getState("animationRunning"),
        setSvgRect: (val) => {
            setState("svgRect", val);
        },
        getLegacyTimeoutHandle: () => getState("timeoutHandle"),
    };
}

export { createMissionStateStore };

