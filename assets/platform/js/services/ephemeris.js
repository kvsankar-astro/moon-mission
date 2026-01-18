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

/**
 * Compute sun longitude from ephemeris.
 *
 * NOTE: Uses global ephemeris library ($moshier, $processor, $const).
 *
 * @param {number} timeMs - Animation time (ms since epoch)
 * @returns {number} Sun longitude in radians
 */
export function computeSunLongitude(timeMs) {
    const ephemDate = getDateComponentsUTC(timeMs);

    // Configure ephemeris for geocentric calculation
    $const.tlong = 0.0;  // longitude
    $const.glat = 0.0;   // latitude
    $processor.init();

    const ephemSun = $moshier.body.sun;
    $processor.calc(ephemDate, ephemSun);

    return degreesToRadians(ephemSun.position.apparentLongitude);
}

