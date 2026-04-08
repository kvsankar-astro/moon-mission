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
import {
    isGzipUrl,
    normalizeChebyshevTransport,
    shouldAttemptGzipTransport,
    toChebyshevGzipCandidateUrl,
} from "./core/domain/chebyshev-transport.js";

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
 * @param {Object} [options] - Optional dependency injection hooks for tests
 * @returns {Promise<Object>} Parsed Chebyshev data object
 */
export async function loadChebyshevData(url, options = {}) {
    if (typeof url !== "string" || !url.trim()) {
        throw new Error("loadChebyshevData(url) requires a non-empty URL string");
    }

    const fetchFn = typeof options.fetchFn === "function" ? options.fetchFn : fetch;
    const decodeGzipJson =
        typeof options.decodeGzipJson === "function" ? options.decodeGzipJson : decodeGzipJsonResponse;
    const transport = normalizeChebyshevTransport(
        options.transport ?? readChebyshevTransportPreference(),
    );
    const canDecompressGzip =
        typeof options.canDecompressGzip === "boolean"
            ? options.canDecompressGzip
            : typeof DecompressionStream === "function";

    if (isGzipUrl(url)) {
        return fetchChebyshevGzipJson(url, fetchFn, decodeGzipJson);
    }

    const shouldAttemptGzip = shouldAttemptGzipTransport({
        url,
        transport,
        canDecompressGzip,
    });

    if (shouldAttemptGzip) {
        const gzipUrl = toChebyshevGzipCandidateUrl(url);
        if (gzipUrl) {
            try {
                return await fetchChebyshevGzipJson(gzipUrl, fetchFn, decodeGzipJson);
            } catch (gzipError) {
                if (transport === "gzip") {
                    throw gzipError;
                }
                console.debug(`Chebyshev gzip transport unavailable at ${gzipUrl}; falling back to JSON`, gzipError);
            }
        }
    }

    return fetchChebyshevJson(url, fetchFn);
}

function readChebyshevTransportPreference() {
    const configuredTransport = globalThis?.window?.missionConfig?.chebyshev_transport;
    return normalizeChebyshevTransport(configuredTransport);
}

async function fetchChebyshevJson(url, fetchFn) {
    const response = await fetchFn(url);
    if (!response.ok) {
        throw new Error(`Failed to load Chebyshev data from ${url}: ${response.status}`);
    }
    return await response.json();
}

async function fetchChebyshevGzipJson(url, fetchFn, decodeGzipJson) {
    const response = await fetchFn(url);
    if (!response.ok) {
        throw new Error(`Failed to load gzip Chebyshev data from ${url}: ${response.status}`);
    }
    return decodeGzipJson(response, url);
}

async function decodeGzipJsonResponse(response, url = "unknown") {
    const contentEncoding = response?.headers?.get?.("content-encoding") || "";
    if (/\bgzip\b/i.test(contentEncoding)) {
        return response.json();
    }

    if (typeof DecompressionStream !== "function") {
        throw new Error(`Gzip Chebyshev transport requires DecompressionStream support (${url})`);
    }

    const fallbackJsonResponse = typeof response.clone === "function" ? response.clone() : null;

    try {
        const compressedBytes = await response.arrayBuffer();
        const compressedStream = new Blob([compressedBytes]).stream();
        const decompressedStream = compressedStream.pipeThrough(new DecompressionStream("gzip"));
        const jsonText = await new Response(decompressedStream).text();

        return JSON.parse(jsonText);
    } catch (error) {
        if (fallbackJsonResponse) {
            try {
                return await fallbackJsonResponse.json();
            } catch (_) {
                // Continue to throw explicit gzip decode error below.
            }
        }
        throw new Error(`Invalid gzip Chebyshev JSON payload at ${url}: ${error.message}`);
    }
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

    // Chebyshev segment data uses JD in TDB (HORIZONS JDCT / SPICE JDTDB).
    const TDB_OFFSET_MS = (37.000 + 32.184) * 1000;
    const JD_UNIX_EPOCH = 2440587.5;
    const MS_PER_DAY = 86400000;
    const msToJD = (ms) => {
        const date = new Date(ms);
        if (typeof date.getJD_TDB === "function") {
            return date.getJD_TDB();
        }
        return JD_UNIX_EPOCH + (ms + TDB_OFFSET_MS) / MS_PER_DAY;
    };

    const jdToMs = (jd) => (jd - JD_UNIX_EPOCH) * MS_PER_DAY - TDB_OFFSET_MS;

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
                    timeMs: t,
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
