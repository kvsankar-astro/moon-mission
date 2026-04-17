import { buildMissionRuntimeWireupConfig } from "./mission-runtime-wireup-config.js";
import { createMissionRuntimeWireup } from "./mission-runtime-wireup.js";
import {
    createMissionRuntimeEffects,
    createMissionRuntimeWireupContext,
    createMissionStatePortsForEntry,
} from "./mission-runtime-entry-deps.js";

function createMissionRuntimeEntry(ctx) {
    let missionRuntimeWireup = null;

    const missionStatePorts = createMissionStatePortsForEntry(
        ctx,
        () => missionRuntimeWireup?.runtimeBootstrapActions,
    );
    const { missionUiEffects, missionClockEffects } = createMissionRuntimeEffects(
        ctx,
        missionStatePorts,
    );

    missionRuntimeWireup = createMissionRuntimeWireup(
        buildMissionRuntimeWireupConfig(
            createMissionRuntimeWireupContext(ctx, {
                missionStatePorts,
                missionUiEffects,
                missionClockEffects,
            }),
        ),
    );

    return {
        missionRuntimeWireup,
        missionStatePorts,
    };
}

export { createMissionRuntimeEntry };
