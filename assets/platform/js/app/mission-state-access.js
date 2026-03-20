import { createMissionStateStore } from "../core/state/mission-state-store.js";

function createMissionStateAccess(ctx) {
    return createMissionStateStore(ctx);
}

export { createMissionStateAccess };
