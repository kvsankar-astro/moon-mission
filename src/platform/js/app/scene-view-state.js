import {
    ensureSceneViewState as ensureSceneViewStateCore,
    resolveEffectivePlaneSelection,
    resolvePlaneSelectionState,
    resolvePlaneVariablesState,
} from "../core/domain/scene-view-state-core.js";

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
        return ensureSceneViewStateCore(scene, defaultViewState);
    }

    function getActiveSceneViewState(cfg = getConfig()) {
        return ensureSceneViewState(getSceneForConfig(cfg));
    }

    function getPlaneSelectionState(cfg = getConfig()) {
        return resolvePlaneSelectionState({
            scene: getActiveSceneViewState(cfg),
            defaultViewState,
            normalizePlaneSelection,
            useLegacyPlaneSelection: cfg === getConfig(),
            legacyPlaneSelection: getLegacyPlaneSelection(),
        });
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
        return resolvePlaneVariablesState({
            scene: getActiveSceneViewState(cfg),
            defaultViewState,
            useLegacyPlaneVariables: cfg === getConfig(),
            legacyPlaneVariables: getLegacyPlaneVariables(),
        });
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
        const effectiveSelection = resolveEffectivePlaneSelection({
            selection: normalizedSelection,
            isRelativeMode,
            globalConfig: getGlobalConfig(),
            normalizePlaneSelection,
        });
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
