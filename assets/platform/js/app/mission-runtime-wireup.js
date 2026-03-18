import {
    createMissionRuntimeBootstrapActions,
    createMissionWiringActions,
} from "./mission-context-builders.js";

function createMissionRuntimeWireup({ wiringDeps, runtimeBootstrapDeps }) {
    const wiringActions = createMissionWiringActions(wiringDeps);

    const runtimeBootstrapActions = createMissionRuntimeBootstrapActions({
        ...runtimeBootstrapDeps,
        zoomEnd: wiringActions.zoomEnd,
        zoomChange: wiringActions.zoomChange,
        zoomChangeTransform: wiringActions.zoomChangeTransform,
        handleZoom: wiringActions.handleZoom,
        setView: wiringActions.setView,
        setDimension: (value) => {
            wiringActions.dimensionActions.setDimension(value);
        },
        initConfig: wiringActions.initConfig,
        initSVG: () => wiringActions.svgActions.initSVG(),
        loadOrbitDataIfNeededAndProcess: wiringActions.loadOrbitDataIfNeededAndProcess,
        loadLandingDataAndProcess: wiringActions.loadLandingDataAndProcess,
        processOrbitVectorsData: wiringActions.processOrbitVectorsData,
        handlePlaneChange: wiringActions.planeActions.handlePlaneChange,
    });

    return {
        ...wiringActions,
        runtimeBootstrapActions,
    };
}

export { createMissionRuntimeWireup };
