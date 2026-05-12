import {
    LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
    LUNAR_CRATER_DISPLAY_MODE_HOVER,
    createDefaultLunarCraterViewState,
    normalizeLunarCraterDisplayMode,
    normalizeLunarCraterViewState,
} from "../core/domain/lunar-crater-view.js";

function readNumericControlValue(control, fallback = 120) {
    const value = Number(control?.value);
    return Number.isFinite(value) ? value : fallback;
}

export function readLunarCraterControlState(elements = {}) {
    return normalizeLunarCraterViewState({
        viewLunarCraters: elements.visibleInput?.checked === true,
        lunarCraterHoverLabels: elements.hoverInput?.checked !== false,
        lunarCraterDisplayMode: normalizeLunarCraterDisplayMode(elements.modeInput?.value),
        lunarCraterLimit: readNumericControlValue(elements.countSlider),
    });
}

export function writeLunarCraterControlState(elements = {}, patch = {}) {
    if (Object.prototype.hasOwnProperty.call(patch, "viewLunarCraters") && elements.visibleInput) {
        elements.visibleInput.checked = patch.viewLunarCraters === true;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "lunarCraterHoverLabels") && elements.hoverInput) {
        elements.hoverInput.checked = patch.lunarCraterHoverLabels !== false;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "lunarCraterDisplayMode") && elements.modeInput) {
        elements.modeInput.value = normalizeLunarCraterDisplayMode(patch.lunarCraterDisplayMode);
    }
    if (Number.isFinite(Number(patch.lunarCraterLimit)) && elements.countSlider) {
        const craterLimit = Number(patch.lunarCraterLimit);
        elements.countSlider.value = String(craterLimit);
        if (elements.countValue) {
            elements.countValue.textContent = String(Math.round(craterLimit));
        }
    }
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
    if (elements.countSlider && elements.countValue) {
        elements.countValue.textContent = String(Math.round(normalized.lunarCraterLimit));
        elements.countSlider.disabled =
            controlsDisabled ||
            !enabled ||
            normalized.lunarCraterDisplayMode === LUNAR_CRATER_DISPLAY_MODE_HOVER;
        elements.countSlider.setAttribute?.(
            "aria-disabled",
            elements.countSlider.disabled ? "true" : "false",
        );
    }
}

export function bindLunarCraterControlPanel({ elements, commitPatch, sync }) {
    const disposers = [];
    const syncControls = typeof sync === "function"
        ? sync
        : () => syncLunarCraterControlPanel(elements);
    const listen = (element, type, handler, options) => {
        if (!element?.addEventListener) return;
        element.addEventListener(type, handler, options);
        disposers.push(() => element.removeEventListener?.(type, handler, options));
    };
    const commit = (patch, options = {}) => {
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

    const commitCount = () => {
        commit(
            { lunarCraterLimit: readNumericControlValue(elements.countSlider) },
            { sourceId: elements.countSlider?.id || "lunar-crater-count" },
        );
    };
    listen(elements.countSlider, "input", commitCount);
    listen(elements.countSlider, "change", commitCount);
    listen(elements.visibleInput, "change", syncControls);
    listen(elements.hoverInput, "change", syncControls);
    listen(elements.modeInput, "change", syncControls);

    syncControls();
    return () => {
        for (const dispose of disposers.splice(0)) {
            dispose();
        }
    };
}

export function createLunarCraterControlPanelElements(documentRef, { idPrefix } = {}) {
    const prefix = idPrefix || "lunar-crater";
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
    label.setAttribute("for", `${prefix}-count`);
    const labelText = documentRef.createElement("span");
    labelText.textContent = "Count";
    const countValue = documentRef.createElement("output");
    countValue.id = `${prefix}-count-value`;
    countValue.className = "lunar-crater-controls-panel__count-value";
    countValue.setAttribute("for", `${prefix}-count`);
    countValue.value = String(state.lunarCraterLimit);
    countValue.textContent = String(state.lunarCraterLimit);
    label.appendChild(labelText);
    label.appendChild(countValue);

    const countSlider = documentRef.createElement("input");
    countSlider.id = `${prefix}-count`;
    countSlider.className = "lunar-crater-controls-panel__range";
    countSlider.type = "range";
    countSlider.min = "25";
    countSlider.max = "500";
    countSlider.step = "25";
    countSlider.value = String(state.lunarCraterLimit);

    const scale = documentRef.createElement("div");
    scale.className = "lunar-crater-controls-panel__scale";
    scale.setAttribute("aria-hidden", "true");
    const big = documentRef.createElement("span");
    big.textContent = "Big";
    const more = documentRef.createElement("span");
    more.textContent = "More";
    scale.appendChild(big);
    scale.appendChild(more);

    panel.appendChild(visibleInput);
    panel.appendChild(hoverInput);
    panel.appendChild(modeInput);
    panel.appendChild(toggles);
    panel.appendChild(label);
    panel.appendChild(countSlider);
    panel.appendChild(scale);

    return {
        panel,
        visibleInput,
        hoverInput,
        modeInput,
        offToggle,
        visibleToggle,
        hoverToggle,
        countSlider,
        countValue,
    };
}
