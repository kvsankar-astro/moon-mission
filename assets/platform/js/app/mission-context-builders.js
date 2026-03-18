import { createMissionWiringComposition } from "./mission-wiring-composition.js";
import { createMissionRuntimeBootstrap } from "./mission-runtime-bootstrap.js";

function createMissionWiringActions(deps) {
    const { stateAccess, ...staticDeps } = deps;
    return createMissionWiringComposition({
        ...staticDeps,
        ...stateAccess,
    });
}

function createMissionRuntimeBootstrapActions(deps) {
    const { stateAccess, ...staticDeps } = deps;
    return createMissionRuntimeBootstrap({
        ...staticDeps,
        ...stateAccess,
    });
}

export {
    createMissionRuntimeBootstrapActions,
    createMissionWiringActions,
};
