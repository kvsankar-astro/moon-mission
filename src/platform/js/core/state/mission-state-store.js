import { createMissionStatePorts } from "./mission-state-port-builders.js";
import { flattenMissionStatePorts } from "./mission-state-port-flattener.js";

function createMissionStateStore(ctx) {
    return flattenMissionStatePorts(createMissionStatePorts(ctx));
}

export { createMissionStatePorts, createMissionStateStore, flattenMissionStatePorts };
