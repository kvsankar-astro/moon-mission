export function initRepeatButtons({
    d3SelectAll,
    setChecked,
    animationScene,
    bindRepeatButtons,
    d3Select,
    handlersById,
    resetMouseRepeatState,
}) {
    animationScene.lockOnSC = false;
    animationScene.lockOnMoon = false;
    animationScene.lockOnEarth = false;

    setChecked("checkbox-lock-sc", false);
    setChecked("checkbox-lock-moon", false);
    setChecked("checkbox-lock-earth", false);

    const buttons = [
        "zoomin",
        "zoomout",
        "panleft",
        "panright",
        "panup",
        "pandown",
        "forward",
        "fastforward",
        "backward",
        "fastbackward",
        "slower",
        "resetspeed",
        "faster",
        "realtime",
    ];

    // Only disable repeat-driven navigation buttons during startup bootstrap.
    // A blanket disable on all buttons can strand mobile shell controls in a
    // disabled state on some mission startup paths.
    buttons.forEach((id) => {
        d3Select(`#${id}`).attr("disabled", true);
    });

    bindRepeatButtons({
        select: d3Select,
        buttons,
        onMouseDownById: handlersById,
        onMouseUp: function () {
            resetMouseRepeatState?.();
        },
        onMouseOut: function () {
            resetMouseRepeatState?.({ mouseOut: true });
        },
        onClick: function () {
            // TODO - would there be a case where mousedown is not called?
        },
    });
}
