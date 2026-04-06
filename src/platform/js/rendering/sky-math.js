/**
 * Celestial coordinate math helpers (J2000/equatorial to horizontal).
 */

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MS_PER_DAY = 86400000;
const UNIX_EPOCH_JD = 2440587.5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function degreesToRadians(degrees) {
  return Number(degrees) * DEG_TO_RAD;
}

export function radiansToDegrees(radians) {
  return Number(radians) * RAD_TO_DEG;
}

export function normalizeAngleRadians(angle) {
  const twoPi = Math.PI * 2;
  let value = Number(angle) % twoPi;
  if (value < 0) value += twoPi;
  return value;
}

export function normalizeAngleDegrees(angle) {
  let value = Number(angle) % 360;
  if (value < 0) value += 360;
  return value;
}

/**
 * @param {Date | number} dateOrMs - Date object or UTC epoch milliseconds.
 * @returns {number}
 */
export function dateToJulianDate(dateOrMs) {
  const ms = dateOrMs instanceof Date ? dateOrMs.getTime() : Number(dateOrMs);
  if (!Number.isFinite(ms)) {
    throw new TypeError('dateToJulianDate requires a Date or epoch milliseconds');
  }
  return (ms / MS_PER_DAY) + UNIX_EPOCH_JD;
}

/**
 * Greenwich Mean Sidereal Time in radians.
 * Meeus-style polynomial referenced to J2000.
 * @param {number} julianDate
 * @returns {number}
 */
export function julianDateToGmstRadians(julianDate) {
  const jd = Number(julianDate);
  const t = (jd - 2451545.0) / 36525.0;
  const gmstDegrees = 280.46061837
    + (360.98564736629 * (jd - 2451545.0))
    + (0.000387933 * t * t)
    - ((t * t * t) / 38710000.0);
  return normalizeAngleRadians(degreesToRadians(gmstDegrees));
}

/**
 * @param {Date | number | { julianDate: number, longitudeRadians?: number, longitudeDegrees?: number }} input
 * @param {number} [longitudeRadians]
 * @returns {number}
 */
export function localSiderealRadians(input, longitudeRadians = 0) {
  if (input && typeof input === 'object' && !(input instanceof Date)) {
    const jd = Number(input.julianDate);
    const lon = Number.isFinite(input.longitudeRadians)
      ? input.longitudeRadians
      : Number.isFinite(input.longitudeDegrees)
        ? degreesToRadians(input.longitudeDegrees)
        : 0;
    return normalizeAngleRadians(julianDateToGmstRadians(jd) + lon);
  }

  const jd = input instanceof Date || Number.isFinite(input)
    ? dateToJulianDate(input)
    : dateToJulianDate(Date.now());
  return normalizeAngleRadians(julianDateToGmstRadians(jd) + Number(longitudeRadians || 0));
}

/**
 * Convert equatorial coordinates to a unit vector.
 * @param {number} raDeg - Right ascension in degrees.
 * @param {number} decDeg - Declination in degrees.
 * @returns {{ x: number, y: number, z: number }}
 */
export function raDecToEquatorialUnitVector(raDeg, decDeg) {
  const ra = degreesToRadians(raDeg);
  const dec = degreesToRadians(decDeg);
  const cosDec = Math.cos(dec);
  return {
    x: cosDec * Math.cos(ra),
    y: cosDec * Math.sin(ra),
    z: Math.sin(dec),
  };
}

/**
 * @param {{ x: number, y: number, z: number }} vector
 * @returns {{ raDeg: number, decDeg: number }}
 */
export function equatorialUnitVectorToRaDec(vector) {
  const x = Number(vector?.x) || 0;
  const y = Number(vector?.y) || 0;
  const z = clamp(Number(vector?.z) || 0, -1, 1);
  const ra = normalizeAngleRadians(Math.atan2(y, x));
  const dec = Math.asin(z);
  return {
    raDeg: radiansToDegrees(ra),
    decDeg: radiansToDegrees(dec),
  };
}

/**
 * Observer zenith direction in equatorial coordinates.
 * @param {number} latitudeRad
 * @param {number} siderealRad
 * @returns {{ x: number, y: number, z: number }}
 */
export function equatorialZenithUnitVector(latitudeRad, siderealRad) {
  const cosLat = Math.cos(latitudeRad);
  return {
    x: cosLat * Math.cos(siderealRad),
    y: cosLat * Math.sin(siderealRad),
    z: Math.sin(latitudeRad),
  };
}

/**
 * Convert an equatorial unit vector to local horizontal coordinates.
 * @param {{ x: number, y: number, z: number }} vectorEq
 * @param {{ latitudeRad: number, siderealRad: number }} observer
 * @returns {{ altitudeRad: number, azimuthRad: number, sinAltitude: number }}
 */
export function equatorialVectorToHorizontal(vectorEq, observer) {
  const latitudeRad = Number(observer?.latitudeRad) || 0;
  const siderealRad = Number(observer?.siderealRad) || 0;

  const x = Number(vectorEq?.x) || 0;
  const y = Number(vectorEq?.y) || 0;
  const z = Number(vectorEq?.z) || 0;

  const sinLat = Math.sin(latitudeRad);
  const cosLat = Math.cos(latitudeRad);
  const sinLst = Math.sin(siderealRad);
  const cosLst = Math.cos(siderealRad);

  // Rotate equatorial -> local topocentric ENU basis.
  const east = (-x * sinLst) + (y * cosLst);
  const north = (-x * sinLat * cosLst) - (y * sinLat * sinLst) + (z * cosLat);
  const up = (x * cosLat * cosLst) + (y * cosLat * sinLst) + (z * sinLat);

  const sinAltitude = clamp(up, -1, 1);
  const altitudeRad = Math.asin(sinAltitude);
  const azimuthRad = normalizeAngleRadians(Math.atan2(east, north));

  return { altitudeRad, azimuthRad, sinAltitude };
}

/**
 * Convert catalog RA/Dec directly to horizontal coordinates.
 * @param {{ raDeg: number, decDeg: number }} coords
 * @param {{ latitudeDeg?: number, latitudeRad?: number, longitudeDeg?: number, longitudeRad?: number, date?: Date | number, julianDate?: number }} observer
 * @returns {{ altitudeRad: number, azimuthRad: number, sinAltitude: number, siderealRad: number }}
 */
export function raDecToHorizontal(coords, observer) {
  const latitudeRad = Number.isFinite(observer?.latitudeRad)
    ? observer.latitudeRad
    : degreesToRadians(observer?.latitudeDeg || 0);

  const longitudeRad = Number.isFinite(observer?.longitudeRad)
    ? observer.longitudeRad
    : degreesToRadians(observer?.longitudeDeg || 0);

  const siderealRad = Number.isFinite(observer?.julianDate)
    ? localSiderealRadians({ julianDate: observer.julianDate, longitudeRadians: longitudeRad })
    : localSiderealRadians(observer?.date ?? Date.now(), longitudeRad);

  const vectorEq = raDecToEquatorialUnitVector(coords.raDeg, coords.decDeg);
  const horizontal = equatorialVectorToHorizontal(vectorEq, { latitudeRad, siderealRad });
  return {
    ...horizontal,
    siderealRad,
  };
}

/**
 * FNV-1a hash normalized to [0, 1]. Stable for deterministic twinkling seeds.
 * @param {string | number} value
 * @returns {number}
 */
export function stableUnitHash(value) {
  const str = String(value ?? '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 4294967295;
}
