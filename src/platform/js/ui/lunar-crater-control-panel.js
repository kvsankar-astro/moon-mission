import {
    LUNAR_CRATER_DEFAULT_MAX_DIAMETER_KM,
    LUNAR_CRATER_DEFAULT_MIN_DIAMETER_KM,
    LUNAR_CRATER_DIAMETER_STEP_KM,
    LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
    LUNAR_CRATER_DISPLAY_MODE_HOVER,
    LUNAR_CRATER_RANGE_MAX_DIAMETER_KM,
    LUNAR_CRATER_RANGE_MIN_DIAMETER_KM,
    createDefaultLunarCraterViewState,
    normalizeLunarCraterDiameterRange,
    normalizeLunarCraterDisplayMode,
    normalizeLunarCraterViewState,
} from "../core/domain/lunar-crater-view.js";
import lunarCraterCatalog from "../../../../assets/lunar-craters.json";
import {
    countCraterDisplayFeatures,
} from "../core/domain/lunar-crater-catalog.js";

const CRATER_DENSE_SELECTION_COUNT = 1000;
const CRATER_DIAMETER_COMMIT_DELAY_MS = 180;

const craterCountFormatter = typeof Intl !== "undefined"
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
    : null;

function readNumericControlValue(control, fallback) {
    const value = Number(control?.value);
    return Number.isFinite(value) ? value : fallback;
}

function formatDiameterKm(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "";
    if (Number.isInteger(numericValue)) return String(numericValue);
    return numericValue.toFixed(1).replace(/\.0$/, "");
}

function formatDiameterRange(state) {
    const normalized = normalizeLunarCraterViewState(state);
    return `${formatDiameterKm(normalized.lunarCraterMinDiameterKm)}-${formatDiameterKm(
        normalized.lunarCraterMaxDiameterKm,
    )} km`;
}

function formatCraterCount(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "0";
    return craterCountFormatter
        ? craterCountFormatter.format(numericValue)
        : String(Math.round(numericValue));
}

function getFilteredCraterCount(state) {
    return countCraterDisplayFeatures(lunarCraterCatalog, normalizeLunarCraterViewState(state));
}

function setLunarCraterControlPending(elements = {}, pending) {
    elements.panel?.classList?.toggle?.("is-busy", pending === true);
    elements.panel?.setAttribute?.("aria-busy", pending === true ? "true" : "false");
    if (elements.busyIndicator) {
        elements.busyIndicator.hidden = pending !== true;
    }
}

function syncLunarCraterCountStatus(elements = {}, state = {}) {
    const normalized = normalizeLunarCraterViewState(state);
    const filteredCount = getFilteredCraterCount(normalized);
    if (elements.countValue) {
        elements.countValue.textContent = `${formatCraterCount(filteredCount)} selected`;
    }
    if (!elements.nudge) {
        return;
    }
    let message = "";
    if (
        normalized.viewLunarCraters === true &&
        filteredCount > CRATER_DENSE_SELECTION_COUNT &&
        normalized.lunarCraterDisplayMode === LUNAR_CRATER_DISPLAY_MODE_ALWAYS
    ) {
        message = "Showing the visible subset. Zoom in for more detail, or switch to hover mode.";
    } else if (
        normalized.viewLunarCraters === true &&
        filteredCount > CRATER_DENSE_SELECTION_COUNT &&
        normalized.lunarCraterDisplayMode === LUNAR_CRATER_DISPLAY_MODE_HOVER
    ) {
        message = "Dense range. Hover to inspect individual craters.";
    }
    elements.nudge.textContent = message;
    elements.nudge.hidden = !message;
}

export function getLunarCraterControlPanelElements(documentRef, {
    idPrefix = "lunar-crater",
    pillId = null,
    visibleInputId = null,
} = {}) {
    const getElement = (id) => documentRef?.getElementById?.(id) || null;
    return {
        pill: pillId ? getElement(pillId) : null,
        panel: getElement(`${idPrefix}-controls-panel`),
        visibleInput: getElement(visibleInputId || `${idPrefix}-visible`) ||
            (idPrefix === "lunar-crater" ? getElement("view-lunar-craters") : null),
        hoverInput: getElement(`${idPrefix}-hover-labels`),
        modeInput: getElement(`${idPrefix}-display-mode`),
        offToggle: getElement(`${idPrefix}-off-toggle`),
        visibleToggle: getElement(`${idPrefix}-visible-toggle`),
        hoverToggle: getElement(`${idPrefix}-hover-toggle`),
        minDiameterSlider: getElement(`${idPrefix}-min-diameter`),
        minDiameterStepDown: getElement(`${idPrefix}-min-diameter-step-down`),
        minDiameterStepUp: getElement(`${idPrefix}-min-diameter-step-up`),
        maxDiameterSlider: getElement(`${idPrefix}-max-diameter`),
        maxDiameterStepDown: getElement(`${idPrefix}-max-diameter-step-down`),
        maxDiameterStepUp: getElement(`${idPrefix}-max-diameter-step-up`),
        diameterValue: getElement(`${idPrefix}-diameter-value`),
        countValue: getElement(`${idPrefix}-count-value`),
        busyIndicator: getElement(`${idPrefix}-busy-indicator`),
        nudge: getElement(`${idPrefix}-nudge`),
    };
}

export function readLunarCraterControlState(elements = {}) {
    const fallback = createDefaultLunarCraterViewState();
    return normalizeLunarCraterViewState({
        viewLunarCraters: elements.visibleInput?.checked === true,
        lunarCraterHoverLabels: elements.hoverInput?.checked !== false,
        lunarCraterDisplayMode: normalizeLunarCraterDisplayMode(elements.modeInput?.value),
        lunarCraterMinDiameterKm: readNumericControlValue(
            elements.minDiameterSlider,
            fallback.lunarCraterMinDiameterKm,
        ),
        lunarCraterMaxDiameterKm: readNumericControlValue(
            elements.maxDiameterSlider,
            fallback.lunarCraterMaxDiameterKm,
        ),
    });
}

export function writeLunarCraterControlState(elements = {}, patch = {}) {
    const normalized = normalizeLunarCraterViewState({
        ...readLunarCraterControlState(elements),
        ...patch,
    });
    if (Object.prototype.hasOwnProperty.call(patch, "viewLunarCraters") && elements.visibleInput) {
        elements.visibleInput.checked = normalized.viewLunarCraters === true;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "lunarCraterHoverLabels") && elements.hoverInput) {
        elements.hoverInput.checked = normalized.lunarCraterHoverLabels !== false;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "lunarCraterDisplayMode") && elements.modeInput) {
        elements.modeInput.value = normalized.lunarCraterDisplayMode;
    }
    if (
        (
            Number.isFinite(Number(patch.lunarCraterMinDiameterKm)) ||
            Number.isFinite(Number(patch.lunarCraterMaxDiameterKm))
        ) &&
        elements.minDiameterSlider &&
        elements.maxDiameterSlider
    ) {
        elements.minDiameterSlider.value = String(normalized.lunarCraterMinDiameterKm);
        elements.maxDiameterSlider.value = String(normalized.lunarCraterMaxDiameterKm);
    }
    if (elements.diameterValue) {
        elements.diameterValue.value = formatDiameterRange(normalized);
        elements.diameterValue.textContent = formatDiameterRange(normalized);
    }
    syncLunarCraterCountStatus(elements, normalized);
}

export function syncLunarCraterControlPanel(elements = {}, state = readLunarCraterControlState(elements)) {
    const normalized = normalizeLunarCraterViewState(state);
    const enabled = normalized.viewLunarCraters === true;
    const controlsDisabled = elements.disabled === true;
    const panelOpen = elements.panel ? elements.panel.hidden === false : false;

    if (elements.pill) {
        elements.pill.classList?.toggle?.("is-active", enabled);
        elements.pill.classList?.toggle?.("is-open", panelOpen);
        elements.pill.setAttribute?.("aria-pressed", enabled ? "true" : "false");
        elements.pill.setAttribute?.("aria-expanded", panelOpen ? "true" : "false");
        elements.pill.disabled = controlsDisabled;
    }
    if (elements.offToggle) {
        elements.offToggle.classList?.toggle?.("is-active", !enabled);
        elements.offToggle.setAttribute?.("aria-pressed", enabled ? "false" : "true");
        elements.offToggle.textContent = "Off";
        elements.offToggle.disabled = controlsDisabled;
    }
    if (elements.visibleToggle) {
        const active = enabled && normalized.lunarCraterDisplayMode === LUNAR_CRATER_DISPLAY_MODE_ALWAYS;
        elements.visibleToggle.classList?.toggle?.("is-active", active);
        elements.visibleToggle.setAttribute?.("aria-pressed", active ? "true" : "false");
        elements.visibleToggle.textContent = "Show always";
        elements.visibleToggle.disabled = controlsDisabled;
    }
    if (elements.hoverToggle) {
        const active = enabled && normalized.lunarCraterDisplayMode === LUNAR_CRATER_DISPLAY_MODE_HOVER;
        elements.hoverToggle.classList?.toggle?.("is-active", active);
        elements.hoverToggle.setAttribute?.("aria-pressed", active ? "true" : "false");
        elements.hoverToggle.textContent = "Show on hover";
        elements.hoverToggle.disabled = controlsDisabled;
    }
    if (elements.minDiameterSlider && elements.maxDiameterSlider) {
        elements.minDiameterSlider.value = String(normalized.lunarCraterMinDiameterKm);
        elements.maxDiameterSlider.value = String(normalized.lunarCraterMaxDiameterKm);
        for (const slider of [elements.minDiameterSlider, elements.maxDiameterSlider]) {
            slider.disabled = controlsDisabled || !enabled;
            slider.setAttribute?.("aria-disabled", slider.disabled ? "true" : "false");
        }
    }
    for (const button of [
        elements.minDiameterStepDown,
        elements.minDiameterStepUp,
        elements.maxDiameterStepDown,
        elements.maxDiameterStepUp,
    ]) {
        if (!button) continue;
        button.disabled = controlsDisabled || !enabled;
        button.setAttribute?.("aria-disabled", button.disabled ? "true" : "false");
    }
    if (elements.diameterValue) {
        elements.diameterValue.value = formatDiameterRange(normalized);
        elements.diameterValue.textContent = formatDiameterRange(normalized);
    }
    syncLunarCraterCountStatus(elements, normalized);
}

export function bindLunarCraterControlPanel({ elements, commitPatch, sync }) {
    const disposers = [];
    let pendingDiameterPatch = null;
    let pendingDiameterOptions = null;
    let pendingDiameterTimer = null;
    const scheduleCommit = typeof window !== "undefined" && typeof window.setTimeout === "function"
        ? window.setTimeout.bind(window)
        : setTimeout;
    const clearScheduledCommit = typeof window !== "undefined" && typeof window.clearTimeout === "function"
        ? window.clearTimeout.bind(window)
        : clearTimeout;
    const syncControls = typeof sync === "function"
        ? sync
        : () => syncLunarCraterControlPanel(elements);
    const listen = (element, type, handler, options) => {
        if (!element?.addEventListener) return;
        element.addEventListener(type, handler, options);
        disposers.push(() => element.removeEventListener?.(type, handler, options));
    };
    const flushDiameterCommit = () => {
        if (pendingDiameterTimer !== null) {
            clearScheduledCommit(pendingDiameterTimer);
            pendingDiameterTimer = null;
        }
        if (!pendingDiameterPatch) {
            setLunarCraterControlPending(elements, false);
            return;
        }
        const patch = pendingDiameterPatch;
        const options = pendingDiameterOptions || {};
        pendingDiameterPatch = null;
        pendingDiameterOptions = null;
        writeLunarCraterControlState(elements, patch);
        commitPatch?.(patch, options);
        setLunarCraterControlPending(elements, false);
        syncControls();
    };
    const queueDiameterCommit = (patch, options = {}) => {
        pendingDiameterPatch = patch;
        pendingDiameterOptions = options;
        writeLunarCraterControlState(elements, patch);
        setLunarCraterControlPending(elements, true);
        syncLunarCraterControlPanel(elements, readLunarCraterControlState(elements));
        if (pendingDiameterTimer !== null) {
            clearScheduledCommit(pendingDiameterTimer);
        }
        pendingDiameterTimer = scheduleCommit(flushDiameterCommit, CRATER_DIAMETER_COMMIT_DELAY_MS);
    };
    const commit = (patch, options = {}) => {
        flushDiameterCommit();
        writeLunarCraterControlState(elements, patch);
        commitPatch?.(patch, options);
        syncControls();
    };

    listen(elements.offToggle, "click", () => {
        commit(
            { viewLunarCraters: false },
            { sourceId: elements.offToggle?.id || "lunar-crater-off-toggle" },
        );
    });
    listen(elements.visibleToggle, "click", () => {
        commit(
            {
                viewLunarCraters: true,
                lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
                lunarCraterHoverLabels: false,
            },
            { sourceId: elements.visibleToggle?.id || "lunar-crater-visible-toggle" },
        );
    });
    listen(elements.hoverToggle, "click", () => {
        commit(
            {
                viewLunarCraters: true,
                lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_HOVER,
                lunarCraterHoverLabels: true,
            },
            { sourceId: elements.hoverToggle?.id || "lunar-crater-hover-toggle" },
        );
    });

    const commitDiameterRange = (source) => {
        const fallback = createDefaultLunarCraterViewState();
        let minDiameterKm = readNumericControlValue(
            elements.minDiameterSlider,
            fallback.lunarCraterMinDiameterKm,
        );
        let maxDiameterKm = readNumericControlValue(
            elements.maxDiameterSlider,
            fallback.lunarCraterMaxDiameterKm,
        );
        if (source === "min" && minDiameterKm > maxDiameterKm) {
            maxDiameterKm = minDiameterKm;
        } else if (source === "max" && maxDiameterKm < minDiameterKm) {
            minDiameterKm = maxDiameterKm;
        }
        const range = normalizeLunarCraterDiameterRange({
            lunarCraterMinDiameterKm: minDiameterKm,
            lunarCraterMaxDiameterKm: maxDiameterKm,
        });
        queueDiameterCommit(
            range,
            {
                sourceId: source === "max"
                    ? elements.maxDiameterSlider?.id || "lunar-crater-max-diameter"
                    : elements.minDiameterSlider?.id || "lunar-crater-min-diameter",
            },
        );
    };

    const readSliderStep = (slider) => {
        const step = Number(slider?.step);
        return Number.isFinite(step) && step > 0 ? step : LUNAR_CRATER_DIAMETER_STEP_KM;
    };

    const adjustDiameter = (slider, delta, source) => {
        if (!slider || slider.disabled === true) return;
        const fallback = source === "max"
            ? LUNAR_CRATER_DEFAULT_MAX_DIAMETER_KM
            : LUNAR_CRATER_DEFAULT_MIN_DIAMETER_KM;
        const value = readNumericControlValue(slider, fallback);
        const min = readNumericControlValue(slider.min ? { value: slider.min } : null, LUNAR_CRATER_RANGE_MIN_DIAMETER_KM);
        const max = readNumericControlValue(slider.max ? { value: slider.max } : null, LUNAR_CRATER_RANGE_MAX_DIAMETER_KM);
        const nextValue = Math.min(max, Math.max(min, value + delta));
        slider.value = String(nextValue);
        commitDiameterRange(source);
    };

    listen(elements.minDiameterSlider, "input", () => commitDiameterRange("min"));
    listen(elements.minDiameterSlider, "change", () => commitDiameterRange("min"));
    listen(elements.maxDiameterSlider, "input", () => commitDiameterRange("max"));
    listen(elements.maxDiameterSlider, "change", () => commitDiameterRange("max"));
    listen(elements.minDiameterStepDown, "click", () => {
        adjustDiameter(elements.minDiameterSlider, -readSliderStep(elements.minDiameterSlider), "min");
    });
    listen(elements.minDiameterStepUp, "click", () => {
        adjustDiameter(elements.minDiameterSlider, readSliderStep(elements.minDiameterSlider), "min");
    });
    listen(elements.maxDiameterStepDown, "click", () => {
        adjustDiameter(elements.maxDiameterSlider, -readSliderStep(elements.maxDiameterSlider), "max");
    });
    listen(elements.maxDiameterStepUp, "click", () => {
        adjustDiameter(elements.maxDiameterSlider, readSliderStep(elements.maxDiameterSlider), "max");
    });
    listen(elements.visibleInput, "change", syncControls);
    listen(elements.hoverInput, "change", syncControls);
    listen(elements.modeInput, "change", syncControls);

    syncControls();
    return () => {
        if (pendingDiameterTimer !== null) {
            clearScheduledCommit(pendingDiameterTimer);
            pendingDiameterTimer = null;
        }
        setLunarCraterControlPending(elements, false);
        for (const dispose of disposers.splice(0)) {
            dispose();
        }
    };
}

export function createLunarCraterControlPanelElements(documentRef, options = {}) {
    const prefix = options.idPrefix || "lunar-crater";
    const state = createDefaultLunarCraterViewState();

    const panel = documentRef.createElement("div");
    panel.id = `${prefix}-controls-panel`;
    panel.className = "lunar-crater-controls-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Lunar crater controls");
    panel.hidden = true;

    const visibleInput = documentRef.createElement("input");
    visibleInput.type = "checkbox";
    visibleInput.id = `${prefix}-visible`;
    visibleInput.checked = state.viewLunarCraters;
    visibleInput.hidden = true;

    const hoverInput = documentRef.createElement("input");
    hoverInput.type = "checkbox";
    hoverInput.id = `${prefix}-hover-labels`;
    hoverInput.checked = state.lunarCraterHoverLabels;
    hoverInput.hidden = true;

    const modeInput = documentRef.createElement("input");
    modeInput.type = "hidden";
    modeInput.id = `${prefix}-display-mode`;
    modeInput.value = state.lunarCraterDisplayMode;

    const toggles = documentRef.createElement("div");
    toggles.className = "lunar-crater-controls-panel__toggles";
    toggles.setAttribute("role", "group");
    toggles.setAttribute("aria-label", "Crater display mode");

    const makeButton = (idSuffix, text, title, pressed = "false") => {
        const button = documentRef.createElement("button");
        button.id = `${prefix}-${idSuffix}`;
        button.type = "button";
        button.className = "lunar-crater-controls-panel__button";
        button.setAttribute("aria-pressed", pressed);
        button.title = title;
        button.textContent = text;
        return button;
    };
    const offToggle = makeButton("off-toggle", "Off", "Hide lunar crater annotations", "true");
    const visibleToggle = makeButton(
        "visible-toggle",
        "Show always",
        "Show lunar crater boundaries and labels",
    );
    const hoverToggle = makeButton(
        "hover-toggle",
        "Show on hover",
        "Show the crater under the pointer",
    );
    toggles.appendChild(offToggle);
    toggles.appendChild(visibleToggle);
    toggles.appendChild(hoverToggle);

    const label = documentRef.createElement("label");
    label.className = "lunar-crater-controls-panel__range-label";
    label.setAttribute("for", `${prefix}-min-diameter`);
    const labelText = documentRef.createElement("span");
    labelText.textContent = "Diameter";
    const diameterValue = documentRef.createElement("output");
    diameterValue.id = `${prefix}-diameter-value`;
    diameterValue.className = "lunar-crater-controls-panel__diameter-value";
    diameterValue.setAttribute("for", `${prefix}-min-diameter ${prefix}-max-diameter`);
    diameterValue.value = formatDiameterRange(state);
    diameterValue.textContent = formatDiameterRange(state);
    label.appendChild(labelText);
    label.appendChild(diameterValue);

    const rangeStack = documentRef.createElement("div");
    rangeStack.className = "lunar-crater-controls-panel__range-stack";

    const createStepButton = (idSuffix, labelTextValue, text) => {
        const button = documentRef.createElement("button");
        button.id = `${prefix}-${idSuffix}`;
        button.type = "button";
        button.className = "lunar-crater-controls-panel__step-button";
        button.setAttribute("aria-label", labelTextValue);
        button.title = labelTextValue;
        button.textContent = text;
        return button;
    };

    const createDiameterSlider = (idSuffix, labelTextValue, value) => {
        const slider = documentRef.createElement("input");
        slider.id = `${prefix}-${idSuffix}`;
        slider.className = "lunar-crater-controls-panel__range";
        slider.type = "range";
        slider.min = String(LUNAR_CRATER_RANGE_MIN_DIAMETER_KM);
        slider.max = String(LUNAR_CRATER_RANGE_MAX_DIAMETER_KM);
        slider.step = String(LUNAR_CRATER_DIAMETER_STEP_KM);
        slider.value = String(value);
        slider.setAttribute("aria-label", labelTextValue);
        return slider;
    };
    const minDiameterSlider = createDiameterSlider(
        "min-diameter",
        "Minimum crater diameter",
        LUNAR_CRATER_DEFAULT_MIN_DIAMETER_KM,
    );
    const maxDiameterSlider = createDiameterSlider(
        "max-diameter",
        "Maximum crater diameter",
        LUNAR_CRATER_DEFAULT_MAX_DIAMETER_KM,
    );
    const minDiameterStepDown = createStepButton(
        "min-diameter-step-down",
        "Decrease minimum crater diameter",
        "-",
    );
    const minDiameterStepUp = createStepButton(
        "min-diameter-step-up",
        "Increase minimum crater diameter",
        "+",
    );
    const maxDiameterStepDown = createStepButton(
        "max-diameter-step-down",
        "Decrease maximum crater diameter",
        "-",
    );
    const maxDiameterStepUp = createStepButton(
        "max-diameter-step-up",
        "Increase maximum crater diameter",
        "+",
    );
    const createSliderRow = (stepDown, slider, stepUp) => {
        const row = documentRef.createElement("div");
        row.className = "lunar-crater-controls-panel__range-row";
        row.appendChild(stepDown);
        row.appendChild(slider);
        row.appendChild(stepUp);
        return row;
    };
    rangeStack.appendChild(createSliderRow(minDiameterStepDown, minDiameterSlider, minDiameterStepUp));
    rangeStack.appendChild(createSliderRow(maxDiameterStepDown, maxDiameterSlider, maxDiameterStepUp));

    const scale = documentRef.createElement("div");
    scale.className = "lunar-crater-controls-panel__scale";
    scale.setAttribute("aria-hidden", "true");
    const small = documentRef.createElement("span");
    small.textContent = `${LUNAR_CRATER_RANGE_MIN_DIAMETER_KM} km`;
    const large = documentRef.createElement("span");
    large.textContent = `${LUNAR_CRATER_RANGE_MAX_DIAMETER_KM} km`;
    scale.appendChild(small);
    scale.appendChild(large);

    const statusRow = documentRef.createElement("div");
    statusRow.className = "lunar-crater-controls-panel__status-row";
    const busyIndicator = documentRef.createElement("span");
    busyIndicator.id = `${prefix}-busy-indicator`;
    busyIndicator.className = "lunar-crater-controls-panel__busy-indicator";
    busyIndicator.hidden = true;
    busyIndicator.textContent = "Rendering";
    const countValue = documentRef.createElement("span");
    countValue.id = `${prefix}-count-value`;
    countValue.className = "lunar-crater-controls-panel__count-value";
    countValue.setAttribute("aria-live", "polite");
    statusRow.appendChild(busyIndicator);
    statusRow.appendChild(countValue);

    const nudge = documentRef.createElement("div");
    nudge.id = `${prefix}-nudge`;
    nudge.className = "lunar-crater-controls-panel__nudge";
    nudge.hidden = true;

    panel.appendChild(visibleInput);
    panel.appendChild(hoverInput);
    panel.appendChild(modeInput);
    panel.appendChild(toggles);
    panel.appendChild(label);
    panel.appendChild(rangeStack);
    panel.appendChild(scale);
    panel.appendChild(statusRow);
    panel.appendChild(nudge);

    return {
        panel,
        visibleInput,
        hoverInput,
        modeInput,
        offToggle,
        visibleToggle,
        hoverToggle,
        minDiameterSlider,
        minDiameterStepDown,
        minDiameterStepUp,
        maxDiameterSlider,
        maxDiameterStepDown,
        maxDiameterStepUp,
        diameterValue,
        countValue,
        busyIndicator,
        nudge,
    };
}
