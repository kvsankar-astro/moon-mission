const panelEntries = new Map();
const panelListeners = new Set();

function sanitizeSnapshotEntry(entry) {
    if (!entry || typeof entry !== "object") {
        return null;
    }

    const {
        actions,
        ...rest
    } = entry;

    return {
        ...rest,
        actions: {
            open: typeof actions?.open === "function",
            restore: typeof actions?.restore === "function",
            focus: typeof actions?.focus === "function",
            minimize: typeof actions?.minimize === "function",
            close: typeof actions?.close === "function",
            delete: typeof actions?.delete === "function",
        },
    };
}

function getMissionPanelDetails(id) {
    const key = String(id || "").trim();
    if (!key) {
        return null;
    }
    const entry = panelEntries.get(key);
    return entry ? sanitizeSnapshotEntry(entry) : null;
}

function sortSnapshotEntries(entries) {
    return [...entries].sort((a, b) => {
        const orderA = Number.isFinite(a?.sortOrder) ? a.sortOrder : 0;
        const orderB = Number.isFinite(b?.sortOrder) ? b.sortOrder : 0;
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        return String(a?.title || "").localeCompare(String(b?.title || ""));
    });
}

function emitPanelRegistryChange() {
    const snapshot = sortSnapshotEntries(
        Array.from(panelEntries.values())
            .map(sanitizeSnapshotEntry)
            .filter(Boolean),
    );

    for (const listener of panelListeners) {
        listener(snapshot);
    }
}

function normalizePanelEntry(id, descriptor, previous = null) {
    const safeDescriptor = descriptor && typeof descriptor === "object" ? descriptor : {};
    const nextActions = {
        ...(previous?.actions || {}),
        ...(safeDescriptor.actions || {}),
    };

    return {
        ...(previous || {}),
        ...safeDescriptor,
        id,
        actions: nextActions,
    };
}

function registerMissionPanel(descriptor) {
    const id = String(descriptor?.id || "").trim();
    if (!id) {
        throw new Error("registerMissionPanel requires a non-empty id");
    }
    const previous = panelEntries.get(id) || null;
    panelEntries.set(id, normalizePanelEntry(id, descriptor, previous));
    emitPanelRegistryChange();
    return id;
}

function updateMissionPanel(id, patch) {
    const key = String(id || "").trim();
    if (!key) {
        return null;
    }
    const previous = panelEntries.get(key) || null;
    if (!previous) {
        return registerMissionPanel({ id: key, ...patch });
    }
    panelEntries.set(key, normalizePanelEntry(key, patch, previous));
    emitPanelRegistryChange();
    return key;
}

function unregisterMissionPanel(id) {
    const key = String(id || "").trim();
    if (!key || !panelEntries.has(key)) {
        return false;
    }
    panelEntries.delete(key);
    emitPanelRegistryChange();
    return true;
}

function subscribeMissionPanels(listener) {
    if (typeof listener !== "function") {
        return () => {};
    }
    panelListeners.add(listener);
    listener(getMissionPanelSnapshot());
    return () => {
        panelListeners.delete(listener);
    };
}

function invokeMissionPanelAction(id, actionName) {
    const key = String(id || "").trim();
    const actionKey = String(actionName || "").trim();
    const entry = panelEntries.get(key);
    const action = entry?.actions?.[actionKey];
    if (typeof action !== "function") {
        return false;
    }
    action();
    return true;
}

function getMissionPanelSnapshot() {
    return sortSnapshotEntries(
        Array.from(panelEntries.values())
            .map(sanitizeSnapshotEntry)
            .filter(Boolean),
    );
}

export {
    getMissionPanelDetails,
    getMissionPanelSnapshot,
    invokeMissionPanelAction,
    registerMissionPanel,
    subscribeMissionPanels,
    unregisterMissionPanel,
    updateMissionPanel,
};
