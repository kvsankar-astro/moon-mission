/**
 * Chebyshev Polynomial Evaluation Module
 *
 * Provides functions to evaluate Chebyshev polynomial ephemeris data
 * for spacecraft position and velocity calculation.
 *
 * Based on NASA/JPL SPICE SPK data types and Clenshaw recurrence algorithm.
 */

import {
    evaluateChebyshev,
    evaluateChebyshevDerivative,
    findSegment,
    getPositionFromChebyshev,
    getStateFromChebyshev,
    getVelocityFromChebyshev,
} from "./core/domain/ephemeris-core.js";

export {
    evaluateChebyshev,
    evaluateChebyshevDerivative,
    findSegment,
    getPositionFromChebyshev,
    getStateFromChebyshev,
    getVelocityFromChebyshev,
};

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load Chebyshev JSON data from a URL.
 *
 * @param {string} url - URL to the Chebyshev JSON file
 * @returns {Promise<Object>} Parsed Chebyshev data object
 */
export async function loadChebyshevData(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load Chebyshev data from ${url}: ${response.status}`);
    }
    return await response.json();
}

// ============================================================================
// Curve Generation
// ============================================================================

/**
 * Generate curve points from Chebyshev data.
 * Sampling adapts per segment using its polynomial degree (number of coeffs),
 * allowing longer steps for low‑order segments while keeping a cap at the
 * original fixed cadence (stepMs).
 *
 * @param {Object} chebData - Chebyshev JSON data object
 * @param {number} startTimeMs - Start time as JavaScript timestamp (ms)
 * @param {number} endTimeMs - End time as JavaScript timestamp (ms)
 * @param {number} stepMs - Step size in milliseconds
 * @returns {Object[]} Array of {x, y, z, vx, vy, vz} vectors
 */
export function generateCurveFromChebyshev(chebData, startTimeMs, endTimeMs, stepMs) {
    const vectors = [];

    // HORIZONS-backed ephemerides in this repo are stored in UTC Julian dates.
    const msToJD = (ms) => {
        const date = new Date(ms);
        if (typeof date.getJD_UTC === "function") {
            return date.getJD_UTC();
        }
        const JD_UNIX_EPOCH = 2440587.5;
        return JD_UNIX_EPOCH + ms / 86400000;
    };

    const JD_UNIX_EPOCH = 2440587.5;
    const jdToMs = (jd) => (jd - JD_UNIX_EPOCH) * 86400000;

    for (const seg of chebData.segments || []) {
        const segStartMs = jdToMs(seg.t_start);
        const segEndMs = jdToMs(seg.t_end);

        const clampedStart = Math.max(startTimeMs, segStartMs);
        const clampedEnd = Math.min(endTimeMs, segEndMs);
        if (clampedStart > clampedEnd) continue;

        const durationMs = Math.max(clampedEnd - clampedStart, 0);
        const maxSamplesAtBaseStep = Math.max(2, Math.ceil(durationMs / stepMs));

        const degreeEstimate = Math.max(
            seg?.cx?.length ?? 0,
            seg?.cy?.length ?? 0,
            seg?.cz?.length ?? 0,
        );
        // Aim for ~3 points per polynomial degree, but never exceed the base cadence.
        const samples = Math.min(
            maxSamplesAtBaseStep,
            Math.max(2, Math.ceil(degreeEstimate * 3)),
        );

        const denom = samples > 1 ? samples - 1 : 1;
        const step = durationMs / denom;

        for (let i = 0; i < samples; i++) {
            const t = i === samples - 1 ? clampedEnd : clampedStart + step * i;
            const jd = msToJD(t);
            const state = getStateFromChebyshev(chebData, jd);

            if (state) {
                vectors.push({
                    x: state.pos.x,
                    y: state.pos.y,
                    z: state.pos.z,
                    vx: state.vel.vx,
                    vy: state.vel.vy,
                    vz: state.vel.vz,
                });
            }
        }
    }

    return vectors;
}
