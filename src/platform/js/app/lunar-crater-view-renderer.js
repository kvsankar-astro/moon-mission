import {
    LUNAR_CRATER_DISPLAY_MODE_HOVER,
    supportsLunarCraterView,
} from "../core/domain/lunar-crater-view.js";
import {
    createDefaultLunarFeatureViewState,
    normalizeLunarFeatureViewState,
} from "../core/domain/lunar-feature-view.js";

function resolveCraterGroup({ animationScene = null, scene = null } = {}) {
    return animationScene?.lunarCraterGroup ||
        scene?.getObjectByName?.("lunar-crater-annotations") ||
        null;
}

function captureCraterPresentation(animationScene) {
    if (!animationScene) return null;
    return {
        hadGroup: !!animationScene.lunarCraterGroup,
        visible: animationScene.lunarCraterGroup?.visible === true,
        displayMode: animationScene.lunarCraterDisplayMode,
        minDiameterKm: animationScene.lunarCraterMinDiameterKm,
        maxDiameterKm: animationScene.lunarCraterMaxDiameterKm,
        searchQuery: animationScene.lunarFeatureSearchQuery,
        excludedKeys: animationScene.lunarFeatureExcludedKeys,
        hoverLabelsEnabled: animationScene.lunarCraterHoverLabelsEnabled,
    };
}

function restoreCraterPresentation(animationScene, previous) {
    if (!animationScene || !previous) return false;
    if (!previous.hadGroup) {
        animationScene.disposeLunarCraterAnnotations?.();
        return true;
    }

    animationScene.lunarCraterDisplayMode = previous.displayMode;
    animationScene.lunarCraterMinDiameterKm = previous.minDiameterKm;
    animationScene.lunarCraterMaxDiameterKm = previous.maxDiameterKm;
    animationScene.lunarFeatureSearchQuery = previous.searchQuery;
    animationScene.lunarFeatureExcludedKeys = previous.excludedKeys;
    animationScene.addLunarCraterAnnotations?.();
    animationScene.setLunarCraterHoverLabelsEnabled?.(previous.hoverLabelsEnabled);
    if (animationScene.lunarCraterGroup) {
        animationScene.lunarCraterGroup.visible = previous.visible;
    }
    return true;
}

function setCraterGroupVisibleTemporarily(group, visible, render) {
    if (!group) {
        render();
        return;
    }
    const previousVisible = group.visible;
    group.visible = visible === true;
    try {
        render();
    } finally {
        group.visible = previousVisible;
    }
}

export function renderWithLunarCraterView({
    viewId,
    viewState,
    animationScene = null,
    scene = null,
    camera = null,
    rendererDomElement = null,
    pointer = null,
    render,
}) {
    if (typeof render !== "function") return;

    const supported = supportsLunarCraterView(viewId);
    const craterState = supported
        ? normalizeLunarFeatureViewState(viewState)
        : createDefaultLunarFeatureViewState();

    if (craterState.viewLunarCraters !== true || !supported) {
        setCraterGroupVisibleTemporarily(
            resolveCraterGroup({ animationScene, scene }),
            false,
            render,
        );
        return;
    }

    const previousPresentation = captureCraterPresentation(animationScene);
    const canApplyPresentation = !!(
        animationScene?.addLunarCraterAnnotations &&
        animationScene?.setLunarCraterHoverLabelsEnabled
    );
    if (canApplyPresentation) {
        animationScene.lunarCraterDisplayMode = craterState.lunarCraterDisplayMode;
        animationScene.lunarCraterMinDiameterKm = craterState.lunarCraterMinDiameterKm;
        animationScene.lunarCraterMaxDiameterKm = craterState.lunarCraterMaxDiameterKm;
        animationScene.lunarFeatureTypeFilters = craterState.lunarFeatureTypeFilters;
        animationScene.lunarFeatureSearchQuery = craterState.lunarFeatureSearchQuery;
        animationScene.lunarFeatureExcludedKeys = craterState.lunarFeatureExcludedKeys;
        animationScene.addLunarCraterAnnotations({
            camera,
            rendererDomElement,
        });
        animationScene.setLunarCraterHoverLabelsEnabled(
            craterState.lunarCraterDisplayMode === LUNAR_CRATER_DISPLAY_MODE_HOVER &&
                craterState.lunarCraterHoverLabels !== false,
        );
    }

    const craterGroup = resolveCraterGroup({ animationScene, scene });
    const previousVisible = craterGroup?.visible;
    if (craterGroup) {
        craterGroup.visible = true;
    }
    try {
        if (
            canApplyPresentation &&
            craterState.lunarCraterDisplayMode === LUNAR_CRATER_DISPLAY_MODE_HOVER
        ) {
            if (pointer) {
                animationScene.updateLunarCraterHoverFromPointer?.({
                    camera,
                    rendererDomElement,
                    clientX: pointer.clientX,
                    clientY: pointer.clientY,
                });
            } else {
                animationScene.clearLunarCraterHover?.();
            }
        }
        animationScene?.updateLunarCraterLabelScales?.({
            camera,
            rendererDomElement,
        });
        render();
    } finally {
        if (!restoreCraterPresentation(animationScene, previousPresentation) && craterGroup) {
            craterGroup.visible = previousVisible === true;
        }
    }
}
