function createSceneViewStateActions(deps) {
    const {
        defaultViewState,
        getConfig,
        getGlobalConfig,
        getSceneForConfig,
        normalizePlaneSelection,
        getPlaneVariablesForSelection,
        syncPlaneSelectionControls,
        setChecked,
        isRelativeMode = false,
        getLegacyPlaneSelection,
        setLegacyPlaneSelection,
        getLegacyPlaneVariables,
        setLegacyPlaneVariables,
        getLegacyZoomFactor,
        setLegacyZoomFactor,
        getLegacyPanX,
        setLegacyPanX,
        getLegacyPanY,
        setLegacyPanY,
    } = deps;

    function ensureSceneViewState(scene) {
        if (!scene) return null;

        if (typeof scene.planeSelection !== "string") scene.planeSelection = defaultViewState.planeSelection;
        if (typeof scene.plane !== "string") scene.plane = defaultViewState.plane;
        if (typeof scene.xVariable !== "string") scene.xVariable = defaultViewState.xVariable;
        if (typeof scene.yVariable !== "string") scene.yVariable = defaultViewState.yVariable;
        if (typeof scene.zVariable !== "string") scene.zVariable = defaultViewState.zVariable;
        if (typeof scene.vxVariable !== "string") scene.vxVariable = defaultViewState.vxVariable;
        if (typeof scene.vyVariable !== "string") scene.vyVariable = defaultViewState.vyVariable;
        if (typeof scene.vzVariable !== "string") scene.vzVariable = defaultViewState.vzVariable;
        if (!Number.isFinite(scene.xFactor)) scene.xFactor = defaultViewState.xFactor;
        if (!Number.isFinite(scene.yFactor)) scene.yFactor = defaultViewState.yFactor;
        if (!Number.isFinite(scene.zFactor)) scene.zFactor = defaultViewState.zFactor;
        if (!Number.isFinite(scene.zoomFactor)) scene.zoomFactor = defaultViewState.zoomFactor;
        if (!Number.isFinite(scene.panx)) scene.panx = defaultViewState.panx;
        if (!Number.isFinite(scene.pany)) scene.pany = defaultViewState.pany;

        return scene;
    }

    function getActiveSceneViewState(cfg = getConfig()) {
        return ensureSceneViewState(getSceneForConfig(cfg));
    }

    function getPlaneSelectionState(cfg = getConfig()) {
        const scene = getActiveSceneViewState(cfg);
        if (scene) {
            return normalizePlaneSelection(scene.planeSelection);
        }
        if (cfg === getConfig() && typeof getLegacyPlaneSelection() === "string") {
            return normalizePlaneSelection(getLegacyPlaneSelection());
        }
        return defaultViewState.planeSelection;
    }

    function setPlaneSelectionState(value, cfg = getConfig()) {
        const normalized = normalizePlaneSelection(value);
        const scene = getActiveSceneViewState(cfg);
        if (scene) scene.planeSelection = normalized;
        setLegacyPlaneSelection(normalized);
    }

    function setPlaneVariablesState(planeConfig, cfg = getConfig()) {
        const scene = getActiveSceneViewState(cfg);
        if (scene) {
            scene.plane = planeConfig.plane;
            scene.xFactor = planeConfig.xFactor;
            scene.yFactor = planeConfig.yFactor;
            scene.zFactor = planeConfig.zFactor;
            scene.xVariable = planeConfig.xVariable;
            scene.yVariable = planeConfig.yVariable;
            scene.zVariable = planeConfig.zVariable;
            scene.vxVariable = planeConfig.vxVariable;
            scene.vyVariable = planeConfig.vyVariable;
            scene.vzVariable = planeConfig.vzVariable;
        }

        // Transitional fallback for code paths not yet scene-scoped.
        setLegacyPlaneVariables(planeConfig);
    }

    function getPlaneVariablesState(cfg = getConfig()) {
        const scene = getActiveSceneViewState(cfg);
        if (scene) {
            return {
                plane: scene.plane,
                xFactor: scene.xFactor,
                yFactor: scene.yFactor,
                zFactor: scene.zFactor,
                xVariable: scene.xVariable,
                yVariable: scene.yVariable,
                zVariable: scene.zVariable,
                vxVariable: scene.vxVariable,
                vyVariable: scene.vyVariable,
                vzVariable: scene.vzVariable,
            };
        }

        if (cfg === getConfig()) {
            return getLegacyPlaneVariables();
        }

        return {
            plane: defaultViewState.plane,
            xFactor: defaultViewState.xFactor,
            yFactor: defaultViewState.yFactor,
            zFactor: defaultViewState.zFactor,
            xVariable: defaultViewState.xVariable,
            yVariable: defaultViewState.yVariable,
            zVariable: defaultViewState.zVariable,
            vxVariable: defaultViewState.vxVariable,
            vyVariable: defaultViewState.vyVariable,
            vzVariable: defaultViewState.vzVariable,
        };
    }

    function getZoomFactorState(cfg = getConfig()) {
        // Keep legacy global zoom semantics to avoid visual drift across suites.
        return getLegacyZoomFactor();
    }

    function setZoomFactorState(value, cfg = getConfig()) {
        const scene = getActiveSceneViewState(cfg);
        if (scene) scene.zoomFactor = value;
        setLegacyZoomFactor(value);
    }

    function getPanXState(cfg = getConfig()) {
        // Keep legacy global pan semantics to avoid visual drift across suites.
        return getLegacyPanX();
    }

    function setPanXState(value, cfg = getConfig()) {
        const scene = getActiveSceneViewState(cfg);
        if (scene) scene.panx = value;
        setLegacyPanX(value);
    }

    function getPanYState(cfg = getConfig()) {
        // Keep legacy global pan semantics to avoid visual drift across suites.
        return getLegacyPanY();
    }

    function setPanYState(value, cfg = getConfig()) {
        const scene = getActiveSceneViewState(cfg);
        if (scene) scene.pany = value;
        setLegacyPanY(value);
    }

    function resetViewTransformState(cfg = getConfig()) {
        setZoomFactorState(defaultViewState.zoomFactor, cfg);
        setPanXState(defaultViewState.panx, cfg);
        setPanYState(defaultViewState.pany, cfg);
    }

    function syncPlaneStateForConfig(cfg = getConfig()) {
        const selection = getPlaneSelectionState(cfg);
        const normalizedSelection = syncPlaneSelectionControls(selection, setChecked);
        const effectiveSelection =
            isRelativeMode && normalizedSelection === "DEFAULT"
                ? normalizePlaneSelection(
                    getGlobalConfig()?.ui?.viewDefaults?.relativeDefaultPlaneSelection || "DEFAULT",
                )
                : normalizedSelection;
        setPlaneSelectionState(normalizedSelection, cfg);
        setPlaneVariablesState(getPlaneVariablesForSelection(effectiveSelection), cfg);
    }

    return {
        syncPlaneStateForConfig,
        ensureSceneViewState,
        getActiveSceneViewState,
        getPlaneSelectionState,
        setPlaneSelectionState,
        setPlaneVariablesState,
        getPlaneVariablesState,
        getZoomFactorState,
        setZoomFactorState,
        getPanXState,
        setPanXState,
        getPanYState,
        setPanYState,
        resetViewTransformState,
    };
}

export { createSceneViewStateActions };
