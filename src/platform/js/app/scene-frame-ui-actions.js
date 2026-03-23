function createSceneFrameUiActions(deps) {
    const { getAnimDate, sceneUiUpdateActions } = deps;

    function updateAnimationDate(animTime) {
        const animDate = getAnimDate();
        if (!animDate || typeof animDate.html !== "function") {
            return;
        }
        animDate.html(new Date(animTime));
    }

    function updateSharedUi({ sceneState, primaryBody, globalConfig }) {
        sceneUiUpdateActions.updateTelemetry(sceneState, primaryBody);
        sceneUiUpdateActions.updatePhaseIndicator(sceneState, globalConfig);
        sceneUiUpdateActions.updateActiveEvent(sceneState);
    }

    function updateFrameUi({ animTime, sceneState, primaryBody, globalConfig }) {
        updateAnimationDate(animTime);
        updateSharedUi({ sceneState, primaryBody, globalConfig });
    }

    return {
        updateAnimationDate,
        updateSharedUi,
        updateFrameUi,
    };
}

export { createSceneFrameUiActions };
