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
    DEFAULT_LUNAR_FEATURE_TYPES,
    createDefaultLunarFeatureViewState,
    LUNAR_FEATURE_PRESET_IDS,
    normalizeLunarFeatureViewState,
    normalizeLunarFeatureTypeFilters,
} from "../core/domain/lunar-feature-view.js";
import lunarCraterCatalog from "../../../../assets/lunar-features.json";
import {
    countCraterDisplayFeatures,
} from "../core/domain/lunar-crater-catalog.js";
import { getLunarFeatureTypeColor } from "../core/domain/lunar-feature-colors.js";

const CRATER_DENSE_SELECTION_COUNT = 1000;
const CRATER_DIAMETER_COMMIT_DELAY_MS = 180;
const TYPE_FILTER_DEFAULT_MIN_KM = 0;
const TYPE_FILTER_DEFAULT_MAX_KM = 6000;

const LUNAR_FEATURE_PRESETS = Object.freeze([
    {
        id: LUNAR_FEATURE_PRESET_IDS.NONE,
        label: "None",
        title: "Disable all lunar feature classes",
    },
    {
        id: LUNAR_FEATURE_PRESET_IDS.DEFAULT,
        label: "Default",
        title: "Show the main Lunar Features group",
    },
    {
        id: LUNAR_FEATURE_PRESET_IDS.ALL,
        label: "All",
        title: "Show all lunar feature classes",
    },
]);

const FEATURE_TYPE_DISPLAY_ORDER = Object.freeze([
    "Crater, craters",
    "Mare, maria",
    "Mons, montes",
    "Rima, rimae",
    "Vallis, valles",
    "Dorsum, dorsa",
    "Catena, catenae",
    "Promontorium, promontoria",
    "Oceanus, oceani",
    "Palus, paludes",
    "Planitia, planitiae",
    "Satellite Feature",
]);

const FEATURE_TYPE_GROUPS = Object.freeze([
    {
        id: "popular",
        label: "Popular Highlights",
        types: DEFAULT_LUNAR_FEATURE_TYPES,
    },
    {
        id: "structures",
        label: "Lines And Relief",
        types: ["Vallis, valles", "Dorsum, dorsa", "Catena, catenae", "Promontorium, promontoria"],
    },
    {
        id: "regions",
        label: "Large Regions",
        types: ["Oceanus, oceani", "Palus, paludes", "Planitia, planitiae"],
    },
    {
        id: "reference",
        label: "Reference Labels",
        types: ["Satellite Feature"],
    },
]);

const craterCountFormatter = typeof Intl !== "undefined"
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
    : null;

function readNumericControlValue(control, fallback) {
    const value = Number(control?.value);
    return Number.isFinite(value) ? value : fallback;
}

function readGlobalDiameterRangeFromElements(elements = {}) {
    const fallback = createDefaultLunarCraterViewState();
    return normalizeLunarCraterDiameterRange({
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

function getOrderedCatalogTypeStats(statsList = CATALOG_TYPE_STATS) {
    const orderIndex = new Map(FEATURE_TYPE_DISPLAY_ORDER.map((name, index) => [name, index]));
    return [...statsList].sort((a, b) => {
        const aIdx = orderIndex.has(a.featureType) ? orderIndex.get(a.featureType) : Number.MAX_SAFE_INTEGER;
        const bIdx = orderIndex.has(b.featureType) ? orderIndex.get(b.featureType) : Number.MAX_SAFE_INTEGER;
        if (aIdx !== bIdx) {
            return aIdx - bIdx;
        }
        if (b.count !== a.count) {
            return b.count - a.count;
        }
        return a.featureType.localeCompare(b.featureType);
    });
}

const ORDERED_CATALOG_TYPE_STATS = getOrderedCatalogTypeStats();

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

function resolveTypeSliderMax(stats = null) {
    const maxFromStats = Number(stats?.maxDiameterKm);
    if (!Number.isFinite(maxFromStats)) {
        return TYPE_FILTER_DEFAULT_MAX_KM;
    }
    return Math.max(
        TYPE_FILTER_DEFAULT_MAX_KM,
        Math.ceil(maxFromStats / LUNAR_CRATER_DIAMETER_STEP_KM) * LUNAR_CRATER_DIAMETER_STEP_KM,
    );
}

function readSliderBound(slider, key, fallback) {
    if (!slider) return fallback;
    const value = Number(slider[key]);
    return Number.isFinite(value) ? value : fallback;
}

function readTypeSliderValue(slider, fallback, { minBound = 0, maxBound = TYPE_FILTER_DEFAULT_MAX_KM } = {}) {
    const value = Number(slider?.value);
    if (!Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(minBound, Math.min(maxBound, value));
}

function syncTypeRangeValueText(controls, minDiameterKm, maxDiameterKm) {
    if (!controls?.rangeValue) return;
    controls.rangeValue.textContent = formatTypeRangeValue(minDiameterKm, maxDiameterKm);
}

function syncDualRangeFill(fillElement, minSlider, maxSlider) {
    if (!fillElement || !minSlider || !maxSlider) return;
    const minBound = readSliderBound(minSlider, "min", TYPE_FILTER_DEFAULT_MIN_KM);
    const maxBound = readSliderBound(maxSlider, "max", TYPE_FILTER_DEFAULT_MAX_KM);
    const span = Math.max(1, maxBound - minBound);
    const minValue = readTypeSliderValue(minSlider, minBound, { minBound, maxBound });
    const maxValue = readTypeSliderValue(maxSlider, maxBound, { minBound, maxBound });
    const leftPct = ((minValue - minBound) / span) * 100;
    const rightPct = ((maxBound - maxValue) / span) * 100;
    fillElement.style.left = `${Math.max(0, Math.min(100, leftPct))}%`;
    fillElement.style.right = `${Math.max(0, Math.min(100, rightPct))}%`;
}

function buildPresetTypeFilters(baseFilters, presetId) {
    const current = normalizeLunarFeatureTypeFilters(baseFilters);
    const next = {};
    for (const stats of ORDERED_CATALOG_TYPE_STATS) {
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
        const isDefaultType = DEFAULT_LUNAR_FEATURE_TYPES.includes(featureType);
        filter.minDiameterKm = null;
        filter.maxDiameterKm = null;
        switch (presetId) {
            case LUNAR_FEATURE_PRESET_IDS.ALL:
                filter.enabled = true;
                break;
            case LUNAR_FEATURE_PRESET_IDS.NONE:
                filter.enabled = false;
                break;
            case LUNAR_FEATURE_PRESET_IDS.CRATERS_ONLY:
                filter.enabled = isCrater;
                break;
            case LUNAR_FEATURE_PRESET_IDS.NON_CRATER:
                filter.enabled = !isCrater && !isSatellite;
                break;
            case LUNAR_FEATURE_PRESET_IDS.DEFAULT:
            default:
                filter.enabled = isDefaultType;
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
    const statsByType = new Map(ORDERED_CATALOG_TYPE_STATS.map((entry) => [entry.featureType, entry]));

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
        const dualRange = row.querySelector?.(".lunar-crater-controls-panel__dual-range") || null;
        const dualRangeFill = row.querySelector?.(".lunar-crater-controls-panel__dual-range-fill") || null;
        const minSlider = row.querySelector?.(".lunar-crater-controls-panel__type-slider--min") || null;
        const maxSlider = row.querySelector?.(".lunar-crater-controls-panel__type-slider--max") || null;
        const rangeValue = row.querySelector?.(".lunar-crater-controls-panel__type-range-value") || null;
        typeControls.set(featureType, {
            row,
            toggle,
            dualRange,
            dualRangeFill,
            minSlider,
            maxSlider,
            rangeValue,
            minExplicit: row?.dataset?.typeMinExplicit === "true",
            maxExplicit: row?.dataset?.typeMaxExplicit === "true",
            stats: statsByType.get(featureType) || null,
        });
    }

    elements.typeControls = typeControls;
    elements.presetButtons = presetButtons;
    return typeControls.size > 0;
}

function getLunarFeatureGroupEntries(container) {
    const groups = container?.querySelectorAll?.(".lunar-crater-controls-panel__type-group") || [];
    return Array.from(groups).map((groupContainer) => ({
        groupContainer,
        groupTitle: groupContainer.querySelector?.(".lunar-crater-controls-panel__type-group-title") || null,
        groupRows: groupContainer.querySelector?.(".lunar-crater-controls-panel__type-group-rows") || null,
    })).filter((entry) => entry.groupTitle && entry.groupRows);
}

function setExpandedLunarFeatureGroup(container, targetId = null) {
    for (const entry of getLunarFeatureGroupEntries(container)) {
        const groupId = `${entry.groupContainer?.dataset?.groupId || ""}`;
        const expanded = Boolean(targetId && groupId === targetId);
        entry.groupContainer.dataset.expanded = expanded ? "true" : "false";
        entry.groupRows.hidden = !expanded;
        entry.groupTitle.setAttribute("aria-expanded", expanded ? "true" : "false");
    }
}

function bindLunarFeatureGroupAccordion(container, { openFirst = false } = {}) {
    if (!container) return;
    const entries = getLunarFeatureGroupEntries(container);
    if (openFirst && entries.length > 0) {
        const firstGroupId = `${entries[0].groupContainer?.dataset?.groupId || ""}`;
        setExpandedLunarFeatureGroup(container, firstGroupId || null);
    }
    if (container.dataset.lunarFeatureAccordionBound === "true") {
        return;
    }
    container.addEventListener("click", (event) => {
        const title = event.target?.closest?.(".lunar-crater-controls-panel__type-group-title");
        if (!title || !container.contains(title)) return;
        const groupContainer = title.closest?.(".lunar-crater-controls-panel__type-group");
        const groupId = `${groupContainer?.dataset?.groupId || ""}`;
        const currentlyExpanded = groupContainer?.dataset?.expanded === "true";
        setExpandedLunarFeatureGroup(container, currentlyExpanded ? null : groupId);
    });
    container.dataset.lunarFeatureAccordionBound = "true";
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
        bindLunarFeatureGroupAccordion(container);
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

    const statsByType = new Map(ORDERED_CATALOG_TYPE_STATS.map((entry) => [entry.featureType, entry]));
    const groupedStats = FEATURE_TYPE_GROUPS.map((group) => ({
        ...group,
        stats: group.types
            .map((featureType) => statsByType.get(featureType))
            .filter(Boolean),
    }));
    const groupedFeatureTypes = new Set(FEATURE_TYPE_GROUPS.flatMap((group) => group.types));
    const ungroupedStats = ORDERED_CATALOG_TYPE_STATS.filter(
        (entry) => !groupedFeatureTypes.has(entry.featureType),
    );
    if (ungroupedStats.length > 0) {
        groupedStats.push({
            id: "other",
            label: "Other Features",
            types: ungroupedStats.map((entry) => entry.featureType),
            stats: ungroupedStats,
        });
    }

    for (const group of groupedStats) {
        if (!Array.isArray(group.stats) || group.stats.length === 0) {
            continue;
        }
        const groupContainer = panel.ownerDocument?.createElement?.("section")
            || document.createElement("section");
        groupContainer.className = "lunar-crater-controls-panel__type-group";
        groupContainer.dataset.groupId = `${group.id || ""}`;

        const groupTitle = panel.ownerDocument?.createElement?.("button")
            || document.createElement("button");
        groupTitle.type = "button";
        groupTitle.className = "lunar-crater-controls-panel__type-group-title";
        groupTitle.textContent = group.label || "";
        groupTitle.setAttribute("aria-expanded", "false");
        groupContainer.appendChild(groupTitle);

        const groupRows = panel.ownerDocument?.createElement?.("div")
            || document.createElement("div");
        groupRows.className = "lunar-crater-controls-panel__type-group-rows";
        groupRows.hidden = true;

        for (const stats of group.stats) {
        const row = panel.ownerDocument?.createElement?.("div")
            || document.createElement("div");
        row.className = "lunar-crater-controls-panel__type-row";
        row.dataset.featureType = stats.featureType;

        const toggle = panel.ownerDocument?.createElement?.("input")
            || document.createElement("input");
        toggle.type = "checkbox";
        toggle.className = "lunar-crater-controls-panel__type-toggle";
        const featureColor = getLunarFeatureTypeColor(stats.featureType);
        if (toggle.style) {
            toggle.style.accentColor = featureColor;
        }

        const swatch = panel.ownerDocument?.createElement?.("span")
            || document.createElement("span");
        swatch.className = "lunar-crater-controls-panel__type-swatch";
        swatch.style?.setProperty?.("--lunar-feature-type-color", featureColor);
        swatch.setAttribute("aria-hidden", "true");

        const label = panel.ownerDocument?.createElement?.("label")
            || document.createElement("label");
        label.className = "lunar-crater-controls-panel__type-label";
        label.textContent = `${formatFeatureTypeLabel(stats.featureType)} (${formatCraterCount(stats.count)})`;

        const range = panel.ownerDocument?.createElement?.("div")
            || document.createElement("div");
        range.className = "lunar-crater-controls-panel__type-range";
        const rangeValue = panel.ownerDocument?.createElement?.("span")
            || document.createElement("span");
        rangeValue.className = "lunar-crater-controls-panel__type-range-value";
        rangeValue.textContent = formatTypeRangeValue(null, null);

        const rangeStack = panel.ownerDocument?.createElement?.("div")
            || document.createElement("div");
        rangeStack.className = "lunar-crater-controls-panel__type-range-stack";

        const createTypeSlider = (className, labelText, sliderMax) => {
            const slider = panel.ownerDocument?.createElement?.("input")
                || document.createElement("input");
            slider.type = "range";
            slider.className = `lunar-crater-controls-panel__range ${className}`;
            slider.step = String(LUNAR_CRATER_DIAMETER_STEP_KM);
            slider.min = String(TYPE_FILTER_DEFAULT_MIN_KM);
            slider.max = String(sliderMax);
            slider.value = String(TYPE_FILTER_DEFAULT_MIN_KM);
            slider.setAttribute("aria-label", labelText);
            return slider;
        };

        const sliderMax = resolveTypeSliderMax(stats);
        const dualRange = panel.ownerDocument?.createElement?.("div")
            || document.createElement("div");
        dualRange.className = "lunar-crater-controls-panel__dual-range";
        const dualRangeFill = panel.ownerDocument?.createElement?.("span")
            || document.createElement("span");
        dualRangeFill.className = "lunar-crater-controls-panel__dual-range-fill";

        const minSlider = createTypeSlider(
            "lunar-crater-controls-panel__type-slider--min",
            `${formatFeatureTypeLabel(stats.featureType)} minimum diameter`,
            sliderMax,
        );
        const maxSlider = createTypeSlider(
            "lunar-crater-controls-panel__type-slider--max",
            `${formatFeatureTypeLabel(stats.featureType)} maximum diameter`,
            sliderMax,
        );
        maxSlider.value = String(sliderMax);
        dualRange.appendChild(dualRangeFill);
        dualRange.appendChild(minSlider);
        dualRange.appendChild(maxSlider);
        rangeStack.appendChild(dualRange);
        range.appendChild(rangeValue);
        range.appendChild(rangeStack);

        row.appendChild(toggle);
        row.appendChild(swatch);
        row.appendChild(label);
            row.appendChild(range);
            groupRows.appendChild(row);

            typeControls.set(stats.featureType, {
                row,
                toggle,
                swatch,
                dualRange,
                dualRangeFill,
                minSlider,
                maxSlider,
                rangeValue,
                minExplicit: false,
                maxExplicit: false,
                stats,
            });
        }
        groupContainer.appendChild(groupRows);
        container.appendChild(groupContainer);
    }
    bindLunarFeatureGroupAccordion(container, { openFirst: true });

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
    const currentGlobal = readGlobalDiameterRangeFromElements(elements);
    if (!(elements.typeControls instanceof Map) || !elements.typeControls.size) {
        return normalizedFallback;
    }
    const next = {};
    for (const [featureType, controls] of elements.typeControls.entries()) {
        const fallbackEntry = normalizedFallback[featureType] || {};
        const sliderMax = readSliderBound(
            controls.maxSlider || controls.minSlider,
            "max",
            resolveTypeSliderMax(controls.stats),
        );
        const minFromSlider = readTypeSliderValue(
            controls.minSlider,
            currentGlobal.lunarCraterMinDiameterKm,
            {
                minBound: TYPE_FILTER_DEFAULT_MIN_KM,
                maxBound: sliderMax,
            },
        );
        const maxFromSlider = readTypeSliderValue(
            controls.maxSlider,
            currentGlobal.lunarCraterMaxDiameterKm,
            {
                minBound: TYPE_FILTER_DEFAULT_MIN_KM,
                maxBound: sliderMax,
            },
        );
        const minDiameterKm = controls.minExplicit === true
            ? minFromSlider
            : fallbackEntry.minDiameterKm ?? null;
        const maxDiameterKm = controls.maxExplicit === true
            ? maxFromSlider
            : fallbackEntry.maxDiameterKm ?? null;
        next[featureType] = {
            enabled: controls.toggle?.checked !== false,
            minDiameterKm,
            maxDiameterKm,
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
    const globalState = readGlobalDiameterRangeFromElements(elements);
    for (const [featureType, controls] of elements.typeControls.entries()) {
        const entry = normalized[featureType] || {};
        const sliderMax = resolveTypeSliderMax(controls.stats);
        const effectiveMin = Number.isFinite(entry.minDiameterKm)
            ? Math.max(TYPE_FILTER_DEFAULT_MIN_KM, Math.min(sliderMax, entry.minDiameterKm))
            : globalState.lunarCraterMinDiameterKm;
        const effectiveMax = Number.isFinite(entry.maxDiameterKm)
            ? Math.max(TYPE_FILTER_DEFAULT_MIN_KM, Math.min(sliderMax, entry.maxDiameterKm))
            : globalState.lunarCraterMaxDiameterKm;
        const boundedMin = Math.min(effectiveMin, effectiveMax);
        const boundedMax = Math.max(effectiveMin, effectiveMax);
        if (controls.toggle) {
            controls.toggle.checked = entry.enabled !== false;
        }
        if (controls.minSlider) {
            controls.minSlider.min = String(TYPE_FILTER_DEFAULT_MIN_KM);
            controls.minSlider.max = String(sliderMax);
            controls.minSlider.value = String(boundedMin);
        }
        if (controls.maxSlider) {
            controls.maxSlider.min = String(TYPE_FILTER_DEFAULT_MIN_KM);
            controls.maxSlider.max = String(sliderMax);
            controls.maxSlider.value = String(boundedMax);
        }
        controls.minExplicit = Number.isFinite(entry.minDiameterKm);
        controls.maxExplicit = Number.isFinite(entry.maxDiameterKm);
        if (controls.row) {
            controls.row.dataset.typeMinExplicit = controls.minExplicit ? "true" : "false";
            controls.row.dataset.typeMaxExplicit = controls.maxExplicit ? "true" : "false";
        }
        syncTypeRangeValueText(controls, boundedMin, boundedMax);
        syncDualRangeFill(controls.dualRangeFill, controls.minSlider, controls.maxSlider);
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
        globalRangeFill: getElement(`${idPrefix}-global-range-fill`),
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
        syncDualRangeFill(elements.globalRangeFill, elements.minDiameterSlider, elements.maxDiameterSlider);
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
        syncDualRangeFill(elements.globalRangeFill, elements.minDiameterSlider, elements.maxDiameterSlider);
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
            if (controls.minSlider) {
                controls.minSlider.disabled = controlsDisabled;
            }
            if (controls.maxSlider) {
                controls.maxSlider.disabled = controlsDisabled;
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
        const markTypeExplicit = (controls, key) => {
            if (!controls) return;
            if (key === "min") {
                controls.minExplicit = true;
                controls.row?.dataset && (controls.row.dataset.typeMinExplicit = "true");
            } else if (key === "max") {
                controls.maxExplicit = true;
                controls.row?.dataset && (controls.row.dataset.typeMaxExplicit = "true");
            }
        };
        const commitTypeFromSliders = (featureType, controls, sourceId, { queued = false } = {}) => {
            markTypeExplicit(controls, sourceId.includes("min") ? "min" : "max");
            if (controls?.minSlider && controls?.maxSlider) {
                const sliderMax = readSliderBound(
                    controls.maxSlider,
                    "max",
                    resolveTypeSliderMax(controls.stats),
                );
                let minValue = readTypeSliderValue(
                    controls.minSlider,
                    TYPE_FILTER_DEFAULT_MIN_KM,
                    { minBound: TYPE_FILTER_DEFAULT_MIN_KM, maxBound: sliderMax },
                );
                let maxValue = readTypeSliderValue(
                    controls.maxSlider,
                    sliderMax,
                    { minBound: TYPE_FILTER_DEFAULT_MIN_KM, maxBound: sliderMax },
                );
                if (minValue > maxValue) {
                    if (sourceId.includes("min")) {
                        maxValue = minValue;
                        controls.maxSlider.value = String(maxValue);
                    } else {
                        minValue = maxValue;
                        controls.minSlider.value = String(minValue);
                    }
                }
                syncTypeRangeValueText(controls, minValue, maxValue);
                syncDualRangeFill(controls.dualRangeFill, controls.minSlider, controls.maxSlider);
            }
            commitCurrentTypeFilters(`lunar-feature-type-${sourceId}:${featureType}`, { queued });
        };
        for (const [featureType, controls] of elements.typeControls.entries()) {
            listen(controls.toggle, "change", () => {
                commitCurrentTypeFilters(`lunar-feature-type-toggle:${featureType}`);
            });
            listen(controls.minSlider, "input", () => {
                commitTypeFromSliders(featureType, controls, "min-input", { queued: true });
            });
            listen(controls.maxSlider, "input", () => {
                commitTypeFromSliders(featureType, controls, "max-input", { queued: true });
            });
            listen(controls.minSlider, "change", () => {
                commitTypeFromSliders(featureType, controls, "min-change");
            });
            listen(controls.maxSlider, "change", () => {
                commitTypeFromSliders(featureType, controls, "max-change");
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

    const createDiameterSlider = (idSuffix, labelTextValue, value, variantClass) => {
        const slider = documentRef.createElement("input");
        slider.id = `${prefix}-${idSuffix}`;
        slider.className = `lunar-crater-controls-panel__range ${variantClass}`;
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
        "lunar-crater-controls-panel__range--min",
    );
    const maxDiameterSlider = createDiameterSlider(
        "max-diameter",
        "Maximum feature diameter",
        LUNAR_CRATER_DEFAULT_MAX_DIAMETER_KM,
        "lunar-crater-controls-panel__range--max",
    );
    const globalDualRange = documentRef.createElement("div");
    globalDualRange.className = "lunar-crater-controls-panel__dual-range";
    const globalRangeFill = documentRef.createElement("span");
    globalRangeFill.id = `${prefix}-global-range-fill`;
    globalRangeFill.className = "lunar-crater-controls-panel__dual-range-fill";
    globalDualRange.appendChild(globalRangeFill);
    globalDualRange.appendChild(minDiameterSlider);
    globalDualRange.appendChild(maxDiameterSlider);
    rangeStack.appendChild(globalDualRange);

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
    panel.appendChild(label);
    panel.appendChild(rangeStack);
    panel.appendChild(scale);
    panel.appendChild(presets);
    panel.appendChild(typeFilters);
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
        minDiameterStepDown: null,
        minDiameterStepUp: null,
        maxDiameterSlider,
        maxDiameterStepDown: null,
        maxDiameterStepUp: null,
        globalRangeFill,
        diameterValue,
        countValue,
        busyIndicator,
        nudge,
        typeControls: null,
        presetButtons: null,
    };
}
