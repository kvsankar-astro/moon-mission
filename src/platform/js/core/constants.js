/**
 * Core Constants Module
 * 
 * Centralized constants for physical, mathematical, and astronomical values.
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
    MOON_RADIUS_KM: 1737.4,
    MOON_SOI_RADIUS_KM: 66000,
    MOON_HILL_SPHERE_RADIUS_KM: 62800,
    EARTH_MOON_DISTANCE_MEAN_AU: 0.00257,
    
    // Angular constants
    DEGREES_PER_RADIAN: 57.2957795,
    DEGREES_PER_CIRCLE: 360.0,
    EARTH_AXIS_INCLINATION_DEGREES: 23.439279444,
    EARTH_AXIS_INCLINATION_RADS: 23.439279444 * Math.PI / 180.0,
    
    // Location constants
    GREENWICH_LONGITUDE: 0
};

// ===================================
// Time Constants
// ===================================

export const TIME_CONSTANTS = {
    ONE_SECOND_MS: 1000,
    ONE_MINUTE_MS: 60 * 1000,
    MILLI_SECONDS_PER_MINUTE: 60000,
    MILLI_SECONDS_PER_HOUR: 3600000,
    STEP_DURATION_MS: 1 * 60000,

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
    
    // SVG positioning
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

const EARTH_GEOMETRIC_ALBEDO = 0.434;
const MOON_GEOMETRIC_ALBEDO = 0.12;
const EARTH_REFLECTANCE_SCALE =
    EARTH_GEOMETRIC_ALBEDO * PHYSICS_CONSTANTS.EARTH_RADIUS_KM * PHYSICS_CONSTANTS.EARTH_RADIUS_KM;
const MOON_REFLECTANCE_SCALE =
    MOON_GEOMETRIC_ALBEDO * PHYSICS_CONSTANTS.MOON_RADIUS_KM * PHYSICS_CONSTANTS.MOON_RADIUS_KM;
const MOONSHINE_TO_EARTHSHINE_INTENSITY_RATIO = MOON_REFLECTANCE_SCALE / EARTH_REFLECTANCE_SCALE;
const EARTHSHINE_REFERENCE_INTENSITY = 0.02;
const MOONSHINE_REFERENCE_INTENSITY =
    EARTHSHINE_REFERENCE_INTENSITY * MOONSHINE_TO_EARTHSHINE_INTENSITY_RATIO;

// ===================================
// Light Settings
// ===================================

export const LIGHT_SETTINGS = {
    // Scene lighting
    PRIMARY_COLOR: 0xFFFFFF,
    PRIMARY_INTENSITY: 3.1,
    AMBIENT_COLOR: 0x222222,
    AMBIENT_INTENSITY: 0.0,
    EARTHSHINE_COLOR: 0x9fb2d8,
    EARTHSHINE_INTENSITY: EARTHSHINE_REFERENCE_INTENSITY,
    EARTHSHINE_MIN_INTENSITY: 0.0,
    EARTHSHINE_MAX_INTENSITY: EARTHSHINE_REFERENCE_INTENSITY,
    EARTHSHINE_PHASE_EXPONENT: 1.8,
    MOONSHINE_COLOR: 0x8a97aa,
    MOONSHINE_TO_EARTHSHINE_INTENSITY_RATIO,
    MOONSHINE_INTENSITY: MOONSHINE_REFERENCE_INTENSITY,
    MOONSHINE_MIN_INTENSITY: 0.0,
    MOONSHINE_MAX_INTENSITY: MOONSHINE_REFERENCE_INTENSITY,
    MOONSHINE_PHASE_EXPONENT: 1.45,
    MOONSHINE_DISTANCE_WEIGHT: 0.24,
    EARTH_REFLECTED_LIGHT_LAYER: 3,
    MOON_REFLECTED_LIGHT_LAYER: 4,
    SHADOW_MAP_SIZE: 4096,
    SHADOW_FRUSTUM_HALF_SIZE: 2.0,
    SHADOW_FRUSTUM_MIN_HALF_SIZE: 1.6,
    SHADOW_FRUSTUM_RADIUS_MULTIPLIER: 1.35,
    SHADOW_NEAR: 4.0,
    SHADOW_FAR: 12.0,
    SHADOW_BIAS: -0.00002,
    SHADOW_NORMAL_BIAS: 0.0016, // Corrected for unit-scale Moon
    SHADOW_LIGHT_DISTANCE: 8.0,
    SHADOW_CAMERA_SIZE: 2.0,

    // Spacecraft lighting
    CRAFT_PRIMARY_COLOR: 0xFFFFFF,
    CRAFT_PRIMARY_INTENSITY: 2.5,
    CRAFT_AMBIENT_COLOR: 0x777777,
    CRAFT_AMBIENT_INTENSITY: 1.5
};
