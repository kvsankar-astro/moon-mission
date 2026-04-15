/**
 * Math Utilities Module
 * 
 * Pure mathematical functions extracted from mission.js for better modularity.
 * All functions here are pure (no side effects) and handle common mathematical operations.
 */

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export function radiansToDegrees(radians) {
    return radians * 180 / Math.PI;
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Normalize angle to 0-360 degrees
 * @param {number} angle - Angle in degrees
 * @returns {number} Normalized angle
 */
export function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
}

/**
 * Convert spherical coordinates to Cartesian coordinates
 * @param {number} radius - Radius
 * @param {number} longitude - Longitude in radians
 * @param {number} latitude - Latitude in radians
 * @returns {Object} Object with x, y, z properties
 */
export function sphericalToCartesian(radius, longitude, latitude) {
    const x = radius * Math.cos(latitude) * Math.cos(longitude);
    const y = radius * Math.cos(latitude) * Math.sin(longitude);
    const z = radius * Math.sin(latitude);
    return { x, y, z };
}

/**
 * Rotate 2D point around origin
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} angleDegrees - Rotation angle in degrees
 * @returns {Object} Object with x, y properties
 */
export function rotate2D(x, y, angleDegrees) {
    const angleRads = degreesToRadians(angleDegrees);
    const cos = Math.cos(angleRads);
    const sin = Math.sin(angleRads);
    
    return {
        x: x * cos - y * sin,
        y: y * cos + x * sin
    };
}

/**
 * Calculate 3D distance from origin
 * @param {Object} position - Object with x, y, z properties
 * @returns {number} Distance from origin
 */
export function distance3D(position) {
    return Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
}

/**
 * Calculate 2D distance between two points
 * @param {number} x1 - First point x coordinate
 * @param {number} y1 - First point y coordinate
 * @param {number} x2 - Second point x coordinate
 * @param {number} y2 - Second point y coordinate
 * @returns {number} Distance between points
 */
export function distance2D(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert velocity components to angle
 * @param {number} vx - X velocity component
 * @param {number} vy - Y velocity component
 * @returns {number} Angle in degrees
 */
export function velocityToAngle(vx, vy) {
    return Math.atan2(vy, vx) * 180.0 / Math.PI + 90;
}

/**
 * Calculate ellipse semi-minor axis from semi-major axis and eccentricity
 * @param {number} semiMajorAxis - Semi-major axis
 * @param {number} eccentricity - Eccentricity (0-1)
 * @returns {number} Semi-minor axis
 */
export function ellipseSemiMinorAxis(semiMajorAxis, eccentricity) {
    return semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity);
}

/**
 * Linear interpolation between two values
 * @param {number} a - First value
 * @param {number} b - Second value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Format a number with specified decimal places and separators
 * @param {number} number - Number to format
 * @param {number} decPlaces - Number of decimal places (default: 2)
 * @param {string} thouSeparator - Thousands separator (default: ",")
 * @param {string} decSeparator - Decimal separator (default: ".")
 * @returns {string} Formatted number string
 */
export function formatFloat(number, decPlaces = 2, thouSeparator = ",", decSeparator = ".") {
    let n = Number(number) || 0;
    const normalizedPlaces = Math.abs(Number(decPlaces));
    const places = Number.isFinite(normalizedPlaces) ? normalizedPlaces : 2;
    const sign = n < 0 ? "-" : "";
    n = Math.abs(Number(n) || 0);
    const fixed = n.toFixed(places);
    const i = `${Number.parseInt(fixed, 10)}`;
    const integerPart = Number(i) || 0;
    const j = (i.length) > 3 ? i.length % 3 : 0;
    
    return sign + 
           (j ? i.substr(0, j) + thouSeparator : "") + 
           i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thouSeparator) + 
           (places ? decSeparator + Math.abs(n - integerPart).toFixed(places).slice(2) : "");
}
