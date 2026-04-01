const DEFAULT_VIEW_STATE = Object.freeze({
    planeSelection: "DEFAULT", // DEFAULT, XY, YZ, ZX, XY-, YZ-, ZX-
    plane: "XY", // XY, YZ, ZX
    xVariable: "x",
    yVariable: "y",
    zVariable: "z",
    vxVariable: "vx",
    vyVariable: "vy",
    vzVariable: "vz",
    xFactor: 1,
    yFactor: 1,
    zFactor: 1,
    zoomFactor: 1,
    panx: 0,
    pany: 0,
});

const PLANE_SELECTION_RADIO_IDS = Object.freeze({
    DEFAULT: "checkbox-lock-default",
    XY: "checkbox-lock-xy",
    YZ: "checkbox-lock-yz",
    ZX: "checkbox-lock-zx",
    "XY-": "checkbox-lock-xy-minus",
    "YZ-": "checkbox-lock-yz-minus",
    "ZX-": "checkbox-lock-zx-minus",
});

const PLANE_SELECTION_VARIABLES = Object.freeze({
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
});

function normalizePlaneSelection(selection) {
    if (typeof selection === "string" && PLANE_SELECTION_RADIO_IDS[selection]) {
        return selection;
    }
    return DEFAULT_VIEW_STATE.planeSelection;
}

function resolveEffectivePlaneSelection(
    selection,
    { isRelativeMode = false, relativeDefaultPlaneSelection = "DEFAULT" } = {},
) {
    const normalized = normalizePlaneSelection(selection);
    if (isRelativeMode && normalized === "DEFAULT") {
        return normalizePlaneSelection(relativeDefaultPlaneSelection);
    }
    return normalized;
}

function getPlaneVariablesForSelection(selection) {
    const normalized = normalizePlaneSelection(selection);
    return PLANE_SELECTION_VARIABLES[normalized] || PLANE_SELECTION_VARIABLES.DEFAULT;
}

function syncPlaneSelectionControls(selection, setCheckedCallback) {
    const normalized = normalizePlaneSelection(selection);
    Object.entries(PLANE_SELECTION_RADIO_IDS).forEach(([planeId, radioId]) => {
        setCheckedCallback(radioId, planeId === normalized);
    });
    return normalized;
}

export {
    DEFAULT_VIEW_STATE,
    PLANE_SELECTION_RADIO_IDS,
    PLANE_SELECTION_VARIABLES,
    normalizePlaneSelection,
    resolveEffectivePlaneSelection,
    getPlaneVariablesForSelection,
    syncPlaneSelectionControls,
};
