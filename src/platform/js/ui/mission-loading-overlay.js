const DEFAULT_MESSAGE = "Loading mission...";

function resolveDocument(documentRef) {
    return documentRef || globalThis?.document || null;
}

function getLoadingOverlay(documentRef) {
    const doc = resolveDocument(documentRef);
    if (!doc) return null;
    return doc.getElementById?.("mission-loading-overlay") || null;
}

function setMissionLoadingMessage(message, documentRef) {
    const doc = resolveDocument(documentRef);
    if (!doc) return;
    const overlay = getLoadingOverlay(doc);
    const messageNode = doc.getElementById?.("mission-loading-overlay-message");
    if (!overlay || !messageNode) return;
    messageNode.textContent = typeof message === "string" && message.trim()
        ? message.trim()
        : DEFAULT_MESSAGE;
}

function showMissionLoadingOverlay(message = DEFAULT_MESSAGE, documentRef) {
    const doc = resolveDocument(documentRef);
    if (!doc) return;
    const overlay = getLoadingOverlay(doc);
    if (!overlay) return;
    setMissionLoadingMessage(message, doc);
    overlay.hidden = false;
    overlay.dataset.state = "loading";
    overlay.dataset.blocking = "true";
    doc.documentElement?.classList?.remove("mission-loading-complete");
}

function setMissionLoadingOverlayBlocking(blocking = true, documentRef) {
    const doc = resolveDocument(documentRef);
    if (!doc) return;
    const overlay = getLoadingOverlay(doc);
    if (!overlay) return;
    overlay.dataset.blocking = blocking ? "true" : "false";
}

function hideMissionLoadingOverlay(documentRef) {
    const doc = resolveDocument(documentRef);
    if (!doc) return;
    const overlay = getLoadingOverlay(doc);
    if (!overlay) return;
    overlay.dataset.state = "ready";
    overlay.dataset.blocking = "false";
    overlay.hidden = true;
    doc.documentElement?.classList?.add("mission-loading-complete");
}

function failMissionLoadingOverlay(message, documentRef) {
    const doc = resolveDocument(documentRef);
    if (!doc) return;
    const overlay = getLoadingOverlay(doc);
    if (!overlay) return;
    setMissionLoadingMessage(message || "Mission failed to load. Please refresh and try again.", doc);
    overlay.hidden = false;
    overlay.dataset.state = "error";
}

export {
    failMissionLoadingOverlay,
    hideMissionLoadingOverlay,
    setMissionLoadingOverlayBlocking,
    setMissionLoadingMessage,
    showMissionLoadingOverlay,
};
