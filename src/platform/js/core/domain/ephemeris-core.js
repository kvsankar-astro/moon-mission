/**
 * Shared pure ephemeris primitives used by runtime and tests.
 */

/**
 * Evaluate a Chebyshev polynomial using the Clenshaw recurrence algorithm.
 * @param {number[]} coeffs
 * @param {number} x normalized time in [-1, 1]
 * @returns {number}
 */
function evaluateChebyshev(coeffs, x) {
    const n = coeffs.length;

    if (n === 0) return 0;
    if (n === 1) return coeffs[0];

    let bK1 = 0;
    let bK2 = 0;

    for (let k = n - 1; k >= 1; k--) {
        const bK = coeffs[k] + 2 * x * bK1 - bK2;
        bK2 = bK1;
        bK1 = bK;
    }

    return coeffs[0] + x * bK1 - bK2;
}

/**
 * Evaluate the derivative of a Chebyshev polynomial and scale it to per-second.
 * @param {number[]} coeffs
 * @param {number} x normalized time in [-1, 1]
 * @param {number} tSpanSeconds segment duration in seconds
 * @returns {number}
 */
function evaluateChebyshevDerivative(coeffs, x, tSpanSeconds) {
    const n = coeffs.length;
    if (n <= 1) return 0;

    const dcoeffs = new Array(n - 1).fill(0);
    dcoeffs[n - 2] = 2 * (n - 1) * coeffs[n - 1];

    if (n >= 3) {
        dcoeffs[n - 3] = 2 * (n - 2) * coeffs[n - 2];
    }

    for (let k = n - 4; k >= 0; k--) {
        dcoeffs[k] = dcoeffs[k + 2] + 2 * (k + 1) * coeffs[k + 1];
    }

    dcoeffs[0] /= 2;
    const deriv = evaluateChebyshev(dcoeffs, x);
    return deriv * 2 / tSpanSeconds;
}

/**
 * Find the segment containing a Julian Date using binary search.
 * @param {{t_start:number,t_end:number}[]} segments
 * @param {number} jd
 * @returns {object|null}
 */
function findSegment(segments, jd) {
    if (!segments || segments.length === 0) return null;

    let low = 0;
    let high = segments.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const seg = segments[mid];

        if (jd < seg.t_start - SEGMENT_BOUNDARY_EPSILON_JD) {
            high = mid - 1;
        } else if (jd > seg.t_end + SEGMENT_BOUNDARY_EPSILON_JD) {
            low = mid + 1;
        } else {
            return seg;
        }
    }

    return null;
}

/**
 * Normalize Julian Date to segment-local Chebyshev time in [-1, 1].
 * @param {{t_start:number,t_end:number}} segment
 * @param {number} jd
 * @returns {{tNorm:number,tSpanJD:number}}
 */
function normalizeSegmentTime(segment, jd) {
    const tSpanJD = segment.t_end - segment.t_start;
    const rawTNorm = 2 * (jd - segment.t_start) / tSpanJD - 1;
    return {
        tNorm: Math.max(-1, Math.min(1, rawTNorm)),
        tSpanJD,
    };
}

/**
 * @param {{segments:object[]}} chebData
 * @param {number} jd
 * @returns {{x:number,y:number,z:number}|null}
 */
function getPositionFromChebyshev(chebData, jd) {
    const segment = findSegment(chebData?.segments, jd);
    if (!segment) return null;
    const { tNorm } = normalizeSegmentTime(segment, jd);

    return {
        x: evaluateChebyshev(segment.cx, tNorm),
        y: evaluateChebyshev(segment.cy, tNorm),
        z: evaluateChebyshev(segment.cz, tNorm),
    };
}

/**
 * @param {{segments:object[]}} chebData
 * @param {number} jd
 * @returns {{vx:number,vy:number,vz:number}|null}
 */
function getVelocityFromChebyshev(chebData, jd) {
    const segment = findSegment(chebData?.segments, jd);
    if (!segment) return null;
    const { tNorm, tSpanJD } = normalizeSegmentTime(segment, jd);
    const tSpanSeconds = tSpanJD * 86400;

    return {
        vx: evaluateChebyshevDerivative(segment.cx, tNorm, tSpanSeconds),
        vy: evaluateChebyshevDerivative(segment.cy, tNorm, tSpanSeconds),
        vz: evaluateChebyshevDerivative(segment.cz, tNorm, tSpanSeconds),
    };
}

/**
 * @param {{segments:object[]}} chebData
 * @param {number} jd
 * @returns {{pos:{x:number,y:number,z:number},vel:{vx:number,vy:number,vz:number}}|null}
 */
function getStateFromChebyshev(chebData, jd) {
    const segment = findSegment(chebData?.segments, jd);
    if (!segment) return null;
    const { tNorm, tSpanJD } = normalizeSegmentTime(segment, jd);
    const tSpanSeconds = tSpanJD * 86400;

    return {
        pos: {
            x: evaluateChebyshev(segment.cx, tNorm),
            y: evaluateChebyshev(segment.cy, tNorm),
            z: evaluateChebyshev(segment.cz, tNorm),
        },
        vel: {
            vx: evaluateChebyshevDerivative(segment.cx, tNorm, tSpanSeconds),
            vy: evaluateChebyshevDerivative(segment.cy, tNorm, tSpanSeconds),
            vz: evaluateChebyshevDerivative(segment.cz, tNorm, tSpanSeconds),
        },
    };
}

export {
    evaluateChebyshev,
    evaluateChebyshevDerivative,
    findSegment,
    getPositionFromChebyshev,
    getStateFromChebyshev,
    getVelocityFromChebyshev,
    normalizeSegmentTime,
};
const SEGMENT_BOUNDARY_EPSILON_JD = 1e-8;
