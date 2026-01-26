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

/**
 * Bind the Settings panel opener.
 */
export function bindSettingsPanel() {
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
        window.CY3Dialog?.init?.("#settings-panel", options);
        window.CY3Dialog?.open?.("#settings-panel");

        // Keep the existing styling adjustments applied to the wrapper.
        const wrapper = window.CY3Dialog?.widgetElement?.("#settings-panel");
        if (wrapper) {
            wrapper.style.backgroundImage = "none";
            wrapper.style.border = "0";
            wrapper.style.maxWidth = "80%";
            wrapper.style.zIndex = "9999";
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
        toggleCamera,
        toggleLockSC,
        toggleLockMoon,
        toggleLockEarth,
        togglePlane,
        setView,
        setDimensionTop,
        cy3Animate,
        toggleJoyRide,
        toggleLanding,
        toggleInfo
    } = handlers;

    onClick("reset", reset);

    onClick("origin-earth", toggleMode);
    onClick("origin-moon", toggleMode);
    onClick("origin-relative", toggleRelativeMode);
    onClick("camera-default", toggleCamera);
    onClick("camera-moon", toggleCamera);
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

    onClick("animate", cy3Animate);
    onClick("joyride", toggleJoyRide);
    onClick("joyridebutton", toggleJoyRide);
    onClick("landing", toggleLanding);
    onClick("landingbutton", toggleLanding);

    onClick("info-button", toggleInfo);
}
