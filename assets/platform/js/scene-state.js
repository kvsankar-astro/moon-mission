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
import { getStateFromChebyshev } from "./chebyshev.js";
import { getMoonState, getEarthFromMoonState } from "./astronomy-bodies.js";
import { PHYSICS_CONSTANTS as PC, TIME_CONSTANTS as TC } from "./core/constants.js";

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
 * @param {Object} data.landingChebyshevData - Landing phase Chebyshev data
 * @param {Object} data.globalConfig - Mission configuration
 * @param {number} data.startLandingTime - Landing phase start time
 * @param {number} data.endLandingTime - Landing phase end time
 * @returns {Object|null} Body state: { position: {x,y,z}, velocity: {vx,vy,vz}, available: boolean, nextPosition?: {x,y,z}, nextVelocity?: {vx,vy,vz} }
 */
export function computeBodyState(bodyId, time, config, data) {
    const {
        chebyshevData,
        chebyshevDataLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        globalConfig,
        startLandingTime,
        endLandingTime
    } = data;

    // Check if landing is enabled
    const isLandingEnabled = globalConfig && globalConfig.landing && globalConfig.landing.enabled;

    // Spacecraft position from Chebyshev data
    if (bodyId === "SC") {
        const computeScStateAtTime = (t) => {
            // Landing phase - use landing Chebyshev
            if (config === "lunar" && isLandingEnabled &&
                t >= startLandingTime && t < endLandingTime - TC.ONE_SECOND_MS) {

                if (landingChebyshevLoaded && landingChebyshevData) {
                    const jd = new Date(t).getJD_TDB();
                    const state = getStateFromChebyshev(landingChebyshevData, jd);
                    if (state) {
                        return {
                            position: { x: state.pos.x, y: state.pos.y, z: state.pos.z },
                            velocity: { vx: state.vel.vx, vy: state.vel.vy, vz: state.vel.vz },
                            available: true
                        };
                    }
                }
                return { position: null, velocity: null, available: false };
            }

            // Regular orbital phase - use Chebyshev
            if (chebyshevDataLoaded[config] && chebyshevData[config]) {
                const jd = new Date(t).getJD_TDB();
                const state = getStateFromChebyshev(chebyshevData[config], jd);
                if (state) {
                    return {
                        position: { x: state.pos.x, y: state.pos.y, z: state.pos.z },
                        velocity: { vx: state.vel.vx, vy: state.vel.vy, vz: state.vel.vz },
                        available: true
                    };
                }
            }

            return { position: null, velocity: null, available: false };
        };

        const current = computeScStateAtTime(time);
        if (!current.available) {
            return { position: null, velocity: null, nextPosition: null, nextVelocity: null, available: false };
        }

        const nextTime = time + TC.ONE_MINUTE_MS;
        const next = computeScStateAtTime(nextTime);

        return {
            position: current.position,
            velocity: current.velocity,
            nextPosition: next.available ? next.position : current.position,
            nextVelocity: next.available ? next.velocity : current.velocity,
            available: true
        };
    }

    // Moon position (only in geo config)
    if (bodyId === "MOON" && config === "geo") {
        const state = getMoonState(time);
        return {
            position: { x: state.x, y: state.y, z: state.z },
            velocity: { vx: state.vx, vy: state.vy, vz: state.vz },
            available: true
        };
    }

    // Earth position (only in lunar config)
    if (bodyId === "EARTH" && config === "lunar") {
        const state = getEarthFromMoonState(time);
        return {
            position: { x: state.x, y: state.y, z: state.z },
            velocity: { vx: state.vx, vy: state.vy, vz: state.vz },
            available: true
        };
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
export function findActiveEvent(time, eventInfos) {
    const BURN_WINDOW_MS = 20 * 60 * 1000; // 20 minutes

    for (const event of eventInfos) {
        if (!event.burnFlag) continue;

        const burnTime = event.startTime.getTime();
        if (Math.abs(time - burnTime) < BURN_WINDOW_MS) {
            if (event.body === "SC") {
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
        landingChebyshevData,
        landingChebyshevLoaded,
        globalConfig,
        startLandingTime,
        endLandingTime,
        eventInfos,
        missionTimes,
        planetsForLocations
    } = options;

    if (providedSunLongitude === undefined || providedSunLongitude === null) {
        throw new Error("computeSceneState() requires `sunLongitude` from the imperative shell");
    }

    // 1. Sun position for lighting (input from imperative shell)
    const sunLongitude = providedSunLongitude;

    // 2. Body states
    const bodies = {};
    const dataForBodies = {
        chebyshevData,
        chebyshevDataLoaded,
        landingChebyshevData,
        landingChebyshevLoaded,
        globalConfig,
        startLandingTime,
        endLandingTime
    };

    for (const bodyId of planetsForLocations) {
        bodies[bodyId] = computeBodyState(bodyId, time, config, dataForBodies);
    }

    // 3. Telemetry (for spacecraft)
    const telemetry = bodies.SC?.available
        ? computeTelemetry(bodies.SC, config, bodies.MOON, bodies.EARTH)
        : null;

    // 4. Mission phase (only for lunar missions)
    const phase = globalConfig?.is_lunar
        ? determinePhase(time, missionTimes)
        : null;

    // 5. Active event (burn indicator)
    const activeEvent = findActiveEvent(time, eventInfos || []);

    return {
        time,
        config,
        sunLongitude,
        bodies,
        telemetry,
        phase,
        activeEvent
    };
}
