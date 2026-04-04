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

function compileMissionConfig(dataDir) {
    const sourcePath = path.join(dataDir, "config.json5");
    const targetPath = path.join(dataDir, "config.json");
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
        const result = compileMissionConfig(dataDir);
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

    if (checkOnly) {
        console.log(`Checked mission configs: ${checkedCount}`);
        if (driftCount > 0) {
            console.error(`Out-of-sync configs: ${driftCount}`);
            process.exit(1);
        }
        console.log("All config.json files are in sync with config.json5 sources.");
        return;
    }

    console.log(`Checked mission configs: ${checkedCount}`);
    console.log(`Updated config.json files: ${writeCount}`);
}

main();
