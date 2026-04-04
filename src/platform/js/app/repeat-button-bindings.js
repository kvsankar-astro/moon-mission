export function bindRepeatButtons({
    select,
    buttons,
    onMouseDownById,
    onMouseUp,
    onMouseOut,
    onClick = () => {},
}) {
    const hasPointerEvents =
        typeof window !== "undefined" &&
        typeof window.PointerEvent !== "undefined";

    for (let i = 0; i < buttons.length; i++) {
        const id = buttons[i];
        const handler = onMouseDownById[id];
        const button = select("#" + id);

        if (typeof handler === "function") {
            if (hasPointerEvents) {
                button.on("pointerdown", handler);
            } else {
                button.on("mousedown", handler);
            }
        }

        if (hasPointerEvents) {
            button.on("pointerup", onMouseUp);
            button.on("pointercancel", onMouseUp);
            button.on("pointerleave", onMouseOut);
        } else {
            button.on("mouseup", onMouseUp);
            button.on("mouseout", onMouseOut);
        }
        button.on("click", onClick);
    }
}
