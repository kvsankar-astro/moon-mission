function createRuntimeInitActions(deps) {
    const {
        getConfig,
        getScene,
        getSceneStateInitDone,
        setSceneState,
        resetViewTransformState,
        initRepeatButtons,
        d3SelectAll,
        setChecked,
        bindRepeatButtons,
        d3Select,
        getHandlersById,
        getTimeoutHandleZoom,
        setTimeoutHandleZoom,
        setMousedownTimeout,
        setMouseDown,
        getZoomTimeoutMs,
        clearTimeoutFn,
        zoomEnd,
        sleep,
        setAnimDate,
        getCurrentDimension,
        initSVG,
        loadOrbitDataIfNeededAndProcess,
        loadLandingDataAndProcess,
    } = deps;

    async function init(callback) {
        const sceneConfig = getConfig();
        const scene = getScene(sceneConfig);
        if (scene && scene.state >= getSceneStateInitDone()) {
            return;
        }

        resetViewTransformState(sceneConfig);

        initRepeatButtons({
            d3SelectAll,
            setChecked,
            animationScene: scene,
            bindRepeatButtons,
            d3Select,
            handlersById: getHandlersById(),
            resetMouseRepeatState: ({ mouseOut } = {}) => {
                if (mouseOut) {
                    setMouseDown(false);
                    if (getTimeoutHandleZoom() == null) return;
                } else {
                    setMousedownTimeout(getZoomTimeoutMs());
                    setMouseDown(false);
                }

                clearTimeoutFn(getTimeoutHandleZoom());
                setTimeoutHandleZoom(null);
                zoomEnd();
            },
        });

        await sleep();

        setAnimDate(d3Select("#date"));

        await sleep();
        if (getCurrentDimension() === "2D") {
            initSVG();
        }

        await sleep();
        loadOrbitDataIfNeededAndProcess(callback);
        loadLandingDataAndProcess();

        setSceneState(sceneConfig, getSceneStateInitDone());
    }

    return {
        init,
    };
}

export { createRuntimeInitActions };
