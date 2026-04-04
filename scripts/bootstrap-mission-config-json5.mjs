#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const assetsRoot = path.join(repoRoot, "assets");

const args = new Set(process.argv.slice(2));
const overwrite = args.has("--overwrite");

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

function rel(filePath) {
    return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function main() {
    if (!fs.existsSync(assetsRoot)) {
        console.error("assets/ directory not found");
        process.exit(1);
    }

    const dataDirs = findMissionDataDirectories(assetsRoot);
    let created = 0;
    let skipped = 0;

    for (const dataDir of dataDirs) {
        const jsonPath = path.join(dataDir, "config.json");
        const json5Path = path.join(dataDir, "config.json5");
        if (!fs.existsSync(jsonPath)) {
            continue;
        }
        if (fs.existsSync(json5Path) && !overwrite) {
            skipped += 1;
            continue;
        }

        const jsonText = fs.readFileSync(jsonPath, "utf8");
        const banner = [
            "// Source-of-truth mission config for maintainers (JSON5).",
            "// Generated from config.json; runtime consumes config.json.",
            "// Edit this file, then run: npm run configs:compile",
            "",
        ].join("\n");
        fs.writeFileSync(json5Path, `${banner}${jsonText}`, "utf8");
        created += 1;
        console.log(`WROTE: ${rel(json5Path)}`);
    }

    console.log(`Created/updated config.json5 files: ${created}`);
    console.log(`Skipped existing config.json5 files: ${skipped}`);
}

main();
