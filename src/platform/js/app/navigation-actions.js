export function createNavigationActions({
    getPanX,
    setPanX,
    getPanY,
    setPanY,
    getZoomFactor,
    setZoomFactor,
    zoomChange,
    zoomEnd,
    render,
    getZoomTimeoutMs,
    getZoomScale,
    toggleInfo,
}) {
    function reset() {
        setPanX(0);
        setPanY(0);
        setZoomFactor(1);
        zoomChange(getZoomTimeoutMs());
        zoomEnd();
    }

    function zoomOut() {
        setZoomFactor(getZoomFactor() * (1 / getZoomScale()));
        zoomChange(getZoomTimeoutMs());
    }

    function zoomIn() {
        setZoomFactor(getZoomFactor() * getZoomScale());
        zoomChange(getZoomTimeoutMs());
    }

    function panLeft() {
        setPanX(getPanX() + 10);
        zoomChange(getZoomTimeoutMs());
    }

    function panRight() {
        setPanX(getPanX() - 10);
        zoomChange(getZoomTimeoutMs());
    }

    function panUp() {
        setPanY(getPanY() + 10);
        zoomChange(getZoomTimeoutMs());
    }

    function panDown() {
        setPanY(getPanY() - 10);
        zoomChange(getZoomTimeoutMs());
    }

    function toggleInfoAction() {
        toggleInfo();
        render();
    }

    return {
        reset,
        zoomOut,
        zoomIn,
        panLeft,
        panRight,
        panUp,
        panDown,
        toggleInfo: toggleInfoAction,
    };
}
