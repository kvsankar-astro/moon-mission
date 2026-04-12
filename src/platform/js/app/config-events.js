import { resolveEventInstant } from "../core/domain/event-time-resolver.js";
import { resolveMissionCraft } from "../core/domain/mission-config.js";
import { createTimestampFromScale, parseConfigTimestamp } from "../utils/time-utils.js";
import {
    appendGeneratedUiText,
    buildPostHorizonUiNote,
    isGeneratedExtensionTime,
    resolvePostHorizonExtension,
} from "./post-horizons-extension.js";

function resolveTimeScale(config) {
    return config?.time_scale === "TDB" ? "TDB" : "UTC";
}

function parseOriginPartsStart(originConfig) {
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

    return createTimestampFromScale(year, month, day, hour, minute, resolveTimeScale(originConfig));
}

function parseSpanStart(spanConfig) {
    if (!spanConfig) return Number.NaN;

    if (typeof spanConfig.startTime === "string") {
        const parsed = parseConfigTimestamp(spanConfig.startTime, resolveTimeScale(spanConfig));
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return parseOriginPartsStart(spanConfig);
}

function resolveEventAvailabilityStartMs({
    eventData,
    globalConfig,
    config,
}) {
    const availabilityStartTime = typeof eventData?.availabilityStartTime === "string"
        ? eventData.availabilityStartTime.trim()
        : "";
    const originStartMs = parseOriginPartsStart(globalConfig?.[config]);

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

function resolvePrimaryCraftMnemonic(globalConfig) {
    const primaryCraft = resolveMissionCraft(
        globalConfig,
        globalConfig?.primaryCraftId || globalConfig?.spacecraft_mnemonic || "SC",
    );
    return primaryCraft?.mnemonic || globalConfig?.spacecraft_mnemonic || "SC";
}

function maybeBuildNowEventInfo({
    globalConfig,
    config,
    nowDate,
    getDataEndTimeMs,
    eventInfos,
}) {
    const existingNow = (eventInfos || []).find((eventInfo) => eventInfo?.kind === "now" || eventInfo?.key === "now");
    const nowMs = new Date(nowDate).getTime();
    if (!Number.isFinite(nowMs)) return existingNow || null;

    const originStartMs = parseOriginPartsStart(globalConfig?.[config]);
    const sourceMnemonic = resolvePrimaryCraftMnemonic(globalConfig);
    const dataEndMs = getDataEndTimeMs?.(sourceMnemonic);
    if (!Number.isFinite(originStartMs) || !Number.isFinite(dataEndMs)) {
        return existingNow || null;
    }

    if (nowMs < originStartMs || nowMs > dataEndMs) {
        return null;
    }
    if (existingNow) {
        return {
            ...existingNow,
            startTime: new Date(nowMs),
            clickable: true,
            preEphemeris: false,
            availabilityStartTime: new Date(originStartMs),
        };
    }

    return {
        key: "now",
        kind: "now",
        startTime: new Date(nowMs),
        durationSeconds: 0,
        label: "Now",
        burnFlag: false,
        infoText: "Now",
        hoverText: "Now",
        body: "",
        timeSource: null,
        clickable: true,
        preEphemeris: false,
        availabilityStartTime: new Date(originStartMs),
    };
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
    const postHorizonExtension = resolvePostHorizonExtension(globalConfig, config);

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
        if (eventData.enabled === false) {
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
        const generated = isGeneratedExtensionTime(resolvedTime.timestampMs, postHorizonExtension);
        eventInfos.push({
            key: eventKey,
            kind: resolvedTime.kind,
            startTime,
            durationSeconds: eventData.durationSeconds,
            label: eventData.label,
            burnFlag: eventData.burnFlag,
            burnDirection: eventData.burnDirection || "",
            burnTypeLabel: eventData.burnTypeLabel || "",
            infoText: eventData.infoText,
            hoverText: generated
                ? appendGeneratedUiText(
                    eventData.hoverText || eventData.infoText || eventData.label,
                    postHorizonExtension,
                )
                : (eventData.hoverText || eventData.infoText || eventData.label),
            body: eventData.body,
            timeSource: eventData.timeSource || null,
            clickable: true,
            preEphemeris: false,
            availabilityStartTime: null,
            generated,
            generatedLabel: generated ? postHorizonExtension?.shortLabel || "Generated" : "",
            generatedNote: generated ? buildPostHorizonUiNote(postHorizonExtension) : "",
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

    const nowEventInfo = maybeBuildNowEventInfo({
        globalConfig,
        config,
        nowDate,
        getDataEndTimeMs,
        eventInfos,
    });

    const filteredEventInfos = eventInfos.filter((eventInfo) => eventInfo.kind !== "now" && eventInfo.key !== "now");
    if (nowEventInfo) {
        filteredEventInfos.push(nowEventInfo);
    }

    filteredEventInfos.sort((a, b) => a.startTime - b.startTime);

    return {
        shouldUpdate: true,
        eventInfos: filteredEventInfos,
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
