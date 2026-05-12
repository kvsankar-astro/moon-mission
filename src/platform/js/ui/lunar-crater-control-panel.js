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
} from "../core/domain/lunar-crater-view.js";
import {
    createDefaultLunarFeatureViewState,
    LUNAR_FEATURE_PRESET_IDS,
    normalizeLunarFeatureViewState,
    normalizeLunarFeatureTypeFilters,
} from "../core/domain/lunar-feature-view.js";
import lunarCraterCatalog from "../../../../assets/lunar-features.json";
import {
    countCraterDisplayFeatures,
} from "../core/domain/lunar-crater-catalog.js";

const CRATER_DENSE_SELECTION_COUNT = 1000;
const CRATER_DIAMETER_COMMIT_DELAY_MS = 180;
const TYPE_FILTER_DEFAULT_MIN_KM = 0;
const TYPE_FILTER_DEFAULT_MAX_KM = 6000;

const LUNAR_FEATURE_PRESETS = Object.freeze([
    {
        id: LUNAR_FEATURE_PRESET_IDS.INTERESTING,
        label: "Interesting",
        title: "Balanced preset: removes clutter from satellite features",
    },
    {
        id: LUNAR_FEATURE_PRESET_IDS.NON_CRATER,
        label: "No Craters",
        title: "Show non-crater feature classes only",
    },
    {
        id: LUNAR_FEATURE_PRESET_IDS.CRATERS_ONLY,
        label: "Craters",
        title: "Show crater-only features",
    },
    {
        id: LUNAR_FEATURE_PRESET_IDS.ALL,
        label: "All",
        title: "Show all lunar feature classes",
    },
]);

const INTERESTING_TYPE_MINIMA_KM = Object.freeze({
    "Crater, craters": 120,
    "Rima, rimae": 80,
    "Mons, montes": 50,
    "Dorsum, dorsa": 80,
    "Mare, maria": 120,
    "Catena, catenae": 80,
    "Vallis, valles": 80,
    "Promontorium, promontoria": 20,
    "Palus, paludes": 120,
    "Oceanus, oceani": 400,
    "Planitia, planitiae": 0,
});

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
    const normalized = normalizeLunarFeatureViewState(state);
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

function getCatalogTypeStats() {
    const statsByType = new Map();
    for (const feature of lunarCraterCatalog?.features || []) {
        const featureType = typeof feature?.featureType === "string"
            ? feature.featureType
            : "";
        if (!featureType) continue;
        const diameterKm = Number(feature?.diameterKm);
        if (!Number.isFinite(diameterKm)) continue;
        const existing = statsByType.get(featureType);
        if (!existing) {
            statsByType.set(featureType, {
                featureType,
                count: 1,
                minDiameterKm: diameterKm,
                maxDiameterKm: diameterKm,
            });
            continue;
        }
        existing.count += 1;
        existing.minDiameterKm = Math.min(existing.minDiameterKm, diameterKm);
        existing.maxDiameterKm = Math.max(existing.maxDiameterKm, diameterKm);
    }
    return Array.from(statsByType.values())
        .sort((a, b) => b.count - a.count);
}

const CATALOG_TYPE_STATS = getCatalogTypeStats();

function formatFeatureTypeLabel(featureType) {
    const primary = String(featureType || "").split(",")[0].trim();
    return primary || String(featureType || "");
}

function formatTypeRangeValue(minDiameterKm, maxDiameterKm) {
    const min = Number(minDiameterKm);
    const max = Number(maxDiameterKm);
    const safeMin = Number.isFinite(min) ? Math.max(0, min) : TYPE_FILTER_DEFAULT_MIN_KM;
    const safeMax = Number.isFinite(max)
        ? Math.max(safeMin, max)
        : TYPE_FILTER_DEFAULT_MAX_KM;
    return `${formatDiameterKm(safeMin)}-${formatDiameterKm(safeMax)} km`;
}

function readOptionalNumericInputValue(input) {
    if (!input) return null;
    const raw = `${input.value ?? ""}`.trim();
    if (!raw) return null;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
}

function buildPresetTypeFilters(baseFilters, presetId) {
    const current = normalizeLunarFeatureTypeFilters(baseFilters);
    const next = {};
    for (const stats of CATALOG_TYPE_STATS) {
        const existing = current[stats.featureType] || {};
        const minDiameterKm = Number.isFinite(existing.minDiameterKm)
            ? existing.minDiameterKm
            : null;
        const maxDiameterKm = Number.isFinite(existing.maxDiameterKm)
            ? existing.maxDiameterKm
            : null;
        next[stats.featureType] = {
            enabled: existing.enabled !== false,
            minDiameterKm,
            maxDiameterKm,
        };
    }
    for (const [featureType, filter] of Object.entries(next)) {
        const isCrater = featureType === "Crater, craters";
        const isSatellite = featureType === "Satellite Feature";
        switch (presetId) {
            case LUNAR_FEATURE_PRESET_IDS.ALL:
                filter.enabled = true;
                filter.minDiameterKm = null;
                filter.maxDiameterKm = null;
                break;
            case LUNAR_FEATURE_PRESET_IDS.CRATERS_ONLY:
                filter.enabled = isCrater;
                break;
            case LUNAR_FEATURE_PRESET_IDS.NON_CRATER:
                filter.enabled = !isCrater && !isSatellite;
                break;
            case LUNAR_FEATURE_PRESET_IDS.INTERESTING:
            default:
                filter.enabled = !isSatellite;
                filter.minDiameterKm = Math.max(
                    Number(INTERESTING_TYPE_MINIMA_KM[featureType]) || 0,
                    filter.minDiameterKm || 0,
                );
                break;
        }
    }
    return normalizeLunarFeatureTypeFilters(next, current);
}

function areTypeFilterEntriesEquivalent(a = {}, b = {}) {
    const aEnabled = a.enabled !== false;
    const bEnabled = b.enabled !== false;
    const aMin = Number.isFinite(Number(a.minDiameterKm)) ? Number(a.minDiameterKm) : null;
    const bMin = Number.isFinite(Number(b.minDiameterKm)) ? Number(b.minDiameterKm) : null;
    const aMax = Number.isFinite(Number(a.maxDiameterKm)) ? Number(a.maxDiameterKm) : null;
    const bMax = Number.isFinite(Number(b.maxDiameterKm)) ? Number(b.maxDiameterKm) : null;
    return aEnabled === bEnabled && aMin === bMin && aMax === bMax;
}

function areTypeFiltersEquivalent(a = {}, b = {}) {
    const normalizedA = normalizeLunarFeatureTypeFilters(a);
    const normalizedB = normalizeLunarFeatureTypeFilters(b);
    const keys = new Set([
        ...Object.keys(normalizedA),
        ...Object.keys(normalizedB),
    ]);
    for (const key of keys) {
        if (!areTypeFilterEntriesEquivalent(normalizedA[key], normalizedB[key])) {
            return false;
        }
    }
    return true;
}

function getFilteredCraterCount(state) {
    return countCraterDisplayFeatures(lunarCraterCatalog, normalizeLunarFeatureViewState(state));
}

function setLunarCraterControlPending(elements = {}, pending) {
    elements.panel?.classList?.toggle?.("is-busy", pending === true);
    elements.panel?.setAttribute?.("aria-busy", pending === true ? "true" : "false");
    if (elements.busyIndicator) {
        elements.busyIndicator.hidden = pending !== true;
    }
}

function syncLunarCraterCountStatus(elements = {}, state = {}) {
    const normalized = normalizeLunarFeatureViewState(state);
    const filteredCount = getFilteredCraterCount(normalized);
    if (elements.countValue) {
        elements.countValue.textContent = `${formatCraterCount(filteredCount)} filtered`;
    }
    if (!elements.nudge) {
        return;
    }
    let message = "";
    if (normalized.viewLunarCraters !== true) {
        message = "Filters ready. Choose Show Always or Show on Hover below.";
    } else
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

function rehydrateTypeFilterControls(elements = {}, { panel, container, presetContainer } = {}) {
    if (!panel || !container) {
        return false;
    }
    const typeControls = new Map();
    const presetButtons = new Map();
    const statsByType = new Map(CATALOG_TYPE_STATS.map((entry) => [entry.featureType, entry]));

    if (presetContainer) {
        const presetButtonNodes = presetContainer.querySelectorAll?.("[data-preset-id]");
        for (const button of presetButtonNodes || []) {
            const presetId = `${button?.dataset?.presetId || ""}`;
            if (!presetId) continue;
            presetButtons.set(presetId, button);
        }
    }

    const rowNodes = container.querySelectorAll?.(".lunar-crater-controls-panel__type-row");
    for (const row of rowNodes || []) {
        const featureType = `${row?.dataset?.featureType || ""}`;
        if (!featureType) continue;
        const toggle = row.querySelector?.(".lunar-crater-controls-panel__type-toggle") || null;
        const typeNumbers = row.querySelectorAll?.(".lunar-crater-controls-panel__type-number") || [];
        const minInput = typeNumbers[0] || null;
        const maxInput = typeNumbers[1] || null;
        typeControls.set(featureType, {
            row,
            toggle,
            minInput,
            maxInput,
            stats: statsByType.get(featureType) || null,
        });
    }

    elements.typeControls = typeControls;
    elements.presetButtons = presetButtons;
    return typeControls.size > 0;
}

function ensureTypeFilterControls(elements = {}) {
    const panel = elements.panel;
    if (!panel || typeof panel.querySelector !== "function") {
        return;
    }
    let container = elements.typeFilterContainer;
    if (!container) {
        container = panel.querySelector(".lunar-crater-controls-panel__type-filters");
        elements.typeFilterContainer = container || null;
    }
    if (!container) {
        return;
    }
    let presetContainer = elements.presetContainer;
    if (!presetContainer) {
        presetContainer = panel.querySelector(".lunar-crater-controls-panel__presets");
        elements.presetContainer = presetContainer || null;
    }
    if (container.dataset.lunarFeatureTypesBuilt === "true") {
        rehydrateTypeFilterControls(elements, { panel, container, presetContainer });
        return;
    }
    while (presetContainer?.firstChild) {
        presetContainer.removeChild(presetContainer.firstChild);
    }
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const typeControls = new Map();
    const presetButtons = new Map();

    for (const preset of LUNAR_FEATURE_PRESETS) {
        const button = panel.ownerDocument?.createElement?.("button")
            || document.createElement("button");
        button.type = "button";
        button.className = "lunar-crater-controls-panel__preset";
        button.dataset.presetId = preset.id;
        button.textContent = preset.label;
        button.title = preset.title;
        presetContainer?.appendChild(button);
        presetButtons.set(preset.id, button);
    }

    for (const stats of CATALOG_TYPE_STATS) {
        const row = panel.ownerDocument?.createElement?.("div")
            || document.createElement("div");
        row.className = "lunar-crater-controls-panel__type-row";
        row.dataset.featureType = stats.featureType;

        const toggle = panel.ownerDocument?.createElement?.("input")
            || document.createElement("input");
        toggle.type = "checkbox";
        toggle.className = "lunar-crater-controls-panel__type-toggle";

        const label = panel.ownerDocument?.createElement?.("label")
            || document.createElement("label");
        label.className = "lunar-crater-controls-panel__type-label";
        label.textContent = `${formatFeatureTypeLabel(stats.featureType)} (${formatCraterCount(stats.count)})`;

        const range = panel.ownerDocument?.createElement?.("div")
            || document.createElement("div");
        range.className = "lunar-crater-controls-panel__type-range";

        const minInput = panel.ownerDocument?.createElement?.("input")
            || document.createElement("input");
        minInput.type = "number";
        minInput.className = "lunar-crater-controls-panel__type-number";
        minInput.step = "1";
        minInput.min = "0";
        minInput.title = "Minimum diameter (km)";
        minInput.setAttribute("aria-label", `${formatFeatureTypeLabel(stats.featureType)} minimum diameter in km`);

        const maxInput = panel.ownerDocument?.createElement?.("input")
            || document.createElement("input");
        maxInput.type = "number";
        maxInput.className = "lunar-crater-controls-panel__type-number";
        maxInput.step = "1";
        maxInput.min = "0";
        maxInput.title = "Maximum diameter (km)";
        maxInput.setAttribute("aria-label", `${formatFeatureTypeLabel(stats.featureType)} maximum diameter in km`);

        const unit = panel.ownerDocument?.createElement?.("span")
            || document.createElement("span");
        unit.className = "lunar-crater-controls-panel__type-unit";
        unit.textContent = "km";

        range.appendChild(minInput);
        range.appendChild(maxInput);
        range.appendChild(unit);

        row.appendChild(toggle);
        row.appendChild(label);
        row.appendChild(range);
        container.appendChild(row);

        typeControls.set(stats.featureType, {
            row,
            toggle,
            minInput,
            maxInput,
            stats,
        });
    }

    elements.typeControls = typeControls;
    elements.presetButtons = presetButtons;
    container.dataset.lunarFeatureTypesBuilt = "true";
    writeTypeFiltersToControls(
        elements,
        createDefaultLunarFeatureViewState().lunarFeatureTypeFilters,
    );
}

function readTypeFiltersFromControls(elements = {}, fallback = {}) {
    ensureTypeFilterControls(elements);
    const normalizedFallback = normalizeLunarFeatureTypeFilters(fallback);
    if (!(elements.typeControls instanceof Map) || !elements.typeControls.size) {
        return normalizedFallback;
    }
    const next = {};
    for (const [featureType, controls] of elements.typeControls.entries()) {
        const fallbackEntry = normalizedFallback[featureType] || {};
        next[featureType] = {
            enabled: controls.toggle?.checked !== false,
            minDiameterKm: readOptionalNumericInputValue(controls.minInput) ?? fallbackEntry.minDiameterKm ?? null,
            maxDiameterKm: readOptionalNumericInputValue(controls.maxInput) ?? fallbackEntry.maxDiameterKm ?? null,
        };
    }
    return normalizeLunarFeatureTypeFilters(next, normalizedFallback);
}

function writeTypeFiltersToControls(elements = {}, typeFilters = {}) {
    ensureTypeFilterControls(elements);
    if (!(elements.typeControls instanceof Map) || !elements.typeControls.size) {
        return;
    }
    const normalized = normalizeLunarFeatureTypeFilters(typeFilters);
    for (const [featureType, controls] of elements.typeControls.entries()) {
        const entry = normalized[featureType] || {};
        if (controls.toggle) {
            controls.toggle.checked = entry.enabled !== false;
        }
        if (controls.minInput) {
            controls.minInput.value = Number.isFinite(entry.minDiameterKm)
                ? String(Math.max(0, entry.minDiameterKm))
                : "";
        }
        if (controls.maxInput) {
            controls.maxInput.value = Number.isFinite(entry.maxDiameterKm)
                ? String(Math.max(0, entry.maxDiameterKm))
                : "";
        }
    }
}

export function getLunarCraterControlPanelElements(documentRef, {
    idPrefix = "lunar-crater",
    pillId = null,
    visibleInputId = null,
} = {}) {
    const getElement = (id) => documentRef?.getElementById?.(id) || null;
    return {
        idPrefix,
        pill: pillId ? getElement(pillId) : null,
        panel: getElement(`${idPrefix}-controls-panel`),
        closeButton: getElement(`${idPrefix}-close`),
        presetContainer: getElement(`${idPrefix}-presets`),
        typeFilterContainer: getElement(`${idPrefix}-type-filters`),
        visibleInput: getElement(visibleInputId || `${idPrefix}-visible`) ||
            (idPrefix === "lunar-crater" ? getElement("view-lunar-craters") : null),
        sitesInput: idPrefix === "lunar-crater" ? getElement("view-craters") : null,
        sitesToggle: getElement(`${idPrefix}-sites-toggle`),
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
        typeControls: null,
        presetButtons: null,
    };
}

export function readLunarCraterControlState(elements = {}) {
    const fallback = createDefaultLunarFeatureViewState();
    return normalizeLunarFeatureViewState({
        viewCraters: elements.sitesInput
            ? elements.sitesInput.checked !== false
            : false,
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
        lunarFeatureTypeFilters: readTypeFiltersFromControls(elements, fallback.lunarFeatureTypeFilters),
    });
}

export function writeLunarCraterControlState(elements = {}, patch = {}) {
    ensureTypeFilterControls(elements);
    const normalized = normalizeLunarFeatureViewState({
        ...readLunarCraterControlState(elements),
        ...patch,
    });
    if (Object.prototype.hasOwnProperty.call(patch, "viewCraters") && elements.sitesInput) {
        elements.sitesInput.checked = normalized.viewCraters !== false;
    }
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
    if (Object.prototype.hasOwnProperty.call(patch, "lunarFeatureTypeFilters")) {
        writeTypeFiltersToControls(elements, normalized.lunarFeatureTypeFilters);
    }
    syncLunarCraterCountStatus(elements, normalized);
}

export function syncLunarCraterControlPanel(elements = {}, state = readLunarCraterControlState(elements)) {
    ensureTypeFilterControls(elements);
    const normalized = normalizeLunarFeatureViewState(state);
    const enabled = normalized.viewLunarCraters === true;
    const featuresEnabled = normalized.viewLunarFeatures === true;
    const controlsDisabled = elements.disabled === true;
    const panelOpen = elements.panel ? elements.panel.hidden === false : false;

    if (elements.pill) {
        elements.pill.classList?.toggle?.("is-active", featuresEnabled);
        elements.pill.classList?.toggle?.("is-open", panelOpen);
        elements.pill.setAttribute?.("aria-pressed", featuresEnabled ? "true" : "false");
        elements.pill.setAttribute?.("aria-expanded", panelOpen ? "true" : "false");
        elements.pill.disabled = controlsDisabled;
    }
    if (elements.sitesToggle) {
        const sitesEnabled = normalized.viewCraters !== false;
        elements.sitesToggle.classList?.toggle?.("is-active", sitesEnabled);
        elements.sitesToggle.setAttribute?.("aria-pressed", sitesEnabled ? "true" : "false");
        elements.sitesToggle.textContent = "Moon sites";
        elements.sitesToggle.disabled = controlsDisabled;
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
            slider.disabled = controlsDisabled;
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
        button.disabled = controlsDisabled;
        button.setAttribute?.("aria-disabled", button.disabled ? "true" : "false");
    }
    if (elements.diameterValue) {
        elements.diameterValue.value = formatDiameterRange(normalized);
        elements.diameterValue.textContent = formatDiameterRange(normalized);
    }
    if (elements.closeButton) {
        elements.closeButton.disabled = controlsDisabled;
    }
    if (elements.typeControls instanceof Map) {
        const normalizedTypeFilters = normalizeLunarFeatureTypeFilters(
            normalized.lunarFeatureTypeFilters,
            createDefaultLunarFeatureViewState().lunarFeatureTypeFilters,
        );
        for (const [featureType, controls] of elements.typeControls.entries()) {
            const entry = normalizedTypeFilters[featureType] || {};
            const active = entry.enabled !== false;
            controls.row?.classList?.toggle?.("is-disabled", controlsDisabled);
            if (controls.toggle) {
                controls.toggle.checked = active;
                controls.toggle.disabled = controlsDisabled;
            }
            if (controls.minInput) {
                controls.minInput.disabled = controlsDisabled;
            }
            if (controls.maxInput) {
                controls.maxInput.disabled = controlsDisabled;
            }
            if (controls.row) {
                controls.row.title = formatTypeRangeValue(entry.minDiameterKm, entry.maxDiameterKm);
            }
        }
    }
    if (elements.presetButtons instanceof Map) {
        const normalizedTypeFilters = normalizeLunarFeatureTypeFilters(
            normalized.lunarFeatureTypeFilters,
            createDefaultLunarFeatureViewState().lunarFeatureTypeFilters,
        );
        for (const preset of LUNAR_FEATURE_PRESETS) {
            const button = elements.presetButtons.get(preset.id);
            if (!button) continue;
            const presetFilters = buildPresetTypeFilters(normalizedTypeFilters, preset.id);
            const active = areTypeFiltersEquivalent(normalizedTypeFilters, presetFilters);
            button.setAttribute("aria-pressed", active ? "true" : "false");
            button.classList?.toggle?.("is-active", active);
            button.disabled = controlsDisabled;
        }
    }
    syncLunarCraterCountStatus(elements, normalized);
}

export function bindLunarCraterControlPanel({ elements, commitPatch, sync }) {
    ensureTypeFilterControls(elements);
    const disposers = [];
    let pendingDiameterPatch = null;
    let pendingDiameterOptions = null;
    let pendingDiameterTimer = null;
    let pendingTypePatch = null;
    let pendingTypeOptions = null;
    let pendingTypeTimer = null;
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
    const flushTypeCommit = () => {
        if (pendingTypeTimer !== null) {
            clearScheduledCommit(pendingTypeTimer);
            pendingTypeTimer = null;
        }
        if (!pendingTypePatch) {
            return;
        }
        const patch = pendingTypePatch;
        const options = pendingTypeOptions || {};
        pendingTypePatch = null;
        pendingTypeOptions = null;
        writeLunarCraterControlState(elements, patch);
        commitPatch?.(patch, options);
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
    const queueTypeCommit = (patch, options = {}) => {
        pendingTypePatch = patch;
        pendingTypeOptions = options;
        writeLunarCraterControlState(elements, patch);
        if (pendingTypeTimer !== null) {
            clearScheduledCommit(pendingTypeTimer);
        }
        pendingTypeTimer = scheduleCommit(flushTypeCommit, CRATER_DIAMETER_COMMIT_DELAY_MS);
    };
    const commit = (patch, options = {}) => {
        flushDiameterCommit();
        flushTypeCommit();
        writeLunarCraterControlState(elements, patch);
        commitPatch?.(patch, options);
        syncControls();
    };
    const readCurrentTypeFilters = () => {
        const current = readLunarCraterControlState(elements);
        return normalizeLunarFeatureTypeFilters(
            current.lunarFeatureTypeFilters,
            createDefaultLunarFeatureViewState().lunarFeatureTypeFilters,
        );
    };
    const commitCurrentTypeFilters = (sourceId, { queued = false } = {}) => {
        const patch = {
            lunarFeatureTypeFilters: readCurrentTypeFilters(),
        };
        if (queued) {
            queueTypeCommit(patch, { sourceId });
        } else {
            commit(patch, { sourceId });
        }
    };
    listen(elements.sitesToggle, "click", () => {
        const current = readLunarCraterControlState(elements);
        commit(
            { viewCraters: !(current.viewCraters !== false) },
            { sourceId: elements.sitesToggle?.id || "lunar-crater-sites-toggle" },
        );
    });

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
    listen(elements.closeButton, "click", () => {
        if (elements.panel) {
            elements.panel.hidden = true;
        }
        syncControls();
    });

    if (elements.presetButtons instanceof Map) {
        for (const [presetId, button] of elements.presetButtons.entries()) {
            listen(button, "click", () => {
                const current = readLunarCraterControlState(elements);
                commit(
                    {
                        lunarFeatureTypeFilters: buildPresetTypeFilters(current.lunarFeatureTypeFilters, presetId),
                    },
                    { sourceId: `lunar-feature-preset:${presetId}` },
                );
            });
        }
    }
    if (elements.typeControls instanceof Map) {
        for (const [featureType, controls] of elements.typeControls.entries()) {
            listen(controls.toggle, "change", () => {
                commitCurrentTypeFilters(`lunar-feature-type-toggle:${featureType}`);
            });
            listen(controls.minInput, "input", () => {
                commitCurrentTypeFilters(`lunar-feature-type-min:${featureType}`, { queued: true });
            });
            listen(controls.maxInput, "input", () => {
                commitCurrentTypeFilters(`lunar-feature-type-max:${featureType}`, { queued: true });
            });
            listen(controls.minInput, "change", () => {
                commitCurrentTypeFilters(`lunar-feature-type-min:${featureType}`);
            });
            listen(controls.maxInput, "change", () => {
                commitCurrentTypeFilters(`lunar-feature-type-max:${featureType}`);
            });
        }
    }

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
        if (pendingTypeTimer !== null) {
            clearScheduledCommit(pendingTypeTimer);
            pendingTypeTimer = null;
        }
        setLunarCraterControlPending(elements, false);
        for (const dispose of disposers.splice(0)) {
            dispose();
        }
    };
}

export function createLunarCraterControlPanelElements(documentRef, options = {}) {
    const prefix = options.idPrefix || "lunar-crater";
    const state = createDefaultLunarFeatureViewState();

    const panel = documentRef.createElement("div");
    panel.id = `${prefix}-controls-panel`;
    panel.className = "lunar-crater-controls-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Lunar feature controls");
    panel.hidden = true;

    const header = documentRef.createElement("div");
    header.className = "lunar-crater-controls-panel__header";
    const headerTitle = documentRef.createElement("span");
    headerTitle.className = "lunar-crater-controls-panel__title";
    headerTitle.textContent = "Lunar Features";
    const closeButton = documentRef.createElement("button");
    closeButton.id = `${prefix}-close`;
    closeButton.type = "button";
    closeButton.className = "lunar-crater-controls-panel__close";
    closeButton.textContent = "Close";
    closeButton.setAttribute("aria-label", "Close lunar feature controls");
    header.appendChild(headerTitle);
    header.appendChild(closeButton);

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
    toggles.setAttribute("aria-label", "Lunar feature display mode");

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
    const offToggle = makeButton("off-toggle", "Off", "Hide lunar feature annotations", "true");
    const visibleToggle = makeButton(
        "visible-toggle",
        "Show always",
        "Show lunar feature boundaries and labels",
    );
    const hoverToggle = makeButton(
        "hover-toggle",
        "Show on hover",
        "Show the feature under the pointer",
    );
    toggles.appendChild(offToggle);
    toggles.appendChild(visibleToggle);
    toggles.appendChild(hoverToggle);

    const presets = documentRef.createElement("div");
    presets.id = `${prefix}-presets`;
    presets.className = "lunar-crater-controls-panel__presets";

    const typeFilters = documentRef.createElement("div");
    typeFilters.id = `${prefix}-type-filters`;
    typeFilters.className = "lunar-crater-controls-panel__type-filters";

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
        "Minimum feature diameter",
        LUNAR_CRATER_DEFAULT_MIN_DIAMETER_KM,
    );
    const maxDiameterSlider = createDiameterSlider(
        "max-diameter",
        "Maximum feature diameter",
        LUNAR_CRATER_DEFAULT_MAX_DIAMETER_KM,
    );
    const minDiameterStepDown = createStepButton(
        "min-diameter-step-down",
        "Decrease minimum feature diameter",
        "-",
    );
    const minDiameterStepUp = createStepButton(
        "min-diameter-step-up",
        "Increase minimum feature diameter",
        "+",
    );
    const maxDiameterStepDown = createStepButton(
        "max-diameter-step-down",
        "Decrease maximum feature diameter",
        "-",
    );
    const maxDiameterStepUp = createStepButton(
        "max-diameter-step-up",
        "Increase maximum feature diameter",
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

    const modeLabel = documentRef.createElement("div");
    modeLabel.className = "lunar-crater-controls-panel__mode-label";
    modeLabel.textContent = "Display";

    panel.appendChild(visibleInput);
    panel.appendChild(hoverInput);
    panel.appendChild(modeInput);
    panel.appendChild(header);
    panel.appendChild(presets);
    panel.appendChild(typeFilters);
    panel.appendChild(label);
    panel.appendChild(rangeStack);
    panel.appendChild(scale);
    panel.appendChild(statusRow);
    panel.appendChild(nudge);
    panel.appendChild(modeLabel);
    panel.appendChild(toggles);

    return {
        panel,
        closeButton,
        presetContainer: presets,
        typeFilterContainer: typeFilters,
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
        typeControls: null,
        presetButtons: null,
    };
}
