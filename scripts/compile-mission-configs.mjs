#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import JSON5 from "json5";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const assetsRoot = path.join(repoRoot, "assets");

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const lintTimeScale = args.has("--lint-time-scale");

function findMissionDataDirectories(rootDir) {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dataDir = path.join(rootDir, entry.name, "data");
        if (fs.existsSync(dataDir) && fs.statSync(dataDir).isDirectory()) {
            result.push(dataDir);
        }
    }
    return result.sort();
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJson5(filePath) {
    return JSON5.parse(fs.readFileSync(filePath, "utf8"));
}

function stringifyJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function rel(filePath) {
    return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

const JSON5_SOURCE_TARGETS = [
    {
        sourceFileName: "config.json5",
        targetFileName: "config.json",
    },
    {
        sourceFileName: "media-manifest.json5",
        targetFileName: "media-manifest.json",
    },
];

function compileJson5Artifact(dataDir, {
    sourceFileName,
    targetFileName,
}) {
    const sourcePath = path.join(dataDir, sourceFileName);
    const targetPath = path.join(dataDir, targetFileName);
    if (!fs.existsSync(sourcePath)) {
        return {
            status: "skip",
            message: `${rel(sourcePath)} missing`,
        };
    }

    const parsedSource = readJson5(sourcePath);
    const serialized = stringifyJson(parsedSource);

    if (!fs.existsSync(targetPath)) {
        if (checkOnly) {
            return {
                status: "drift",
                message: `${rel(targetPath)} missing (would be generated from ${rel(sourcePath)})`,
            };
        }
        fs.writeFileSync(targetPath, serialized, "utf8");
        return {
            status: "write",
            message: `${rel(targetPath)} generated from ${rel(sourcePath)}`,
        };
    }

    const parsedTarget = readJson(targetPath);
    const equivalent = isDeepStrictEqual(parsedSource, parsedTarget);
    if (equivalent) {
        return {
            status: "ok",
            message: `${rel(targetPath)} already in sync`,
        };
    }

    if (checkOnly) {
        return {
            status: "drift",
            message: `${rel(targetPath)} is out of sync with ${rel(sourcePath)}`,
        };
    }

    fs.writeFileSync(targetPath, serialized, "utf8");
    return {
        status: "write",
        message: `${rel(targetPath)} updated from ${rel(sourcePath)}`,
    };
}

const PHASE_KEYS = new Set(["geo", "lunar", "landing", "relative"]);

function lintTimeScaleAnnotations(dataDirs) {
    const warnings = [];
    for (const dataDir of dataDirs) {
        const sourcePath = path.join(dataDir, "config.json5");
        if (!fs.existsSync(sourcePath)) continue;
        const config = readJson5(sourcePath);
        const mission = path.basename(path.dirname(dataDir));

        for (const key of PHASE_KEYS) {
            const block = config[key];
            if (!block || typeof block !== "object") continue;
            if (!block.time_scale) {
                warnings.push(`${mission}: phase "${key}" missing time_scale`);
            }
        }

        if (config.events && typeof config.events === "object" && !config.events.time_scale) {
            warnings.push(`${mission}: "events" block missing time_scale`);
        }

        const crafts = Array.isArray(config.crafts) ? config.crafts : [];
        for (const craft of crafts) {
            const spans = craft.spans;
            if (!spans || typeof spans !== "object") continue;
            for (const spanKey of Object.keys(spans)) {
                if (!PHASE_KEYS.has(spanKey)) continue;
                const span = spans[spanKey];
                if (span && typeof span === "object" && !span.time_scale) {
                    warnings.push(`${mission}: craft "${craft.id || craft.mnemonic}" span "${spanKey}" missing time_scale`);
                }
            }
        }
    }
    return warnings;
}

function main() {
    if (!fs.existsSync(assetsRoot)) {
        console.error("assets/ directory not found");
        process.exit(1);
    }

    const dataDirs = findMissionDataDirectories(assetsRoot);
    let driftCount = 0;
    let writeCount = 0;
    let checkedCount = 0;

    for (const dataDir of dataDirs) {
        for (const artifact of JSON5_SOURCE_TARGETS) {
            const result = compileJson5Artifact(dataDir, artifact);
            if (result.status === "skip") continue;
            checkedCount += 1;
            if (result.status === "drift") {
                driftCount += 1;
                console.error(`DRIFT: ${result.message}`);
                continue;
            }
            if (result.status === "write") {
                writeCount += 1;
                console.log(`WRITE: ${result.message}`);
                continue;
            }
            console.log(`OK: ${result.message}`);
        }
    }

    if (checkOnly) {
        console.log(`Checked JSON5 mission artifacts: ${checkedCount}`);
        if (driftCount > 0) {
            console.error(`Out-of-sync mission artifacts: ${driftCount}`);
            process.exit(1);
        }
        console.log("All compiled mission artifacts are in sync with their JSON5 sources.");
    } else {
        console.log(`Checked JSON5 mission artifacts: ${checkedCount}`);
        console.log(`Updated compiled mission artifacts: ${writeCount}`);
    }

    if (lintTimeScale) {
        const warnings = lintTimeScaleAnnotations(dataDirs);
        if (warnings.length > 0) {
            console.error(`\ntime_scale lint failures (${warnings.length}):`);
            for (const w of warnings) {
                console.error(`  ${w}`);
            }
            process.exit(1);
        }
        console.log("time_scale lint: all phase/span/events blocks annotated.");
    }
}

main();
