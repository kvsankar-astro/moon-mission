import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import * as Astronomy from "astronomy-engine";

import { computeSceneState } from "../assets/platform/js/scene-state.js";

globalThis.Astronomy = Astronomy;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function parseIsoTimestamp(value) {
    return new Date(value).getTime();
}

function parseMissionTime(config, phaseKey, prefix) {
    const phase = config?.[phaseKey];
    if (!phase) return null;
    const year = phase[`${prefix}_year`];
    const month = phase[`${prefix}_month`];
    const day = phase[`${prefix}_day`];
    const hour = phase[`${prefix}_hour`];
    const minute = phase[`${prefix}_minute`];
    return Date.parse(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
}

function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const idx = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
    );
    return sorted[idx];
}

function summarize(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((acc, v) => acc + v, 0);
    const mean = sum / samples.length;
    const median = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);
    const max = sorted[sorted.length - 1];
    return { mean, median, p95, p99, max };
}

function toMs(value) {
    return Number(value.toFixed(6));
}

function parseArgs(argv) {
    const args = {
        rounds: 5,
        samples: 3000,
        warmup: 500,
        config: "geo",
        includeNextState: false,
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--rounds") args.rounds = Number(argv[++i] || args.rounds);
        if (arg === "--samples") args.samples = Number(argv[++i] || args.samples);
        if (arg === "--warmup") args.warmup = Number(argv[++i] || args.warmup);
        if (arg === "--config") args.config = String(argv[++i] || args.config);
        if (arg === "--include-next-state") {
            const raw = String(argv[++i] || "false").toLowerCase();
            args.includeNextState = raw === "true" || raw === "1" || raw === "yes";
        }
    }

    return args;
}

function buildInputs({ missionConfig, phaseKey, includeNextState }) {
    const dataDir = path.resolve(repoRoot, "assets", "chandrayaan3", "data");
    const cfg = missionConfig?.[phaseKey];
    if (!cfg) {
        throw new Error(`Missing phase config: ${phaseKey}`);
    }

    const chebPath = path.resolve(dataDir, `${cfg.orbits_file}-cheb.json`);
    const chebyshev = JSON.parse(fs.readFileSync(chebPath, "utf8"));

    const startTimeMs = parseMissionTime(missionConfig, phaseKey, "start");
    const endTimeMs = parseMissionTime(missionConfig, phaseKey, "stop");
    if (!Number.isFinite(startTimeMs) || !Number.isFinite(endTimeMs)) {
        throw new Error(`Invalid mission times for phase ${phaseKey}`);
    }

    const tliMs = parseIsoTimestamp(missionConfig?.events?.tli?.startTime || "2100-01-01T00:00:00Z");
    const loiMs = parseIsoTimestamp(missionConfig?.events?.loi?.startTime || "2100-01-01T00:00:00Z");
    const eventInfos = Object.values(missionConfig?.events || {})
        .filter((event) => event?.burnFlag && event?.startTime && event?.startTime !== "dynamic")
        .map((event) => ({
            burnFlag: !!event.burnFlag,
            body: event.body || "",
            startTime: new Date(event.startTime),
        }));

    const bodySources = {};
    const configuredSources = missionConfig?.ephemeris_sources || {};
    for (const [bodyId, source] of Object.entries(configuredSources)) {
        bodySources[String(bodyId).toUpperCase()] = source;
    }

    return {
        phaseKey,
        startTimeMs,
        endTimeMs,
        options: {
            sunLongitude: 0,
            chebyshevData: { [phaseKey]: chebyshev },
            chebyshevDataLoaded: { [phaseKey]: true },
            npzData: {},
            npzDataLoaded: {},
            landingNpzData: null,
            landingNpzLoaded: false,
            landingChebyshevData: null,
            landingChebyshevLoaded: false,
            globalConfig: missionConfig,
            startLandingTime: parseMissionTime(missionConfig, "landing", "start"),
            endLandingTime: parseMissionTime(missionConfig, "landing", "stop"),
            eventInfos,
            missionTimes: {
                timeTransLunarInjection: tliMs,
                timeLunarOrbitInsertion: loiMs,
            },
            planetsForLocations: cfg.planets || [],
            frameMode: "inertial",
            ephemerisSource: missionConfig?.ephemeris_source || "chebyshev",
            bodySources,
            includeNextState,
        },
    };
}

function buildTimeline(startTimeMs, endTimeMs, count) {
    if (count <= 1) return [startTimeMs];
    const span = Math.max(1, endTimeMs - startTimeMs);
    const step = span / (count - 1);
    const values = [];
    for (let i = 0; i < count; i++) {
        values.push(Math.floor(startTimeMs + step * i));
    }
    return values;
}

function runRound({ phaseKey, timeline, options, warmup }) {
    let guard = 0;
    const timelineLength = timeline.length;

    for (let i = 0; i < warmup; i++) {
        const t = timeline[i % timelineLength];
        options.sunLongitude = (i % 360) * (Math.PI / 180);
        const state = computeSceneState(t, phaseKey, options);
        if (state?.bodies?.SC?.available) {
            guard += 1;
        }
    }

    const durations = [];
    for (let i = 0; i < timelineLength; i++) {
        const t = timeline[i];
        options.sunLongitude = (i % 360) * (Math.PI / 180);
        const start = performance.now();
        const state = computeSceneState(t, phaseKey, options);
        durations.push(performance.now() - start);
        if (state?.bodies?.SC?.available) {
            guard += state.bodies.SC.position.x * 0;
        }
    }

    return { durations, guard };
}

function aggregate(roundStats) {
    const means = roundStats.map((r) => r.mean);
    const medians = roundStats.map((r) => r.median);
    const p95s = roundStats.map((r) => r.p95);
    const p99s = roundStats.map((r) => r.p99);
    const maxes = roundStats.map((r) => r.max);
    return {
        rounds: roundStats.length,
        meanOfMeans: means.reduce((a, b) => a + b, 0) / means.length,
        medianOfMedians: medians.sort((a, b) => a - b)[Math.floor(medians.length / 2)],
        meanP95: p95s.reduce((a, b) => a + b, 0) / p95s.length,
        meanP99: p99s.reduce((a, b) => a + b, 0) / p99s.length,
        worstMax: Math.max(...maxes),
    };
}

function main() {
    const args = parseArgs(process.argv);
    const configPath = path.resolve(repoRoot, "assets", "chandrayaan3", "data", "config.json");
    const missionConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const inputs = buildInputs({
        missionConfig,
        phaseKey: args.config,
        includeNextState: args.includeNextState,
    });
    const timeline = buildTimeline(inputs.startTimeMs, inputs.endTimeMs, args.samples);

    const rounds = [];
    for (let round = 0; round < args.rounds; round++) {
        const result = runRound({
            phaseKey: inputs.phaseKey,
            timeline,
            options: { ...inputs.options },
            warmup: args.warmup,
        });
        const stats = summarize(result.durations);
        rounds.push({
            round: round + 1,
            mean: stats.mean,
            median: stats.median,
            p95: stats.p95,
            p99: stats.p99,
            max: stats.max,
        });
    }

    const overall = aggregate(rounds);
    const output = {
        benchmark: "functional-core-scene-state",
        phase: args.config,
        rounds: rounds.map((r) => ({
            round: r.round,
            meanMs: toMs(r.mean),
            medianMs: toMs(r.median),
            p95Ms: toMs(r.p95),
            p99Ms: toMs(r.p99),
            maxMs: toMs(r.max),
        })),
        overall: {
            meanOfMeansMs: toMs(overall.meanOfMeans),
            medianOfMediansMs: toMs(overall.medianOfMedians),
            meanP95Ms: toMs(overall.meanP95),
            meanP99Ms: toMs(overall.meanP99),
            worstMaxMs: toMs(overall.worstMax),
        },
        params: {
            samples: args.samples,
            warmup: args.warmup,
            rounds: args.rounds,
            includeNextState: args.includeNextState,
        },
    };

    console.log(JSON.stringify(output, null, 2));
}

main();
