/**
 * UI Event Handlers
 *
 * Centralizes DOM event wiring for mission.html.
 * This keeps mission.js focused on orchestration and business logic.
 */

/**
 * Bind the Settings panel opener.
 */
export function bindSettingsPanel() {
    $("#settings-panel-button").on("click", function() {
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
        window.CY3Dialog?.widget?.("#settings-panel")
            ?.css({ "background-image": "none", border: "0", "max-width": "80%", "z-index": "9999" });
    });
}

/**
 * Bind the dynamically-created burn buttons to the provided handler.
 * @param {number} eventCount
 * @param {(index: number) => void} onBurn
 */
export function bindBurnButtons(eventCount, onBurn) {
    for (let i = 0; i < eventCount; ++i) {
        $("#burn" + (i + 1)).on("click", function() { onBurn(i); });
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

    $("#reset").on("click", reset);

    $("#origin-earth").on("click", toggleMode);
    $("#origin-moon").on("click", toggleMode);
    $("#camera-default").on("click", toggleCamera);
    $("#camera-moon").on("click", toggleCamera);
    $("#checkbox-lock-sc").on("click", toggleLockSC);
    $("#checkbox-lock-moon").on("click", toggleLockMoon);
    $("#checkbox-lock-earth").on("click", toggleLockEarth);

    $("#checkbox-lock-default").on("click", togglePlane);
    $("#checkbox-lock-xy").on("click", togglePlane);
    $("#checkbox-lock-zx").on("click", togglePlane);
    $("#checkbox-lock-yz").on("click", togglePlane);

    $("#checkbox-lock-xy-minus").on("click", togglePlane);
    $("#checkbox-lock-zx-minus").on("click", togglePlane);
    $("#checkbox-lock-yz-minus").on("click", togglePlane);

    $("#view-orbit").on("click", setView);
    $("#view-orbit-descent").on("click", setView);
    $("#view-craters").on("click", setView);
    $("#view-xyz-axes").on("click", setView);
    $("#view-poles").on("click", setView);
    $("#view-polar-axes").on("click", setView);
    $("#view-sky").on("click", setView);
    $("#view-moonsoi").on("click", setView);
    $("#view-eclipticplane").on("click", setView);
    $("#view-equatorialplane").on("click", setView);
    $("#view-fps").on("click", setView);

    $("#dimension-2D").on("click", setDimensionTop);
    $("#dimension-3D").on("click", setDimensionTop);

    $("#animate").on("click", cy3Animate);
    $("#joyride").on("click", toggleJoyRide);
    $("#joyridebutton").on("click", toggleJoyRide);
    $("#landing").on("click", toggleLanding);
    $("#landingbutton").on("click", toggleLanding);

    $("#info-button").on("click", toggleInfo);
}
