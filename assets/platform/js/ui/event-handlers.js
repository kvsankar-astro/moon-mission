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
                of: "#svg-top-baseline",
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
        toggleLockSC,
        toggleLockMoon,
        toggleLockEarth,
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
    onChangeAll('input[name="camera-pair"]', changeCameraFromTo);
    onChange("camera-fov-one-degree", changeCameraFromTo);
    onClick("checkbox-lock-sc", toggleLockSC);
    onClick("checkbox-lock-moon", toggleLockMoon);
    onClick("checkbox-lock-earth", toggleLockEarth);

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
