import { createRuntimeBootstrapActions } from "./runtime-bootstrap-actions.js";

function createMissionRuntimeBootstrap(ports) {
    return createRuntimeBootstrapActions(ports);
}

export { createMissionRuntimeBootstrap };
