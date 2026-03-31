import { resolveEventInstant } from "../core/domain/event-time-resolver.js";

export function computeEventsUpdate({
    globalConfig,
    config,
    nowDate,
    getDataEndTimeMs,
}) {
    if (!globalConfig || !globalConfig.events || !globalConfig.eventConfigs) {
        return {
            shouldUpdate: false,
            eventInfos: null,
            warnings: ["Events configuration not loaded, using default events"],
        };
    }

    const events = globalConfig.events;
    const eventConfigs = globalConfig.eventConfigs;
    const configEvents = eventConfigs[config] || [];

    /** @type {Array<{ startTime: Date, durationSeconds: number, label: string, burnFlag?: boolean, infoText?: string, body?: string }>} */
    const eventInfos = [];
    /** @type {string[]} */
    const warnings = [];

    for (const eventKey of configEvents) {
        const eventData = events[eventKey];
        if (!eventData) {
            warnings.push(`Event ${eventKey} not found in configuration`);
            continue;
        }

        const resolvedTime = resolveEventInstant(eventData, {
            eventKey,
            nowDate,
            getDataEndTimeMs,
            spacecraftMnemonic: globalConfig?.spacecraft_mnemonic || "SC",
            missionTimes: globalConfig?.missionTimes || {},
        });

        if (!resolvedTime.ok) {
            warnings.push(resolvedTime.warning);
            continue;
        }

        const startTime = new Date(resolvedTime.timestampMs);
        eventInfos.push({
            key: eventKey,
            kind: resolvedTime.kind,
            startTime,
            durationSeconds: eventData.durationSeconds,
            label: eventData.label,
            burnFlag: eventData.burnFlag,
            infoText: eventData.infoText,
            body: eventData.body,
            timeSource: eventData.timeSource || null,
        });
    }

    eventInfos.sort((a, b) => a.startTime - b.startTime);

    return {
        shouldUpdate: true,
        eventInfos,
        warnings,
    };
}

export function applyEventsUpdate({ update, setEventInfos, console }) {
    if (!update) return;

    if (update.warnings?.length) {
        for (let i = 0; i < update.warnings.length; i++) {
            console?.warn?.(update.warnings[i]);
        }
    }

    if (!update.shouldUpdate) return;

    if (Array.isArray(update.eventInfos)) {
        setEventInfos?.(update.eventInfos);
    }
}
