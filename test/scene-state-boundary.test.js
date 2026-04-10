/**
 * Headless functional test: verify computeSceneState runs without exceptions
 * from data start to data end for every mission + phase with Chebyshev data.
 *
 * This catches boundary issues (e.g., TDB/UTC slider overshoot) where the
 * animation clock reaches a time outside Chebyshev data coverage.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Astronomy Engine is needed by computeSceneState for sidereal time
import * as Astronomy from "astronomy-engine";
globalThis.Astronomy = Astronomy;

import { computeSceneState } from "../src/platform/js/scene-state.js";
import { parseConfigTimestamp, createTimestampFromScale } from "../src/platform/js/utils/time-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const assetsDir = path.join(repoRoot, "assets");

function resolveTimeScale(block) {
    return block?.time_scale === "TDB" ? "TDB" : "UTC";
}

function parsePhaseStartMs(phase) {
    if (!phase) return NaN;
    const scale = resolveTimeScale(phase);
    if (typeof phase.startTime === "string") {
        return parseConfigTimestamp(phase.startTime, scale);
    }
    const y = parseInt(phase.start_year);
    const m = parseInt(phase.start_month);
    const d = parseInt(phase.start_day);
    const h = parseInt(phase.start_hour);
    const mi = parseInt(phase.start_minute);
    if ([y, m, d, h, mi].some((v) => !Number.isFinite(v))) return NaN;
    return createTimestampFromScale(y, m, d, h, mi, scale);
}

function parsePhaseEndMs(phase) {
    if (!phase) return NaN;
    const scale = resolveTimeScale(phase);
    if (typeof phase.endTime === "string") {
        return parseConfigTimestamp(phase.endTime, scale);
    }
    const y = parseInt(phase.stop_year);
    const m = parseInt(phase.stop_month);
    const d = parseInt(phase.stop_day);
    const h = parseInt(phase.stop_hour);
    const mi = parseInt(phase.stop_minute);
    if ([y, m, d, h, mi].some((v) => !Number.isFinite(v))) return NaN;
    return createTimestampFromScale(y, m, d, h, mi, scale);
}

// Discover missions that have both config.json and a geo Chebyshev file
function discoverMissions() {
    const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
    const missions = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dataDir = path.join(assetsDir, entry.name, "data");
        if (!fs.existsSync(dataDir)) continue;
        const files = fs.readdirSync(dataDir);
        const configFile = files.includes("config.json") ? "config.json" : null;
        const geoCheb = files.find(
            (f) => f.startsWith("geo-") && f.endsWith("-cheb.json") && !f.endsWith(".gz"),
        );
        if (configFile && geoCheb) {
            missions.push({ name: entry.name, dataDir, geoCheb });
        }
    }
    return missions.sort((a, b) => a.name.localeCompare(b.name));
}

function buildOptions(config, phaseKey, chebyshev) {
    const bodySources = {};
    const sources = config.ephemeris_sources || {};
    for (const [id, src] of Object.entries(sources)) {
        bodySources[String(id).toUpperCase()] = src;
    }

    const eventInfos = Object.values(config.events || {})
        .filter((e) => e?.burnFlag && typeof e?.startTime === "string" && e.startTime !== "dynamic")
        .map((e) => ({
            burnFlag: true,
            body: e.body || "",
            startTime: new Date(e.startTime),
        }));

    const tliMs = config.events?.tli?.startTime
        ? new Date(config.events.tli.startTime).getTime()
        : NaN;
    const loiMs = config.events?.loi?.startTime
        ? new Date(config.events.loi.startTime).getTime()
        : NaN;

    return {
        sunLongitude: 0,
        chebyshevData: { [phaseKey]: chebyshev },
        chebyshevDataLoaded: { [phaseKey]: true },
        npzData: {},
        npzDataLoaded: {},
        landingNpzData: null,
        landingNpzLoaded: false,
        landingChebyshevData: null,
        landingChebyshevLoaded: false,
        globalConfig: config,
        startLandingTime: NaN,
        endLandingTime: NaN,
        eventInfos,
        missionTimes: {
            timeTransLunarInjection: tliMs,
            timeLunarOrbitInsertion: loiMs,
        },
        planetsForLocations: config[phaseKey]?.planets || [],
        frameMode: "inertial",
        ephemerisSource: config.ephemeris_source || "chebyshev",
        bodySources,
        includeNextState: false,
    };
}

const ONE_MINUTE_MS = 60_000;

const missions = discoverMissions();

describe("scene-state boundary sweep", () => {
    if (missions.length === 0) {
        it.skip("no local mission Chebyshev files found for boundary sweep", () => {});
        return;
    }

    for (const mission of missions) {
        describe(mission.name, () => {
            let config;
            let chebyshev;
            let startMs;
            let endMs;
            let options;

            try {
                config = JSON.parse(fs.readFileSync(path.join(mission.dataDir, "config.json"), "utf8"));
                chebyshev = JSON.parse(fs.readFileSync(path.join(mission.dataDir, mission.geoCheb), "utf8"));
            } catch {
                // skip missions whose data can't be loaded
            }

            if (!config || !chebyshev) return;

            const phase = config.geo;
            if (!phase) return;

            startMs = parsePhaseStartMs(phase);
            endMs = parsePhaseEndMs(phase);
            if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;

            options = buildOptions(config, "geo", chebyshev);

            // Sample: start, start+1min, 25%, 50%, 75%, end-1min, end
            const sampleTimes = [
                { label: "start", ms: startMs },
                { label: "start+1min", ms: startMs + ONE_MINUTE_MS },
                { label: "25%", ms: startMs + (endMs - startMs) * 0.25 },
                { label: "50%", ms: startMs + (endMs - startMs) * 0.50 },
                { label: "75%", ms: startMs + (endMs - startMs) * 0.75 },
                { label: "end-1min", ms: endMs - ONE_MINUTE_MS },
                { label: "end", ms: endMs },
            ];

            // Identify spacecraft body IDs from the planets list
            // (may be "SC", mnemonic like "ORION", or multi-craft IDs like "CH2O"/"CH2L")
            const planets = phase.planets || [];
            const nonCelestial = planets.filter(
                (id) => !["MOON", "EARTH", "SUN"].includes(id.toUpperCase()),
            );
            const craftIds = nonCelestial.length > 0
                ? nonCelestial
                : [(config.spacecraft_mnemonic || "SC").toUpperCase()];

            // Check if the Chebyshev file actually has SC data
            const hasCraftSeries = craftIds.some(
                (id) => !!(chebyshev[id]?.segments || (id === "SC" && chebyshev.segments)),
            );

            for (const { label, ms } of sampleTimes) {
                it(`geo phase at ${label} (${new Date(ms).toISOString()})`, () => {
                    // computeSceneState must not throw regardless of data coverage
                    const state = computeSceneState(Math.round(ms), "geo", options);
                    expect(state).toBeDefined();
                    expect(state.bodies).toBeDefined();

                    if (!hasCraftSeries) {
                        // Mission has no SC Chebyshev data — verify no crash but skip availability check
                        return;
                    }

                    // At least one spacecraft body should be available.
                    // Missions with known trajectory gaps (e.g., maneuver blackouts) may
                    // legitimately return available=false at interior samples; only the
                    // boundary points (start, start+1min, end-1min, end) are strict.
                    const availableCraft = craftIds.find(
                        (id) => state.bodies[id]?.available,
                    );
                    const isBoundary = ["start", "start+1min", "end-1min", "end"].includes(label);
                    if (!isBoundary && !availableCraft) {
                        // Interior gap — acceptable for missions with fragmented coverage
                        return;
                    }

                    expect(
                        availableCraft,
                        `no spacecraft available at ${label} (tried: ${craftIds.join(", ")})`,
                    ).toBeTruthy();
                    const body = state.bodies[availableCraft];
                    expect(body.position).toBeDefined();
                    expect(Number.isFinite(body.position.x)).toBe(true);
                });
            }
        });
    }
});
