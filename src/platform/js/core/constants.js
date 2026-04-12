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
    EARTH_GM_KM3_S2: 398600.4418,
    MOON_GM_KM3_S2: 4902.800118,
    MOON_RADIUS_KM: 1737.4 + 0.52, // 0.52 is to keep the lander on the surface
    MOON_SOI_RADIUS_KM: 66000,
    MOON_HILL_SPHERE_RADIUS_KM: 62800,
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
    STEP_DURATION_MS: 1 * 60000, // 1 minute - update when Orbit JSON time resolution changes

    // TDB - UTC offset in milliseconds.
    // TDB ≈ UTC + leap_seconds + 32.184s (fixed TT-UTC offset).
    // 37 leap seconds are in effect from 2017-01-01 onward.
    // Update this value when the next leap second is announced.
    TDB_OFFSET_MS: (37.000 + 32.184) * 1000,
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

// ===================================
// Color Constants
// ===================================

export const COLORS = {
    BLACK: 0x000000,
    EARTH_AXIS: 0xFFFF00,        // yellow
    MOON_AXIS: 0xFFFF00,         // yellow
    MOON_SOI: 0x414141,          // charcoal
    MOON_OSCULATING_ORBIT: 0x7d90b2, // muted slate blue
    NORTH_POLE: 0xff6347,        // tomato
    SOUTH_POLE: 0x6a5acd,        // slate blue
    ECLIPTIC_PLANE: 0xFFFFE0,    // light yellow
    EQUATORIAL_PLANE: 0xABEBC6   // light green
};

// ===================================
// Light Settings
// ===================================

export const LIGHT_SETTINGS = {
    // Scene lighting
    PRIMARY_COLOR: 0xFFFFFF,     // white
    PRIMARY_INTENSITY: 3.1,
    AMBIENT_COLOR: 0x222222,     // soft white
    AMBIENT_INTENSITY: 0.01,
    EARTHSHINE_COLOR: 0x9fb2d8,  // subtle cool fill from Earthshine
    EARTHSHINE_INTENSITY: 0.02,
    EARTHSHINE_MIN_INTENSITY: 0.002,
    EARTHSHINE_MAX_INTENSITY: 0.02,
    EARTHSHINE_PHASE_EXPONENT: 1.8,
    SHADOW_MAP_SIZE: 4096,
    SHADOW_FRUSTUM_HALF_SIZE: 2.4,
    SHADOW_FRUSTUM_MIN_HALF_SIZE: 1.6,
    SHADOW_FRUSTUM_RADIUS_MULTIPLIER: 1.35,
    SHADOW_NEAR: 0.1,
    SHADOW_FAR: 32.0,
    SHADOW_BIAS: -0.00001,
    SHADOW_NORMAL_BIAS: 0.0016,
    SHADOW_LIGHT_DISTANCE: 8.0,

    // Spacecraft lighting
    CRAFT_PRIMARY_COLOR: 0xFFFFFF,
    CRAFT_PRIMARY_INTENSITY: 2.5,
    CRAFT_AMBIENT_COLOR: 0x777777,
    CRAFT_AMBIENT_INTENSITY: 1.5
};
