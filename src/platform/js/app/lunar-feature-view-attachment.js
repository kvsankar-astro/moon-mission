import {
    createDefaultLunarFeatureViewState,
    normalizeLunarFeatureViewState,
    patchLunarFeatureViewState,
} from "../core/domain/lunar-feature-view.js";
import {
    bindLunarCraterControlPanel,
    syncLunarCraterControlPanel,
    writeLunarCraterControlState,
} from "../ui/lunar-crater-control-panel.js";

export function hasLunarFeatureOverlay(state = {}) {
    return normalizeLunarFeatureViewState(state).viewLunarFeatures === true;
}

export function shouldRenderLunarFeaturePointer(state = {}) {
    const normalized = normalizeLunarFeatureViewState(state);
    return normalized.viewLunarFeatures === true &&
        normalized.lunarCraterHoverLabels !== false;
}

export function createLunarFeatureViewAttachment({
    controls = null,
    initialState = createDefaultLunarFeatureViewState(),
    activate = null,
    requestRender = null,
    persist = null,
    onStateChange = null,
} = {}) {
    let currentControls = controls;
    let currentState = normalizeLunarFeatureViewState(initialState);

    const sync = () => {
        currentState = normalizeLunarFeatureViewState(currentState);
        if (currentControls) {
            writeLunarCraterControlState(currentControls, currentState);
            syncLunarCraterControlPanel(currentControls, currentState);
        }
        onStateChange?.(currentState, { enabled: hasLunarFeatureOverlay(currentState) });
        return currentState;
    };

    const setControls = (nextControls) => {
        currentControls = nextControls || null;
        sync();
    };

    const setState = (nextState) => {
        currentState = normalizeLunarFeatureViewState(nextState);
        sync();
        return currentState;
    };

    const commitPatch = (patch = {}) => {
        activate?.();
        currentState = patchLunarFeatureViewState(currentState, patch);
        sync();
        requestRender?.();
        persist?.();
        return currentState;
    };

    const bind = () => currentControls
        ? bindLunarCraterControlPanel({
            elements: currentControls,
            commitPatch,
            sync,
        })
        : null;

    sync();

    return {
        bind,
        commitPatch,
        setControls,
        setState,
        sync,
        get controls() {
            return currentControls;
        },
        get enabled() {
            return hasLunarFeatureOverlay(currentState);
        },
        get state() {
            return currentState;
        },
    };
}
