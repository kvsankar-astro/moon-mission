/**
 * Core Constants Module
 * 
 * Centralized constants for physical, mathematical, and astronomical values.
 * Extracted from mission.js to improve maintainability and reduce hardcoded values.
 */

// ===================================
// Celestial Body Constants
// ===================================

export const CELESTIAL_BODIES = {
    SUN: "SUN",
    MERCURY: "MERCURY",
    VENUS: "VENUS", 
    EARTH: "EARTH",
    MARS: "MARS",
    MOON: "MOON",
    CSS: "CSS" // Siding Spring comet
};

// ===================================
// Physics and Astronomical Constants
// ===================================

export const PHYSICS_CONSTANTS = {
    // Distance and size constants
    KM_PER_AU: 149597870.691,
    EARTH_RADIUS_KM: 6371,
    EARTH_RADIUS_MAX_KM: 6378.1,
    EARTH_RADIUS_MIN_KM: 6356.8,
    MOON_RADIUS_KM: 1737.4 + 0.52, // 0.52 is to keep the lander on the surface
    MOON_SOI_RADIUS_KM: 66000,
    EARTH_MOON_DISTANCE_MEAN_AU: 0.00257,
    
    // Angular constants
    DEGREES_PER_RADIAN: 57.2957795,
    DEGREES_PER_CIRCLE: 360.0,
    EARTH_AXIS_INCLINATION_DEGREES: 23.439279444,
    EARTH_AXIS_INCLINATION_RADS: 23.439279444 * Math.PI / 180.0,
    
    // Location constants
    GREENWICH_LONGITUDE: 0 // used to be that of Bangalore earlier: 77.5667
};

// ===================================
// Time Constants
// ===================================

export const TIME_CONSTANTS = {
    ONE_SECOND_MS: 1000,
    ONE_MINUTE_MS: 60 * 1000,
    MILLI_SECONDS_PER_MINUTE: 60000,
    MILLI_SECONDS_PER_HOUR: 3600000,
    STEP_DURATION_MS: 1 * 60000 // 1 minute - update when Orbit JSON time resolution changes
};

// ===================================
// UI and Display Constants  
// ===================================

export const UI_CONSTANTS = {
    // Label positioning
    CENTER_LABEL_OFFSET_X: -5,
    CENTER_LABEL_OFFSET_Y: -15,
    
    // Interaction constants
    SPEED_CHANGE_FACTOR: 2,
    ZOOM_SCALE: 1.10,
    ZOOM_TIMEOUT: 200,
    
    // SVG positioning (TODO: match with CSS values; find better way)
    SVG_ORIGIN_X: 0,
    SVG_ORIGIN_Y: 0
};

// ===================================
// Format Constants
// ===================================

export const FORMAT_CONSTANTS = {
    PERCENT: ".0%",
    METRIC: " >10,.2f"
};