#!/usr/bin/env node
/**
 * One-time migration: add time_scale annotations to all config.json5 files.
 *
 * - Phase blocks (geo, lunar, landing, relative): time_scale = "TDB"
 *   (their start/end times come from HORIZONS/Chebyshev data which is TDB)
 * - Events block: time_scale = "UTC"
 *   (event times come from HORIZONS MAJOR EVENTS which is UTC)
 * - Craft span blocks: time_scale = "TDB"
 *   (span boundaries come from ephemeris data ranges)
 *
 * Also patches all *-cheb.json files to annotate units.time as "julian_date_tdb".
 *
 * Usage:  node scripts/annotate-config-time-scale.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ASSETS = join(ROOT, "assets");
const DRY_RUN = process.argv.includes("--dry-run");

const PHASE_KEYS = ["geo", "lunar", "landing", "relative"];

// ── Config.json5 annotation ────────────────────────────────────────────────

function annotateConfigJson5(filePath) {
    let text = readFileSync(filePath, "utf8");
    let changes = 0;

    // Skip files that already have time_scale annotations
    if (text.includes('"time_scale"')) {
        return 0;
    }

    // Insert time_scale: "TDB" into phase blocks.
    // Match:  "geo": {  (with optional whitespace/newlines before {)
    // Insert "time_scale": "TDB", as the first field.
    for (const key of PHASE_KEYS) {
        const pattern = new RegExp(
            `("${key}"\\s*:\\s*\\{)(\\s*\\n)`,
            "g",
        );
        const replacement = `$1$2    "time_scale": "TDB",\n`;
        const before = text;
        text = text.replace(pattern, replacement);
        if (text !== before) changes++;
    }

    // Insert time_scale: "UTC" into events block.
    {
        const pattern = /("events"\s*:\s*\{)(\s*\n)/;
        const replacement = `$1$2    "time_scale": "UTC",\n`;
        const before = text;
        text = text.replace(pattern, replacement);
        if (text !== before) changes++;
    }

    // Insert time_scale: "TDB" into craft span phase blocks.
    // These appear as  "spans": { "geo": { ... }, "lunar": { ... } }
    // We need to find "geo": { inside a "spans" context.
    // Strategy: find "spans" block, then annotate nested phase keys within it.
    const spansMatch = text.match(/"spans"\s*:\s*\{/);
    if (spansMatch) {
        const spansStart = spansMatch.index + spansMatch[0].length;
        // Find the matching closing brace for spans
        let depth = 1;
        let spansEnd = spansStart;
        for (let i = spansStart; i < text.length && depth > 0; i++) {
            if (text[i] === "{") depth++;
            else if (text[i] === "}") depth--;
            if (depth === 0) spansEnd = i;
        }
        const spansBlock = text.substring(spansStart, spansEnd);
        let annotatedSpans = spansBlock;
        for (const key of PHASE_KEYS) {
            const spanPattern = new RegExp(
                `("${key}"\\s*:\\s*\\{)(\\s*\\n)`,
                "g",
            );
            const spanReplacement = `$1$2        "time_scale": "TDB",\n`;
            const before = annotatedSpans;
            annotatedSpans = annotatedSpans.replace(spanPattern, spanReplacement);
            if (annotatedSpans !== before) changes++;
        }
        if (annotatedSpans !== spansBlock) {
            text = text.substring(0, spansStart) + annotatedSpans + text.substring(spansEnd);
        }
    }

    if (changes > 0 && !DRY_RUN) {
        writeFileSync(filePath, text, "utf8");
    }
    return changes;
}

// ── Chebyshev JSON annotation ──────────────────────────────────────────────

function annotateChebJson(filePath) {
    const text = readFileSync(filePath, "utf8");
    const data = JSON.parse(text);
    let changed = false;

    if (data.metadata?.units?.time === "julian_date") {
        data.metadata.units.time = "julian_date_tdb";
        changed = true;
    }

    if (changed && !DRY_RUN) {
        writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
    }
    return changed ? 1 : 0;
}

// ── Main ───────────────────────────────────────────────────────────────────

let configCount = 0;
let configChanges = 0;
let chebCount = 0;
let chebChanges = 0;

const missions = readdirSync(ASSETS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

for (const mission of missions) {
    const dataDir = join(ASSETS, mission, "data");
    if (!existsSync(dataDir) || !statSync(dataDir).isDirectory()) continue;

    // Annotate config.json5
    const configPath = join(dataDir, "config.json5");
    if (existsSync(configPath)) {
        const n = annotateConfigJson5(configPath);
        configCount++;
        configChanges += n;
        if (n > 0) {
            console.log(`${DRY_RUN ? "[dry-run] " : ""}config: ${mission} (${n} blocks annotated)`);
        }
    }

    // Annotate *-cheb.json files
    const files = readdirSync(dataDir);
    for (const file of files) {
        if (file.endsWith("-cheb.json") && !file.endsWith(".gz")) {
            const chebPath = join(dataDir, file);
            const n = annotateChebJson(chebPath);
            chebCount++;
            chebChanges += n;
            if (n > 0) {
                console.log(`${DRY_RUN ? "[dry-run] " : ""}cheb:   ${mission}/${file}`);
            }
        }
    }
}

console.log();
console.log(`Configs: ${configChanges} of ${configCount} annotated`);
console.log(`Chebyshev: ${chebChanges} of ${chebCount} annotated`);
if (DRY_RUN) {
    console.log("(dry-run mode — no files written)");
} else {
    console.log("Done. Run: npm run configs:compile && npm run configs:check");
}
