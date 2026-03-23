const DEFAULT_STAGE_WEIGHTS = Object.freeze({
    config: 10,
    orbit: 45,
    landing: 15,
    process: 15,
    scene: 15,
});

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
}

function normalizeStageWeights(weights = DEFAULT_STAGE_WEIGHTS) {
    const result = {};
    for (const stage of Object.keys(DEFAULT_STAGE_WEIGHTS)) {
        const value = Number(weights?.[stage]);
        result[stage] = Number.isFinite(value) && value > 0 ? value : 0;
    }
    return result;
}

function createLoadProgressState(options = {}) {
    const includeLanding = options.includeLanding !== false;
    const stageWeights = normalizeStageWeights(options.stageWeights);
    const stageProgress = {
        config: 0,
        orbit: 0,
        landing: includeLanding ? 0 : 1,
        process: 0,
        scene: 0,
    };

    return {
        stageWeights,
        stageProgress,
    };
}

function setLoadProgressStage(state, stage, fraction) {
    if (!state || typeof stage !== "string") return state;
    if (!Object.prototype.hasOwnProperty.call(state.stageProgress, stage)) return state;

    return {
        ...state,
        stageProgress: {
            ...state.stageProgress,
            [stage]: clamp01(fraction),
        },
    };
}

function completeLoadProgressStage(state, stage) {
    return setLoadProgressStage(state, stage, 1);
}

function completeAllLoadProgressStages(state) {
    if (!state) return state;
    let next = state;
    for (const stage of Object.keys(next.stageProgress || {})) {
        next = completeLoadProgressStage(next, stage);
    }
    return next;
}

function computeLoadProgressPercent(state) {
    if (!state) return 0;
    const weights = state.stageWeights || {};
    const progress = state.stageProgress || {};

    let weighted = 0;
    let totalWeight = 0;
    for (const stage of Object.keys(DEFAULT_STAGE_WEIGHTS)) {
        const weight = Number(weights[stage]) || 0;
        totalWeight += weight;
        weighted += weight * clamp01(progress[stage]);
    }

    if (totalWeight <= 0) return 0;
    return (weighted / totalWeight) * 100;
}

export {
    DEFAULT_STAGE_WEIGHTS,
    completeAllLoadProgressStages,
    completeLoadProgressStage,
    computeLoadProgressPercent,
    createLoadProgressState,
    setLoadProgressStage,
};
