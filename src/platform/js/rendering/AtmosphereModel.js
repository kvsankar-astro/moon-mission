// @ts-nocheck

/**
 * Lightweight physically-motivated atmosphere helper model.
 *
 * This module focuses on coefficients and color ramps that can be sampled
 * by shaders and controllers, rather than performing full multi-scattering.
 */

const DEG_TO_RAD = Math.PI / 180;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

export const DEFAULT_ATMOSPHERE_PARAMS = Object.freeze({
  clarity: 0.72,
  extinctionCoefficient: 0.2,
  twinkleStrength: 1,
  turbidity: 2.8,
  lightPollution: 0.08,
  horizonGlow: 0.18,
});

/**
 * Approximate relative optical air mass from altitude.
 * Kasten-Young style smoothing near the horizon.
 * @param {number} altitudeRad
 * @returns {number}
 */
export function airmassFromAltitude(altitudeRad) {
  const sinAlt = Math.sin(altitudeRad);
  if (sinAlt <= 0) {
    return 40;
  }
  return 1 / (sinAlt + (0.025 * Math.exp(-11 * sinAlt)));
}

/**
 * Transmission factor from atmospheric extinction.
 * Requirement fit: exp(-k / sin(alt)).
 * @param {number} altitudeRad
 * @param {{ extinctionCoefficient?: number, clarity?: number }} [options]
 * @returns {number}
 */
export function extinctionFromAltitude(altitudeRad, options = {}) {
  const extinctionCoefficient = Number.isFinite(options.extinctionCoefficient)
    ? options.extinctionCoefficient
    : DEFAULT_ATMOSPHERE_PARAMS.extinctionCoefficient;
  const clarity = Number.isFinite(options.clarity)
    ? clamp(options.clarity, 0, 1)
    : DEFAULT_ATMOSPHERE_PARAMS.clarity;

  // Clear sites reduce effective attenuation, hazy sites increase it.
  const clarityScale = 1.32 - (0.62 * clarity);
  const k = extinctionCoefficient * clarityScale;

  const sinAlt = Math.max(0.05, Math.sin(altitudeRad));
  return Math.exp(-k / sinAlt);
}

/**
 * Twinkle modulation amplitude. Strong near horizon due to longer turbulent path.
 * @param {number} altitudeRad
 * @param {{ twinkleStrength?: number, clarity?: number }} [options]
 * @returns {number}
 */
export function twinkleAmplitudeFromAltitude(altitudeRad, options = {}) {
  const twinkleStrength = Number.isFinite(options.twinkleStrength)
    ? options.twinkleStrength
    : DEFAULT_ATMOSPHERE_PARAMS.twinkleStrength;
  const clarity = Number.isFinite(options.clarity)
    ? clamp(options.clarity, 0, 1)
    : DEFAULT_ATMOSPHERE_PARAMS.clarity;

  const sinAlt = clamp(Math.sin(altitudeRad), -1, 1);
  const horizonFactor = 1 - clamp01((sinAlt + 0.05) / 0.95);
  const clarityFactor = 0.6 + (0.8 * (1 - clarity));
  return 0.015 + (0.07 * twinkleStrength * horizonFactor * clarityFactor);
}

/**
 * Approximate Rayleigh/Mie coefficients for use in shader controls.
 * @param {{ turbidity?: number, clarity?: number }} [options]
 * @returns {{ rayleigh: number, mie: number }}
 */
export function scatteringCoefficients(options = {}) {
  const turbidity = Number.isFinite(options.turbidity)
    ? clamp(options.turbidity, 1.5, 8)
    : DEFAULT_ATMOSPHERE_PARAMS.turbidity;
  const clarity = Number.isFinite(options.clarity)
    ? clamp(options.clarity, 0, 1)
    : DEFAULT_ATMOSPHERE_PARAMS.clarity;

  const rayleigh = clamp(2.4 + (2.8 * clarity) - (0.22 * turbidity), 1.2, 6.0);
  const mie = clamp(0.15 + (0.22 * turbidity) + (0.16 * (1 - clarity)), 0.08, 2.2);
  return { rayleigh, mie };
}

/**
 * Resolve atmospheric sky gradient colors in linear RGB.
 * @param {{
 *   sunAltitudeDeg?: number,
 *   turbidity?: number,
 *   lightPollution?: number,
 *   horizonGlow?: number
 * }} [options]
 * @returns {{
 *   zenith: [number, number, number],
 *   horizon: [number, number, number],
 *   nadir: [number, number, number],
 *   twilight: number,
 *   scattering: { rayleigh: number, mie: number }
 * }}
 */
export function resolveSkyGradient(options = {}) {
  const sunAltitudeDeg = Number.isFinite(options.sunAltitudeDeg) ? options.sunAltitudeDeg : -18;
  const turbidity = Number.isFinite(options.turbidity)
    ? clamp(options.turbidity, 1.5, 8)
    : DEFAULT_ATMOSPHERE_PARAMS.turbidity;
  const lightPollution = Number.isFinite(options.lightPollution)
    ? clamp(options.lightPollution, 0, 1)
    : DEFAULT_ATMOSPHERE_PARAMS.lightPollution;
  const horizonGlow = Number.isFinite(options.horizonGlow)
    ? clamp(options.horizonGlow, 0, 1)
    : DEFAULT_ATMOSPHERE_PARAMS.horizonGlow;

  const twilight = clamp01((sunAltitudeDeg + 18) / 24);
  const haze = clamp01((turbidity - 1.5) / 6.5);

  const zenith = [
    clamp(0.013 + (0.052 * twilight) + (0.018 * haze) + (0.014 * lightPollution), 0, 1),
    clamp(0.018 + (0.115 * twilight) + (0.030 * haze) + (0.020 * lightPollution), 0, 1),
    clamp(0.037 + (0.255 * twilight) + (0.032 * haze) + (0.023 * lightPollution), 0, 1),
  ];

  const horizonWarmth = clamp01((sunAltitudeDeg + 12) / 20);
  const horizon = [
    clamp(0.05 + (0.35 * horizonWarmth) + (0.14 * haze) + (0.06 * lightPollution), 0, 1),
    clamp(0.08 + (0.30 * horizonWarmth) + (0.10 * haze) + (0.06 * lightPollution), 0, 1),
    clamp(0.14 + (0.20 * twilight) + (0.05 * (1 - horizonWarmth)) + (0.05 * lightPollution), 0, 1),
  ];

  const nadir = [
    clamp(0.01 + (0.04 * horizonGlow) + (0.03 * lightPollution), 0, 1),
    clamp(0.012 + (0.03 * horizonGlow) + (0.02 * lightPollution), 0, 1),
    clamp(0.02 + (0.05 * horizonGlow) + (0.03 * lightPollution), 0, 1),
  ];

  return {
    zenith,
    horizon,
    nadir,
    twilight,
    scattering: scatteringCoefficients({ turbidity, clarity: 1 - haze }),
  };
}

export class AtmosphereModel {
  /**
   * @param {Partial<typeof DEFAULT_ATMOSPHERE_PARAMS>} [params]
   */
  constructor(params = {}) {
    this.params = {
      ...DEFAULT_ATMOSPHERE_PARAMS,
      ...params,
    };
  }

  /**
   * @param {Partial<typeof DEFAULT_ATMOSPHERE_PARAMS>} patch
   */
  setParams(patch = {}) {
    this.params = {
      ...this.params,
      ...patch,
    };
  }

  /**
   * @returns {typeof DEFAULT_ATMOSPHERE_PARAMS}
   */
  getParams() {
    return { ...this.params };
  }

  /**
   * @param {number} altitudeRad
   * @returns {number}
   */
  extinctionAt(altitudeRad) {
    return extinctionFromAltitude(altitudeRad, this.params);
  }

  /**
   * @param {number} altitudeRad
   * @returns {number}
   */
  twinkleAmplitudeAt(altitudeRad) {
    return twinkleAmplitudeFromAltitude(altitudeRad, this.params);
  }

  /**
   * @param {{ sunAltitudeDeg?: number }} [options]
   */
  skyGradient(options = {}) {
    return resolveSkyGradient({
      ...this.params,
      ...options,
    });
  }

  /**
   * Precomputed uniform-like payload that can be fed directly into shaders.
   * @param {{ sunAltitudeDeg?: number }} [options]
   */
  toUniforms(options = {}) {
    const gradient = this.skyGradient(options);
    return {
      uAtmosphereClarity: this.params.clarity,
      uExtinctionStrength: this.params.extinctionCoefficient,
      uTwinkleStrength: this.params.twinkleStrength,
      uSkyZenithColor: gradient.zenith,
      uSkyHorizonColor: gradient.horizon,
      uSkyNadirColor: gradient.nadir,
      uRayleighStrength: gradient.scattering.rayleigh,
      uMieStrength: gradient.scattering.mie,
    };
  }
}

export function sunAltitudeToTwilight(sunAltitudeDeg) {
  return clamp01((Number(sunAltitudeDeg) + 18) / 18);
}

export function estimateSkyLuminance(options = {}) {
  const sunAltitudeRad = (Number(options.sunAltitudeDeg ?? -18)) * DEG_TO_RAD;
  const lightPollution = clamp(Number(options.lightPollution ?? DEFAULT_ATMOSPHERE_PARAMS.lightPollution), 0, 1);
  const base = Math.max(0, Math.sin(sunAltitudeRad));
  const twilight = Math.max(0, Math.sin(sunAltitudeRad + (12 * DEG_TO_RAD)));
  return clamp01((0.1 * base) + (0.75 * twilight) + (0.35 * lightPollution));
}
