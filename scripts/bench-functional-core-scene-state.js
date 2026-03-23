import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import * as Astronomy from "astronomy-engine";
import JSZip from "jszip";

import { computeSceneState } from "../src/platform/js/scene-state.js";

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

function normalizeBodyId(bodyId) {
    return typeof bodyId === "string" ? bodyId.toUpperCase() : "";
}

function normalizeSource(source, fallback = "chebyshev") {
    if (typeof source !== "string") return fallback;
    const normalized = source.toLowerCase();
    if (normalized === "npz" || normalized === "chebyshev" || normalized === "astronomy") {
        return normalized;
    }
    return fallback;
}

function resolveSourceForBenchmarkBody({ bodyId, bodySources, defaultSpacecraftSource }) {
    const normalizedBodyId = normalizeBodyId(bodyId);
    const override = bodySources?.[normalizedBodyId];
    if (typeof override === "string") {
        return normalizeSource(override);
    }
    if (normalizedBodyId === "SC") {
        return normalizeSource(defaultSpacecraftSource, "chebyshev");
    }
    return normalizeSource(defaultSpacecraftSource, "chebyshev");
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

function parseNpyHeader(buffer) {
    const u8 = new Uint8Array(buffer, 0, 10);
    const magic = String.fromCharCode(...u8.slice(0, 6));
    if (!magic.startsWith("\x93NUMPY")) {
        throw new Error("Invalid NPY file (missing magic header)");
    }

    const major = u8[6];
    const minor = u8[7];
    let headerLen = 0;
    let headerOffset = 0;

    if (major === 1) {
        headerLen = new DataView(buffer, 8, 2).getUint16(0, true);
        headerOffset = 10;
    } else if (major === 2 || major === 3) {
        headerLen = new DataView(buffer, 8, 4).getUint32(0, true);
        headerOffset = 12;
    } else {
        throw new Error(`Unsupported NPY version ${major}.${minor}`);
    }

    const headerText = new TextDecoder("latin1").decode(
        new Uint8Array(buffer, headerOffset, headerLen),
    );

    return {
        headerText,
        dataOffset: headerOffset + headerLen,
    };
}

function parseShape(headerText) {
    const match = headerText.match(/'shape': *\(([^)]*)\)/);
    if (!match) return [];
    const parts = match[1]
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => parseInt(p, 10))
        .filter((n) => Number.isFinite(n));
    return parts;
}

function parseDescr(headerText) {
    const fields = [];
    const tupleRegex = /\('([^']+)',\s*'([<>|])?([a-zA-Z])(\d+)'\)/g;
    let match;
    let offset = 0;
    while ((match = tupleRegex.exec(headerText)) !== null) {
        const name = match[1];
        const endian = match[2] || "<";
        const kind = match[3];
        const size = parseInt(match[4], 10);
        fields.push({
            name,
            endian,
            kind,
            size,
            byteOffset: offset,
        });
        offset += size;
    }
    return { fields, recordSize: offset };
}

function parseStructuredArray(buffer) {
    const { headerText, dataOffset } = parseNpyHeader(buffer);
    const shape = parseShape(headerText);
    if (shape.length !== 1) {
        throw new Error("Only 1D structured arrays are supported for NPZ ephemeris");
    }
    const count = shape[0];

    const { fields, recordSize } = parseDescr(headerText);
    if (fields.length === 0) {
        throw new Error("No structured fields found in NPY header");
    }

    const littleEndian = fields.every((f) => f.endian === "<" || f.endian === "|");
    if (!littleEndian) {
        throw new Error("Big-endian NPY files are not supported");
    }

    const view = new DataView(buffer, dataOffset);
    const arrays = {};
    for (const field of fields) {
        arrays[field.name] = new Float64Array(count);
    }

    for (let i = 0; i < count; i++) {
        const base = i * recordSize;
        for (const field of fields) {
            const offset = base + field.byteOffset;
            const kind = field.kind.toLowerCase();

            let value;
            if (kind === "f") {
                if (field.size === 8) {
                    value = view.getFloat64(offset, true);
                } else if (field.size === 4) {
                    value = view.getFloat32(offset, true);
                } else {
                    throw new Error(`Unsupported float size: ${field.size}`);
                }
            } else if (kind === "i" || kind === "u") {
                if (field.size === 8) {
                    value = view.getBigInt64(offset, true);
                } else if (field.size === 4) {
                    value = view.getInt32(offset, true);
                } else if (field.size === 2) {
                    value = view.getInt16(offset, true);
                } else if (field.size === 1) {
                    value = view.getInt8(offset);
                } else {
                    throw new Error(`Unsupported int size: ${field.size}`);
                }
                value = Number(value);
            } else {
                throw new Error(`Unsupported dtype kind: ${field.kind}`);
            }

            arrays[field.name][i] = value;
        }
    }

    return {
        count,
        arrays,
    };
}

function buildNpzSeries(parsed) {
    const { arrays, count } = parsed;
    const jd = arrays.jdct || arrays.jd;
    if (!jd) {
        throw new Error("NPZ ephemeris missing jd/jdct field");
    }

    const required = ["x", "y", "z", "vx", "vy", "vz"];
    for (const key of required) {
        if (!arrays[key]) {
            throw new Error(`NPZ ephemeris missing field '${key}'`);
        }
    }

    return {
        jd,
        x: arrays.x,
        y: arrays.y,
        z: arrays.z,
        vx: arrays.vx,
        vy: arrays.vy,
        vz: arrays.vz,
        timeRange: { start: jd[0], end: jd[count - 1] },
    };
}

async function loadNpzFromFile(npzPath) {
    const bytes = fs.readFileSync(npzPath);
    const zip = await JSZip.loadAsync(bytes);
    const bodies = {};
    const entries = Object.entries(zip.files).filter(([name]) =>
        name.endsWith("_vectors.npy"),
    );

    for (const [name, file] of entries) {
        const base = name.replace(/\.npy$/, "");
        const bodyName = base.replace(/_vectors$/, "").toUpperCase();

        const npyBuffer = await file.async("arraybuffer");
        const parsed = parseStructuredArray(npyBuffer);
        bodies[bodyName] = buildNpzSeries(parsed);
    }

    return bodies;
}

function parseArgs(argv) {
    const args = {
        rounds: 5,
        samples: 3000,
        warmup: 500,
        config: "geo",
        includeNextState: false,
        frameMode: "inertial",
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--rounds") args.rounds = Number(argv[++i] || args.rounds);
        if (arg === "--samples") args.samples = Number(argv[++i] || args.samples);
        if (arg === "--warmup") args.warmup = Number(argv[++i] || args.warmup);
        if (arg === "--config") args.config = String(argv[++i] || args.config);
        if (arg === "--frame-mode") args.frameMode = String(argv[++i] || args.frameMode);
        if (arg === "--include-next-state") {
            const raw = String(argv[++i] || "false").toLowerCase();
            args.includeNextState = raw === "true" || raw === "1" || raw === "yes";
        }
    }

    return args;
}

async function buildInputs({ missionConfig, phaseKey, includeNextState }) {
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

    const defaultSpacecraftSource = missionConfig?.ephemeris_source || "chebyshev";
    const benchmarkBodies = cfg.planets || [];
    const needsNpz = benchmarkBodies.some((bodyId) =>
        resolveSourceForBenchmarkBody({
            bodyId,
            bodySources,
            defaultSpacecraftSource,
        }) === "npz",
    );
    let npzBodies = {};
    let npzLoaded = {};
    if (needsNpz) {
        const npzPath = path.resolve(dataDir, `${cfg.orbits_file}.npz`);
        npzBodies = await loadNpzFromFile(npzPath);
        npzLoaded = { [phaseKey]: true };
    }

    return {
        phaseKey,
        startTimeMs,
        endTimeMs,
        options: {
            sunLongitude: 0,
            chebyshevData: { [phaseKey]: chebyshev },
            chebyshevDataLoaded: { [phaseKey]: true },
            npzData: needsNpz ? { [phaseKey]: npzBodies } : {},
            npzDataLoaded: npzLoaded,
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
            ephemerisSource: defaultSpacecraftSource,
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

async function main() {
    const args = parseArgs(process.argv);
    const configPath = path.resolve(repoRoot, "assets", "chandrayaan3", "data", "config.json");
    const missionConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const inputs = await buildInputs({
        missionConfig,
        phaseKey: args.config,
        includeNextState: args.includeNextState,
    });
    inputs.options.frameMode = args.frameMode;
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
            frameMode: args.frameMode,
        },
    };

    console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
});
