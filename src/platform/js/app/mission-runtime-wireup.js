import { createMissionWiringComposition } from "./mission-wiring-composition.js";
import { createRuntimeBootstrapActions } from "./runtime-bootstrap-actions.js";
import { createRuntimeBootstrapPorts } from "./mission-runtime-wireup-deps.js";

function createMissionRuntimeWireup({ wiringPorts, runtimeBootstrapPorts }) {
    const wiringActions = createMissionWiringComposition(wiringPorts);
    const runtimeBootstrapActions = createRuntimeBootstrapActions(
        createRuntimeBootstrapPorts(runtimeBootstrapPorts, wiringActions),
    );

    return {
        ...wiringActions,
        runtimeBootstrapActions,
    };
}

export { createMissionRuntimeWireup };
