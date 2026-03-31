import { resolveMissionCraft } from "../core/domain/mission-config.js";

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

    const startTime = createUTCTimestamp(
        startYear,
        startMonth,
        startDay,
        startHour,
        startMinute,
    );
    const endTime = createUTCTimestamp(
        stopYear,
        stopMonth,
        stopDay,
        stopHour,
        stopMinute,
    ) - oneMinuteMs;

    return [startTime, endTime];
}

function buildRangeFromSpan(spanConfig, createUTCTimestamp, oneMinuteMs) {
    if (!spanConfig) return [null, null];

    const startIso = typeof spanConfig.startTime === "string" ? Date.parse(spanConfig.startTime) : Number.NaN;
    const endIso = typeof spanConfig.endTime === "string" ? Date.parse(spanConfig.endTime) : Number.NaN;
    if (Number.isFinite(startIso) && Number.isFinite(endIso)) {
        return [startIso, endIso];
    }

    return buildRangeFromParts(spanConfig, createUTCTimestamp, oneMinuteMs);
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

    return buildRangeFromParts(globalConfig[config], createUTCTimestamp, oneMinuteMs);
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
