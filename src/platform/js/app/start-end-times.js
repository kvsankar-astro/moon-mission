import { resolveMissionCraft } from "../core/domain/mission-config.js";
import { createTimestampFromScale, parseConfigTimestamp } from "../utils/time-utils.js";

function resolveTimeScale(config) {
    return config?.time_scale === "TDB" ? "TDB" : "UTC";
}

function buildRangeFromParts(windowConfig, createUTCTimestamp, oneMinuteMs) {
    if (!windowConfig) return [null, null];

    const startYear = parseInt(windowConfig.start_year);
    const startMonth = parseInt(windowConfig.start_month);
    const startDay = parseInt(windowConfig.start_day);
    const startHour = parseInt(windowConfig.start_hour);
    const startMinute = parseInt(windowConfig.start_minute);
    const stopYear = parseInt(windowConfig.stop_year);
    const stopMonth = parseInt(windowConfig.stop_month);
    const stopDay = parseInt(windowConfig.stop_day);
    const stopHour = parseInt(windowConfig.stop_hour);
    const stopMinute = parseInt(windowConfig.stop_minute);

    if (
        !Number.isFinite(startYear) ||
        !Number.isFinite(startMonth) ||
        !Number.isFinite(startDay) ||
        !Number.isFinite(startHour) ||
        !Number.isFinite(startMinute) ||
        !Number.isFinite(stopYear) ||
        !Number.isFinite(stopMonth) ||
        !Number.isFinite(stopDay) ||
        !Number.isFinite(stopHour) ||
        !Number.isFinite(stopMinute)
    ) {
        return [null, null];
    }

    const timeScale = resolveTimeScale(windowConfig);

    const startTime = createTimestampFromScale(
        startYear,
        startMonth,
        startDay,
        startHour,
        startMinute,
        timeScale,
    );
    const endTime = createTimestampFromScale(
        stopYear,
        stopMonth,
        stopDay,
        stopHour,
        stopMinute,
        timeScale,
    ) - oneMinuteMs;

    return [startTime, endTime];
}

function buildRangeFromSpan(spanConfig, createUTCTimestamp, oneMinuteMs) {
    if (!spanConfig) return [null, null];

    const timeScale = resolveTimeScale(spanConfig);
    const startIso = typeof spanConfig.startTime === "string"
        ? parseConfigTimestamp(spanConfig.startTime, timeScale)
        : NaN;
    const endIso = typeof spanConfig.endTime === "string"
        ? parseConfigTimestamp(spanConfig.endTime, timeScale)
        : NaN;
    const [partsStart, partsEnd] = buildRangeFromParts(spanConfig, createUTCTimestamp, oneMinuteMs);
    return [
        Number.isFinite(startIso) ? startIso : partsStart,
        Number.isFinite(endIso) ? endIso : partsEnd,
    ];
}

export function resolveMissionBodyTimeRange({
    globalConfig,
    config,
    bodyId,
    createUTCTimestamp,
    oneMinuteMs,
}) {
    if (!globalConfig || !config || !globalConfig[config]) {
        return [null, null];
    }

    const craft = resolveMissionCraft(globalConfig, bodyId);
    const craftSpan = craft?.spans?.[config];
    const craftRange = buildRangeFromSpan(
        craftSpan,
        createUTCTimestamp,
        oneMinuteMs,
    );
    if (Number.isFinite(craftRange[0]) && Number.isFinite(craftRange[1])) {
        return craftRange;
    }

    const phaseConfig = globalConfig[config];
    return buildRangeFromSpan(phaseConfig, createUTCTimestamp, oneMinuteMs);
}

export function createStartEndTimesResolver({
    getGlobalConfig,
    getConfig,
    createUTCTimestamp,
    oneMinuteMs,
}) {
    return function getStartAndEndTimes(id) {
        return resolveMissionBodyTimeRange({
            globalConfig: getGlobalConfig?.(),
            config: getConfig?.(),
            bodyId: id,
            createUTCTimestamp,
            oneMinuteMs,
        });
    };
}
