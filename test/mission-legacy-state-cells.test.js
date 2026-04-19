import { describe, expect, it, vi } from "vitest";

import {
    createMissionLegacyStateCells,
    createMutableStateAccessors,
    MISSION_LEGACY_MUTABLE_STATE_KEYS,
} from "../src/platform/js/app/mission-legacy-state-cells.js";

function createLocalStateBindings() {
    const state = Object.fromEntries(
        MISSION_LEGACY_MUTABLE_STATE_KEYS.map((key) => [key, `${key}-value`]),
    );
    const bindings = Object.fromEntries(
        MISSION_LEGACY_MUTABLE_STATE_KEYS.map((key) => [
            key,
            {
                get: () => state[key],
                set: (value) => { state[key] = value; },
            },
        ]),
    );

    return { bindings, state };
}

describe("mission legacy state cells", () => {
    it("builds mutable accessor pairs for every legacy writable state key", () => {
        const { bindings, state } = createLocalStateBindings();

        const accessors = createMutableStateAccessors(bindings);
        const [getValue, setValue] = accessors.globalConfig;

        expect(Object.keys(accessors)).toEqual(MISSION_LEGACY_MUTABLE_STATE_KEYS);
        expect(getValue()).toBe("globalConfig-value");

        setValue("updated");
        expect(state.globalConfig).toBe("updated");
    });

    it("delegates the local and runtime cell composition through the shared builders", () => {
        const { bindings } = createLocalStateBindings();
        const captured = {};
        const runtimeViewState = { kind: "view" };
        const runtimeSessionState = { kind: "session" };
        const runtimeInteractionState = { kind: "interaction" };
        const getEffectiveOrbitStyle = vi.fn(() => "trail");

        const result = createMissionLegacyStateCells({
            localStateBindings: bindings,
            readonlyStateBindings: {
                frameMode: () => "relative",
                craftId: () => -158,
            },
            runtimeViewState,
            runtimeSessionState,
            runtimeInteractionState,
            getEffectiveOrbitStyle,
            createMissionLocalStateCellsImpl: vi.fn((options) => {
                captured.localOptions = options;
                return { localCells: true };
            }),
            createMissionStateCellsImpl: vi.fn((options) => {
                captured.stateOptions = options;
                return { missionStateCells: true };
            }),
        });

        expect(result).toEqual({ missionStateCells: true });
        expect(Object.keys(captured.localOptions.mutableStateAccessors)).toEqual(
            MISSION_LEGACY_MUTABLE_STATE_KEYS,
        );
        expect(captured.localOptions.readonlyStateAccessors.frameMode()).toBe("relative");
        expect(captured.localOptions.readonlyStateAccessors.craftId()).toBe(-158);
        expect(captured.stateOptions).toEqual({
            localStateCells: { localCells: true },
            runtimeViewState,
            runtimeSessionState,
            runtimeInteractionState,
            getEffectiveOrbitStyle,
        });
    });
});
