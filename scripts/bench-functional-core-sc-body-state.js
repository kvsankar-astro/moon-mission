import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import * as Astronomy from "astronomy-engine";

import { computeBodyState } from "../assets/platform/js/scene-state.js";

globalThis.Astronomy = Astronomy;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

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
    const mean = samples.reduce((acc, v) => acc + v, 0) / samples.length;
    return {
        mean,
        median: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        max: sorted[sorted.length - 1],
    };
}

function parseArgs(argv) {
    const args = {
        rounds: 8,
        samples: 12000,
        warmup: 3000,
        includeNextState: false,
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--rounds") args.rounds = Number(argv[++i] || args.rounds);
        if (arg === "--samples") args.samples = Number(argv[++i] || args.samples);
        if (arg === "--warmup") args.warmup = Number(argv[++i] || args.warmup);
        if (arg === "--include-next-state") {
            const raw = String(argv[++i] || "false").toLowerCase();
            args.includeNextState = raw === "true" || raw === "1" || raw === "yes";
        }
    }

    return args;
}

function parseMissionTime(config, phaseKey, prefix) {
    const phase = config?.[phaseKey];
    if (!phase) return null;
    return Date.parse(
        `${phase[`${prefix}_year`]}-${phase[`${prefix}_month`]}-${phase[`${prefix}_day`]}T${phase[`${prefix}_hour`]}:${phase[`${prefix}_minute`]}:00Z`,
    );
}

function buildTimeline(startTimeMs, endTimeMs, count) {
    if (count <= 1) return [startTimeMs];
    const span = Math.max(1, endTimeMs - startTimeMs);
    const step = span / (count - 1);
    const out = [];
    for (let i = 0; i < count; i++) {
        out.push(Math.floor(startTimeMs + step * i));
    }
    return out;
}

function buildData(missionConfig, includeNextState) {
    const dataDir = path.resolve(repoRoot, "assets", "chandrayaan3", "data");
    const cheb = JSON.parse(
        fs.readFileSync(path.resolve(dataDir, `${missionConfig.geo.orbits_file}-cheb.json`), "utf8"),
    );

    return {
        chebyshevData: { geo: cheb },
        chebyshevDataLoaded: { geo: true },
        npzData: {},
        npzDataLoaded: {},
        landingNpzData: null,
        landingNpzLoaded: false,
        landingChebyshevData: null,
        landingChebyshevLoaded: false,
        globalConfig: missionConfig,
        startLandingTime: parseMissionTime(missionConfig, "landing", "start"),
        endLandingTime: parseMissionTime(missionConfig, "landing", "stop"),
        frameMode: "inertial",
        ephemerisSource: missionConfig.ephemeris_source || "chebyshev",
        bodySources: missionConfig.ephemeris_sources || {},
        includeNextState,
    };
}

function toMs(value) {
    return Number(value.toFixed(6));
}

function main() {
    const args = parseArgs(process.argv);
    const configPath = path.resolve(repoRoot, "assets", "chandrayaan3", "data", "config.json");
    const missionConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

    const startTimeMs = parseMissionTime(missionConfig, "geo", "start");
    const endTimeMs = parseMissionTime(missionConfig, "geo", "stop");
    const timeline = buildTimeline(startTimeMs, endTimeMs, args.samples);
    const rounds = [];

    for (let round = 0; round < args.rounds; round++) {
        const data = buildData(missionConfig, args.includeNextState);
        for (let i = 0; i < args.warmup; i++) {
            computeBodyState("SC", timeline[i % timeline.length], "geo", data);
        }

        const samples = [];
        for (let i = 0; i < timeline.length; i++) {
            const t0 = performance.now();
            computeBodyState("SC", timeline[i], "geo", data);
            samples.push(performance.now() - t0);
        }
        const stats = summarize(samples);
        rounds.push({
            round: round + 1,
            meanMs: toMs(stats.mean),
            medianMs: toMs(stats.median),
            p95Ms: toMs(stats.p95),
            p99Ms: toMs(stats.p99),
            maxMs: toMs(stats.max),
        });
    }

    const meanOfMeans = rounds.reduce((acc, r) => acc + r.meanMs, 0) / rounds.length;
    const meanP95 = rounds.reduce((acc, r) => acc + r.p95Ms, 0) / rounds.length;
    const meanP99 = rounds.reduce((acc, r) => acc + r.p99Ms, 0) / rounds.length;

    console.log(
        JSON.stringify(
            {
                benchmark: "functional-core-sc-body-state",
                includeNextState: args.includeNextState,
                rounds,
                overall: {
                    meanOfMeansMs: toMs(meanOfMeans),
                    meanP95Ms: toMs(meanP95),
                    meanP99Ms: toMs(meanP99),
                    worstMaxMs: toMs(Math.max(...rounds.map((r) => r.maxMs))),
                },
                params: {
                    rounds: args.rounds,
                    samples: args.samples,
                    warmup: args.warmup,
                },
            },
            null,
            2,
        ),
    );
}

main();
