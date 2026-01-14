/**
 * Astronomy Engine wrapper for Moon/Earth ephemeris calculations
 *
 * Replaces NPZ pre-computed data with real-time calculations using
 * the Astronomy Engine library. Provides ~10km position accuracy
 * when using TT time system and ecliptic J2000 coordinates.
 *
 * @module astronomy-bodies
 */

// Astronomy Engine is loaded via CDN in the HTML page
// Uses global 'Astronomy' object

// Constants
const KM_PER_AU = 149597870.7;
const SECONDS_PER_DAY = 86400;

/**
 * Convert JavaScript timestamp to TT-adjusted Astronomy Engine time
 *
 * HORIZONS ephemeris data uses TDB (Barycentric Dynamical Time) which
 * is very close to TT (Terrestrial Time). Using TT instead of UTC
 * reduces position error from ~70km to ~10km.
 *
 * @param {number} timestamp - JavaScript timestamp (ms since Unix epoch)
 * @returns {AstroTime} Astronomy Engine time object
 */
function makeTimeTT(timestamp) {
    const date = new Date(timestamp);
    const utcTime = Astronomy.MakeTime(date);
    // deltaT is the difference between TT and UT in days
    const deltaT = utcTime.tt - utcTime.ut;
    // Subtract deltaT to get the UTC time that corresponds to desired TT
    const adjustedDate = new Date(timestamp - deltaT * SECONDS_PER_DAY * 1000);
    return Astronomy.MakeTime(adjustedDate);
}

/**
 * Convert equatorial J2000 state to ecliptic J2000 coordinates
 *
 * Astronomy Engine returns positions in equatorial (EQJ2000) frame.
 * HORIZONS data uses ecliptic (ECLIPJ2000) frame. This function
 * rotates the state vector around the X-axis by the obliquity angle.
 *
 * @param {Object} state - State with x, y, z, vx, vy, vz components
 * @returns {Object} State in ecliptic coordinates
 */
function rotateToEcliptic(state) {
    // Get rotation matrix from equatorial to ecliptic
    const rot = Astronomy.Rotation_EQJ_ECL();

    // Create state vector for rotation
    const eqState = {
        x: state.x,
        y: state.y,
        z: state.z,
        vx: state.vx,
        vy: state.vy,
        vz: state.vz
    };

    // Rotate the state
    const eclState = Astronomy.RotateState(rot, eqState);

    return {
        x: eclState.x,
        y: eclState.y,
        z: eclState.z,
        vx: eclState.vx,
        vy: eclState.vy,
        vz: eclState.vz
    };
}

/**
 * Get Moon position and velocity from Earth (geocentric)
 *
 * Returns the Moon's state vector in ecliptic J2000 coordinates,
 * centered on Earth. Position is in km, velocity in km/s.
 *
 * @param {number} timestamp - JavaScript timestamp (ms since Unix epoch)
 * @returns {Object} {x, y, z, vx, vy, vz} in km and km/s
 */
export function getMoonState(timestamp) {
    const time = makeTimeTT(timestamp);

    // GeoMoonState returns position in AU and velocity in AU/day (equatorial J2000)
    const state = Astronomy.GeoMoonState(time);

    // Convert AU to km and AU/day to km/s
    const eqState = {
        x: state.x * KM_PER_AU,
        y: state.y * KM_PER_AU,
        z: state.z * KM_PER_AU,
        vx: state.vx * KM_PER_AU / SECONDS_PER_DAY,
        vy: state.vy * KM_PER_AU / SECONDS_PER_DAY,
        vz: state.vz * KM_PER_AU / SECONDS_PER_DAY
    };

    // Rotate from equatorial to ecliptic
    return rotateToEcliptic(eqState);
}

/**
 * Get Earth position and velocity from Moon (selenocentric)
 *
 * Returns the Earth's state vector as seen from the Moon, in ecliptic
 * J2000 coordinates. This is simply the negation of the Moon's
 * geocentric state.
 *
 * @param {number} timestamp - JavaScript timestamp (ms since Unix epoch)
 * @returns {Object} {x, y, z, vx, vy, vz} in km and km/s
 */
export function getEarthFromMoonState(timestamp) {
    const moon = getMoonState(timestamp);
    return {
        x: -moon.x,
        y: -moon.y,
        z: -moon.z,
        vx: -moon.vx,
        vy: -moon.vy,
        vz: -moon.vz
    };
}
