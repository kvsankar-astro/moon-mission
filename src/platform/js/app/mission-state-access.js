import {
    createMissionInteractionStateCells,
    createMissionSessionStateCells,
    createMissionViewStateCells,
    createMutableStateCell,
    createReadonlyStateCell,
} from "./mission-state-cell-groups.js";

function createMissionLocalStateCells({
    mutableStateAccessors = {},
    readonlyStateAccessors = {},
    createMutableStateCellImpl = createMutableStateCell,
    createReadonlyStateCellImpl = createReadonlyStateCell,
} = {}) {
    return {
        ...Object.fromEntries(
            Object.entries(mutableStateAccessors).map(([key, accessors]) => {
                const [get, set] = accessors;
                return [key, createMutableStateCellImpl(get, set)];
            }),
        ),
        ...Object.fromEntries(
            Object.entries(readonlyStateAccessors).map(([key, get]) => [
                key,
                createReadonlyStateCellImpl(get),
            ]),
        ),
    };
}

function createMissionStateCells({
    localStateCells = {},
    runtimeViewState,
    runtimeSessionState,
    runtimeInteractionState,
    getEffectiveOrbitStyle,
}) {
    return {
        ...localStateCells,
        ...createMissionViewStateCells(runtimeViewState, getEffectiveOrbitStyle),
        ...createMissionSessionStateCells(runtimeSessionState),
        ...createMissionInteractionStateCells(runtimeInteractionState),
    };
}

export {
    createMissionLocalStateCells,
    createMissionStateCells,
    createMutableStateCell,
    createReadonlyStateCell,
};
