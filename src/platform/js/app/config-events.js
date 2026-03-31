import { resolveEventInstant } from "../core/domain/event-time-resolver.js";
import { resolveMissionCraft } from "../core/domain/mission-config.js";

function parseUtcPartsStart(originConfig) {
    if (!originConfig) return Number.NaN;

    const year = parseInt(originConfig.start_year, 10);
    const month = parseInt(originConfig.start_month, 10);
    const day = parseInt(originConfig.start_day, 10);
    const hour = parseInt(originConfig.start_hour, 10);
    const minute = parseInt(originConfig.start_minute, 10);
    if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        !Number.isFinite(day) ||
        !Number.isFinite(hour) ||
        !Number.isFinite(minute)
    ) {
        return Number.NaN;
    }

    return Date.UTC(year, month - 1, day, hour, minute, 0, 0);
}

function parseSpanStart(spanConfig) {
    if (!spanConfig) return Number.NaN;

    if (typeof spanConfig.startTime === "string") {
        const parsed = Date.parse(spanConfig.startTime);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return parseUtcPartsStart(spanConfig);
}

function resolveEventAvailabilityStartMs({
    eventData,
    globalConfig,
    config,
}) {
    const availabilityStartTime = typeof eventData?.availabilityStartTime === "string"
        ? eventData.availabilityStartTime.trim()
        : "";
    const originStartMs = parseUtcPartsStart(globalConfig?.[config]);

    if (!availabilityStartTime && !eventData?.requiresEphemeris) {
        return Number.NaN;
    }

    if (!availabilityStartTime || availabilityStartTime === "body_span_start") {
        const craft = resolveMissionCraft(
            globalConfig,
            eventData?.body || globalConfig?.primaryCraftId || globalConfig?.spacecraft_mnemonic || "SC",
        );
        const craftStartMs = parseSpanStart(craft?.spans?.[config]);
        return Number.isFinite(craftStartMs) ? craftStartMs : originStartMs;
    }

    if (availabilityStartTime === "origin_start") {
        return originStartMs;
    }

    const parsedAvailability = Date.parse(availabilityStartTime);
    return Number.isFinite(parsedAvailability) ? parsedAvailability : Number.NaN;
}

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
            hoverText: eventData.hoverText || eventData.infoText || eventData.label,
            body: eventData.body,
            timeSource: eventData.timeSource || null,
            clickable: true,
            preEphemeris: false,
            availabilityStartTime: null,
        });
    }

    for (let i = 0; i < eventInfos.length; i++) {
        const eventInfo = eventInfos[i];
        const eventData = events[eventInfo.key];
        const availabilityStartMs = resolveEventAvailabilityStartMs({
            eventData,
            globalConfig,
            config,
        });
        if (!Number.isFinite(availabilityStartMs)) {
            continue;
        }

        eventInfo.availabilityStartTime = new Date(availabilityStartMs);
        eventInfo.preEphemeris = eventInfo.startTime.getTime() < availabilityStartMs;
        eventInfo.clickable = !eventInfo.preEphemeris;
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
