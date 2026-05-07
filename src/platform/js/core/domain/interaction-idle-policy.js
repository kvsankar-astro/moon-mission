function resolveInputIdleMs({
    nowMs,
    lastInputActivityMs,
} = {}) {
    const numericNowMs = Number(nowMs);
    const numericLastInputActivityMs = Number(lastInputActivityMs);
    if (!Number.isFinite(numericNowMs) || !Number.isFinite(numericLastInputActivityMs)) {
        return Infinity;
    }
    return Math.max(0, numericNowMs - numericLastInputActivityMs);
}

function shouldDeferForRecentInput({
    nowMs,
    lastInputActivityMs,
    minIdleMs = 0,
} = {}) {
    const numericMinIdleMs = Math.max(0, Number(minIdleMs) || 0);
    return resolveInputIdleMs({ nowMs, lastInputActivityMs }) < numericMinIdleMs;
}

function resolveDelayUntilInputIdle({
    nowMs,
    lastInputActivityMs,
    minIdleMs = 0,
} = {}) {
    const numericMinIdleMs = Math.max(0, Number(minIdleMs) || 0);
    const idleMs = resolveInputIdleMs({ nowMs, lastInputActivityMs });
    if (!Number.isFinite(idleMs)) {
        return 0;
    }
    return Math.max(0, numericMinIdleMs - idleMs);
}

export {
    resolveDelayUntilInputIdle,
    resolveInputIdleMs,
    shouldDeferForRecentInput,
};
