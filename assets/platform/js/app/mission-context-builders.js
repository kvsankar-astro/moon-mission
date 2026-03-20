import { createMissionWiringComposition } from "./mission-wiring-composition.js";
import { createMissionRuntimeBootstrap } from "./mission-runtime-bootstrap.js";

function createMissionWiringActions(ports) {
    return createMissionWiringComposition(ports);
}

function createMissionRuntimeBootstrapActions(ports) {
    return createMissionRuntimeBootstrap(ports);
}

export {
    createMissionRuntimeBootstrapActions,
    createMissionWiringActions,
};
