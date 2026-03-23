import { getMoonState, getEarthFromMoonState } from "../astronomy-bodies.js";
import { getStateFromChebyshev } from "../chebyshev.js";
import { getStateFromNpzSeries } from "./npz-ephemeris.js";

const DEFAULT_SOURCE_BY_BODY = {
    SC: "chebyshev",
    MOON: "astronomy",
    EARTH: "astronomy",
    SUN: "astronomy",
};

const JD_UNIX_EPOCH = 2440587.5;
const MS_PER_DAY = 86400000;
const HAS_DATE_GET_JD_UTC =
    typeof Date !== "undefined" &&
    typeof Date.prototype.getJD_UTC === "function";

function normalizeBodyId(bodyId) {
    return typeof bodyId === "string" ? bodyId.toUpperCase() : "";
}

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

function convertRawState(rawState, source) {
    if (!rawState) {
        return {
            position: null,
            velocity: null,
            available: false,
            source,
        };
    }

    if (rawState.position && rawState.velocity) {
        return {
            position: rawState.position,
            velocity: rawState.velocity,
            available: true,
            source,
        };
    }

    if (rawState.pos && rawState.vel) {
        return {
            position: {
                x: rawState.pos.x,
                y: rawState.pos.y,
                z: rawState.pos.z,
            },
            velocity: {
                vx: rawState.vel.vx,
                vy: rawState.vel.vy,
                vz: rawState.vel.vz,
            },
            available: true,
            source,
        };
    }

    return {
        position: { x: rawState.x, y: rawState.y, z: rawState.z },
        velocity: { vx: rawState.vx, vy: rawState.vy, vz: rawState.vz },
        available: true,
        source,
    };
}

export function getHorizonsJulianDate(timeMs) {
    if (HAS_DATE_GET_JD_UTC) {
        return new Date(timeMs).getJD_UTC();
    }
    return JD_UNIX_EPOCH + timeMs / MS_PER_DAY;
}

export function resolveBodySource({
    bodyId,
    bodySources,
    defaultSpacecraftSource,
}) {
    const normalizedBodyId = normalizeBodyId(bodyId);
    const override = bodySources?.[normalizedBodyId];
    if (typeof override === "string") {
        return normalizeSource(
            override,
            DEFAULT_SOURCE_BY_BODY[normalizedBodyId] || "chebyshev",
        );
    }

    if (normalizedBodyId === "SC") {
        return normalizeSource(
            defaultSpacecraftSource,
            DEFAULT_SOURCE_BY_BODY.SC,
        );
    }

    return DEFAULT_SOURCE_BY_BODY[normalizedBodyId] || normalizeSource(defaultSpacecraftSource);
}

export function selectSeriesFromNpz(
    npzData,
    config,
    bodyId,
    spacecraftMnemonic = "SC",
) {
    const bucket = npzData?.[config];
    if (!bucket) return null;

    const normalizedBodyId = normalizeBodyId(bodyId);
    const normalizedSpacecraftMnemonic = normalizeBodyId(spacecraftMnemonic);

    return (
        bucket[normalizedBodyId] ||
        bucket[normalizedSpacecraftMnemonic] ||
        bucket.SC ||
        null
    );
}

export function selectSeriesFromChebyshev(
    chebyshevData,
    config,
    bodyId,
    spacecraftMnemonic = "SC",
) {
    const bucket = chebyshevData?.[config];
    if (!bucket) return null;

    const normalizedBodyId = normalizeBodyId(bodyId);
    const normalizedSpacecraftMnemonic = normalizeBodyId(spacecraftMnemonic);

    if (bucket.segments) {
        return normalizedBodyId === "SC" ||
            normalizedBodyId === normalizedSpacecraftMnemonic
            ? bucket
            : null;
    }

    return (
        bucket[normalizedBodyId] ||
        bucket[normalizedSpacecraftMnemonic] ||
        bucket.SC ||
        null
    );
}

function getLandingStateFromSource({
    source,
    landingTimeMs,
    normalizedBodyId,
    spacecraftMnemonic,
    landingNpzData,
    landingNpzLoaded,
    landingChebyshevData,
    landingChebyshevLoaded,
}) {
    const landingJd = getHorizonsJulianDate(landingTimeMs);

    if (source === "npz" && landingNpzLoaded && landingNpzData) {
        const landingSeries =
            landingNpzData[normalizedBodyId] ||
            landingNpzData[spacecraftMnemonic] ||
            landingNpzData.SC ||
            null;
        const landingState = landingSeries
            ? getStateFromNpzSeries(landingSeries, landingJd)
            : null;
        const state = convertRawState(landingState, "npz");
        if (state.available) {
            return state;
        }
    }

    if (landingChebyshevLoaded && landingChebyshevData) {
        const landingState = getStateFromChebyshev(
            landingChebyshevData,
            landingJd,
        );
        const state = convertRawState(landingState, "chebyshev");
        if (state.available) {
            return state;
        }
    }

    return null;
}

export function getBodyEphemerisRange({
    bodyId,
    config,
    npzData,
    npzDataLoaded,
    chebyshevData,
    chebyshevDataLoaded,
    bodySources,
    defaultSpacecraftSource,
    spacecraftMnemonic = "SC",
    resolvedSource,
}) {
    const source = normalizeSource(
        resolvedSource,
        resolveBodySource({
            bodyId,
            bodySources,
            defaultSpacecraftSource,
        }),
    );

    if (source === "npz") {
        if (!npzDataLoaded?.[config]) return null;
        const series = selectSeriesFromNpz(npzData, config, bodyId, spacecraftMnemonic);
        return series?.timeRange || null;
    }

    if (source === "chebyshev") {
        if (!chebyshevDataLoaded?.[config]) return null;
        const series = selectSeriesFromChebyshev(
            chebyshevData,
            config,
            bodyId,
            spacecraftMnemonic,
        );
        return series?.time_range || null;
    }

    return null;
}

export function getBodyEphemerisState({
    bodyId,
    timeMs,
    config,
    npzData,
    npzDataLoaded,
    chebyshevData,
    chebyshevDataLoaded,
    landingNpzData,
    landingNpzLoaded,
    landingChebyshevData,
    landingChebyshevLoaded,
    globalConfig,
    startLandingTime,
    endLandingTime,
    bodySources,
    defaultSpacecraftSource,
    spacecraftMnemonic = "SC",
    resolvedSource,
}) {
    const normalizedBodyId = normalizeBodyId(bodyId);
    const source = normalizeSource(
        resolvedSource,
        resolveBodySource({
            bodyId: normalizedBodyId,
            bodySources,
            defaultSpacecraftSource,
        }),
    );
    const jd = getHorizonsJulianDate(timeMs);

    if (normalizedBodyId === "SC") {
        const landingEnabled = !!globalConfig?.landing?.enabled;
        if (
            landingEnabled &&
            typeof startLandingTime === "number" &&
            typeof endLandingTime === "number" &&
            timeMs >= startLandingTime &&
            timeMs < endLandingTime
        ) {
            const landingTimeMs = Math.min(timeMs, endLandingTime - 1000);

            const landingState = getLandingStateFromSource({
                source,
                landingTimeMs,
                normalizedBodyId,
                spacecraftMnemonic,
                landingNpzData,
                landingNpzLoaded,
                landingChebyshevData,
                landingChebyshevLoaded,
            });
            if (landingState?.available) {
                return landingState;
            }
        }
    }

    if (source === "astronomy") {
        if (normalizedBodyId === "MOON" && config === "geo") {
            return convertRawState(getMoonState(timeMs), source);
        }
        if (normalizedBodyId === "EARTH" && config === "lunar") {
            return convertRawState(getEarthFromMoonState(timeMs), source);
        }
        return {
            position: null,
            velocity: null,
            available: false,
            source,
            reason: `Astronomy source is not implemented for ${normalizedBodyId} in ${config}`,
        };
    }

    if (source === "npz") {
        if (!npzDataLoaded?.[config]) {
            return {
                position: null,
                velocity: null,
                available: false,
                source,
                reason: `NPZ data not loaded for ${config}`,
            };
        }

        const series = selectSeriesFromNpz(
            npzData,
            config,
            normalizedBodyId,
            spacecraftMnemonic,
        );
        const rawState = series ? getStateFromNpzSeries(series, jd) : null;
        const state = convertRawState(rawState, source);
        if (!state.available) {
            return {
                ...state,
                reason: series
                    ? `No NPZ state for ${normalizedBodyId} at JD ${jd.toFixed(6)}`
                    : `No NPZ series for ${normalizedBodyId} in ${config}`,
                range: series?.timeRange || null,
            };
        }
        return state;
    }

    if (source === "chebyshev") {
        if (!chebyshevDataLoaded?.[config]) {
            return {
                position: null,
                velocity: null,
                available: false,
                source,
                reason: `Chebyshev data not loaded for ${config}`,
            };
        }

        const series = selectSeriesFromChebyshev(
            chebyshevData,
            config,
            normalizedBodyId,
            spacecraftMnemonic,
        );
        const rawState = series ? getStateFromChebyshev(series, jd) : null;
        const state = convertRawState(rawState, source);
        if (!state.available) {
            return {
                ...state,
                reason: series
                    ? `No Chebyshev state for ${normalizedBodyId} at JD ${jd.toFixed(6)}`
                    : `No Chebyshev series for ${normalizedBodyId} in ${config}`,
                range: series?.time_range || null,
            };
        }
        return state;
    }

    return {
        position: null,
        velocity: null,
        available: false,
        source,
        reason: `Unsupported ephemeris source ${source}`,
    };
}

export function generateBodyCurve({
    bodyId,
    config,
    startTimeMs,
    endTimeMs,
    stepMs,
    npzData,
    npzDataLoaded,
    chebyshevData,
    chebyshevDataLoaded,
    bodySources,
    defaultSpacecraftSource,
    spacecraftMnemonic = "SC",
    resolvedSource,
}) {
    const vectors = [];
    const step = Math.max(1, stepMs);

    for (let timeMs = startTimeMs; timeMs <= endTimeMs; timeMs += step) {
        const state = getBodyEphemerisState({
            bodyId,
            timeMs,
            config,
            npzData,
            npzDataLoaded,
            chebyshevData,
            chebyshevDataLoaded,
            bodySources,
            defaultSpacecraftSource,
            spacecraftMnemonic,
            resolvedSource,
        });

        if (!state.available) continue;

        vectors.push({
            x: state.position.x,
            y: state.position.y,
            z: state.position.z,
            vx: state.velocity.vx,
            vy: state.velocity.vy,
            vz: state.velocity.vz,
        });
    }

    return vectors;
}

export function getRequiredEphemerisSources({
    bodyIds,
    bodySources,
    defaultSpacecraftSource,
}) {
    const requiredSources = new Set();

    for (const bodyId of bodyIds || []) {
        const source = resolveBodySource({
            bodyId,
            bodySources,
            defaultSpacecraftSource,
        });
        if (source === "npz" || source === "chebyshev") {
            requiredSources.add(source);
        }
    }

    return requiredSources;
}
