import { createMissionRuntimeEntry } from "./mission-runtime-entry.js";
import { buildMissionRuntimeStaticDeps } from "./mission-runtime-static-deps.js";
import {
    createMissionRuntimeEntryContext,
    createMissionRuntimeStaticDepsContext,
} from "./mission-runtime-entry-deps.js";

function createMissionRuntimeWireupEntry(ctx) {
    const staticWireupDeps = buildMissionRuntimeStaticDeps(
        createMissionRuntimeStaticDepsContext(ctx),
    );

    return createMissionRuntimeEntry(
        createMissionRuntimeEntryContext(ctx, { staticWireupDeps }),
    );
}

export { createMissionRuntimeWireupEntry };
