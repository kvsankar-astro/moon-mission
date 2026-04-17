function createRuntimeBootstrapRenderPort(runtimeBootstrapPorts, wiringActions) {
    const renderPort = runtimeBootstrapPorts?.renderPort || {};

    return {
        ...renderPort,
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
    };
}

function createRuntimeBootstrapDataPort(runtimeBootstrapPorts, wiringActions) {
    const dataPort = runtimeBootstrapPorts?.dataPort || {};

    return {
        ...dataPort,
        initSVG: () => wiringActions.svgActions.initSVG(),
        loadOrbitDataIfNeededAndProcess: wiringActions.loadOrbitDataIfNeededAndProcess,
        loadLandingDataAndProcess: wiringActions.loadLandingDataAndProcess,
        processOrbitVectorsData: wiringActions.processOrbitVectorsData,
    };
}

function createRuntimeBootstrapPorts(runtimeBootstrapPorts, wiringActions) {
    return {
        ...runtimeBootstrapPorts,
        renderPort: createRuntimeBootstrapRenderPort(runtimeBootstrapPorts, wiringActions),
        dataPort: createRuntimeBootstrapDataPort(runtimeBootstrapPorts, wiringActions),
    };
}

export {
    createRuntimeBootstrapDataPort,
    createRuntimeBootstrapPorts,
    createRuntimeBootstrapRenderPort,
};
