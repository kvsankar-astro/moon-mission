function createFrameRenderer({
    animation3DControllers,
    adjustCameraProjectionMatrixAndSkyAngle,
    scene2DFrameActions,
}) {
    function applyRenderIntent(renderIntent) {
        if (!renderIntent) return;

        if (renderIntent.dimension === "3D") {
            const controller = animation3DControllers[renderIntent.config];
            if (controller) {
                controller.render(renderIntent.sceneState, renderIntent.renderOptions);
            }
            if (renderIntent.shouldAdjustCameraProjection) {
                adjustCameraProjectionMatrixAndSkyAngle();
            }
            return;
        }

        scene2DFrameActions.render2DFrame({
            sceneState: renderIntent.sceneState,
            renderOptions: renderIntent.renderOptions,
        });
    }

    return {
        applyRenderIntent,
    };
}

export { createFrameRenderer };
