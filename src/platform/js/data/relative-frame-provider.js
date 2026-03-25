import {
    evaluateChebyshev,
    findSegment,
    normalizeSegmentTime,
} from "../core/domain/ephemeris-core.js";

const JD_UNIX_EPOCH = 2440587.5;
const MS_PER_DAY = 86400000;

function toHorizonsJulianDate(timeMs) {
    if (
        typeof Date !== "undefined" &&
        typeof Date.prototype.getJD_UTC === "function"
    ) {
        return new Date(timeMs).getJD_UTC();
    }
    return JD_UNIX_EPOCH + timeMs / MS_PER_DAY;
}

function normalizeQuaternion(quat) {
    const mag = Math.sqrt(
        quat.w * quat.w +
        quat.x * quat.x +
        quat.y * quat.y +
        quat.z * quat.z,
    );
    if (!Number.isFinite(mag) || mag === 0) {
        return null;
    }
    return {
        w: quat.w / mag,
        x: quat.x / mag,
        y: quat.y / mag,
        z: quat.z / mag,
    };
}

export function getRelativeFrameQuaternion({ chebyshevData, config, timeMs }) {
    const series = chebyshevData?.[config]?.FRAME_ROT;
    if (!series?.segments?.length) {
        return null;
    }

    const jd = toHorizonsJulianDate(timeMs);
    const segment = findSegment(series.segments, jd);
    if (!segment) {
        return null;
    }

    const { tNorm } = normalizeSegmentTime(segment, jd);
    const cw = segment.cw || segment.qw;
    const cx = segment.cx || segment.qx;
    const cy = segment.cy || segment.qy;
    const cz = segment.cz || segment.qz;
    if (!cw || !cx || !cy || !cz) {
        return null;
    }

    return normalizeQuaternion({
        w: evaluateChebyshev(cw, tNorm),
        x: evaluateChebyshev(cx, tNorm),
        y: evaluateChebyshev(cy, tNorm),
        z: evaluateChebyshev(cz, tNorm),
    });
}

