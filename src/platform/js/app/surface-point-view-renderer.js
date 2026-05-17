import { normalizeSurfacePointViewState } from "../core/domain/surface-point-view-state.js";

function captureSurfacePointPresentation(animationScene) {
    if (!animationScene) return null;
    return normalizeSurfacePointViewState(animationScene.surfacePointMarkerVisibility || {});
}

function applySurfacePointPresentation(animationScene, state) {
    if (!animationScene?.setSurfacePointMarkersVisible) return false;
    animationScene.setSurfacePointMarkersVisible(normalizeSurfacePointViewState(state), {
        renderNow: false,
    });
    return true;
}

export function renderWithSurfacePointView({
    animationScene = null,
    viewState = {},
    render,
}) {
    if (typeof render !== "function") return;
    if (!animationScene?.setSurfacePointMarkersVisible) {
        render();
        return;
    }

    const previousState = captureSurfacePointPresentation(animationScene);
    applySurfacePointPresentation(animationScene, viewState);
    try {
        render();
    } finally {
        applySurfacePointPresentation(animationScene, previousState);
    }
}
