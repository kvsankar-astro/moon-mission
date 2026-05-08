// @ts-nocheck

import * as THREE from 'three';
import {
  degreesToRadians,
  localSiderealRadians,
  raDecToEquatorialUnitVector,
  stableUnitHash,
} from './sky-math.js';
import { STAR_CATALOG_BRIGHT } from './star-catalog-hipparcos.js';

const MIN_MAGNITUDE = -3.0;
const MAX_MAGNITUDE = 8.0;

export function isStarVisibleForMagnitudeLimit(vmag, magnitudeLimit) {
  const magnitude = Number(vmag);
  const limit = Number(magnitudeLimit);
  return Number.isFinite(magnitude) && Number.isFinite(limit) && magnitude <= (limit + 0.0001);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function srgbToLinear(value) {
  const x = clamp01(value);
  if (x <= 0.04045) {
    return x / 12.92;
  }
  return Math.pow((x + 0.055) / 1.055, 2.4);
}

/**
 * Approximate stellar color from B-V color index.
 * Uses Ballesteros temperature estimation then maps to RGB.
 * @param {number} bv
 * @returns {[number, number, number]} Linear RGB [0..1]
 */
export function bvToLinearRgb(bv) {
  const clampedBv = clamp(Number(bv), -0.4, 2.0);
  const temperature = 4600 * (
    (1 / ((0.92 * clampedBv) + 1.7)) +
    (1 / ((0.92 * clampedBv) + 0.62))
  );

  const temp = temperature / 100;

  let r;
  let g;
  let b;

  if (temp <= 66) {
    r = 1;
  } else {
    r = 1.292936186062745 * Math.pow(temp - 60, -0.1332047592);
  }

  if (temp <= 66) {
    g = 0.3900815787690196 * Math.log(temp) - 0.6318414437886275;
  } else {
    g = 1.129890860895294 * Math.pow(temp - 60, -0.0755148492);
  }

  if (temp >= 66) {
    b = 1;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = 0.5432067891101961 * Math.log(temp - 10) - 1.19625408914;
  }

  // Slight desaturation to better match naked-eye perception.
  const sr = clamp01(r);
  const sg = clamp01(g);
  const sb = clamp01(b);
  const luma = (0.2126 * sr) + (0.7152 * sg) + (0.0722 * sb);
  const sat = 0.98;

  const dsr = luma + ((sr - luma) * sat);
  const dsg = luma + ((sg - luma) * sat);
  const dsb = luma + ((sb - luma) * sat);

  const lr = srgbToLinear(dsr);
  const lg = srgbToLinear(dsg);
  const lb = srgbToLinear(dsb);

  // Keep photometric brightness driven by magnitude, not by color tint.
  // Without this, very blue stars can look artificially dim compared to
  // similar-magnitude neutral/red stars.
  const linLuma = (0.2126 * lr) + (0.7152 * lg) + (0.0722 * lb);
  if (linLuma <= 1e-4) {
    return [1, 1, 1];
  }

  let scale = 1 / linLuma;
  const maxChannel = Math.max(lr, lg, lb);
  if (maxChannel * scale > 2.2) {
    scale = 2.2 / maxChannel;
  }

  return [lr * scale, lg * scale, lb * scale];
}

const STAR_VERTEX_SHADER = `
attribute vec3 aDirection;
attribute float aMagnitude;
attribute float aBv;
attribute float aIdHash;
attribute vec3 aColor;

uniform float uPointScale;
uniform float uBaseSize;
uniform float uStarSizeScale;
uniform float uMinPointSize;
uniform float uMaxPointSize;
uniform float uSkyRadius;
uniform float uPhotometricScale;
uniform float uMagnitudeLimit;
uniform float uAtmosphereEnabled;
uniform float uExtinctionStrength;
uniform float uTwinkleStrength;
uniform float uTimeSeconds;
uniform float uSiderealAngle;
uniform float uObserverLat;
uniform float uObserverLon;
uniform float uHaloStrength;
uniform float uTwinkleRate;
uniform float uHorizonFadeStart;
uniform float uHorizonFadeEnd;

varying vec3 vColor;
varying float vIntensity;
varying float vHalo;
varying float vAtmosphereEnabled;
varying float vPointSize;

float hash11(float x) {
  return fract(sin(x * 1043.13 + 0.371) * 43758.5453123);
}

void main() {
  vec3 eq = normalize(aDirection);
  float magnitudeVisible = 1.0 - step(uMagnitudeLimit + 0.0001, aMagnitude);
  float sinLat = sin(uObserverLat);
  float cosLat = cos(uObserverLat);
  float sinLst = sin(uSiderealAngle);
  float cosLst = cos(uSiderealAngle);

  // Equatorial unit vector -> local ENU vector (alt/az frame).
  float east = (-eq.x * sinLst) + (eq.y * cosLst);
  float north = (-eq.x * sinLat * cosLst) - (eq.y * sinLat * sinLst) + (eq.z * cosLat);
  float up = (eq.x * cosLat * cosLst) + (eq.y * cosLat * sinLst) + (eq.z * sinLat);
  float atmosphere = step(0.5, uAtmosphereEnabled);
  vec3 horizontalDir = normalize(vec3(east, up, north));
  // Space mode (atmosphere off): keep stars inertial and compensate for sky
  // container handedness so RA increases in the expected direction.
  vec3 inertialEclipticDir = normalize(vec3(eq.x, -eq.y, eq.z));
  // Level-0 lock: star positions stay inertial (J2000-aligned) regardless of
  // observer/time; atmosphere only affects photometry, not direction.
  vec3 frameDir = inertialEclipticDir;
  vec4 mvPosition = modelViewMatrix * vec4(frameDir * uSkyRadius, 1.0);

  float clampedSinAlt = clamp(up, -1.0, 1.0);
  float horizonFade = smoothstep(uHorizonFadeStart, uHorizonFadeEnd, clampedSinAlt);

  float baseIntensity = pow(10.0, -0.4 * aMagnitude);
  float baseSize = uBaseSize * uStarSizeScale * pow(10.0, -0.2 * aMagnitude);

  float sinAltSafe = max(0.05, max(clampedSinAlt, 0.0));

  float extinction = exp(-uExtinctionStrength / sinAltSafe);
  extinction = mix(1.0, extinction * horizonFade, atmosphere);

  float horizonTwinkleBoost = mix(0.0, 1.0 - clamp(sinAltSafe, 0.0, 1.0), atmosphere);
  float phase = (uTimeSeconds * (0.7 + (hash11(aIdHash * 1007.0) * 2.2)) * uTwinkleRate)
    + (aIdHash * 67.31);
  float twinkleWave = sin(phase) * sin((phase * 0.69) + 1.4);
  float twinkle = 1.0 + (twinkleWave * 0.05 * uTwinkleStrength * horizonTwinkleBoost);
  twinkle = mix(1.0, twinkle, atmosphere);

  // Keep vacuum stars tight but not subpixel-dim; atmosphere broadens near horizon.
  float psfSoftening = mix(0.98, 1.08 + (0.24 * horizonTwinkleBoost), atmosphere);
  float spriteSize = baseSize * psfSoftening;
  // Stage 2 size shaping:
  // - global lift for all stars
  // - additional bright-star-only lift
  float globalSizeGain = mix(1.14, 1.07, atmosphere);
  spriteSize *= globalSizeGain;
  // Bright-star-only size boost: faint stars stay unchanged; space mode gets
  // a stronger enlargement so major guide stars are easier to pick out.
  float brightSizeClass = smoothstep(2.8, -1.2, aMagnitude);
  float brightSizeBoost = mix(
    1.0 + (0.85 * brightSizeClass),
    1.0 + (0.40 * brightSizeClass),
    atmosphere
  );
  spriteSize *= brightSizeBoost;

  // Keep point-size driven by photometric sprite size + viewport scaling.
  float viewportScale = max(0.9, uPointScale / 500.0);
  float pointSizePx = spriteSize * viewportScale;
  gl_PointSize = clamp(pointSizePx, uMinPointSize, uMaxPointSize) * magnitudeVisible;
  vPointSize = gl_PointSize;

  float apparentIntensity = baseIntensity * extinction * twinkle;
  vIntensity = apparentIntensity;
  vIntensity *= uPhotometricScale;
  vIntensity *= magnitudeVisible;
  vColor = aColor;
  vAtmosphereEnabled = atmosphere;

  float haloByMagnitude = smoothstep(2.6, -1.1, aMagnitude);
  float haloByAltitude = mix(0.35, 1.0, horizonTwinkleBoost);
  vHalo = uHaloStrength * haloByMagnitude * haloByAltitude * magnitudeVisible;

  gl_Position = projectionMatrix * mvPosition;
}
`;

const STAR_FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vIntensity;
varying float vHalo;
varying float vAtmosphereEnabled;
varying float vPointSize;

void main() {
  vec2 p = (gl_PointCoord * 2.0) - vec2(1.0);
  float r2 = dot(p, p);
  if (r2 > 1.0) {
    discard;
  }
  float r = sqrt(r2);
  float atmosphere = clamp(vAtmosphereEnabled, 0.0, 1.0);
  float baseIntensity = max(vIntensity, 0.0);
  // Space mode target: preserve photometric separation across magnitudes.
  // Use a steeper transfer than sqrt-style compression, with a small floor so
  // dim stars remain visible instead of disappearing entirely.
  float contrastGamma = mix(1.04, 0.94, atmosphere);
  float contrastIntensity = pow(max(baseIntensity, 1e-6), contrastGamma);
  float visibilityLift = mix(
    0.0095 * sqrt(baseIntensity),
    0.0125 * sqrt(baseIntensity),
    atmosphere
  );
  float perceivedIntensity = contrastIntensity + visibilityLift;
  // Stage 2 intensity shaping:
  // - global gain across all stars
  // - stronger bright-only separation on top
  float globalIntensityGain = mix(1.36, 1.18, atmosphere);
  perceivedIntensity *= globalIntensityGain;
  // Bright-star-only monotonic boost: never dims any star.
  float brightClass = smoothstep(90.0, 4500.0, baseIntensity);
  float brightBoost = mix(
    1.0 + (3.25 * brightClass),
    1.0 + (1.55 * brightClass),
    atmosphere
  );
  perceivedIntensity *= brightBoost;

  // Mild saturation enhancement in shader space: stronger in vacuum.
  float colorSatGain = mix(1.08, 1.02, atmosphere);
  float colorLuma = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
  vec3 starColor = vec3(colorLuma) + ((vColor - vec3(colorLuma)) * colorSatGain);

  // Pinpoint path for small stars: render as crisp, bright stellar pixels.
  if (vPointSize <= 1.45) {
    // Adaptively widen tiny-star PSF near 1px to avoid per-pixel dropout while
    // keeping larger tiny sprites visually crisp.
    float tinyT = clamp((vPointSize - 0.75) / 0.70, 0.0, 1.0);
    float tinyCoreSharpness = mix(7.2, 12.8, tinyT);
    float pixelCore = exp(-r2 * tinyCoreSharpness);
    float tinyRoundMask = smoothstep(1.0, 0.0, r2);
    float tinyEdgeSoft = 1.0 - smoothstep(0.72, 1.0, r);
    float pixelHalo = vHalo * exp(-r2 * mix(2.8, 4.8, tinyT)) * 0.06;
    float tinyProfile = ((pixelCore * 0.82) + (tinyEdgeSoft * 0.55)) * tinyRoundMask + pixelHalo;
    vec3 pixelColor = starColor * (tinyProfile * perceivedIntensity * 1.35);
    gl_FragColor = vec4(pixelColor, 1.0);
    return;
  }

  // Dual-lobe PSF: Gaussian core + Moffat wings for realistic stellar appearance.
  float coreSigma = mix(0.17, 0.22, atmosphere);
  float gaussianCore = exp(-(r2 / (coreSigma * coreSigma)));

  float moffatBeta = mix(3.4, 2.6, atmosphere);
  float moffatAlpha = mix(0.060, 0.095, atmosphere);
  float moffatWing = pow(1.0 + (r2 / moffatAlpha), -moffatBeta);

  float haloGate = smoothstep(0.03, 0.28, vHalo);
  float halo = haloGate * vHalo * exp(-r2 * 3.8) * mix(0.030, 0.060, atmosphere);
  halo *= (1.0 + (1.05 * brightClass));

  // Mild diffraction spikes for brighter stars to avoid uniformly round blobs.
  float spikeAxis = (
    exp(-abs(p.x) * mix(20.0, 14.0, atmosphere)) +
    exp(-abs(p.y) * mix(20.0, 14.0, atmosphere))
  );
  float spikes = haloGate * vHalo * spikeAxis * exp(-r2 * 2.4) * 0.026;
  spikes *= (1.0 + (0.72 * brightClass));

  float profile = (gaussianCore * (1.36 + (0.18 * brightClass))) +
    (moffatWing * mix(0.18, 0.30, atmosphere)) +
    halo +
    spikes;
  // Subtle radial edge attenuation to reduce square-looking sprite boundaries.
  float circularEdgeFalloff = 1.0 - (0.16 * smoothstep(0.84, 1.0, r));
  profile *= circularEdgeFalloff;

  vec3 color = starColor * (profile * perceivedIntensity);
  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * GPU-driven starfield renderer with physically-motivated photometry controls.
 *
 * Per-star attributes are immutable GPU buffers; animation is done with uniforms only.
 */
export class StarRenderer {
  /**
   * @param {THREE.Object3D} parentContainer
   * @param {{
   *   radius?: number,
   *   layer?: number,
   *   baseSize?: number,
   *   starSizeScale?: number,
   *   minPointSize?: number,
   *   maxPointSize?: number,
   *   atmosphereEnabled?: boolean,
   *   extinctionStrength?: number,
   *   twinkleStrength?: number,
   *   haloStrength?: number,
   *   catalog?: Array<{id?: string, name?: string, raDeg: number, decDeg: number, vmag: number, bv?: number}>
   * }} [options]
   */
  constructor(parentContainer, options = {}) {
    this.parentContainer = parentContainer;
    this.radius = Number.isFinite(options.radius) ? options.radius : 1300000;
    this.layer = Number.isFinite(options.layer) ? options.layer : 2;

    this.catalog = Array.isArray(options.catalog) ? options.catalog : STAR_CATALOG_BRIGHT;

    this.container = null;
    this.points = null;
    this.geometry = null;
    this.material = null;

    this.observerLatitudeRad = 0;
    this.observerLongitudeRad = 0;

    this.uniforms = {
      uPointScale: { value: 500 },
      uBaseSize: { value: Number.isFinite(options.baseSize) ? options.baseSize : 2.8 },
      uStarSizeScale: { value: Number.isFinite(options.starSizeScale) ? options.starSizeScale : 1.0 },
      uMinPointSize: { value: Number.isFinite(options.minPointSize) ? options.minPointSize : 1.25 },
      uMaxPointSize: { value: Number.isFinite(options.maxPointSize) ? options.maxPointSize : 7.2 },
      uSkyRadius: { value: this.radius },
      uPhotometricScale: { value: 85.0 },
      uMagnitudeLimit: { value: Number.isFinite(options.magnitudeLimit) ? options.magnitudeLimit : MAX_MAGNITUDE },
      uAtmosphereEnabled: { value: options.atmosphereEnabled ? 1 : 0 },
      uExtinctionStrength: { value: Number.isFinite(options.extinctionStrength) ? options.extinctionStrength : 0.2 },
      uTwinkleStrength: { value: Number.isFinite(options.twinkleStrength) ? options.twinkleStrength : 1.0 },
      uTimeSeconds: { value: 0 },
      uSiderealAngle: { value: 0 },
      uObserverLat: { value: 0 },
      uObserverLon: { value: 0 },
      uHaloStrength: { value: Number.isFinite(options.haloStrength) ? options.haloStrength : 0.2 },
      uTwinkleRate: { value: 1.0 },
      uHorizonFadeStart: { value: -0.08 },
      uHorizonFadeEnd: { value: 0.05 },
    };
  }

  /**
   * Build immutable geometry attributes from catalog entries.
   * @private
   */
  buildGeometry() {
    const stars = this.catalog;
    const count = stars.length;

    const positions = new Float32Array(count * 3);
    const directions = new Float32Array(count * 3);
    const magnitudes = new Float32Array(count);
    const bvs = new Float32Array(count);
    const idHash = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const star = stars[i];
      const raDeg = Number(star.raDeg);
      const decDeg = Number(star.decDeg);
      const vmag = clamp(Number(star.vmag), MIN_MAGNITUDE, MAX_MAGNITUDE);
      const bv = Number.isFinite(star.bv) ? Number(star.bv) : 0.65;

      const direction = raDecToEquatorialUnitVector(raDeg, decDeg);
      const dirX = direction.x;
      const dirY = direction.y;
      const dirZ = direction.z;

      const idx3 = i * 3;
      positions[idx3] = dirX * this.radius;
      positions[idx3 + 1] = dirY * this.radius;
      positions[idx3 + 2] = dirZ * this.radius;

      directions[idx3] = dirX;
      directions[idx3 + 1] = dirY;
      directions[idx3 + 2] = dirZ;

      magnitudes[i] = vmag;
      bvs[i] = bv;

      const seed = star.id ||
        (typeof star.name === "string" ? star.name : "") ||
        String(i + 1);
      idHash[i] = stableUnitHash(seed);

      const rgb = bvToLinearRgb(bv);
      colors[idx3] = rgb[0];
      colors[idx3 + 1] = rgb[1];
      colors[idx3 + 2] = rgb[2];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));
    geometry.setAttribute('aMagnitude', new THREE.BufferAttribute(magnitudes, 1));
    geometry.setAttribute('aBv', new THREE.BufferAttribute(bvs, 1));
    geometry.setAttribute('aIdHash', new THREE.BufferAttribute(idHash, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    return geometry;
  }

  /**
   * @private
   */
  buildMaterial() {
    return new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      uniforms: this.uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      dithering: true,
    });
  }

  /**
   * @param {boolean} [visible]
   */
  create(visible = true) {
    if (this.container) {
      this.setVisible(visible);
      return;
    }

    this.container = new THREE.Group();

    this.geometry = this.buildGeometry();
    this.material = this.buildMaterial();
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.layers.set(this.layer);
    this.points.renderOrder = -24;

    this.container.add(this.points);
    this.container.visible = visible;
    this.parentContainer.add(this.container);
    this.setTime(Date.now());
  }

  /**
   * @param {THREE.Camera} camera
   */
  updatePosition(camera) {
    if (!this.container || !camera) return;
    this.container.position.setFromMatrixPosition(camera.matrixWorld);
  }

  /**
   * @param {boolean} visible
   */
  setVisible(visible) {
    if (this.container) {
      this.container.visible = Boolean(visible);
    }
  }

  /**
   * @param {number} viewportHeightPx
   */
  setViewportHeight(viewportHeightPx) {
    if (!Number.isFinite(viewportHeightPx)) return;
    this.uniforms.uPointScale.value = Math.max(120, Number(viewportHeightPx) * 0.5);
  }

  /**
   * @param {number} latitudeDeg
   * @param {number} longitudeDeg
   */
  setObserver(latitudeDeg, longitudeDeg) {
    this.observerLatitudeRad = degreesToRadians(latitudeDeg);
    this.observerLongitudeRad = degreesToRadians(longitudeDeg);

    this.uniforms.uObserverLat.value = this.observerLatitudeRad;
    this.uniforms.uObserverLon.value = this.observerLongitudeRad;
  }

  /**
   * @param {Date | number} dateOrMs
   */
  setSiderealTimeFromDate(dateOrMs) {
    const sidereal = localSiderealRadians(dateOrMs, this.observerLongitudeRad);
    this.uniforms.uSiderealAngle.value = sidereal;
  }

  /**
   * @param {number} siderealRadians
   */
  setSiderealAngle(siderealRadians) {
    this.uniforms.uSiderealAngle.value = Number(siderealRadians) || 0;
  }

  /**
   * @param {number} timeSeconds
   */
  setTimeSeconds(timeSeconds) {
    this.uniforms.uTimeSeconds.value = Number(timeSeconds) || 0;
  }

  /**
   * @param {boolean} enabled
   */
  setAtmosphereEnabled(enabled) {
    this.uniforms.uAtmosphereEnabled.value = enabled ? 1 : 0;
  }

  /**
   * Runtime parameter patch.
   * @param {{
   *   baseSize?: number,
   *   starSizeScale?: number,
   *   extinctionStrength?: number,
   *   twinkleStrength?: number,
   *   haloStrength?: number,
   *   twinkleRate?: number,
   *   minPointSize?: number,
   *   maxPointSize?: number,
   *   photometricScale?: number,
   *   magnitudeLimit?: number,
   * }} patch
   */
  setParams(patch = {}) {
    if (Number.isFinite(patch.baseSize)) {
      this.uniforms.uBaseSize.value = patch.baseSize;
    }
    if (Number.isFinite(patch.starSizeScale)) {
      this.uniforms.uStarSizeScale.value = patch.starSizeScale;
    }
    if (Number.isFinite(patch.extinctionStrength)) {
      this.uniforms.uExtinctionStrength.value = patch.extinctionStrength;
    }
    if (Number.isFinite(patch.twinkleStrength)) {
      this.uniforms.uTwinkleStrength.value = patch.twinkleStrength;
    }
    if (Number.isFinite(patch.haloStrength)) {
      this.uniforms.uHaloStrength.value = patch.haloStrength;
    }
    if (Number.isFinite(patch.twinkleRate)) {
      this.uniforms.uTwinkleRate.value = patch.twinkleRate;
    }
    if (Number.isFinite(patch.minPointSize)) {
      this.uniforms.uMinPointSize.value = patch.minPointSize;
    }
    if (Number.isFinite(patch.maxPointSize)) {
      this.uniforms.uMaxPointSize.value = patch.maxPointSize;
    }
    if (Number.isFinite(patch.photometricScale)) {
      this.uniforms.uPhotometricScale.value = patch.photometricScale;
    }
    if (Number.isFinite(patch.magnitudeLimit)) {
      this.uniforms.uMagnitudeLimit.value = clamp(patch.magnitudeLimit, MIN_MAGNITUDE, MAX_MAGNITUDE);
    }
  }

  /**
   * Backward-compatible runtime patch entrypoint.
   * Accepts both snake_case and camelCase keys.
   * @param {Record<string, unknown>} patch
   */
  setParameters(patch = {}) {
    const observerLat = Number.isFinite(Number(patch.observer_lat))
      ? Number(patch.observer_lat)
      : Number(patch.observerLat);
    const observerLon = Number.isFinite(Number(patch.observer_lon))
      ? Number(patch.observer_lon)
      : Number(patch.observerLon);
    if (Number.isFinite(observerLat) || Number.isFinite(observerLon)) {
      this.setObserver(
        Number.isFinite(observerLat) ? observerLat : (this.observerLatitudeRad * (180 / Math.PI)),
        Number.isFinite(observerLon) ? observerLon : (this.observerLongitudeRad * (180 / Math.PI)),
      );
    }

    if (typeof patch.atmosphere_enabled === 'boolean') {
      this.setAtmosphereEnabled(patch.atmosphere_enabled);
    } else if (typeof patch.atmosphereEnabled === 'boolean') {
      this.setAtmosphereEnabled(patch.atmosphereEnabled);
    }

    const resolved = {
      baseSize: Number.isFinite(Number(patch.baseSize)) ? Number(patch.baseSize) : undefined,
      starSizeScale: Number.isFinite(Number(patch.star_size_scale))
        ? Number(patch.star_size_scale)
        : Number(patch.starSizeScale),
      extinctionStrength: Number.isFinite(Number(patch.extinction_strength))
        ? Number(patch.extinction_strength)
        : Number(patch.extinctionStrength),
      twinkleStrength: Number.isFinite(Number(patch.twinkle_strength))
        ? Number(patch.twinkle_strength)
        : Number(patch.twinkleStrength),
      haloStrength: Number.isFinite(Number(patch.bloom_strength))
        ? (0.10 + (Number(patch.bloom_strength) * 0.18))
        : Number(patch.haloStrength),
      twinkleRate: Number.isFinite(Number(patch.twinkleRate)) ? Number(patch.twinkleRate) : undefined,
      minPointSize: Number.isFinite(Number(patch.minPointSize)) ? Number(patch.minPointSize) : undefined,
      maxPointSize: Number.isFinite(Number(patch.maxPointSize)) ? Number(patch.maxPointSize) : undefined,
      photometricScale: Number.isFinite(Number(patch.star_intensity_scale))
        ? Number(patch.star_intensity_scale)
        : Number(patch.starIntensityScale),
      magnitudeLimit: Number.isFinite(Number(patch.magnitude_limit))
        ? Number(patch.magnitude_limit)
        : Number(patch.magnitudeLimit),
    };
    this.setParams(resolved);
  }

  /**
   * @param {Date | number} timeMs
   */
  setTime(timeMs) {
    const ms = Number(timeMs);
    if (!Number.isFinite(ms)) return;
    this.setTimeSeconds(ms * 0.001);
    this.setSiderealTimeFromDate(ms);
  }

  /**
   * Backward-compatible alias for older callers.
   * @param {Record<string, unknown>} patch
   */
  setConfig(patch = {}) {
    this.setParameters(patch);
  }

  get object3D() {
    return this.container;
  }

  dispose() {
    if (!this.container) return;

    if (this.points) {
      this.container.remove(this.points);
      this.points = null;
    }

    if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }

    this.parentContainer.remove(this.container);
    this.container = null;
  }
}
