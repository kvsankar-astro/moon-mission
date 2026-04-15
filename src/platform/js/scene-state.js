/**
 * Scene State Module - Functional Core
 *
 * Pure functions that compute scene state from time and configuration.
 * These functions have no side effects (no DOM updates, no 3D object mutations).
 *
 * Architecture: "Functional core / Imperative shell"
 * - This module = functional core (pure calculations)
 * - mission.js = imperative shell (applies state to DOM/3D)
 */
import {
    getBodyEphemerisState,
} from "./data/ephemeris-provider.js";
import { getRelativeFrameQuaternion } from "./data/relative-frame-provider.js";
import { PHYSICS_CONSTANTS as PC, TIME_CONSTANTS as TC } from "./core/constants.js";
import {
    isMissionCraftBody,
    resolveMissionCraft,
} from "./core/domain/mission-config.js";

const SPEED_OF_LIGHT_KM_PER_SEC = 299792.458;
const MS_PER_SEC = 1000;

// ============================================================================
// Body State Computation
// ============================================================================

/**
 * Compute the state (position and velocity) of a celestial body at a given time.
 *
 * @param {string} bodyId - Body identifier: "SC", "MOON", "EARTH"
 * @param {number} time - Animation time (ms since epoch)
 * @param {string} config - Configuration: "geo" or "lunar"
 * @param {Object} data - Data sources
 * @param {Object} data.chebyshevData - Chebyshev data keyed by config
 * @param {Object} data.chebyshevDataLoaded - Chebyshev loaded flags keyed by config
 * @param {Object} data.npzData - NPZ data keyed by config
 * @param {Object} data.npzDataLoaded - NPZ loaded flags keyed by config
 * @param {Object} data.landingNpzData - Landing phase NPZ data
 * @param {Object} data.landingNpzLoaded - Landing phase NPZ loaded flags
 * @param {Object} data.landingChebyshevData - Landing phase Chebyshev data
 * @param {Object} data.landingChebyshevLoaded - Landing phase Chebyshev loaded flags
 * @param {Object} data.globalConfig - Mission configuration
 * @param {number} data.startLandingTime - Landing phase start time
 * @param {number} data.endLandingTime - Landing phase end time
 * @param {string} [data.frameMode] - Frame mode ("absolute" or "relative")
 * @param {string} [data.ephemerisSource] - Default spacecraft ephemeris source
 * @param {Object} [data.bodySources] - Per-body ephemeris source overrides
 * @param {boolean} [data.includeNextState] - Whether to compute next-step state
 * @param {Object} [data.precomputedBodyEphemeris] - Optional precomputed body states
 * @returns {Object|null} Body state: { position: {x,y,z}, velocity: {vx,vy,vz}, available: boolean, nextPosition?: {x,y,z}, nextVelocity?: {vx,vy,vz} }
 */
export function computeBodyState(bodyId, time, config, data) {
    const {
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        globalConfig,
        startLandingTime,
        endLandingTime,
        frameMode,
        ephemerisSource,
        bodySources,
        includeNextState,
        precomputedBodyEphemeris,
    } = data;

    const defaultSpacecraftMnemonic = (globalConfig?.spacecraft_mnemonic || "SC").toUpperCase();
    const missionCraft = resolveMissionCraft(globalConfig, bodyId);
    const spacecraftMnemonic = (
        missionCraft?.mnemonic ||
        defaultSpacecraftMnemonic
    ).toUpperCase();
    // Check if landing is enabled
    const isLandingEnabled = globalConfig && globalConfig.landing && globalConfig.landing.enabled;

    if (bodyId === "SC" || isMissionCraftBody(globalConfig, bodyId)) {
        const computeScStateAtTime = (t) => {
            return getBodyEphemerisState({
                bodyId,
                timeMs: t,
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
                defaultSpacecraftSource: ephemerisSource,
                spacecraftMnemonic,
            });
        };

        const current = computeScStateAtTime(time);
        if (!current.available) {
            return { position: null, velocity: null, nextPosition: null, nextVelocity: null, available: false };
        }

        const shouldIncludeNextState = includeNextState !== false;
        if (!shouldIncludeNextState) {
            return {
                position: current.position,
                velocity: current.velocity,
                nextPosition: current.position,
                nextVelocity: current.velocity,
                available: true,
            };
        }

        // Use finer step near landing to stabilize orientation (landing data is 1s resolution)
        const nextStepMs =
            (isLandingEnabled &&
             time >= startLandingTime &&
             time < endLandingTime - TC.ONE_SECOND_MS)
                ? TC.ONE_SECOND_MS
                : TC.ONE_MINUTE_MS;

        const nextTime = time + nextStepMs;
        const next = computeScStateAtTime(nextTime);

        return {
            position: current.position,
            velocity: current.velocity,
            nextPosition: next.available ? next.position : current.position,
            nextVelocity: next.available ? next.velocity : current.velocity,
            available: true
        };
    }

    if (bodyId === "MOON" && config === "geo") {
        const ephemerisState =
            precomputedBodyEphemeris?.MOON ||
            getBodyEphemerisState({
                bodyId,
                timeMs: time,
                config,
                npzData,
                npzDataLoaded,
                chebyshevData,
                chebyshevDataLoaded,
                bodySources,
                defaultSpacecraftSource: ephemerisSource,
                spacecraftMnemonic,
            });

        if (!ephemerisState.available) {
            return ephemerisState;
        }

        const state = {
            x: ephemerisState.position.x,
            y: ephemerisState.position.y,
            z: ephemerisState.position.z,
            vx: ephemerisState.velocity.vx,
            vy: ephemerisState.velocity.vy,
            vz: ephemerisState.velocity.vz,
        };

        // Relative mode: Earth-centered rotating frame where Moon is always on +X.
        // Keep real scale by using the instantaneous Earth–Moon distance.
        if (state && frameMode === "relative") {
            const r = Math.sqrt(state.x * state.x + state.y * state.y + state.z * state.z);
            const drdt = r > 0 ? (state.x * state.vx + state.y * state.vy + state.z * state.vz) / r : 0;
            return {
                position: { x: r, y: 0, z: 0 },
                velocity: { vx: drdt, vy: 0, vz: 0 },
                available: true
            };
        }

        return state ? {
            position: { x: state.x, y: state.y, z: state.z },
            velocity: { vx: state.vx, vy: state.vy, vz: state.vz },
            available: true
        } : { position: null, velocity: null, available: false };
    }

    if (bodyId === "EARTH" && config === "lunar") {
        const ephemerisState = getBodyEphemerisState({
            bodyId,
            timeMs: time,
            config,
            npzData,
            npzDataLoaded,
            chebyshevData,
            chebyshevDataLoaded,
            bodySources,
            defaultSpacecraftSource: ephemerisSource,
            spacecraftMnemonic,
        });

        if (!ephemerisState.available) {
            return ephemerisState;
        }

        const state = {
            x: ephemerisState.position.x,
            y: ephemerisState.position.y,
            z: ephemerisState.position.z,
            vx: ephemerisState.velocity.vx,
            vy: ephemerisState.velocity.vy,
            vz: ephemerisState.velocity.vz,
        };

        return state
            ? {
                  position: { x: state.x, y: state.y, z: state.z },
                  velocity: { vx: state.vx, vy: state.vy, vz: state.vz },
                  available: true,
              }
            : { position: null, velocity: null, available: false };
    }

    // Unknown body or wrong config
    return { position: null, velocity: null, available: false };
}

// ============================================================================
// Vector Math Helpers
// ============================================================================

/**
 * Calculate magnitude (length) of a 3D vector.
 * @param {Object} v - Vector with x, y, z (or vx, vy, vz) properties
 * @returns {number} Magnitude
 */
function magnitude(v) {
    const x = v.x ?? v.vx ?? 0;
    const y = v.y ?? v.vy ?? 0;
    const z = v.z ?? v.vz ?? 0;
    return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Calculate distance between two 3D vectors.
 * @param {Object} v1 - First vector
 * @param {Object} v2 - Second vector
 * @returns {number} Distance
 */
function vectorDistance(v1, v2) {
    const dx = (v1.x ?? v1.vx ?? 0) - (v2.x ?? v2.vx ?? 0);
    const dy = (v1.y ?? v1.vy ?? 0) - (v2.y ?? v2.vy ?? 0);
    const dz = (v1.z ?? v1.vz ?? 0) - (v2.z ?? v2.vz ?? 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function directionFromTo(from, to) {
    if (!from || !to) return null;
    const dx = (to.x ?? 0) - (from.x ?? 0);
    const dy = (to.y ?? 0) - (from.y ?? 0);
    const dz = (to.z ?? 0) - (from.z ?? 0);
    const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!Number.isFinite(mag) || mag <= 1e-12) {
        return null;
    }
    return {
        x: dx / mag,
        y: dy / mag,
        z: dz / mag,
    };
}

function normalizeBodyId(value) {
    return String(value || "").trim().toUpperCase();
}

function buildPreferredCraftIds({ globalConfig, craftId, planetsForLocations }) {
    const ids = [];
    if (craftId) ids.push(craftId);
    if (globalConfig?.primaryCraftId) ids.push(globalConfig.primaryCraftId);
    if (globalConfig?.spacecraft_mnemonic) ids.push(globalConfig.spacecraft_mnemonic);
    if (Array.isArray(globalConfig?.crafts)) {
        for (const craft of globalConfig.crafts) {
            if (!craft || typeof craft !== "object") continue;
            if (craft.primary === true && craft.id) ids.push(craft.id);
            if (craft.mnemonic) ids.push(craft.mnemonic);
        }
    }
    if (Array.isArray(planetsForLocations)) {
        for (const bodyId of planetsForLocations) {
            if (isMissionCraftBody(globalConfig, bodyId)) {
                ids.push(bodyId);
            }
        }
    }
    ids.push("SC");

    const unique = [];
    const seen = new Set();
    for (const id of ids) {
        const normalized = normalizeBodyId(id);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        unique.push(normalized);
    }
    return unique;
}

function resolveBodyStateById(bodies, bodyId) {
    if (!bodies || !bodyId) return null;
    if (bodies[bodyId]) return bodies[bodyId];
    const target = normalizeBodyId(bodyId);
    for (const [candidateId, state] of Object.entries(bodies)) {
        if (normalizeBodyId(candidateId) === target) {
            return state;
        }
    }
    return null;
}

// ============================================================================
// Telemetry Computation
// ============================================================================

/**
 * Compute telemetry values for the spacecraft.
 *
 * @param {Object} scState - Spacecraft state from computeBodyState
 * @param {string} config - Configuration: "geo" or "lunar"
 * @param {Object} moonState - Moon state (for geo config)
 * @param {Object} earthState - Earth state (for lunar config)
 * @returns {Object} Telemetry values
 */
export function computeTelemetry(scState, config, moonState, earthState) {
    if (!scState || !scState.available) {
        return null;
    }

    const pos = scState.position;
    const vel = scState.velocity;

    // Primary body (what we're orbiting)
    const primaryRadius = config === "geo" ? PC.EARTH_RADIUS_KM : PC.MOON_RADIUS_KM;
    const r = magnitude(pos);
    const v = magnitude(vel);

    const telemetry = {
        distancePrimary: r,
        altitudePrimary: r - primaryRadius,
        velocityPrimary: v
    };

    // Secondary body calculations
    if (config === "geo" && moonState && moonState.available) {
        const dr = vectorDistance(pos, moonState.position);
        const dv = vectorDistance(vel, moonState.velocity);
        telemetry.distanceMoon = dr;
        telemetry.altitudeMoon = dr - PC.MOON_RADIUS_KM;
        telemetry.velocityMoon = dv;
    }

    if (config === "lunar" && earthState && earthState.available) {
        const dr = vectorDistance(pos, earthState.position);
        const dv = vectorDistance(vel, earthState.velocity);
        telemetry.distanceEarth = dr;
        telemetry.altitudeEarth = dr - PC.EARTH_RADIUS_KM;
        telemetry.velocityEarth = dv;
    }

    return telemetry;
}

// ============================================================================
// Mission Phase Detection
// ============================================================================

/**
 * Determine the current mission phase.
 *
 * @param {number} time - Animation time (ms since epoch)
 * @param {Object} missionTimes - Mission time boundaries
 * @param {number} missionTimes.timeTransLunarInjection - TLI event time
 * @param {number} missionTimes.timeLunarOrbitInsertion - LOI event time
 * @returns {string} Phase identifier: "earth-bound", "lunar-bound", or "lunar-orbit"
 */
export function determinePhase(time, missionTimes) {
    const { timeTransLunarInjection, timeLunarOrbitInsertion } = missionTimes;

    if (time < timeTransLunarInjection) {
        return "earth-bound";
    }
    if (time < timeLunarOrbitInsertion) {
        return "lunar-bound";
    }
    return "lunar-orbit";
}

// ============================================================================
// Event Detection
// ============================================================================

/**
 * Find the active burn event at the given time.
 *
 * @param {number} time - Animation time (ms since epoch)
 * @param {Array} eventInfos - Array of event objects
 * @returns {Object|null} Active event or null
 */
export function findActiveEvent(time, eventInfos, preferredCraftIds = ["SC"]) {
    const BURN_WINDOW_MS = 20 * 60 * 1000; // 20 minutes
    const preferredBodies = new Set(
        Array.isArray(preferredCraftIds) && preferredCraftIds.length > 0
            ? preferredCraftIds.map(normalizeBodyId).filter(Boolean)
            : ["SC"],
    );

    for (const event of eventInfos) {
        if (!event.burnFlag) continue;

        const burnTime = event.startTime.getTime();
        if (Math.abs(time - burnTime) < BURN_WINDOW_MS) {
            const bodyId = normalizeBodyId(event.body);
            if (!bodyId || preferredBodies.has(bodyId)) {
                return event;
            }
        }
    }

    return null;
}

// ============================================================================
// Coordinate Transforms
// ============================================================================

/**
 * Convert position from km to screen coordinates.
 *
 * @param {Object} pos - Position in km {x, y, z}
 * @param {number} pixelsPerAU - Scale factor (pixels per AU)
 * @returns {Object} Screen coordinates {x, y, z}
 */
export function toScreenCoordinates(pos, pixelsPerAU) {
    const scale = pixelsPerAU / PC.KM_PER_AU;
    return {
        x: pos.x * scale,
        y: pos.y * scale,
        z: pos.z * scale
    };
}

/**
 * Project 3D position to 2D based on plane selection.
 *
 * @param {Object} pos - 3D position {x, y, z}
 * @param {Object} vel - 3D velocity {vx, vy, vz}
 * @param {Object} planeConfig - Plane configuration
 * @param {string} planeConfig.xVariable - "x", "y", or "z"
 * @param {string} planeConfig.yVariable - "x", "y", or "z"
 * @param {string} planeConfig.zVariable - "x", "y", or "z"
 * @param {number} planeConfig.xFactor - Sign factor (+1 or -1)
 * @param {number} planeConfig.yFactor - Sign factor (+1 or -1)
 * @param {number} planeConfig.zFactor - Sign factor (+1 or -1)
 * @returns {Object} Projected coordinates and velocities
 */
export function projectToPlane(pos, vel, planeConfig) {
    const { xVariable, yVariable, zVariable, xFactor, yFactor, zFactor } = planeConfig;

    return {
        x: xFactor * pos[xVariable],
        y: yFactor * pos[yVariable],
        z: zFactor * pos[zVariable],
        vx: xFactor * vel["v" + xVariable],
        vy: yFactor * vel["v" + yVariable],
        vz: zFactor * vel["v" + zVariable]
    };
}

// ============================================================================
// Composite Function
// ============================================================================

/**
 * Compute complete scene state from time and configuration.
 * This is the main entry point for the functional core.
 *
 * @param {number} time - Animation time (ms since epoch)
 * @param {string} config - Configuration: "geo" or "lunar"
 * @param {Object} options - All required data and configuration
 * @returns {Object} Complete scene state for rendering
 */
export function computeSceneState(time, config, options) {
    const {
        sunLongitude: providedSunLongitude,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        globalConfig,
        startLandingTime,
        endLandingTime,
        eventInfos,
        missionTimes,
        planetsForLocations,
        frameMode,
        ephemerisSource,
        bodySources,
        includeNextState,
        craftId,
    } = options;

    if (providedSunLongitude === undefined || providedSunLongitude === null) {
        throw new Error("computeSceneState() requires `sunLongitude` from the imperative shell");
    }

    // 1. Sun position fallback for lighting (input from imperative shell)
    const sunLongitude = providedSunLongitude;
    let fallbackSunDirection = {
        x: Math.cos(sunLongitude),
        y: Math.sin(sunLongitude),
        z: 0,
    };

    let relativeFrameMoonState = null;
    const frameQuat =
        frameMode === "relative" && config === "geo"
            ? getRelativeFrameQuaternion({
                chebyshevData,
                config,
                timeMs: time,
            })
            : null;
    const hasPrecomputedRelativeFrameData = !!frameQuat;
    const sunAlreadyRelative =
        frameMode === "relative" &&
        config === "geo" &&
        chebyshevData?.[config]?.metadata?.sun_frame === "relative";

    if (frameQuat && !sunAlreadyRelative) {
        fallbackSunDirection = normalize(rotateVectorByQuaternion(fallbackSunDirection, frameQuat));
    }

    // In relative mode (geo), express fallback Sun direction in rotating Earth–Moon frame
    if (frameMode === "relative" && config === "geo" && !hasPrecomputedRelativeFrameData) {
        relativeFrameMoonState = getBodyEphemerisState({
            bodyId: "MOON",
            timeMs: time,
            config,
            npzData,
            npzDataLoaded,
            chebyshevData,
            chebyshevDataLoaded,
            bodySources,
            defaultSpacecraftSource: ephemerisSource,
            spacecraftMnemonic: globalConfig?.spacecraft_mnemonic || "SC",
        });

        if (!relativeFrameMoonState.available) {
            throw new Error("Moon state unavailable for relative frame");
        }
        const r = relativeFrameMoonState.position;
        const v = {
            x: relativeFrameMoonState.velocity.vx,
            y: relativeFrameMoonState.velocity.vy,
            z: relativeFrameMoonState.velocity.vz,
        };

        const xHat = normalize(r);
        const zHat = normalize(cross(r, v));
        const yHat = normalize(cross(zHat, xHat));

        // Rotation matrix inertial->relative is [xHat yHat zHat]^T
        const transform = (vec) => ({
            x: xHat.x * vec.x + xHat.y * vec.y + xHat.z * vec.z,
            y: yHat.x * vec.x + yHat.y * vec.y + yHat.z * vec.z,
            z: zHat.x * vec.x + zHat.y * vec.y + zHat.z * vec.z,
        });

        const relSun = transform(fallbackSunDirection);
        const relNorm = normalize(relSun);
        fallbackSunDirection = relNorm;
    }

    // 2. Body states
    const bodies = {};
    /** @type {any} */
    const dataForBodies = {
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        landingNpzData,
        landingNpzLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        globalConfig,
        startLandingTime,
        endLandingTime,
        frameMode,
        ephemerisSource,
        bodySources,
        includeNextState,
        precomputedBodyEphemeris: relativeFrameMoonState
            ? { MOON: relativeFrameMoonState }
            : null,
    };

    for (const bodyId of planetsForLocations) {
        bodies[bodyId] = computeBodyState(bodyId, time, config, dataForBodies);
    }

    const resolveSunStateAtTime = (timeMs) =>
        getBodyEphemerisState({
            bodyId: "SUN",
            timeMs,
            config,
            npzData,
            npzDataLoaded,
            chebyshevData,
            chebyshevDataLoaded,
            bodySources,
            defaultSpacecraftSource: ephemerisSource,
            spacecraftMnemonic: (globalConfig?.spacecraft_mnemonic || "SC").toUpperCase(),
        });

    // 3. Telemetry (for spacecraft)
    const preferredCraftIds = buildPreferredCraftIds({
        globalConfig,
        craftId,
        planetsForLocations,
    });
    let telemetryBodyId = null;
    let telemetryBodyState = null;
    for (const preferredCraftId of preferredCraftIds) {
        const state = resolveBodyStateById(bodies, preferredCraftId);
        if (state?.available) {
            telemetryBodyId = preferredCraftId;
            telemetryBodyState = state;
            break;
        }
    }

    const earthState = resolveBodyStateById(bodies, "EARTH");
    const moonState = resolveBodyStateById(bodies, "MOON");
    let sunState = resolveBodyStateById(bodies, "SUN");

    const earthCenteredSunDirection = (
        sunState?.available && earthState?.available
            ? directionFromTo(earthState.position, sunState.position)
            : null
    ) || fallbackSunDirection;
    const moonCenteredSunDirection = (
        sunState?.available && moonState?.available
            ? directionFromTo(moonState.position, sunState.position)
            : null
    ) || earthCenteredSunDirection;

    let craftCenteredSunDirection = earthCenteredSunDirection;
    let craftCenteredSunDirectionLightTime = craftCenteredSunDirection;
    if (sunState?.available && telemetryBodyState?.available) {
        const craftPos = telemetryBodyState.position;
        const directCraftSunDirection = directionFromTo(craftPos, sunState.position);
        if (directCraftSunDirection) {
            craftCenteredSunDirection = directCraftSunDirection;
            craftCenteredSunDirectionLightTime = directCraftSunDirection;
        }

        let apparentSunPos = sunState.position;
        for (let i = 0; i < 2; i += 1) {
            const rangeKm = vectorDistance(craftPos, apparentSunPos);
            if (!Number.isFinite(rangeKm) || rangeKm <= 0) {
                break;
            }
            const lightTimeMs = (rangeKm / SPEED_OF_LIGHT_KM_PER_SEC) * MS_PER_SEC;
            if (!Number.isFinite(lightTimeMs) || lightTimeMs <= 0) {
                break;
            }
            const apparentState = resolveSunStateAtTime(time - lightTimeMs);
            if (!apparentState?.available || !apparentState.position) {
                break;
            }
            apparentSunPos = apparentState.position;
            const apparentDirection = directionFromTo(craftPos, apparentSunPos);
            if (apparentDirection) {
                craftCenteredSunDirectionLightTime = apparentDirection;
            }
        }
    }

    const sunDirections = {
        earthCentered: earthCenteredSunDirection,
        moonCentered: moonCenteredSunDirection,
        craftCentered: craftCenteredSunDirection,
        craftCenteredLightTime: craftCenteredSunDirectionLightTime,
    };

    const telemetry = telemetryBodyState
        ? computeTelemetry(telemetryBodyState, config, bodies.MOON, bodies.EARTH)
        : null;

    // 4. Mission phase (only for lunar missions)
    const phase = globalConfig?.is_lunar
        ? determinePhase(time, missionTimes)
        : null;

    // 5. Active event (burn indicator)
    const activeEvent = findActiveEvent(time, eventInfos || [], preferredCraftIds);

    return {
        time,
        config,
        sunLongitude,
        // Backward compatibility: keep top-level sunDirection as Earth-centered.
        sunDirection: earthCenteredSunDirection,
        sunDirections,
        bodies,
        telemetryBodyId,
        telemetry,
        phase,
        activeEvent
    };
}

// Vector helpers (keep small and local)
function normalize(v) {
    const mag = Math.sqrt((v.x ?? 0) * (v.x ?? 0) + (v.y ?? 0) * (v.y ?? 0) + (v.z ?? 0) * (v.z ?? 0));
    if (mag === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}

function cross(a, b) {
    return {
        x: (a.y ?? 0) * (b.z ?? 0) - (a.z ?? 0) * (b.y ?? 0),
        y: (a.z ?? 0) * (b.x ?? 0) - (a.x ?? 0) * (b.z ?? 0),
        z: (a.x ?? 0) * (b.y ?? 0) - (a.y ?? 0) * (b.x ?? 0),
    };
}

function rotateVectorByQuaternion(vec, quat) {
    const qx = quat.x ?? 0;
    const qy = quat.y ?? 0;
    const qz = quat.z ?? 0;
    const qw = quat.w ?? 1;
    const vx = vec.x ?? 0;
    const vy = vec.y ?? 0;
    const vz = vec.z ?? 0;

    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);

    return {
        x: vx + qw * tx + (qy * tz - qz * ty),
        y: vy + qw * ty + (qz * tx - qx * tz),
        z: vz + qw * tz + (qx * ty - qy * tx),
    };
}
