function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function percentile(values, ratio = 0.5) {
    if (!Array.isArray(values) || values.length === 0) {
        return 0;
    }
    const sorted = values
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);
    if (sorted.length === 0) {
        return 0;
    }
    const normalizedRatio = clamp(Number(ratio) || 0.5, 0, 1);
    const index = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil((sorted.length - 1) * normalizedRatio)),
    );
    return sorted[index];
}

function sampleSegmentPoints(start, end, sampleStepPx) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt((dx * dx) + (dy * dy));
    if (!Number.isFinite(length) || length <= 0) {
        return [start];
    }

    const steps = Math.max(1, Math.ceil(length / Math.max(1, sampleStepPx)));
    const points = [];
    for (let index = 0; index <= steps; index++) {
        const t = index / steps;
        points.push({
            x: start.x + (dx * t),
            y: start.y + (dy * t),
        });
    }
    return points;
}

function keyForCell(x, y, gridSizePx) {
    const gx = Math.floor(x / gridSizePx);
    const gy = Math.floor(y / gridSizePx);
    return `${gx},${gy}`;
}

function collectDensityMap(chunksByBodyId, options = {}) {
    const gridSizePx = Math.max(2, Number(options.gridSizePx) || 6);
    const sampleStepPx = Math.max(1, Number(options.sampleStepPx) || 3);
    const density = new Map();

    for (const chunks of Object.values(chunksByBodyId || {})) {
        for (const chunk of chunks || []) {
            if (!Array.isArray(chunk) || chunk.length < 2) continue;
            for (let i = 1; i < chunk.length; i++) {
                const start = chunk[i - 1];
                const end = chunk[i];
                if (!start || !end) continue;
                const samples = sampleSegmentPoints(start, end, sampleStepPx);
                for (const sample of samples) {
                    const key = keyForCell(sample.x, sample.y, gridSizePx);
                    density.set(key, (density.get(key) || 0) + 1);
                }
            }
        }
    }

    return {
        density,
        gridSizePx,
        sampleStepPx,
    };
}

function computeChunkDensity(chunk, densityState, options = {}) {
    if (!Array.isArray(chunk) || chunk.length < 2) {
        return 0;
    }
    const { density, gridSizePx, sampleStepPx } = densityState;
    const sampleDensities = [];

    for (let i = 1; i < chunk.length; i++) {
        const start = chunk[i - 1];
        const end = chunk[i];
        if (!start || !end) continue;
        const samples = sampleSegmentPoints(start, end, sampleStepPx);
        for (const sample of samples) {
            const key = keyForCell(sample.x, sample.y, gridSizePx);
            sampleDensities.push(density.get(key) || 0);
        }
    }

    if (sampleDensities.length === 0) {
        return 0;
    }

    const percentileRatio = clamp(
        Number(options.chunkDensityPercentile),
        0.5,
        1,
    ) || 0.82;
    return percentile(sampleDensities, percentileRatio);
}

function densityToFactor(value, normalizationDensity, options = {}) {
    const minFactor = clamp(
        Number(options.minFactor),
        0.05,
        1,
    ) || 0.18;
    const maxFactor = clamp(
        Number(options.maxFactor),
        minFactor,
        1,
    ) || 1;

    if (
        !Number.isFinite(value) ||
        value <= 0 ||
        !Number.isFinite(normalizationDensity) ||
        normalizationDensity <= 0
    ) {
        return maxFactor;
    }

    const normalized = clamp(value / normalizationDensity, 0, 1);
    const exponent = clamp(Number(options.densityExponent), 0.5, 3) || 1.35;
    const eased = Math.pow(normalized, exponent);
    return maxFactor - (eased * (maxFactor - minFactor));
}

function computeOrbitOverlapOpacities(chunksByBodyId, options = {}) {
    const densityState = collectDensityMap(chunksByBodyId, options);
    const chunkDensitiesByBodyId = {};
    const allChunkDensities = [];

    for (const [bodyId, chunks] of Object.entries(chunksByBodyId || {})) {
        const densities = (chunks || []).map((chunk) =>
            computeChunkDensity(chunk, densityState, options),
        );
        chunkDensitiesByBodyId[bodyId] = densities;
        for (const density of densities) {
            if (Number.isFinite(density)) {
                allChunkDensities.push(density);
            }
        }
    }

    const normalizationDensity = percentile(
        allChunkDensities,
        clamp(Number(options.normalizationPercentile), 0.7, 1) || 0.94,
    ) || 0;

    const opacitiesByBodyId = {};
    for (const [bodyId, densities] of Object.entries(chunkDensitiesByBodyId)) {
        opacitiesByBodyId[bodyId] = densities.map((density) =>
            densityToFactor(density, normalizationDensity, options),
        );
    }

    return {
        opacitiesByBodyId,
        maxDensity: normalizationDensity,
    };
}

export {
    collectDensityMap,
    computeOrbitOverlapOpacities,
};
