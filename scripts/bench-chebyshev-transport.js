#!/usr/bin/env node
/**
 * Compare Chebyshev transport encodings:
 * - JSON
 * - JSON + gzip
 * - JSON + brotli
 * - Flat binary (F64/F32) + optional gzip/brotli
 *
 * Usage:
 *   node scripts/bench-chebyshev-transport.js
 *   node scripts/bench-chebyshev-transport.js --files assets/chandrayaan3/data/geo-CY3-cheb.json
 */

import fs from "fs";
import path from "path";
import process from "process";
import { gzipSync, gunzipSync, brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from "zlib";

const MAGIC = 0x43484542; // "CHEB"
const VERSION = 1;

function parseArgs(argv) {
    const files = [];
    let rounds = 80;
    let warmup = 10;

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === "--files") {
            const next = argv[++i];
            if (next) {
                next.split(",").map((v) => v.trim()).filter(Boolean).forEach((v) => files.push(v));
            }
        } else if (token === "--rounds") {
            rounds = Number(argv[++i] ?? rounds);
        } else if (token === "--warmup") {
            warmup = Number(argv[++i] ?? warmup);
        }
    }

    if (files.length === 0) {
        files.push(
            "assets/chandrayaan3/data/geo-CY3-cheb.json",
            "assets/chandrayaan3/data/lunar-CY3-cheb.json",
        );
    }

    return { files, rounds, warmup };
}

function toProjectPath(relativePath) {
    return path.resolve(process.cwd(), relativePath);
}

function loadChebJson(filePath) {
    const abs = toProjectPath(filePath);
    const text = fs.readFileSync(abs, "utf8");
    const data = JSON.parse(text);
    return { abs, text, data };
}

function encodeFlat(data, useFloat32 = false) {
    const segments = Array.isArray(data?.segments) ? data.segments : [];
    const bytesPerValue = useFloat32 ? 4 : 8;
    const headerBytes = 4 + 2 + 2 + 4 + 8 + 8;
    let totalBytes = headerBytes;

    for (const seg of segments) {
        const degree = Math.max(seg?.cx?.length ?? 0, seg?.cy?.length ?? 0, seg?.cz?.length ?? 0);
        totalBytes += 8 + 8 + 2 + 2 + degree * 3 * bytesPerValue;
    }

    const buffer = new ArrayBuffer(totalBytes);
    const view = new DataView(buffer);
    let offset = 0;

    view.setUint32(offset, MAGIC, true);
    offset += 4;
    view.setUint16(offset, VERSION, true);
    offset += 2;
    view.setUint16(offset, useFloat32 ? 32 : 64, true);
    offset += 2;
    view.setUint32(offset, segments.length, true);
    offset += 4;
    view.setFloat64(offset, Number(data?.time_range?.start ?? 0), true);
    offset += 8;
    view.setFloat64(offset, Number(data?.time_range?.end ?? 0), true);
    offset += 8;

    for (const seg of segments) {
        const cx = Array.isArray(seg?.cx) ? seg.cx : [];
        const cy = Array.isArray(seg?.cy) ? seg.cy : [];
        const cz = Array.isArray(seg?.cz) ? seg.cz : [];
        const degree = Math.max(cx.length, cy.length, cz.length);

        view.setFloat64(offset, Number(seg?.t_start ?? 0), true);
        offset += 8;
        view.setFloat64(offset, Number(seg?.t_end ?? 0), true);
        offset += 8;
        view.setUint16(offset, degree, true);
        offset += 2;
        view.setUint16(offset, 0, true);
        offset += 2;

        for (let axis = 0; axis < 3; axis += 1) {
            const src = axis === 0 ? cx : axis === 1 ? cy : cz;
            for (let i = 0; i < degree; i += 1) {
                const value = Number(src[i] ?? 0);
                if (useFloat32) {
                    view.setFloat32(offset, value, true);
                    offset += 4;
                } else {
                    view.setFloat64(offset, value, true);
                    offset += 8;
                }
            }
        }
    }

    return Buffer.from(buffer);
}

function decodeFlatChecksum(buffer) {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let offset = 0;

    const magic = view.getUint32(offset, true);
    offset += 4;
    if (magic !== MAGIC) throw new Error("Invalid flat payload magic");

    const version = view.getUint16(offset, true);
    offset += 2;
    if (version !== VERSION) throw new Error("Unsupported flat payload version");

    const precision = view.getUint16(offset, true);
    offset += 2;
    const isFloat32 = precision === 32;
    if (!isFloat32 && precision !== 64) throw new Error("Unsupported flat payload precision");

    const segmentCount = view.getUint32(offset, true);
    offset += 4;
    const start = view.getFloat64(offset, true);
    offset += 8;
    const end = view.getFloat64(offset, true);
    offset += 8;

    let checksum = start + end + segmentCount;

    for (let seg = 0; seg < segmentCount; seg += 1) {
        checksum += view.getFloat64(offset, true);
        offset += 8;
        checksum += view.getFloat64(offset, true);
        offset += 8;

        const degree = view.getUint16(offset, true);
        offset += 2;
        offset += 2;

        const coeffCount = degree * 3;
        for (let i = 0; i < coeffCount; i += 1) {
            if (isFloat32) {
                checksum += view.getFloat32(offset, true);
                offset += 4;
            } else {
                checksum += view.getFloat64(offset, true);
                offset += 8;
            }
        }
    }

    return checksum;
}

function checksumJsonData(data) {
    const segments = Array.isArray(data?.segments) ? data.segments : [];
    let checksum = Number(data?.time_range?.start ?? 0) + Number(data?.time_range?.end ?? 0) + segments.length;
    for (let i = 0; i < segments.length; i += 1) {
        const seg = segments[i];
        checksum += Number(seg?.t_start ?? 0) + Number(seg?.t_end ?? 0);
        const coeffs = [seg?.cx, seg?.cy, seg?.cz];
        for (let axis = 0; axis < coeffs.length; axis += 1) {
            const arr = Array.isArray(coeffs[axis]) ? coeffs[axis] : [];
            for (let j = 0; j < arr.length; j += 1) {
                checksum += Number(arr[j] ?? 0);
            }
        }
    }
    return checksum;
}

function timeMs(fn, rounds, warmup) {
    for (let i = 0; i < warmup; i += 1) fn();
    const start = process.hrtime.bigint();
    let guard = 0;
    for (let i = 0; i < rounds; i += 1) {
        guard += Number(fn()) || 0;
    }
    const elapsedNs = Number(process.hrtime.bigint() - start);
    const meanMs = (elapsedNs / rounds) / 1e6;
    return { meanMs, guard };
}

function formatBytes(bytes) {
    return `${bytes} B`;
}

function runCase(filePath, rounds, warmup) {
    const { abs, text, data } = loadChebJson(filePath);
    const jsonBytes = Buffer.from(text, "utf8");
    const gzipJson = gzipSync(jsonBytes, { level: 9, mtime: 0 });
    const brotliJson = brotliCompressSync(jsonBytes, {
        params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        },
    });
    const flat64 = encodeFlat(data, false);
    const flat32 = encodeFlat(data, true);
    const gzipFlat64 = gzipSync(flat64, { level: 9, mtime: 0 });
    const brotliFlat64 = brotliCompressSync(flat64, {
        params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        },
    });
    const gzipFlat32 = gzipSync(flat32, { level: 9, mtime: 0 });
    const brotliFlat32 = brotliCompressSync(flat32, {
        params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        },
    });

    const sizes = {
        json: jsonBytes.length,
        json_gzip: gzipJson.length,
        json_brotli: brotliJson.length,
        flat64: flat64.length,
        flat64_gzip: gzipFlat64.length,
        flat64_brotli: brotliFlat64.length,
        flat32: flat32.length,
        flat32_gzip: gzipFlat32.length,
        flat32_brotli: brotliFlat32.length,
    };

    const timings = {
        json_parse: timeMs(() => checksumJsonData(JSON.parse(text)), rounds, warmup).meanMs,
        gzip_json_parse: timeMs(() => checksumJsonData(JSON.parse(gunzipSync(gzipJson).toString("utf8"))), rounds, warmup).meanMs,
        brotli_json_parse: timeMs(
            () => checksumJsonData(JSON.parse(brotliDecompressSync(brotliJson).toString("utf8"))),
            rounds,
            warmup,
        ).meanMs,
        flat64_decode: timeMs(() => decodeFlatChecksum(flat64), rounds, warmup).meanMs,
        gzip_flat64_decode: timeMs(() => decodeFlatChecksum(gunzipSync(gzipFlat64)), rounds, warmup).meanMs,
        flat32_decode: timeMs(() => decodeFlatChecksum(flat32), rounds, warmup).meanMs,
        gzip_flat32_decode: timeMs(() => decodeFlatChecksum(gunzipSync(gzipFlat32)), rounds, warmup).meanMs,
    };

    return { abs, sizes, timings };
}

function printSizeTable(sizes) {
    const base = sizes.json;
    const rows = [
        ["JSON", sizes.json],
        ["JSON + gzip", sizes.json_gzip],
        ["JSON + brotli", sizes.json_brotli],
        ["Flat F64", sizes.flat64],
        ["Flat F64 + gzip", sizes.flat64_gzip],
        ["Flat F64 + brotli", sizes.flat64_brotli],
        ["Flat F32", sizes.flat32],
        ["Flat F32 + gzip", sizes.flat32_gzip],
        ["Flat F32 + brotli", sizes.flat32_brotli],
    ];

    console.log("| Encoding | Size | Delta vs JSON |");
    console.log("|---|---:|---:|");
    for (const [label, value] of rows) {
        const delta = base ? ((value - base) / base) * 100 : 0;
        console.log(`| ${label} | ${formatBytes(value)} | ${delta.toFixed(1)}% |`);
    }
}

function printTimingTable(timings) {
    const rows = [
        ["JSON parse", timings.json_parse],
        ["gzip -> JSON parse", timings.gzip_json_parse],
        ["brotli -> JSON parse", timings.brotli_json_parse],
        ["Flat F64 decode", timings.flat64_decode],
        ["gzip -> Flat F64 decode", timings.gzip_flat64_decode],
        ["Flat F32 decode", timings.flat32_decode],
        ["gzip -> Flat F32 decode", timings.gzip_flat32_decode],
    ];

    console.log("| Decode Path | Mean (ms) |");
    console.log("|---|---:|");
    for (const [label, value] of rows) {
        console.log(`| ${label} | ${value.toFixed(3)} |`);
    }
}

function main() {
    const { files, rounds, warmup } = parseArgs(process.argv.slice(2));
    console.log(`# Chebyshev Transport Benchmark`);
    console.log(`rounds=${rounds}, warmup=${warmup}`);
    console.log("");

    for (const filePath of files) {
        const result = runCase(filePath, rounds, warmup);
        console.log(`## ${result.abs}`);
        console.log("");
        printSizeTable(result.sizes);
        console.log("");
        printTimingTable(result.timings);
        console.log("");
    }
}

main();
