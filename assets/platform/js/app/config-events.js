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

        let startTime;
        if (eventData.startTime === "dynamic") {
            if (eventKey === "now") {
                startTime = new Date(nowDate);
            } else if (eventKey.endsWith("DataEnd")) {
                const spacecraftMnemonic = globalConfig?.spacecraft_mnemonic || "SC";
                const endMs = getDataEndTimeMs?.(spacecraftMnemonic);
                startTime = new Date(endMs);
            } else {
                warnings.push(`Dynamic start time not handled for event ${eventKey}`);
                continue;
            }
        } else {
            startTime = new Date(eventData.startTime);
        }

        eventInfos.push({
            startTime,
            durationSeconds: eventData.durationSeconds,
            label: eventData.label,
            burnFlag: eventData.burnFlag,
            infoText: eventData.infoText,
            body: eventData.body,
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

