import {
    createMissionLocalStateCells,
    createMissionStateCells,
} from "./mission-state-access.js";

const MISSION_LEGACY_MUTABLE_STATE_KEYS = [
    "globalConfig",
    "svgContainer",
    "dataLoaded",
    "svgX",
    "svgY",
    "svgWidth",
    "svgHeight",
    "offsetx",
    "offsety",
    "landingDataLoaded",
    "epochJD",
    "epochDate",
    "startTime",
    "endTime",
    "endTimeSC",
    "latestEndTime",
    "timelineTotalSteps",
    "ticksPerAnimationStep",
    "PIXELS_PER_AU",
    "defaultCameraDistance",
    "trackWidth",
    "earthRadius",
    "moonRadius",
    "startLandingTime",
    "endLandingTime",
    "craftData",
    "eventInfos",
    "ephemerisSource",
    "bodyEphemerisSources",
    "timeTransLunarInjection",
    "timeLunarOrbitInsertion",
    "theSceneHandler",
    "animDate",
    "svgRect",
    "sunLongitude",
];

function createMutableStateAccessors(localStateBindings) {
    return Object.fromEntries(
        MISSION_LEGACY_MUTABLE_STATE_KEYS.map((key) => {
            const binding = localStateBindings[key];
            return [key, [binding.get, binding.set]];
        }),
    );
}

function createReadonlyStateAccessors(readonlyStateBindings) {
    return Object.fromEntries(
        Object.entries(readonlyStateBindings).map(([key, get]) => [key, get]),
    );
}

function createMissionLegacyStateCells({
    localStateBindings,
    readonlyStateBindings,
    runtimeViewState,
    runtimeSessionState,
    runtimeInteractionState,
    getEffectiveOrbitStyle,
    createMissionLocalStateCellsImpl = createMissionLocalStateCells,
    createMissionStateCellsImpl = createMissionStateCells,
}) {
    return createMissionStateCellsImpl({
        localStateCells: createMissionLocalStateCellsImpl({
            mutableStateAccessors: createMutableStateAccessors(localStateBindings),
            readonlyStateAccessors: createReadonlyStateAccessors(readonlyStateBindings),
        }),
        runtimeViewState,
        runtimeSessionState,
        runtimeInteractionState,
        getEffectiveOrbitStyle,
    });
}

export {
    createMissionLegacyStateCells,
    createMutableStateAccessors,
    createReadonlyStateAccessors,
    MISSION_LEGACY_MUTABLE_STATE_KEYS,
};
