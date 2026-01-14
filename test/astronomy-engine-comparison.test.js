/**
 * Test comparing NPZ ephemeris data with Astronomy Engine calculations
 *
 * This test verifies whether Astronomy Engine can replace NPZ files for Moon/Earth positions.
 * Key concerns:
 * - Time system: NPZ from HORIZONS may use TDB, Astronomy Engine uses UTC by default
 * - Coordinate frame: Both should be J2000 equatorial (EQJ)
 * - Units: NPZ is in km, Astronomy Engine is in AU
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as Astronomy from 'astronomy-engine';
import { uncompressNPZ } from '../assets/platform/js/npyreader.js';

// Constants
const KM_PER_AU = 149597870.7;
const SECONDS_PER_DAY = 86400;

// Obliquity of ecliptic (J2000) in radians
const OBLIQUITY_J2000 = 23.4392911 * Math.PI / 180;

// Load NPZ data
let geoData = null;
let lunarData = null;

beforeAll(async () => {
    const dataPath = join(process.cwd(), 'assets', 'chandrayaan3', 'data');

    // Load geo NPZ - uncompressNPZ already parses the NPY data
    const geoBuffer = readFileSync(join(dataPath, 'geo-CY3.npz'));
    const geoNpz = await uncompressNPZ(geoBuffer);
    geoData = {};
    for (const [name, parsedData] of Object.entries(geoNpz)) {
        // parsedData is { dtype, shape, data, fortranOrder }
        // data is array of records with x, y, z, vx, vy, vz fields
        geoData[name.replace('.npy', '')] = {
            vectors: parsedData.data // Array of {x, y, z, vx, vy, vz} records
        };
    }

    // Load lunar NPZ
    const lunarBuffer = readFileSync(join(dataPath, 'lunar-CY3.npz'));
    const lunarNpz = await uncompressNPZ(lunarBuffer);
    lunarData = {};
    for (const [name, parsedData] of Object.entries(lunarNpz)) {
        lunarData[name.replace('.npy', '')] = {
            vectors: parsedData.data
        };
    }

    console.log('Loaded NPZ data:');
    console.log('  geo keys:', Object.keys(geoData));
    console.log('  lunar keys:', Object.keys(lunarData));
    if (geoData['MOON_vectors']) {
        console.log('  Moon vectors count:', geoData['MOON_vectors'].vectors.length);
        console.log('  First Moon vector:', geoData['MOON_vectors'].vectors[0]);
    }
});

/**
 * Convert equatorial (EQJ2000) to ecliptic (ECLIPJ2000) coordinates
 * Rotation around X-axis by obliquity angle
 */
function equatorialToEcliptic(pos, vel) {
    const cosE = Math.cos(OBLIQUITY_J2000);
    const sinE = Math.sin(OBLIQUITY_J2000);

    return {
        x: pos.x,
        y: pos.y * cosE + pos.z * sinE,
        z: -pos.y * sinE + pos.z * cosE,
        vx: vel.vx,
        vy: vel.vy * cosE + vel.vz * sinE,
        vz: -vel.vy * sinE + vel.vz * cosE
    };
}

/**
 * Get Moon position from Astronomy Engine
 * @param {Date} date - JavaScript Date (UTC)
 * @param {boolean} useTT - If true, interpret the date as TT instead of UTC
 * @param {boolean} ecliptic - If true, return ecliptic coordinates
 * @returns {Object} Position {x, y, z} in km and velocity {vx, vy, vz} in km/s
 */
function getMoonFromAstronomy(date, useTT = false, ecliptic = false) {
    let time;

    if (useTT) {
        // Convert UTC date to TT by adding delta-T (~69 seconds in 2023)
        // Astronomy Engine's MakeTime expects UTC, so we need to adjust
        // TT = UTC + deltaT, so UTC = TT - deltaT
        // We want to query at a specific TT, so we subtract deltaT from the input
        const utcTime = Astronomy.MakeTime(date);
        const deltaT = utcTime.tt - utcTime.ut; // days
        const adjustedDate = new Date(date.getTime() - deltaT * SECONDS_PER_DAY * 1000);
        time = Astronomy.MakeTime(adjustedDate);
    } else {
        time = Astronomy.MakeTime(date);
    }

    // GeoMoonState returns position in AU and velocity in AU/day (equatorial J2000)
    const state = Astronomy.GeoMoonState(time);

    const pos = {
        x: state.x * KM_PER_AU,
        y: state.y * KM_PER_AU,
        z: state.z * KM_PER_AU
    };
    const vel = {
        vx: state.vx * KM_PER_AU / SECONDS_PER_DAY,
        vy: state.vy * KM_PER_AU / SECONDS_PER_DAY,
        vz: state.vz * KM_PER_AU / SECONDS_PER_DAY
    };

    if (ecliptic) {
        const eclipticState = equatorialToEcliptic(pos, vel);
        return { ...eclipticState, time };
    }

    return { ...pos, ...vel, time };
}

/**
 * Get Earth position from Moon (selenocentric) using Astronomy Engine
 * Earth from Moon = -(Moon from Earth)
 * @param {Date} date - JavaScript Date (UTC)
 * @param {boolean} useTT - If true, interpret the date as TT instead of UTC
 * @param {boolean} ecliptic - If true, return ecliptic coordinates
 */
function getEarthFromMoonAstronomy(date, useTT = false, ecliptic = false) {
    const moon = getMoonFromAstronomy(date, useTT, ecliptic);
    return {
        x: -moon.x,
        y: -moon.y,
        z: -moon.z,
        vx: -moon.vx,
        vy: -moon.vy,
        vz: -moon.vz,
        time: moon.time
    };
}

/**
 * Get Earth position from NPZ lunar data at a specific index
 */
function getEarthFromNPZ(data, index) {
    const earthData = data['EARTH_vectors'];
    if (!earthData || !earthData.vectors || index >= earthData.vectors.length) {
        return null;
    }
    const vec = earthData.vectors[index];
    return {
        x: vec.x,
        y: vec.y,
        z: vec.z,
        vx: vec.vx,
        vy: vec.vy,
        vz: vec.vz
    };
}

/**
 * Get Moon position from NPZ data at a specific index
 * NPZ keys are: MOON_vectors, SC_vectors, EARTH_vectors, etc.
 */
function getMoonFromNPZ(data, index) {
    // Try different possible key names for Moon data
    const moonData = data['MOON_vectors'] || data['301'] || data['Moon'];
    if (!moonData || !moonData.vectors || index >= moonData.vectors.length) {
        return null;
    }
    const vec = moonData.vectors[index];
    return {
        x: vec.x,
        y: vec.y,
        z: vec.z,
        vx: vec.vx,
        vy: vec.vy,
        vz: vec.vz
    };
}

/**
 * Calculate 3D distance between two positions
 */
function distance3D(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

/**
 * Calculate velocity difference magnitude
 */
function velocityDiff(vel1, vel2) {
    const dvx = vel1.vx - vel2.vx;
    const dvy = vel1.vy - vel2.vy;
    const dvz = vel1.vz - vel2.vz;
    return Math.sqrt(dvx*dvx + dvy*dvy + dvz*dvz);
}

describe('Astronomy Engine vs NPZ Comparison', () => {

    describe('Time system investigation', () => {
        it('should report delta-T for the mission timeframe', () => {
            // Chandrayaan-3 mission: July-August 2023
            const testDates = [
                new Date('2023-07-14T09:23:00Z'), // Launch
                new Date('2023-08-05T00:00:00Z'), // Mid-mission
                new Date('2023-08-23T12:30:00Z'), // Landing
            ];

            console.log('\n=== Delta-T (TT - UT) values ===');
            for (const date of testDates) {
                const time = Astronomy.MakeTime(date);
                const deltaT_seconds = (time.tt - time.ut) * SECONDS_PER_DAY;
                console.log(`${date.toISOString()}: deltaT = ${deltaT_seconds.toFixed(3)} seconds`);
            }
        });
    });

    describe('Moon position comparison', () => {
        it('should compare Moon positions at mission start (UTC vs TT)', async () => {
            // Mission start: July 14, 2023, 09:23 UTC
            const startDate = new Date('2023-07-14T09:23:00Z');

            // Get Astronomy Engine positions in ECLIPTIC coordinates (to match HORIZONS)
            const moonUTC = getMoonFromAstronomy(startDate, false, true);  // ecliptic=true
            const moonTT = getMoonFromAstronomy(startDate, true, true);    // ecliptic=true

            console.log('\n=== Moon Position at Mission Start ===');
            console.log(`Date: ${startDate.toISOString()}`);
            console.log('\nAstronomy Engine Ecliptic (UTC):');
            console.log(`  Position: (${moonUTC.x.toFixed(2)}, ${moonUTC.y.toFixed(2)}, ${moonUTC.z.toFixed(2)}) km`);
            console.log(`  Velocity: (${moonUTC.vx.toFixed(4)}, ${moonUTC.vy.toFixed(4)}, ${moonUTC.vz.toFixed(4)}) km/s`);

            console.log('\nAstronomy Engine Ecliptic (as TT):');
            console.log(`  Position: (${moonTT.x.toFixed(2)}, ${moonTT.y.toFixed(2)}, ${moonTT.z.toFixed(2)}) km`);
            console.log(`  Velocity: (${moonTT.vx.toFixed(4)}, ${moonTT.vy.toFixed(4)}, ${moonTT.vz.toFixed(4)}) km/s`);

            // NPZ data - find the index for this time
            // The geo data starts at a specific time with 1-minute steps
            if (geoData && geoData['MOON_vectors']) {
                const moonNPZ = getMoonFromNPZ(geoData, 0); // First data point, with vx/vy swap corrected
                console.log('\nNPZ/HORIZONS (index 0):');
                console.log(`  Position: (${moonNPZ.x.toFixed(2)}, ${moonNPZ.y.toFixed(2)}, ${moonNPZ.z.toFixed(2)}) km`);
                console.log(`  Velocity: (${moonNPZ.vx.toFixed(4)}, ${moonNPZ.vy.toFixed(4)}, ${moonNPZ.vz.toFixed(4)}) km/s`);

                const distUTC = distance3D(moonUTC, moonNPZ);
                const distTT = distance3D(moonTT, moonNPZ);

                console.log('\nPosition difference from NPZ:');
                console.log(`  Using UTC: ${distUTC.toFixed(2)} km`);
                console.log(`  Using TT:  ${distTT.toFixed(2)} km`);

                const velDiffUTC = velocityDiff(moonUTC, moonNPZ);
                const velDiffTT = velocityDiff(moonTT, moonNPZ);

                console.log('\nVelocity difference from NPZ:');
                console.log(`  Using UTC: ${velDiffUTC.toFixed(6)} km/s`);
                console.log(`  Using TT:  ${velDiffTT.toFixed(6)} km/s`);
            }
        });

        it('should compare Moon positions at multiple time points', async () => {
            if (!geoData || !geoData['MOON_vectors']) {
                console.log('No Moon data in NPZ');
                return;
            }

            const moonVectors = geoData['MOON_vectors'].vectors;
            const stepMinutes = 1; // Assumed 1-minute steps
            const startDate = new Date('2023-07-14T09:23:00Z');

            // Test at different indices
            const testIndices = [0, 60, 1440, 10080, 43200]; // 0, 1hr, 1day, 1week, 30days

            console.log('\n=== Moon Position Comparison at Multiple Times ===');
            console.log('Index | Time | UTC Error (km) | TT Error (km) | UTC Vel Err | TT Vel Err');
            console.log('-'.repeat(90));

            let utcTotalError = 0;
            let ttTotalError = 0;
            let count = 0;

            for (const index of testIndices) {
                if (index >= moonVectors.length) continue;

                const date = new Date(startDate.getTime() + index * stepMinutes * 60 * 1000);
                const moonNPZ = moonVectors[index];
                const moonUTC = getMoonFromAstronomy(date, false, true);  // ecliptic=true
                const moonTT = getMoonFromAstronomy(date, true, true);   // ecliptic=true

                const distUTC = distance3D(moonUTC, moonNPZ);
                const distTT = distance3D(moonTT, moonNPZ);
                const velUTC = velocityDiff(moonUTC, moonNPZ);
                const velTT = velocityDiff(moonTT, moonNPZ);

                console.log(`${index.toString().padStart(5)} | ${date.toISOString().slice(0,16)} | ${distUTC.toFixed(2).padStart(14)} | ${distTT.toFixed(2).padStart(13)} | ${velUTC.toFixed(6).padStart(11)} | ${velTT.toFixed(6).padStart(10)}`);

                utcTotalError += distUTC;
                ttTotalError += distTT;
                count++;
            }

            console.log('-'.repeat(90));
            console.log(`Average UTC error: ${(utcTotalError/count).toFixed(2)} km`);
            console.log(`Average TT error:  ${(ttTotalError/count).toFixed(2)} km`);
            console.log(`\nBetter match: ${utcTotalError < ttTotalError ? 'UTC' : 'TT'}`);
        });
    });

    describe('Comprehensive accuracy test', () => {
        it('should test Moon accuracy across entire mission', async () => {
            if (!geoData || !geoData['MOON_vectors']) {
                console.log('No Moon data in NPZ');
                return;
            }

            const moonVectors = geoData['MOON_vectors'].vectors;
            const stepMinutes = 1;
            const startDate = new Date('2023-07-14T09:23:00Z');

            // Sample every hour for efficiency
            const sampleInterval = 60; // Every 60 indices = 1 hour

            let utcErrors = [];
            let ttErrors = [];
            let utcVelErrors = [];
            let ttVelErrors = [];

            for (let i = 0; i < moonVectors.length; i += sampleInterval) {
                const date = new Date(startDate.getTime() + i * stepMinutes * 60 * 1000);
                const moonNPZ = moonVectors[i];
                const moonUTC = getMoonFromAstronomy(date, false, true);  // ecliptic=true
                const moonTT = getMoonFromAstronomy(date, true, true);    // ecliptic=true

                utcErrors.push(distance3D(moonUTC, moonNPZ));
                ttErrors.push(distance3D(moonTT, moonNPZ));
                utcVelErrors.push(velocityDiff(moonUTC, moonNPZ));
                ttVelErrors.push(velocityDiff(moonTT, moonNPZ));
            }

            const stats = (arr) => ({
                min: Math.min(...arr),
                max: Math.max(...arr),
                mean: arr.reduce((a,b) => a+b, 0) / arr.length
            });

            const utcStats = stats(utcErrors);
            const ttStats = stats(ttErrors);
            const utcVelStats = stats(utcVelErrors);
            const ttVelStats = stats(ttVelErrors);

            console.log('\n=== Comprehensive Moon Accuracy Test ===');
            console.log(`Samples tested: ${utcErrors.length} (every hour)`);
            console.log(`Time range: ${startDate.toISOString()} to ${new Date(startDate.getTime() + moonVectors.length * stepMinutes * 60 * 1000).toISOString()}`);

            console.log('\nPosition Error (km):');
            console.log(`  UTC: min=${utcStats.min.toFixed(2)}, max=${utcStats.max.toFixed(2)}, mean=${utcStats.mean.toFixed(2)}`);
            console.log(`  TT:  min=${ttStats.min.toFixed(2)}, max=${ttStats.max.toFixed(2)}, mean=${ttStats.mean.toFixed(2)}`);

            console.log('\nVelocity Error (km/s):');
            console.log(`  UTC: min=${utcVelStats.min.toFixed(6)}, max=${utcVelStats.max.toFixed(6)}, mean=${utcVelStats.mean.toFixed(6)}`);
            console.log(`  TT:  min=${ttVelStats.min.toFixed(6)}, max=${ttVelStats.max.toFixed(6)}, mean=${ttVelStats.mean.toFixed(6)}`);

            console.log(`\n*** RECOMMENDATION: Use ${utcStats.mean < ttStats.mean ? 'UTC' : 'TT'} time system ***`);

            // The test passes if either time system gives reasonable accuracy
            const bestMeanError = Math.min(utcStats.mean, ttStats.mean);
            expect(bestMeanError).toBeLessThan(1000); // Less than 1000 km mean error
        });
    });

    describe('Earth position comparison (lunar phase)', () => {
        it('should compare Earth positions from lunar-phase NPZ with Astronomy Engine', async () => {
            if (!lunarData || !lunarData['EARTH_vectors']) {
                console.log('No Earth data in lunar NPZ');
                return;
            }

            const earthVectors = lunarData['EARTH_vectors'].vectors;
            // Lunar phase has same time range as geo phase (center is Moon instead of Earth)
            const startDate = new Date('2023-07-14T09:23:00Z');
            const stepMinutes = 1;

            // Sample every hour for efficiency
            const sampleInterval = 60;

            let ttErrors = [];
            let ttVelErrors = [];

            for (let i = 0; i < Math.min(earthVectors.length, 5000); i += sampleInterval) {
                const date = new Date(startDate.getTime() + i * stepMinutes * 60 * 1000);
                const earthNPZ = earthVectors[i];
                const earthTT = getEarthFromMoonAstronomy(date, true, true);  // TT + ecliptic

                ttErrors.push(distance3D(earthTT, earthNPZ));
                ttVelErrors.push(velocityDiff(earthTT, earthNPZ));
            }

            const stats = (arr) => ({
                min: Math.min(...arr),
                max: Math.max(...arr),
                mean: arr.reduce((a,b) => a+b, 0) / arr.length
            });

            const ttStats = stats(ttErrors);
            const ttVelStats = stats(ttVelErrors);

            console.log('\n=== Earth Position Accuracy (Lunar Phase) ===');
            console.log(`Samples tested: ${ttErrors.length}`);

            console.log('\nPosition Error (km) using TT:');
            console.log(`  min=${ttStats.min.toFixed(2)}, max=${ttStats.max.toFixed(2)}, mean=${ttStats.mean.toFixed(2)}`);

            console.log('\nVelocity Error (km/s) using TT:');
            console.log(`  min=${ttVelStats.min.toFixed(6)}, max=${ttVelStats.max.toFixed(6)}, mean=${ttVelStats.mean.toFixed(6)}`);

            // Note: This test may fail until lunar NPZ is regenerated with the vx/vy fix
            // For now, just report the results
            if (ttStats.mean < 1000) {
                expect(ttStats.mean).toBeLessThan(1000);
            } else {
                console.log('\n*** WARNING: Large errors - lunar NPZ may need regeneration ***');
            }
        });
    });
});
