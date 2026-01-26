/**
 * UI State Helpers
 *
 * Imperative-shell utilities for reading and writing UI control state.
 * These helpers centralize DOM access so core/renderer code can stay focused.
 */

function normalizeId(idOrSelector) {
    if (!idOrSelector) return "";
    return idOrSelector.startsWith("#") ? idOrSelector.slice(1) : idOrSelector;
}

function getElement(idOrSelector) {
    return document.getElementById(normalizeId(idOrSelector));
}

export function getChecked(idOrSelector) {
    const element = getElement(idOrSelector);
    return !!element?.checked;
}

export function setChecked(idOrSelector, checked) {
    const element = getElement(idOrSelector);
    if (!element) return;
    element.checked = !!checked;
}

export function readOriginMode() {
    if (getChecked("origin-relative")) return "geo";
    if (getChecked("origin-earth")) return "geo";
    if (getChecked("origin-moon")) return "lunar";
    return "undefined";
}

const VIEW_SETTING_CHECKBOXES = {
    viewOrbit: "view-orbit",
    viewOrbitDescent: "view-orbit-descent",
    viewCraters: "view-craters",
    viewXYZAxes: "view-xyz-axes",
    viewPoles: "view-poles",
    viewPolarAxes: "view-polar-axes",
    viewSky: "view-sky",
    viewMoonSOI: "view-moonsoi",
    viewEclipticPlane: "view-eclipticplane",
    viewEquatorialPlane: "view-equatorialplane",
    viewFPS: "view-fps"
};

export function readViewSettings() {
    /** @type {Record<string, boolean>} */
    const settings = {};

    for (const [key, id] of Object.entries(VIEW_SETTING_CHECKBOXES)) {
        settings[key] = getChecked(id);
    }

    return settings;
}

/**
 * Apply a partial update to the view settings checkboxes.
 * @param {Record<string, boolean>} patch - Partial settings object keyed like readViewSettings()
 */
export function applyViewSettings(patch) {
    if (!patch) return;

    for (const [key, value] of Object.entries(patch)) {
        const id = VIEW_SETTING_CHECKBOXES[key];
        if (!id) continue;
        setChecked(id, value);
    }
}
