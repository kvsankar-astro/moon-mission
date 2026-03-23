const planeVariableConfig = {
    DEFAULT: {
        plane: "DEFAULT",
        xFactor: 1,
        yFactor: 1,
        zFactor: 1,
        xVariable: "x",
        yVariable: "y",
        zVariable: "z",
        vxVariable: "vx",
        vyVariable: "vy",
        vzVariable: "vz",
    },
    XY: {
        plane: "XY",
        xFactor: 1,
        yFactor: 1,
        zFactor: 1,
        xVariable: "x",
        yVariable: "y",
        zVariable: "z",
        vxVariable: "vx",
        vyVariable: "vy",
        vzVariable: "vz",
    },
    YZ: {
        plane: "YZ",
        xFactor: 1,
        yFactor: 1,
        zFactor: 1,
        xVariable: "y",
        yVariable: "z",
        zVariable: "x",
        vxVariable: "vy",
        vyVariable: "vz",
        vzVariable: "vx",
    },
    ZX: {
        plane: "ZX",
        xFactor: 1,
        yFactor: 1,
        zFactor: 1,
        xVariable: "z",
        yVariable: "x",
        zVariable: "y",
        vxVariable: "vz",
        vyVariable: "vx",
        vzVariable: "vy",
    },
    "XY-": {
        plane: "XY",
        xFactor: -1,
        yFactor: 1,
        zFactor: 1,
        xVariable: "x",
        yVariable: "y",
        zVariable: "z",
        vxVariable: "vx",
        vyVariable: "vy",
        vzVariable: "vz",
    },
    "YZ-": {
        plane: "YZ",
        xFactor: -1,
        yFactor: 1,
        zFactor: 1,
        xVariable: "y",
        yVariable: "z",
        zVariable: "x",
        vxVariable: "vy",
        vyVariable: "vz",
        vzVariable: "vx",
    },
    "ZX-": {
        plane: "ZX",
        xFactor: -1,
        yFactor: 1,
        zFactor: 1,
        xVariable: "z",
        yVariable: "x",
        zVariable: "y",
        vxVariable: "vz",
        vyVariable: "vx",
        vzVariable: "vy",
    },
};

export function createPlaneActions({
    getPlaneSelection,
    setPlaneVariables,
    getCurrentDimension,
    animationScenes,
    getConfig,
    initSVG,
    loadOrbitDataIfNeededAndProcess,
    handleDimensionSwitch,
    setLocation,
}) {
    const planeChangeStateByConfig = new Map();

    function getPlaneChangeState(config) {
        if (!planeChangeStateByConfig.has(config)) {
            planeChangeStateByConfig.set(config, {
                previousPlaneSelection: null,
                planeChangesPending: false,
            });
        }
        return planeChangeStateByConfig.get(config);
    }

    function handlePlaneChange(dimension_changed = false, init_flag = false) {
        const selection = getPlaneSelection();
        const config = getConfig();
        const planeChangeState = getPlaneChangeState(config);

        let planeChanged = false;
        if (selection !== planeChangeState.previousPlaneSelection) {
            planeChanged = true;
            planeChangeState.previousPlaneSelection = selection;
            planeChangeState.planeChangesPending = true;
        } else {
            planeChanged = false;
        }

        if (init_flag && selection === "DEFAULT") {
            planeChangeState.planeChangesPending = false;
            return;
        }
        if (!dimension_changed && !planeChanged) {
            return;
        }

        const planeConfig = planeVariableConfig[selection];
        if (planeConfig) {
            setPlaneVariables(planeConfig);
        }

        const currentDimension = getCurrentDimension();
        if (currentDimension === "3D") {
            animationScenes[config].setCameraParameters(init_flag);
        }

        if (currentDimension === "2D") {
            initSVG();
            loadOrbitDataIfNeededAndProcess(function () {
                handleDimensionSwitch(currentDimension);
                setLocation();
            });
        } else if (currentDimension === "3D") {
            loadOrbitDataIfNeededAndProcess(function () {
                handleDimensionSwitch(currentDimension);
                setLocation();
            });
        }

        if (planeChangeState.planeChangesPending && dimension_changed) {
            planeChangeState.planeChangesPending = false;
        }
    }

    return {
        handlePlaneChange,
    };
}
