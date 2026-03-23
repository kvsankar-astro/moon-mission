function createFrameUiUpdater({ sceneFrameUiActions }) {
    function applyUiIntent(uiIntent) {
        if (!uiIntent) return;
        sceneFrameUiActions.updateFrameUi(uiIntent);
    }

    return {
        applyUiIntent,
    };
}

export { createFrameUiUpdater };
