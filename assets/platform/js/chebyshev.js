/**
 * Chebyshev Polynomial Evaluation Module
 *
 * Provides functions to evaluate Chebyshev polynomial ephemeris data
 * for spacecraft position and velocity calculation.
 *
 * Based on NASA/JPL SPICE SPK data types and Clenshaw recurrence algorithm.
 */

// ============================================================================
// Chebyshev Polynomial Evaluation
// ============================================================================

/**
 * Evaluate a Chebyshev polynomial using the Clenshaw recurrence algorithm.
 * This is numerically stable and efficient.
 *
 * @param {number[]} coeffs - Chebyshev coefficients [c0, c1, c2, ...]
 * @param {number} x - Normalized time in range [-1, 1]
 * @returns {number} Evaluated polynomial value
 */
export function evaluateChebyshev(coeffs, x) {
    const n = coeffs.length;

    if (n === 0) return 0;
    if (n === 1) return coeffs[0];

    let b_k1 = 0;  // b_{k+1}
    let b_k2 = 0;  // b_{k+2}

    // Clenshaw recurrence: iterate from highest to lowest coefficient
    for (let k = n - 1; k >= 1; k--) {
        const b_k = coeffs[k] + 2 * x * b_k1 - b_k2;
        b_k2 = b_k1;
        b_k1 = b_k;
    }

    return coeffs[0] + x * b_k1 - b_k2;
}

/**
 * Evaluate the derivative of a Chebyshev polynomial.
 * Uses the recurrence relation for Chebyshev derivatives.
 *
 * @param {number[]} coeffs - Chebyshev coefficients [c0, c1, c2, ...]
 * @param {number} x - Normalized time in range [-1, 1]
 * @param {number} tSpan - Time span of the segment in seconds
 * @returns {number} Derivative value (scaled to per-second rate)
 */
export function evaluateChebyshevDerivative(coeffs, x, tSpan) {
    const n = coeffs.length;
    if (n <= 1) return 0;

    // Compute derivative coefficients using recurrence
    // d/dx T_n(x) = n * U_{n-1}(x) where U is Chebyshev of second kind
    // The derivative coefficients satisfy: d_k = 2*(k+1)*c_{k+1} + d_{k+2}
    const dcoeffs = new Array(n - 1).fill(0);

    // Start from the highest order
    dcoeffs[n - 2] = 2 * (n - 1) * coeffs[n - 1];

    // Handle second-highest order separately (no d_{k+2} term)
    if (n >= 3) {
        dcoeffs[n - 3] = 2 * (n - 2) * coeffs[n - 2];
    }

    // Continue recurrence for remaining terms
    for (let k = n - 4; k >= 0; k--) {
        dcoeffs[k] = dcoeffs[k + 2] + 2 * (k + 1) * coeffs[k + 1];
    }

    // First coefficient is halved in Chebyshev convention
    dcoeffs[0] /= 2;

    // Evaluate the derivative polynomial
    const deriv = evaluateChebyshev(dcoeffs, x);

    // Scale by time normalization factor: d/dt = d/dx * dx/dt = d/dx * 2/tSpan
    // tSpan is in seconds, so result is in km/s
    return deriv * 2 / tSpan;
}

// ============================================================================
// Segment Lookup
// ============================================================================

/**
 * Find the segment containing a given Julian Date using binary search.
 *
 * @param {Object[]} segments - Array of segment objects with t_start and t_end
 * @param {number} jd - Julian Date to find
 * @returns {Object|null} Segment containing the time, or null if not found
 */
export function findSegment(segments, jd) {
    if (!segments || segments.length === 0) return null;

    let low = 0;
    let high = segments.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const seg = segments[mid];

        if (jd < seg.t_start) {
            high = mid - 1;
        } else if (jd > seg.t_end) {
            low = mid + 1;
        } else {
            return seg;
        }
    }

    return null;
}

// ============================================================================
// Position and Velocity from Chebyshev Data
// ============================================================================

/**
 * Get position from Chebyshev data at a specific Julian Date.
 *
 * @param {Object} chebData - Chebyshev JSON data object
 * @param {number} jd - Julian Date
 * @returns {Object|null} Position {x, y, z} in km, or null if out of range
 */
export function getPositionFromChebyshev(chebData, jd) {
    const segment = findSegment(chebData.segments, jd);
    if (!segment) {
        return null;
    }

    // Normalize time to [-1, 1]
    const tSpan = segment.t_end - segment.t_start;
    const tNorm = 2 * (jd - segment.t_start) / tSpan - 1;

    return {
        x: evaluateChebyshev(segment.cx, tNorm),
        y: evaluateChebyshev(segment.cy, tNorm),
        z: evaluateChebyshev(segment.cz, tNorm)
    };
}

/**
 * Get velocity from Chebyshev data at a specific Julian Date.
 * Velocity is computed analytically from the polynomial derivative.
 *
 * @param {Object} chebData - Chebyshev JSON data object
 * @param {number} jd - Julian Date
 * @returns {Object|null} Velocity {vx, vy, vz} in km/s, or null if out of range
 */
export function getVelocityFromChebyshev(chebData, jd) {
    const segment = findSegment(chebData.segments, jd);
    if (!segment) {
        return null;
    }

    // Normalize time to [-1, 1]
    const tSpanJD = segment.t_end - segment.t_start;
    const tNorm = 2 * (jd - segment.t_start) / tSpanJD - 1;

    // Time span in seconds for proper velocity scaling
    const tSpanSeconds = tSpanJD * 86400;

    return {
        vx: evaluateChebyshevDerivative(segment.cx, tNorm, tSpanSeconds),
        vy: evaluateChebyshevDerivative(segment.cy, tNorm, tSpanSeconds),
        vz: evaluateChebyshevDerivative(segment.cz, tNorm, tSpanSeconds)
    };
}

/**
 * Get both position and velocity from Chebyshev data at a specific Julian Date.
 * More efficient than calling getPosition and getVelocity separately.
 *
 * @param {Object} chebData - Chebyshev JSON data object
 * @param {number} jd - Julian Date
 * @returns {Object|null} {pos: {x,y,z}, vel: {vx,vy,vz}} or null if out of range
 */
export function getStateFromChebyshev(chebData, jd) {
    if (!chebData || !chebData.segments || chebData.segments.length === 0) {
        return null;
    }

    const segment = findSegment(chebData.segments, jd);
    if (!segment) {
        return null;
    }

    // Normalize time to [-1, 1]
    const tSpanJD = segment.t_end - segment.t_start;
    const tNorm = 2 * (jd - segment.t_start) / tSpanJD - 1;
    const tSpanSeconds = tSpanJD * 86400;

    return {
        pos: {
            x: evaluateChebyshev(segment.cx, tNorm),
            y: evaluateChebyshev(segment.cy, tNorm),
            z: evaluateChebyshev(segment.cz, tNorm)
        },
        vel: {
            vx: evaluateChebyshevDerivative(segment.cx, tNorm, tSpanSeconds),
            vy: evaluateChebyshevDerivative(segment.cy, tNorm, tSpanSeconds),
            vz: evaluateChebyshevDerivative(segment.cz, tNorm, tSpanSeconds)
        }
    };
}

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

    // Helper to convert JS timestamp to Julian Date
    const msToJD = (ms) => {
        const date = new Date(ms);
        if (typeof date.getJD_TDB === "function") {
            return date.getJD_TDB();
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
