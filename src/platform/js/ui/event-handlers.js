/**
 * UI Event Handlers
 *
 * Centralizes DOM event wiring for mission.html.
 * This keeps mission.js focused on orchestration and business logic.
 */

function onClick(id, handler) {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener("click", handler);
}

function onChange(id, handler) {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener("change", handler);
}

function onChangeAll(selector, handler) {
    const elements = document.querySelectorAll(selector);
    if (!elements.length) return;
    elements.forEach((element) => element.addEventListener("change", handler));
}

function getMissionDialogApi() {
    return window.MissionDialog || window.CY3Dialog || null;
}

let keyboardShortcutsBound = false;
let settingsPanelResizeBound = false;

function isInteractiveInputTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return target.isContentEditable === true;
}

function clickControlButton(id) {
    const button = document.getElementById(id);
    if (!button || button.disabled) return false;
    button.click();
    return true;
}

function toggleShortcutPanel(forceVisible) {
    const panel = document.getElementById("shortcut-panel");
    if (!panel) return;
    const shouldShow = typeof forceVisible === "boolean"
        ? forceVisible
        : panel.classList.contains("shortcut-panel--hidden");
    panel.classList.toggle("shortcut-panel--hidden", !shouldShow);
}

function adjustSettingsPanelBodyOverflow() {
    const panel = document.getElementById("settings-panel");
    const body = document.getElementById("settings-panel-body");
    if (!panel || !body) return;
    if (panel.classList.contains("is-collapsed")) return;

    body.style.maxHeight = "none";
    body.style.overflowY = "visible";

    const panelRect = panel.getBoundingClientRect();
    const bottomGapPx = 14;
    const minBodyHeightPx = 220;
    const availableHeight = Math.max(minBodyHeightPx, Math.floor(window.innerHeight - panelRect.top - bottomGapPx));
    const needsScroll = body.scrollHeight > availableHeight + 1;

    body.style.maxHeight = `${availableHeight}px`;
    body.style.overflowY = needsScroll ? "auto" : "hidden";
}

/**
 * Bind the Settings panel opener.
 */
export function bindSettingsPanel() {
    const collapseButton = document.getElementById("settings-panel-collapse");
    if (collapseButton && !collapseButton.dataset.bound) {
        collapseButton.dataset.bound = "true";
        collapseButton.addEventListener("click", function () {
            const panel = document.getElementById("settings-panel");
            if (!panel) return;
            const collapsed = panel.classList.toggle("is-collapsed");
            collapseButton.setAttribute("aria-expanded", String(!collapsed));
            collapseButton.textContent = collapsed ? "▸" : "▾";
            if (!collapsed) {
                adjustSettingsPanelBodyOverflow();
                requestAnimationFrame(adjustSettingsPanelBodyOverflow);
            }
        });
    }

    const closeButton = document.getElementById("settings-panel-close");
    if (closeButton && !closeButton.dataset.bound) {
        closeButton.dataset.bound = "true";
        closeButton.addEventListener("click", function () {
            getMissionDialogApi()?.close?.("#settings-panel");
        });
    }

    onClick("settings-panel-button", function () {
        const options = {
            dialogClass: "dialog",
            modal: false,
            position: {
                my: "left top",
                at: "left bottom",
                of: "#settings-panel-button",
                collision: "fit flip"
            },
            title: "Settings",
            closeOnEscape: false
        };

        // Route through the lightweight dialog shim (not jQuery UI).
        const dialogApi = getMissionDialogApi();
        dialogApi?.init?.("#settings-panel", options);
        dialogApi?.open?.("#settings-panel");

        // Keep the existing styling adjustments applied to the wrapper.
        const wrapper = dialogApi?.widgetElement?.("#settings-panel");
        if (wrapper) {
            wrapper.style.backgroundImage = "none";
            wrapper.style.border = "0";
            wrapper.style.maxWidth = "80%";
            wrapper.style.zIndex = "9999";
            const titleBar = wrapper.querySelector(".ui-dialog-titlebar");
            if (titleBar) titleBar.style.display = "none";
        }

        const panel = document.getElementById("settings-panel");
        const collapseButton = document.getElementById("settings-panel-collapse");
        if (panel && collapseButton) {
            const collapsed = panel.classList.contains("is-collapsed");
            collapseButton.setAttribute("aria-expanded", String(!collapsed));
            collapseButton.textContent = collapsed ? "▸" : "▾";
        }

        adjustSettingsPanelBodyOverflow();
        requestAnimationFrame(adjustSettingsPanelBodyOverflow);

        if (!settingsPanelResizeBound) {
            settingsPanelResizeBound = true;
            window.addEventListener("resize", function () {
                const panel = document.getElementById("settings-panel");
                if (!panel || panel.style.display === "none") return;
                adjustSettingsPanelBodyOverflow();
            });
        }
    });
}

/**
 * Bind the dynamically-created burn buttons to the provided handler.
 * @param {number} eventCount
 * @param {(index: number) => void} onBurn
 */
export function bindBurnButtons(eventCount, onBurn) {
    for (let i = 0; i < eventCount; ++i) {
        onClick("burn" + (i + 1), function () {
            onBurn(i);
        });
    }
}

/**
 * Bind main UI controls.
 * @param {Object} handlers
 */
export function bindMainControls(handlers) {
    const {
        reset,
        toggleMode,
        toggleRelativeMode,
        changeCameraFromTo,
        togglePlane,
        setView,
        setDimensionTop,
        toggleAnimation,
        // Legacy compatibility while callers migrate.
        cy3Animate,
        toggleJoyRide,
        toggleLanding,
        toggleInfo
    } = handlers;

    onClick("reset", reset);

    onClick("origin-earth", toggleMode);
    onClick("origin-moon", toggleMode);
    onClick("origin-relative", toggleRelativeMode);
    onChange("camera-position", changeCameraFromTo);
    onChange("camera-look", changeCameraFromTo);
    onChangeAll('input[name="camera-position-pill"]', changeCameraFromTo);
    onChangeAll('input[name="camera-look-pill"]', changeCameraFromTo);
    onChange("camera-fov-one-degree", changeCameraFromTo);

    onClick("checkbox-lock-default", togglePlane);
    onClick("checkbox-lock-xy", togglePlane);
    onClick("checkbox-lock-zx", togglePlane);
    onClick("checkbox-lock-yz", togglePlane);

    onClick("checkbox-lock-xy-minus", togglePlane);
    onClick("checkbox-lock-zx-minus", togglePlane);
    onClick("checkbox-lock-yz-minus", togglePlane);

    onClick("view-orbit", setView);
    onClick("view-orbit-descent", setView);
    onClick("view-craters", setView);
    onClick("view-xyz-axes", setView);
    onClick("view-poles", setView);
    onClick("view-polar-axes", setView);
    onClick("view-sky", setView);
    onClick("view-constellation-lines", setView);
    onClick("view-moonsoi", setView);
    onClick("view-eclipticplane", setView);
    onClick("view-equatorialplane", setView);
    onClick("view-fps", setView);

    onClick("dimension-2D", setDimensionTop);
    onClick("dimension-3D", setDimensionTop);

    const animateHandler = typeof toggleAnimation === "function" ? toggleAnimation : cy3Animate;
    if (typeof animateHandler === "function") {
        onClick("animate", animateHandler);
    }
    onClick("joyride", toggleJoyRide);
    onClick("joyridebutton", toggleJoyRide);
    onClick("landing", toggleLanding);
    onClick("landingbutton", toggleLanding);

    onClick("info-button", toggleInfo);
}

export function bindKeyboardShortcuts() {
    if (keyboardShortcutsBound) return;
    keyboardShortcutsBound = true;

    onClick("shortcut-help", function () {
        toggleShortcutPanel();
    });

    document.addEventListener("keydown", function (event) {
        if (event.defaultPrevented) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (isInteractiveInputTarget(event.target)) return;

        const key = event.key;
        const lowerKey = typeof key === "string" ? key.toLowerCase() : "";

        if (key === "Escape") {
            toggleShortcutPanel(false);
            return;
        }

        if (key === "?" || (key === "/" && event.shiftKey)) {
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

        if (key === "-" || key === "_") {
            event.preventDefault();
            clickControlButton("slower");
            return;
        }

        if (key === "+" || key === "=") {
            event.preventDefault();
            clickControlButton("faster");
            return;
        }

        if (key === "0") {
            event.preventDefault();
            clickControlButton("resetspeed");
            return;
        }

        if (lowerKey === "r") {
            event.preventDefault();
            clickControlButton("realtime");
        }
    });
}
