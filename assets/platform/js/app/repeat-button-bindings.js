export function bindRepeatButtons({
    select,
    buttons,
    onMouseDownById,
    onMouseUp,
    onMouseOut,
    onClick = () => {},
}) {
    for (let i = 0; i < buttons.length; i++) {
        const id = buttons[i];
        const handler = onMouseDownById[id];

        if (typeof handler === "function") {
            select("#" + id).on("mousedown", handler);
        }

        select("#" + id).on("mouseup", onMouseUp);
        select("#" + id).on("mouseout", onMouseOut);
        select("#" + id).on("click", onClick);
    }
}
