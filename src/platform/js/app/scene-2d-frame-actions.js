function createScene2DFrameActions(deps) {
    const {
        animation2DControllers,
        animationScenes,
        getConfig,
        getPlaneVariables,
        getZoomFactor,
        getPanX,
        getPanY,
        setCraftData,
        setLabelLocation,
        zoomChangeTransform,
        showGreenwichLongitude,
    } = deps;

    function render2DFrame({ sceneState, renderOptions }) {
        const config = getConfig();
        const controller = animation2DControllers[config];

        if (controller) {
            const planeVars = getPlaneVariables();
            controller.setPlaneConfig({
                xVariable: planeVars.xVariable,
                yVariable: planeVars.yVariable,
                zVariable: planeVars.zVariable,
                xFactor: planeVars.xFactor,
                yFactor: planeVars.yFactor,
                zFactor: planeVars.zFactor,
            });
            controller.setZoomPan(getZoomFactor(), getPanX(), getPanY());
            controller.render(sceneState, renderOptions);

            // Keep legacy craftData in sync (used by zoom/label helpers like adjustLabelLocations()).
            if (typeof controller.getCraftData === "function") {
                const latestCraftData = controller.getCraftData();
                if (latestCraftData && Number.isFinite(latestCraftData.x) && Number.isFinite(latestCraftData.y)) {
                    setCraftData(latestCraftData);
                }
            }
        }

        const scene = animationScenes[config];
        for (let i = 0; i < scene.planetsForLocations.length; ++i) {
            const planetKey = scene.planetsForLocations[i];
            setLabelLocation(planetKey, sceneState.bodies[planetKey]);
        }
        zoomChangeTransform(0);
        showGreenwichLongitude();
    }

    return {
        render2DFrame,
    };
}

export { createScene2DFrameActions };
