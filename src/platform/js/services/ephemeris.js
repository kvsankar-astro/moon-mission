/**
 * Ephemeris Service
 *
 * Imperative-shell dependency wrapper for runtime ephemeris lookups.
 *
 * Sun longitude is intentionally Chebyshev-only (no fallback path).
 */

import { getStateFromChebyshev } from "../chebyshev.js";

const JD_UNIX_EPOCH = 2440587.5;
const MS_PER_DAY = 86400000;
const TWO_PI = Math.PI * 2;

function normalizeSource(source, fallback = "chebyshev") {
    if (typeof source !== "string") return fallback;
    const normalized = source.toLowerCase();
    if (
        normalized === "npz" ||
        normalized === "chebyshev" ||
        normalized === "astronomy"
    ) {
        return normalized;
    }
    return fallback;
}

function resolveSunSource(options) {
    const override = options?.bodySources?.SUN;
    if (typeof override === "string") {
        return normalizeSource(override, "chebyshev");
    }
    return "chebyshev";
}

function toHorizonsJulianDate(timeMs) {
    if (
        typeof Date !== "undefined" &&
        typeof Date.prototype.getJD_UTC === "function"
    ) {
        return new Date(timeMs).getJD_UTC();
    }
    return JD_UNIX_EPOCH + timeMs / MS_PER_DAY;
}

function normalizeLongitudeRadians(angle) {
    if (!Number.isFinite(angle)) return null;
    return angle < 0 ? angle + TWO_PI : angle;
}

function resolveSunChebyshevSeries(options) {
    const chebyshevData = options?.chebyshevData;
    if (!chebyshevData) return null;

    const chebyshevDataLoaded = options?.chebyshevDataLoaded;
    const config = typeof options?.config === "string" ? options.config : null;
    const candidates = [];

    // Prefer geocentric Sun vectors to keep lighting continuity across phase switches.
    if (config !== "geo") {
        candidates.push("geo");
    }
    if (config) {
        candidates.push(config);
    }

    for (const key of candidates) {
        if (chebyshevDataLoaded && !chebyshevDataLoaded[key]) continue;
        const series = chebyshevData?.[key]?.sun || chebyshevData?.[key]?.SUN;
        if (series?.segments) return series;
    }

    // Fallback to any loaded sun series in memory for resilience during preloading order.
    for (const [key, bucket] of Object.entries(chebyshevData)) {
        if (chebyshevDataLoaded && !chebyshevDataLoaded[key]) continue;
        const series = bucket?.sun || bucket?.SUN;
        if (series?.segments) return series;
    }

    return null;
}

function computeSunLongitudeFromChebyshev(timeMs, options) {
    const sunSeries = resolveSunChebyshevSeries(options);
    if (!sunSeries) return null;

    const jd = toHorizonsJulianDate(timeMs);
    const state = getStateFromChebyshev(sunSeries, jd);
    if (!state?.pos) return null;

    return normalizeLongitudeRadians(Math.atan2(state.pos.y, state.pos.x));
}

/**
 * Compute Sun longitude from ephemeris.
 *
 * Requirement:
 * - SUN source must be `chebyshev`
 * - Sun Chebyshev series must be loaded for the phase (or geocentric fallback phase)
 *
 * @param {number} timeMs - Animation time (ms since epoch)
 * @param {Object} [options] - Runtime lookup options
 * @returns {number} Sun longitude in radians
 */
export function computeSunLongitude(timeMs, options) {
    const source = resolveSunSource(options);
    if (source !== "chebyshev") {
        throw new Error(
            `Unsupported SUN ephemeris source '${source}'. Configure SUN source as 'chebyshev' (no fallback enabled).`,
        );
    }

    const longitude = computeSunLongitudeFromChebyshev(timeMs, options);
    if (Number.isFinite(longitude)) {
        return longitude;
    }

    const cfg = typeof options?.config === "string" ? options.config : "unknown";
    throw new Error(
        `SUN Chebyshev series unavailable for config '${cfg}' (no fallback enabled).`,
    );
}
