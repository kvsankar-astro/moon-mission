/**
 * Ephemeris Service
 *
 * Imperative-shell dependency wrapper around the external ephemeris globals:
 * - $moshier
 * - $processor
 * - $const
 *
 * Kept separate from the functional core so scene state computation can remain pure.
 */

import { degreesToRadians } from "../utils/math-utils.js";
import { getDateComponentsUTC } from "../utils/time-utils.js";
import { getStateFromNpzSeries } from "../data/npz-ephemeris.js";

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
        return normalizeSource(override, "astronomy");
    }
    return "astronomy";
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

function resolveSunSeries(options) {
    const npzData = options?.npzData;
    if (!npzData) return null;

    const npzDataLoaded = options?.npzDataLoaded;
    const config = typeof options?.config === "string" ? options.config : null;
    const candidates = [];

    // Prefer geocentric Sun vectors for continuity with the legacy geocentric model.
    if (config !== "geo") {
        candidates.push("geo");
    }
    if (config) {
        candidates.push(config);
    }

    for (const key of candidates) {
        if (npzDataLoaded && !npzDataLoaded[key]) continue;
        const series = npzData?.[key]?.SUN;
        if (series) return series;
    }

    // Fallback: use any loaded SUN series that is available.
    for (const [key, bucket] of Object.entries(npzData)) {
        if (npzDataLoaded && !npzDataLoaded[key]) continue;
        if (bucket?.SUN) return bucket.SUN;
    }

    return null;
}

function normalizeLongitudeRadians(angle) {
    if (!Number.isFinite(angle)) return null;
    return angle < 0 ? angle + TWO_PI : angle;
}

function computeSunLongitudeFromNpz(timeMs, options) {
    if (resolveSunSource(options) !== "npz") {
        return null;
    }

    const sunSeries = resolveSunSeries(options);
    if (!sunSeries) return null;

    const jd = toHorizonsJulianDate(timeMs);
    const state = getStateFromNpzSeries(sunSeries, jd);
    if (!state?.pos) return null;

    return normalizeLongitudeRadians(Math.atan2(state.pos.y, state.pos.x));
}

function computeSunLongitudeFromLegacy(timeMs) {
    if (
        typeof $const === "undefined" ||
        typeof $processor === "undefined" ||
        typeof $moshier === "undefined"
    ) {
        throw new Error(
            "Legacy ephemeris globals are unavailable for sun longitude fallback",
        );
    }

    const ephemDate = getDateComponentsUTC(timeMs);

    // Configure ephemeris for geocentric calculation
    $const.tlong = 0.0; // longitude
    $const.glat = 0.0; // latitude
    $processor.init();

    const ephemSun = $moshier.body.sun;
    $processor.calc(ephemDate, ephemSun);

    return degreesToRadians(ephemSun.position.apparentLongitude);
}

/**
 * Compute sun longitude from ephemeris.
 *
 * Source preference:
 * 1. NPZ vectors when body source for SUN is configured as "npz"
 * 2. Legacy global ephemeris fallback ($moshier, $processor, $const)
 *
 * @param {number} timeMs - Animation time (ms since epoch)
 * @param {Object} [options] - Optional runtime data for NPZ lookup
 * @returns {number} Sun longitude in radians
 */
export function computeSunLongitude(timeMs, options) {
    const npzLongitude = computeSunLongitudeFromNpz(timeMs, options);
    if (Number.isFinite(npzLongitude)) {
        return npzLongitude;
    }

    return computeSunLongitudeFromLegacy(timeMs);
}
