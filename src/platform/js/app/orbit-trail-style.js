function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

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
    mixColors,
    normalizeHexColor,
    resolveHeadOpacity2D,
    resolveHeadOpacity3D,
    resolveTailOpacity2D,
    resolveTailOpacity3D,
    resolveTrackOpacity2D,
    resolveTrackOpacity3D,
    resolveTrailWindow,
};
