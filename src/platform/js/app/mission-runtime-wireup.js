import {
    createMissionRuntimeBootstrapActions,
    createMissionWiringActions,
} from "./mission-context-builders.js";

function createMissionRuntimeWireup({ wiringPorts, runtimeBootstrapPorts }) {
    const wiringActions = createMissionWiringActions(wiringPorts);

    const runtimeBootstrapActions = createMissionRuntimeBootstrapActions({
        ...runtimeBootstrapPorts,
        renderPort: {
            ...runtimeBootstrapPorts.renderPort,
            zoomEnd: wiringActions.zoomEnd,
            zoomChange: wiringActions.zoomChange,
            zoomChangeTransform: wiringActions.zoomChangeTransform,
            handleZoom: wiringActions.handleZoom,
            setView: wiringActions.setView,
            setDimension: (value) => {
                wiringActions.dimensionActions.setDimension(value);
            },
            initConfig: wiringActions.initConfig,
            handlePlaneChange: wiringActions.planeActions.handlePlaneChange,
        },
        dataPort: {
            ...runtimeBootstrapPorts.dataPort,
            initSVG: () => wiringActions.svgActions.initSVG(),
            loadOrbitDataIfNeededAndProcess: wiringActions.loadOrbitDataIfNeededAndProcess,
            loadLandingDataAndProcess: wiringActions.loadLandingDataAndProcess,
            processOrbitVectorsData: wiringActions.processOrbitVectorsData,
        },
    });

    return {
        ...wiringActions,
        runtimeBootstrapActions,
    };
}

export { createMissionRuntimeWireup };
