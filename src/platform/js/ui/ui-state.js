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

function getSelectValue(idOrSelector, fallback = "") {
    const element = getElement(idOrSelector);
    const value = element?.value;
    return value !== undefined && value !== null && value !== "" ? value : fallback;
}

function setSelectValue(idOrSelector, value) {
    const element = getElement(idOrSelector);
    if (!element) return;
    element.value = value;
}

export function readOriginMode() {
    if (getChecked("origin-relative")) return "geo";
    if (getChecked("origin-earth")) return "geo";
    if (getChecked("origin-moon")) return "lunar";
    return "undefined";
}

const VIEW_SETTING_CHECKBOXES = {
    viewAdditionalCrafts: "view-additional-crafts",
    viewOrbit: "view-orbit",
    viewOrbitDescent: "view-orbit-descent",
    viewCraters: "view-craters",
    viewXYZAxes: "view-xyz-axes",
    viewPoles: "view-poles",
    viewPolarAxes: "view-polar-axes",
    viewSky: "view-sky",
    viewConstellationLines: "view-constellation-lines",
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

    const activeCraftId = getSelectValue("active-craft-select", "");
    if (activeCraftId) {
        settings.activeCraftId = activeCraftId;
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

export function readCameraPositionMode() {
    return getSelectValue("camera-position", "manual");
}

export function readCameraLookMode() {
    return getSelectValue("camera-look", "manual");
}

export function applyCameraFromTo(patch) {
    if (!patch) return;
    if (patch.positionMode) setSelectValue("camera-position", patch.positionMode);
    if (patch.lookMode) setSelectValue("camera-look", patch.lookMode);
}
