const PANEL_STATE_VALUES = new Set(["open", "minimized", "closed", "deleted"]);

function getMissionPanelDefaultsMap(missionConfig) {
    const defaults = missionConfig?.ui?.panels?.defaults;
    if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) {
        return {};
    }
    return defaults;
}

function getMissionPanelDefaultConfig(missionConfig, panelId) {
    const key = String(panelId || "").trim();
    if (!key) {
        return null;
    }
    const defaults = getMissionPanelDefaultsMap(missionConfig);
    const config = defaults[key];
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        return null;
    }
    return config;
}

function normalizeMissionPanelState(value, fallbackState = "open") {
    const normalized = String(value || "").trim().toLowerCase();
    if (PANEL_STATE_VALUES.has(normalized)) {
        return normalized;
    }
    const fallback = String(fallbackState || "").trim().toLowerCase();
    if (fallback.length === 0) {
        return "";
    }
    if (PANEL_STATE_VALUES.has(fallback)) {
        return fallback;
    }
    return "open";
}

function isMissionPanelEnabled(missionConfig, panelId, { fallbackEnabled = true } = {}) {
    const panelConfig = getMissionPanelDefaultConfig(missionConfig, panelId);
    if (typeof panelConfig?.enabled === "boolean") {
        return panelConfig.enabled;
    }
    return fallbackEnabled !== false;
}

function getMissionPanelDefaultState(missionConfig, panelId, { fallbackState = "open" } = {}) {
    const panelConfig = getMissionPanelDefaultConfig(missionConfig, panelId);
    return normalizeMissionPanelState(panelConfig?.defaultState, fallbackState);
}

function shouldMissionPanelAutoOpenBeforeEvent(missionConfig, panelId, { fallback = false } = {}) {
    const panelConfig = getMissionPanelDefaultConfig(missionConfig, panelId);
    if (typeof panelConfig?.autoOpenBeforeEvent === "boolean") {
        return panelConfig.autoOpenBeforeEvent;
    }
    return fallback === true;
}

export {
    getMissionPanelDefaultConfig,
    getMissionPanelDefaultState,
    isMissionPanelEnabled,
    normalizeMissionPanelState,
    shouldMissionPanelAutoOpenBeforeEvent,
};
