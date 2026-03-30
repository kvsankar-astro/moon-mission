function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

const JD_UNIX_EPOCH = 2440587.5;
const MS_PER_DAY = 86400000;

function normalizeHexColor(value, fallback = "#f8b84b") {
    const text = typeof value === "string" ? value.trim() : "";
    const match = text.match(/^#?([0-9a-f]{6})$/i);
    return match ? `#${match[1]}` : fallback;
}

function hexToRgb(color) {
    const normalized = normalizeHexColor(color).slice(1);
    return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
    };
}

function toHexComponent(value) {
    return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function mixColors(baseColor, mixColor = "#ffffff", amount = 0.35) {
    const base = hexToRgb(baseColor);
    const mix = hexToRgb(mixColor);
    const ratio = clamp(amount, 0, 1);
    return (
        "#" +
        toHexComponent(base.r + (mix.r - base.r) * ratio) +
        toHexComponent(base.g + (mix.g - base.g) * ratio) +
        toHexComponent(base.b + (mix.b - base.b) * ratio)
    );
}

function findNearestTimeIndex(times, timeMs) {
    if (!Array.isArray(times) || times.length === 0 || !Number.isFinite(timeMs)) {
        return -1;
    }
    if (times.length === 1) {
        return 0;
    }
    if (timeMs <= times[0]) {
        return 0;
    }
    const lastIndex = times.length - 1;
    if (timeMs >= times[lastIndex]) {
        return lastIndex;
    }

    let low = 0;
    let high = lastIndex;
    while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (times[mid] <= timeMs) {
            low = mid;
        } else {
            high = mid;
        }
    }

    return Math.abs(times[low] - timeMs) <= Math.abs(times[high] - timeMs)
        ? low
        : high;
}

function findLowerBoundIndex(times, targetTimeMs) {
    if (!Array.isArray(times) || times.length === 0) {
        return -1;
    }

    let low = 0;
    let high = times.length;
    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (times[mid] < targetTimeMs) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    return clamp(low, 0, times.length - 1);
}

function normalizeMetadataArray(values) {
    if (!Array.isArray(values)) return [];
    return values.map((value) => {
        if (value === null || value === undefined || value === "") {
            return NaN;
        }
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : NaN;
    });
}

function getOrbitStyleDensitySeries(metadata) {
    if (!metadata || typeof metadata !== "object") {
        return null;
    }

    const times = normalizeMetadataArray(
        metadata.sample_times_jd ||
        metadata.sampleTimesJd ||
        metadata.times_jd ||
        metadata.timesJd,
    );
    if (times.length === 0) {
        return null;
    }

    return {
        times,
        densityHints: normalizeMetadataArray(
            metadata.density_hint ||
            metadata.densityHint,
        ),
    };
}

function parseMetadataTime(value, jdValue) {
    if (typeof value === "string" && value.trim()) {
        const ms = Date.parse(value);
        if (Number.isFinite(ms)) {
            return ms;
        }
    }

    const jd = Number(jdValue);
    if (Number.isFinite(jd)) {
        return (jd - JD_UNIX_EPOCH) * MS_PER_DAY;
    }

    return NaN;
}

function getOrbitStyleIntervals(metadata) {
    const intervals = Array.isArray(metadata?.regime_intervals)
        ? metadata.regime_intervals
        : Array.isArray(metadata?.regimeIntervals)
          ? metadata.regimeIntervals
          : [];
    return intervals
        .map((interval) => {
            const periodSeconds = Number(interval?.period_s_local ?? interval?.periodSecondsLocal);
            return {
                startMs: parseMetadataTime(
                    interval?.startTime ?? interval?.start_time,
                    interval?.start_jd ?? interval?.startJd,
                ),
                endMs: parseMetadataTime(
                    interval?.endTime ?? interval?.end_time,
                    interval?.end_jd ?? interval?.endJd,
                ),
                regime: typeof interval?.regime === "string" ? interval.regime : "",
                centerCode: typeof interval?.center_code === "string"
                    ? interval.center_code
                    : typeof interval?.centerCode === "string"
                      ? interval.centerCode
                      : "",
                periodMs: Number.isFinite(periodSeconds) && periodSeconds > 0
                    ? periodSeconds * 1000
                    : NaN,
                periodStatus: typeof interval?.period_status === "string"
                    ? interval.period_status
                    : typeof interval?.periodStatus === "string"
                      ? interval.periodStatus
                      : "",
            };
        })
        .filter((interval) =>
            Number.isFinite(interval.startMs) &&
            Number.isFinite(interval.endMs) &&
            interval.endMs >= interval.startMs,
        );
}

function findOrbitStyleInterval(metadata, timeMs) {
    if (!Number.isFinite(timeMs)) {
        return { interval: null, index: -1, intervals: [] };
    }
    const intervals = getOrbitStyleIntervals(metadata);
    for (let index = 0; index < intervals.length; index += 1) {
        const interval = intervals[index];
        if (timeMs >= interval.startMs && timeMs <= interval.endMs) {
            return { interval, index, intervals };
        }
    }
    return { interval: null, index: -1, intervals };
}

function isMeaningfulIntervalPeriod(interval) {
    return !!interval &&
        Number.isFinite(interval.periodMs) &&
        interval.periodMs > 0 &&
        (!interval.periodStatus || interval.periodStatus === "meaningful");
}

function resolveIntervalPeriodMs(metadata, timeMs) {
    const { interval } = findOrbitStyleInterval(metadata, timeMs);
    return isMeaningfulIntervalPeriod(interval) ? interval.periodMs : NaN;
}

function resolveOrbitDensityHint(metadata, timeMs) {
    const series = getOrbitStyleDensitySeries(metadata);
    if (!series || !Number.isFinite(timeMs)) {
        return NaN;
    }

    const index = findNearestTimeIndex(
        series.times,
        JD_UNIX_EPOCH + (timeMs / MS_PER_DAY),
    );
    const hint = index >= 0 ? series.densityHints[index] : NaN;
    return Number.isFinite(hint) ? clamp(hint, 0, 1) : NaN;
}

function hasOrbitStyleDensityHints(metadata) {
    const series = getOrbitStyleDensitySeries(metadata);
    if (!series || !Array.isArray(series.densityHints)) {
        return false;
    }
    return series.densityHints.some((value) => Number.isFinite(value));
}

function resolveChunkDensityHint(metadata, startTimeMs, endTimeMs) {
    if (!Number.isFinite(startTimeMs) || !Number.isFinite(endTimeMs)) {
        return NaN;
    }
    const midpointTimeMs = startTimeMs + ((endTimeMs - startTimeMs) * 0.5);
    return resolveOrbitDensityHint(metadata, midpointTimeMs);
}

function resolveTrailWindow(times, timeMs, options = {}) {
    if (!Array.isArray(times) || times.length === 0) {
        return {
            currentIndex: -1,
            tailStartIndex: -1,
            headStartIndex: -1,
            tailLength: 0,
            headLength: 0,
        };
    }

    const currentIndex = findNearestTimeIndex(times, timeMs);
    if (currentIndex < 0) {
        return {
            currentIndex,
            tailStartIndex: -1,
            headStartIndex: -1,
            tailLength: 0,
            headLength: 0,
        };
    }

    const totalDurationMs = Math.max(0, times[times.length - 1] - times[0]);
    const defaultTailDurationMs = clamp(
        totalDurationMs * 0.0125,
        20 * 60 * 1000,
        7 * 24 * 60 * 60 * 1000,
    );
    const tailDurationMs = Number.isFinite(options.tailDurationMs)
        ? Math.max(1, options.tailDurationMs)
        : defaultTailDurationMs;
    const headDurationMs = Number.isFinite(options.headDurationMs)
        ? Math.max(1, options.headDurationMs)
        : clamp(
              tailDurationMs * 0.24,
              5 * 60 * 1000,
              24 * 60 * 60 * 1000,
          );

    const tailStartIndex = findLowerBoundIndex(times, times[currentIndex] - tailDurationMs);
    const headStartIndex = findLowerBoundIndex(times, times[currentIndex] - headDurationMs);

    return {
        currentIndex,
        tailStartIndex,
        headStartIndex,
        tailLength: currentIndex - tailStartIndex + 1,
        headLength: currentIndex - headStartIndex + 1,
    };
}

function buildCurveTimes(vectors, startTimeMs, stepMs) {
    if (!Array.isArray(vectors) || vectors.length === 0) {
        return [];
    }
    const safeStart = Number.isFinite(startTimeMs) ? startTimeMs : 0;
    const safeStep = Math.max(1, Number(stepMs) || 1);
    return vectors.map((vector, index) =>
        Number.isFinite(vector?.timeMs)
            ? vector.timeMs
            : safeStart + (index * safeStep),
    );
}

const ORBIT_TRAIL_STYLE = Object.freeze({
    backgroundOpacity2D: 0.16,
    tailOpacity2D: 0.62,
    headOpacity2D: 0.92,
    backgroundOpacity3D: 0.15,
    tailOpacity3D: 0.52,
    headOpacity3D: 0.94,
});

function resolveBackgroundOpacity(options = {}) {
    const {
        metadata,
        startTimeMs,
        endTimeMs,
        dimension = "3D",
        opacityOverride,
    } = options;
    const defaultOpacity = dimension === "2D"
        ? ORBIT_TRAIL_STYLE.backgroundOpacity2D
        : ORBIT_TRAIL_STYLE.backgroundOpacity3D;
    const baseOpacity = Number.isFinite(Number(opacityOverride))
        ? Number(opacityOverride)
        : defaultOpacity;
    const hint = resolveChunkDensityHint(metadata, startTimeMs, endTimeMs);
    if (!Number.isFinite(hint)) {
        return baseOpacity;
    }
    return clamp(
        baseOpacity * (1 - (0.55 * hint)),
        baseOpacity * 0.28,
        baseOpacity,
    );
}

function resolveOverlapAdjustedOpacity(baseOpacity, overlapFactor = 1) {
    const safeBaseOpacity = clamp(Number(baseOpacity) || 0, 0, 1);
    const safeOverlapFactor = clamp(Number(overlapFactor) || 1, 0, 1);
    return clamp(safeBaseOpacity * safeOverlapFactor, 0, 1);
}

function resolveTrackOpacity2D(brightness = 1) {
    return clamp(ORBIT_TRAIL_STYLE.backgroundOpacity2D * (Number(brightness) || 1), 0, 1);
}

function resolveTrackOpacity3D(brightness = 1) {
    return clamp(ORBIT_TRAIL_STYLE.backgroundOpacity3D * (Number(brightness) || 1), 0, 1);
}

function resolveTailOpacity2D(brightness = 1) {
    return clamp(ORBIT_TRAIL_STYLE.tailOpacity2D * (Number(brightness) || 1), 0, 1);
}

function resolveHeadOpacity2D(brightness = 1) {
    return clamp(ORBIT_TRAIL_STYLE.headOpacity2D * (Number(brightness) || 1), 0, 1);
}

function resolveTailOpacity3D(brightness = 1) {
    return clamp(ORBIT_TRAIL_STYLE.tailOpacity3D * (Number(brightness) || 1), 0, 1);
}

function resolveHeadOpacity3D(brightness = 1) {
    return clamp(ORBIT_TRAIL_STYLE.headOpacity3D * (Number(brightness) || 1), 0, 1);
}

export {
    ORBIT_TRAIL_STYLE,
    buildCurveTimes,
    findOrbitStyleInterval,
    getOrbitStyleIntervals,
    hasOrbitStyleDensityHints,
    isMeaningfulIntervalPeriod,
    mixColors,
    normalizeHexColor,
    resolveBackgroundOpacity,
    resolveChunkDensityHint,
    resolveHeadOpacity2D,
    resolveHeadOpacity3D,
    resolveIntervalPeriodMs,
    resolveOrbitDensityHint,
    resolveOverlapAdjustedOpacity,
    resolveTailOpacity2D,
    resolveTailOpacity3D,
    resolveTrackOpacity2D,
    resolveTrackOpacity3D,
    resolveTrailWindow,
};
