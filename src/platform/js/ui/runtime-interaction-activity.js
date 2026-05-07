const DEFAULT_INTERACTION_ACTIVITY_EVENTS = Object.freeze([
    "pointerdown",
    "pointermove",
    "pointerup",
    "wheel",
    "keydown",
    "input",
    "change",
    "focusin",
]);

function bindRuntimeInteractionActivity({
    documentRef = globalThis?.document,
    markInputActivity,
    events = DEFAULT_INTERACTION_ACTIVITY_EVENTS,
} = {}) {
    if (!documentRef || typeof markInputActivity !== "function") {
        return () => {};
    }

    const listener = () => {
        markInputActivity();
    };
    const options = {
        capture: true,
        passive: true,
    };

    for (const eventName of events) {
        documentRef.addEventListener(eventName, listener, options);
    }

    return () => {
        for (const eventName of events) {
            documentRef.removeEventListener(eventName, listener, options);
        }
    };
}

export {
    DEFAULT_INTERACTION_ACTIVITY_EVENTS,
    bindRuntimeInteractionActivity,
};
