const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

const FIXED_INTERVALS = [
    { unit: "second", step: 1, ms: SECOND_MS },
    { unit: "second", step: 5, ms: 5 * SECOND_MS },
    { unit: "second", step: 15, ms: 15 * SECOND_MS },
    { unit: "second", step: 30, ms: 30 * SECOND_MS },
    { unit: "minute", step: 1, ms: MINUTE_MS },
    { unit: "minute", step: 5, ms: 5 * MINUTE_MS },
    { unit: "minute", step: 15, ms: 15 * MINUTE_MS },
    { unit: "minute", step: 30, ms: 30 * MINUTE_MS },
    { unit: "hour", step: 1, ms: HOUR_MS },
    { unit: "hour", step: 3, ms: 3 * HOUR_MS },
    { unit: "hour", step: 6, ms: 6 * HOUR_MS },
    { unit: "hour", step: 12, ms: 12 * HOUR_MS },
    { unit: "day", step: 1, ms: DAY_MS },
    { unit: "day", step: 2, ms: 2 * DAY_MS },
    { unit: "day", step: 3, ms: 3 * DAY_MS },
    { unit: "week", step: 1, ms: 7 * DAY_MS },
    { unit: "week", step: 2, ms: 14 * DAY_MS },
];

const CALENDAR_INTERVALS = [
    { unit: "month", step: 1, approximateMs: 30 * DAY_MS },
    { unit: "month", step: 3, approximateMs: 90 * DAY_MS },
    { unit: "month", step: 6, approximateMs: 183 * DAY_MS },
    { unit: "year", step: 1, approximateMs: 365 * DAY_MS },
    { unit: "year", step: 5, approximateMs: 5 * 365 * DAY_MS },
];

const INTERVALS = [
    ...FIXED_INTERVALS,
    ...CALENDAR_INTERVALS,
];

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function pad2(value) {
    return String(value).padStart(2, "0");
}

function monthDay(date, includeYear = false) {
    const base = `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
    return includeYear ? `${base} ${date.getFullYear()}` : base;
}

function hhmm(date) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function hhmmss(date) {
    return `${hhmm(date)}:${pad2(date.getSeconds())}`;
}

function sameLocalDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function sameLocalMinute(a, b) {
    return (
        sameLocalDay(a, b) &&
        a.getHours() === b.getHours() &&
        a.getMinutes() === b.getMinutes()
    );
}

function intervalApproxMs(interval) {
    return Number(interval.ms || interval.approximateMs || 0);
}

function targetLabelCount(widthPx, densityOffset) {
    const safeWidth = Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 720;
    const base = Math.floor(safeWidth / 118);
    return clamp(base + Number(densityOffset || 0) * 3, 1, 12);
}

function selectTimelineTimeLabelInterval({ startTimeMs, endTimeMs, widthPx = 0, densityOffset = 0 }) {
    const spanMs = Math.max(0, Number(endTimeMs) - Number(startTimeMs));
    if (!Number.isFinite(spanMs) || spanMs <= 0) return null;

    const targetCount = targetLabelCount(widthPx, densityOffset);
    const targetSpacingMs = spanMs / (targetCount + 1);
    return INTERVALS.find((interval) => intervalApproxMs(interval) >= targetSpacingMs) ||
        INTERVALS[INTERVALS.length - 1];
}

function firstFixedTick(startTimeMs, intervalMs) {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return Number.NaN;
    return Math.ceil(startTimeMs / intervalMs) * intervalMs;
}

function firstCalendarTick(startTimeMs, interval) {
    const date = new Date(startTimeMs);
    if (interval.unit === "year") {
        const year = Math.floor(date.getFullYear() / interval.step) * interval.step;
        let tick = new Date(year, 0, 1, 0, 0, 0, 0).getTime();
        while (tick < startTimeMs) {
            tick = new Date(new Date(tick).getFullYear() + interval.step, 0, 1, 0, 0, 0, 0).getTime();
        }
        return tick;
    }

    const absoluteMonth = date.getFullYear() * 12 + date.getMonth();
    let alignedMonth = Math.floor(absoluteMonth / interval.step) * interval.step;
    let year = Math.floor(alignedMonth / 12);
    let month = alignedMonth % 12;
    let tick = new Date(year, month, 1, 0, 0, 0, 0).getTime();
    while (tick < startTimeMs) {
        alignedMonth += interval.step;
        year = Math.floor(alignedMonth / 12);
        month = alignedMonth % 12;
        tick = new Date(year, month, 1, 0, 0, 0, 0).getTime();
    }
    return tick;
}

function nextCalendarTick(timeMs, interval) {
    const date = new Date(timeMs);
    if (interval.unit === "year") {
        return new Date(date.getFullYear() + interval.step, 0, 1, 0, 0, 0, 0).getTime();
    }
    return new Date(date.getFullYear(), date.getMonth() + interval.step, 1, 0, 0, 0, 0).getTime();
}

function formatComparisonLabel(timeMs, startTimeMs, interval) {
    const elapsedMs = Math.max(0, timeMs - startTimeMs);
    const approxMs = intervalApproxMs(interval);
    const totalSeconds = Math.round(elapsedMs / SECOND_MS);
    if (approxMs < MINUTE_MS) return `T+${totalSeconds}s`;
    const totalMinutes = Math.round(elapsedMs / MINUTE_MS);
    if (approxMs < HOUR_MS) return `T+${totalMinutes}m`;
    const totalHours = Math.round(elapsedMs / HOUR_MS);
    if (approxMs < DAY_MS) return `T+${totalHours}h`;
    const totalDays = Math.round(elapsedMs / DAY_MS);
    return `T+${totalDays}d`;
}

function formatTimelineTimeLabel(timeMs, interval, context = {}) {
    const {
        startTimeMs = Number.NaN,
        endTimeMs = Number.NaN,
        compareMode = false,
    } = context;
    if (compareMode) {
        return formatComparisonLabel(timeMs, startTimeMs, interval);
    }

    const date = new Date(timeMs);
    const startDate = new Date(startTimeMs);
    const endDate = new Date(endTimeMs);
    const spansYear = startDate.getFullYear() !== endDate.getFullYear();
    const sameDayRange = sameLocalDay(startDate, endDate);
    const sameMinuteRange = sameLocalMinute(startDate, endDate);

    if (interval.unit === "year") {
        return String(date.getFullYear());
    }
    if (interval.unit === "month") {
        return spansYear ? `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}` : MONTH_NAMES[date.getMonth()];
    }
    if (interval.unit === "week" || interval.unit === "day") {
        return monthDay(date, spansYear);
    }
    if (interval.unit === "hour") {
        return sameDayRange
            ? hhmm(date)
            : `${monthDay(date, spansYear)} ${hhmm(date)}`;
    }
    if (interval.unit === "minute") {
        return sameDayRange
            ? hhmm(date)
            : `${monthDay(date, spansYear)} ${hhmm(date)}`;
    }
    if (interval.unit === "second") {
        if (sameMinuteRange) return hhmmss(date);
        return sameDayRange
            ? hhmmss(date)
            : `${monthDay(date, spansYear)} ${hhmmss(date)}`;
    }
    return monthDay(date, spansYear);
}

function buildTimelineTimeLabels({
    startTimeMs,
    endTimeMs,
    widthPx = 0,
    densityOffset = 0,
    compareMode = false,
} = {}) {
    const safeStart = Number(startTimeMs);
    const safeEnd = Number(endTimeMs);
    if (!Number.isFinite(safeStart) || !Number.isFinite(safeEnd) || safeEnd <= safeStart) {
        return [];
    }

    const interval = selectTimelineTimeLabelInterval({
        startTimeMs: safeStart,
        endTimeMs: safeEnd,
        widthPx,
        densityOffset,
    });
    if (!interval) return [];

    const fixedMs = Number(interval.ms);
    const firstTick = Number.isFinite(fixedMs)
        ? firstFixedTick(safeStart, fixedMs)
        : firstCalendarTick(safeStart, interval);
    if (!Number.isFinite(firstTick)) return [];

    const spanMs = safeEnd - safeStart;
    const labels = [];
    const maxLabels = targetLabelCount(widthPx, densityOffset) + 2;
    const edgeGuardPercent = 5;
    const minPercentSpacing = 100 / (maxLabels + 1);

    let lastPercent = -Infinity;
    let tick = firstTick;
    let guard = 0;

    while (tick <= safeEnd && guard < 200) {
        guard += 1;
        const percent = ((tick - safeStart) / spanMs) * 100;
        if (
            percent > edgeGuardPercent &&
            percent < 100 - edgeGuardPercent &&
            percent - lastPercent >= minPercentSpacing * 0.74
        ) {
            const label = formatTimelineTimeLabel(tick, interval, {
                startTimeMs: safeStart,
                endTimeMs: safeEnd,
                compareMode,
            });
            labels.push({
                timeMs: tick,
                percent,
                label,
                intervalUnit: interval.unit,
                intervalStep: interval.step,
            });
            lastPercent = percent;
        }

        tick = Number.isFinite(fixedMs)
            ? tick + fixedMs
            : nextCalendarTick(tick, interval);
    }

    return labels;
}

export {
    buildTimelineTimeLabels,
    formatTimelineTimeLabel,
    selectTimelineTimeLabelInterval,
};
