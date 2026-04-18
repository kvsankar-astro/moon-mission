const REPEAT_PRESS_BUTTON_IDS = new Set([
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
]);

export function createKeyboardShortcutsController(deps = {}) {
    const documentRef = deps.documentRef || document;
    const windowRef = deps.windowRef || window;
    const onClick = typeof deps.onClick === "function" ? deps.onClick : null;
    const isInteractiveInputTarget = typeof deps.isInteractiveInputTarget === "function"
        ? deps.isInteractiveInputTarget
        : () => false;
    const dispatchSyntheticPress = typeof deps.dispatchSyntheticPress === "function"
        ? deps.dispatchSyntheticPress
        : () => false;
    const nodeCtor = windowRef.Node || globalThis.Node || null;

    let bound = false;
    let globalBound = false;

    function clickControlButton(id) {
        const button = documentRef.getElementById(id);
        if (!button || button.disabled) return false;
        if (REPEAT_PRESS_BUTTON_IDS.has(id)) {
            return dispatchSyntheticPress(button, "mouse");
        }
        button.click();
        return true;
    }

    function positionShortcutPanel(panel, toggleButton) {
        if (!panel || !toggleButton) return;

        const wasHidden = panel.classList.contains("shortcut-panel--hidden");
        if (wasHidden) {
            panel.classList.remove("shortcut-panel--hidden");
            panel.style.visibility = "hidden";
        }

        panel.style.position = "fixed";
        panel.style.left = "0px";
        panel.style.top = "0px";

        const buttonRect = toggleButton.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const marginPx = 8;

        const unclampedLeft = buttonRect.right - panelRect.width;
        const maxLeft = Math.max(marginPx, windowRef.innerWidth - panelRect.width - marginPx);
        const left = Math.min(Math.max(unclampedLeft, marginPx), maxLeft);

        let top = buttonRect.top - panelRect.height - marginPx;
        if (top < marginPx) {
            const maxTop = Math.max(marginPx, windowRef.innerHeight - panelRect.height - marginPx);
            top = Math.min(buttonRect.bottom + marginPx, maxTop);
        }

        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;

        if (wasHidden) {
            panel.classList.add("shortcut-panel--hidden");
            panel.style.visibility = "";
        }
    }

    function toggleShortcutPanel(forceVisible) {
        const panel = documentRef.getElementById("shortcut-panel");
        const toggleButton = documentRef.getElementById("shortcut-help");
        if (!panel) return;
        const shouldShow = typeof forceVisible === "boolean"
            ? forceVisible
            : panel.classList.contains("shortcut-panel--hidden");
        if (shouldShow) {
            positionShortcutPanel(panel, toggleButton);
            panel.classList.remove("shortcut-panel--hidden");
            return;
        }
        panel.classList.add("shortcut-panel--hidden");
    }

    function isNodeLike(target) {
        if (!target) return false;
        if (nodeCtor) return target instanceof nodeCtor;
        return typeof target === "object";
    }

    function bind() {
        if (bound) return;
        bound = true;

        if (onClick) {
            onClick("shortcut-help", function () {
                toggleShortcutPanel();
            });
        }

        if (!globalBound) {
            globalBound = true;
            windowRef.addEventListener("resize", function () {
                const panel = documentRef.getElementById("shortcut-panel");
                const button = documentRef.getElementById("shortcut-help");
                if (!panel || !button || panel.classList.contains("shortcut-panel--hidden")) return;
                positionShortcutPanel(panel, button);
            });

            documentRef.addEventListener("pointerdown", function (event) {
                const panel = documentRef.getElementById("shortcut-panel");
                const button = documentRef.getElementById("shortcut-help");
                if (!panel || panel.classList.contains("shortcut-panel--hidden")) return;
                if (!isNodeLike(event.target)) return;
                if (panel.contains(event.target)) return;
                if (button && button.contains(event.target)) return;
                toggleShortcutPanel(false);
            });
        }

        documentRef.addEventListener("keydown", function (event) {
            if (event.defaultPrevented) return;
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (isInteractiveInputTarget(event.target)) return;

            const key = event.key;
            const lowerKey = typeof key === "string" ? key.toLowerCase() : "";

            if (key === "Escape") {
                toggleShortcutPanel(false);
                return;
            }

            if (key === "?" || key === "/") {
                event.preventDefault();
                toggleShortcutPanel();
                return;
            }

            if (key === " " || lowerKey === "k") {
                event.preventDefault();
                clickControlButton("animate");
                return;
            }

            if (key === "ArrowLeft") {
                event.preventDefault();
                clickControlButton(event.shiftKey ? "fastbackward" : "backward");
                return;
            }

            if (key === "ArrowRight") {
                event.preventDefault();
                clickControlButton(event.shiftKey ? "fastforward" : "forward");
                return;
            }

            if (lowerKey === "j") {
                event.preventDefault();
                clickControlButton("fastbackward");
                return;
            }

            if (lowerKey === "l") {
                event.preventDefault();
                clickControlButton("fastforward");
                return;
            }

            if (
                key === "-" ||
                key === "_" ||
                event.code === "Minus" ||
                event.code === "NumpadSubtract"
            ) {
                event.preventDefault();
                clickControlButton("slower");
                return;
            }

            if (
                key === "+" ||
                key === "=" ||
                event.code === "Equal" ||
                event.code === "NumpadAdd"
            ) {
                event.preventDefault();
                clickControlButton("faster");
                return;
            }

            if (lowerKey === "r") {
                event.preventDefault();
                clickControlButton("realtime");
                return;
            }

            if (lowerKey === "n") {
                event.preventDefault();
                clickControlButton("missionnow");
            }
        });
    }

    return {
        bind,
        positionShortcutPanel,
        toggleShortcutPanel,
    };
}
