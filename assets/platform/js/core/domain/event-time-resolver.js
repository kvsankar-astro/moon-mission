const EVENT_KIND = Object.freeze({
    FIXED: "fixed",
    NOW: "now",
    DATA_END: "data_end",
    MISSION_MARKER: "mission_marker",
});

function inferLegacyEventKind(eventKey, eventDef) {
    if (eventDef?.startTime !== "dynamic") {
        return EVENT_KIND.FIXED;
    }

    if (eventKey === "now") {
        return EVENT_KIND.NOW;
    }

    if (eventKey?.endsWith?.("DataEnd")) {
        return EVENT_KIND.DATA_END;
    }

    return null;
}

function resolveFixedTime(eventDef) {
    if (eventDef?.timeSource?.timestamp) {
        return new Date(eventDef.timeSource.timestamp).getTime();
    }

    return new Date(eventDef?.startTime).getTime();
}

function resolveEventInstant(eventDef, context = {}) {
    const {
        eventKey,
        nowDate = new Date(),
        getDataEndTimeMs,
        spacecraftMnemonic = "SC",
        missionTimes = {},
    } = context;

    const resolvedKind = eventDef?.kind || inferLegacyEventKind(eventKey, eventDef);
    if (!resolvedKind) {
        return {
            ok: false,
            warning: `Unable to resolve event kind for ${eventKey}`,
        };
    }

    if (resolvedKind === EVENT_KIND.FIXED) {
        const fixedTs = resolveFixedTime(eventDef);
        if (!Number.isFinite(fixedTs)) {
            return {
                ok: false,
                warning: `Invalid fixed event timestamp for ${eventKey}`,
            };
        }

        return {
            ok: true,
            timestampMs: fixedTs,
            kind: EVENT_KIND.FIXED,
        };
    }

    if (resolvedKind === EVENT_KIND.NOW) {
        return {
            ok: true,
            timestampMs: new Date(nowDate).getTime(),
            kind: EVENT_KIND.NOW,
        };
    }

    if (resolvedKind === EVENT_KIND.DATA_END) {
        const sourceMnemonic =
            eventDef?.timeSource?.spacecraftMnemonic ||
            spacecraftMnemonic;
        const endMs = getDataEndTimeMs?.(sourceMnemonic);
        if (!Number.isFinite(endMs)) {
            return {
                ok: false,
                warning: `Data-end timestamp unavailable for ${eventKey}`,
            };
        }

        return {
            ok: true,
            timestampMs: endMs,
            kind: EVENT_KIND.DATA_END,
        };
    }

    if (resolvedKind === EVENT_KIND.MISSION_MARKER) {
        const markerKey = eventDef?.timeSource?.markerKey;
        const markerTs = markerKey ? missionTimes?.[markerKey] : null;
        if (!Number.isFinite(markerTs)) {
            return {
                ok: false,
                warning: `Mission-marker timestamp unavailable for ${eventKey}`,
            };
        }
        return {
            ok: true,
            timestampMs: markerTs,
            kind: EVENT_KIND.MISSION_MARKER,
        };
    }

    return {
        ok: false,
        warning: `Unsupported event kind '${resolvedKind}' for ${eventKey}`,
    };
}

export {
    EVENT_KIND,
    inferLegacyEventKind,
    resolveEventInstant,
};
