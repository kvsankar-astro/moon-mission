import JSZip from "jszip";
import { TIME_CONSTANTS } from "../core/constants.js";

/**
 * Parse a NumPy .npy header to extract shape and dtype string.
 * Supports v1.0 and v2.0 headers (sufficient for files produced by numpy.savez).
 */
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
    // Expecting formats like: [('jdct', '<f8'), ('x', '<f8'), ...]
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
        // Only float and int types are expected; cast to Float64 for simplicity
        arrays[field.name] = new Float64Array(count);
    }

    for (let i = 0; i < count; i++) {
        const base = i * recordSize;
        for (const field of fields) {
            const offset = base + field.byteOffset;
            const kind = field.kind.toLowerCase();

            let value;
            if (kind === "f") {
                // Float
                if (field.size === 8) {
                    value = view.getFloat64(offset, true);
                } else if (field.size === 4) {
                    value = view.getFloat32(offset, true);
                } else {
                    throw new Error(`Unsupported float size: ${field.size}`);
                }
            } else if (kind === "i" || kind === "u") {
                // Integer
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
        shape,
    };
}

function buildSeries(parsed) {
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

    const start = jd[0];
    const end = jd[count - 1];

    return {
        jd,
        x: arrays.x,
        y: arrays.y,
        z: arrays.z,
        vx: arrays.vx,
        vy: arrays.vy,
        vz: arrays.vz,
        timeRange: { start, end },
    };
}

/**
 * Load a .npz ephemeris file and return body series keyed by body name.
 * Body keys are uppercased (e.g., SC, MOON, EARTH).
 */
export async function loadNpzEphemeris(url) {
    if (!url) throw new Error("loadNpzEphemeris(url) requires a URL");

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch NPZ: ${url} (${response.status})`);
    }

    const buffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const bodies = {};
    const entries = Object.entries(zip.files).filter(([name]) =>
        name.endsWith("_vectors.npy"),
    );

    for (const [name, file] of entries) {
        const base = name.replace(/\.npy$/, "");
        const bodyName = base.replace(/_vectors$/, "").toUpperCase();

        const npyBuffer = await file.async("arraybuffer");
        const parsed = parseStructuredArray(npyBuffer);
        bodies[bodyName] = buildSeries(parsed);
    }

    return bodies;
}

/**
 * Linear interpolation of an ephemeris series at a given Julian Date.
 */
export function getStateFromNpzSeries(series, jd) {
    if (!series || !series.jd || series.jd.length === 0) return null;

    const times = series.jd;
    const n = times.length;

    if (jd < times[0] || jd > times[n - 1]) {
        return null;
    }

    // Binary search for interval
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (times[mid] === jd) {
            lo = hi = mid;
            break;
        }
        if (times[mid] < jd) {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    const t0 = times[lo];
    const t1 = times[hi];
    const span = t1 - t0 || 1;
    const alpha = Math.min(Math.max((jd - t0) / span, 0), 1);

    const lerp = (arr) => arr[lo] + alpha * (arr[hi] - arr[lo]);

    return {
        pos: {
            x: lerp(series.x),
            y: lerp(series.y),
            z: lerp(series.z),
        },
        vel: {
            vx: lerp(series.vx),
            vy: lerp(series.vy),
            vz: lerp(series.vz),
        },
    };
}

/**
 * Generate a time-sampled curve from an NPZ series.
 */
export function generateCurveFromNpz(series, startTimeMs, endTimeMs, stepMs) {
    if (!series) return [];
    const out = [];
    const step = Math.max(1, stepMs);
    const sampleStateAtTime = (t) => {
        // NPZ data stores JD in TDB (HORIZONS JDCT), same as Chebyshev.
        const { TDB_OFFSET_MS } = TIME_CONSTANTS;
        const jd =
            typeof new Date(t).getJD_TDB === "function"
                ? new Date(t).getJD_TDB()
                : 2440587.5 + (t + TDB_OFFSET_MS) / 86400000;
        const state = getStateFromNpzSeries(series, jd);
        if (state) {
            out.push({
                timeMs: t,
                x: state.pos.x,
                y: state.pos.y,
                z: state.pos.z,
                vx: state.vel.vx,
                vy: state.vel.vy,
                vz: state.vel.vz,
            });
        }
    };

    for (let t = startTimeMs; t <= endTimeMs; t += step) {
        sampleStateAtTime(t);
    }

    const lastTimeMs = out.length ? out[out.length - 1].timeMs : Number.NaN;
    if (Number.isFinite(endTimeMs) && Math.abs(lastTimeMs - endTimeMs) > 1e-3) {
        sampleStateAtTime(endTimeMs);
    }
    return out;
}
