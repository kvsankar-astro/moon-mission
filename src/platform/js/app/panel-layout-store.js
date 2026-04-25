import { resolveCurrentMissionKey } from "../core/domain/current-mission.js";

const PANEL_LAYOUT_STORAGE_PREFIX = "moon-mission:panel-layout:v1";

function sanitizeKeyPart(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function resolveMissionKeyFromWindow() {
    if (typeof window === "undefined") {
        return "unknown";
    }

    const missionKey = sanitizeKeyPart(resolveCurrentMissionKey(window));
    if (missionKey) {
        return missionKey;
    }

    return "unknown";
}

function getMissionPanelLayoutStorageKey() {
    return `${PANEL_LAYOUT_STORAGE_PREFIX}:${resolveMissionKeyFromWindow()}`;
}

function readMissionPanelLayout() {
    const storage = globalThis?.localStorage;
    if (!storage) {
        return { panels: {}, manager: {} };
    }
    try {
        const raw = storage.getItem(getMissionPanelLayoutStorageKey());
        if (!raw) {
            return { panels: {}, manager: {} };
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return { panels: {}, manager: {} };
        }
        return {
            panels: parsed.panels && typeof parsed.panels === "object" ? parsed.panels : {},
            manager: parsed.manager && typeof parsed.manager === "object" ? parsed.manager : {},
        };
    } catch {
        return { panels: {}, manager: {} };
    }
}

function writeMissionPanelLayout(nextLayout) {
    const storage = globalThis?.localStorage;
    if (!storage) {
        return;
    }
    const safeLayout = nextLayout && typeof nextLayout === "object"
        ? nextLayout
        : { panels: {}, manager: {} };
    try {
        storage.setItem(getMissionPanelLayoutStorageKey(), JSON.stringify({
            panels: safeLayout.panels && typeof safeLayout.panels === "object" ? safeLayout.panels : {},
            manager: safeLayout.manager && typeof safeLayout.manager === "object" ? safeLayout.manager : {},
        }));
    } catch {
        // Ignore persistence failures.
    }
}

function readMissionPanelState(panelId) {
    const key = String(panelId || "").trim();
    if (!key) {
        return null;
    }
    const layout = readMissionPanelLayout();
    const state = layout.panels?.[key];
    return state && typeof state === "object" ? state : null;
}

function writeMissionPanelState(panelId, patch) {
    const key = String(panelId || "").trim();
    if (!key) {
        return;
    }
    const layout = readMissionPanelLayout();
    const existing = layout.panels?.[key];
    layout.panels[key] = {
        ...(existing && typeof existing === "object" ? existing : {}),
        ...(patch && typeof patch === "object" ? patch : {}),
    };
    writeMissionPanelLayout(layout);
}

function writeMissionPanelStates(panelsPatch) {
    if (!panelsPatch || typeof panelsPatch !== "object") {
        return;
    }
    const layout = readMissionPanelLayout();
    for (const [panelId, patch] of Object.entries(panelsPatch)) {
        const key = String(panelId || "").trim();
        if (!key) {
            continue;
        }
        const existing = layout.panels?.[key];
        layout.panels[key] = {
            ...(existing && typeof existing === "object" ? existing : {}),
            ...(patch && typeof patch === "object" ? patch : {}),
        };
    }
    writeMissionPanelLayout(layout);
}

function readMissionPanelManagerState() {
    const layout = readMissionPanelLayout();
    return layout.manager && typeof layout.manager === "object"
        ? layout.manager
        : {};
}

function writeMissionPanelManagerState(patch) {
    const layout = readMissionPanelLayout();
    layout.manager = {
        ...(layout.manager && typeof layout.manager === "object" ? layout.manager : {}),
        ...(patch && typeof patch === "object" ? patch : {}),
    };
    writeMissionPanelLayout(layout);
}

export {
    getMissionPanelLayoutStorageKey,
    readMissionPanelLayout,
    readMissionPanelManagerState,
    readMissionPanelState,
    resolveMissionKeyFromWindow,
    writeMissionPanelLayout,
    writeMissionPanelManagerState,
    writeMissionPanelState,
    writeMissionPanelStates,
};
