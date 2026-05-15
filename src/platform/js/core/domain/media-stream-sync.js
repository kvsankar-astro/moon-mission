function clampPlaybackRate(value) {
    if (!Number.isFinite(value)) return 1;
    return Math.max(0.5, Math.min(2.0, value));
}

function resolveTargetPlaybackTimeSeconds(stream, missionTimeMs) {
    const streamStartMs = Number(stream?.startTimeMs);
    const missionMs = Number(missionTimeMs);
    if (!Number.isFinite(streamStartMs) || !Number.isFinite(missionMs)) {
        return Number.NaN;
    }

    const timeOffsetSeconds = Number(stream?.timeOffsetSeconds);
    const rawSeconds = ((missionMs - streamStartMs) / 1000)
        + (Number.isFinite(timeOffsetSeconds) ? timeOffsetSeconds : 0);
    const durationSeconds = Number(stream?.durationSeconds);
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return Math.max(0, Math.min(durationSeconds, rawSeconds));
    }
    return Math.max(0, rawSeconds);
}

function buildMediaStreamSyncPlan({
    stream,
    missionTimeMs,
    isMissionPlaying,
    currentPlaybackTimeSeconds,
    hardSeekThresholdSeconds = 2.0,
    softCorrectionThresholdSeconds = 0.35,
} = {}) {
    if (!stream || stream.enabled === false) {
        return {
            mode: "inactive",
            shouldPlay: false,
            targetPlaybackTimeSeconds: Number.NaN,
            playbackRate: 1,
            inRange: false,
        };
    }

    const streamStartMs = Number(stream.startTimeMs);
    const streamEndMs = Number(stream.endTimeMs);
    const inRange = Number.isFinite(missionTimeMs) &&
        Number.isFinite(streamStartMs) &&
        missionTimeMs >= streamStartMs &&
        (!Number.isFinite(streamEndMs) || missionTimeMs <= streamEndMs);

    if (!inRange) {
        return {
            mode: "out-of-range",
            shouldPlay: false,
            targetPlaybackTimeSeconds: Number.NaN,
            playbackRate: 1,
            inRange: false,
        };
    }

    const targetPlaybackTimeSeconds = resolveTargetPlaybackTimeSeconds(stream, missionTimeMs);
    const currentTime = Number(currentPlaybackTimeSeconds);
    const driftSeconds = Number.isFinite(currentTime)
        ? targetPlaybackTimeSeconds - currentTime
        : Number.NaN;

    if (!Number.isFinite(currentTime) || Math.abs(driftSeconds) >= hardSeekThresholdSeconds) {
        return {
            mode: "hard-seek",
            shouldPlay: isMissionPlaying === true,
            targetPlaybackTimeSeconds,
            playbackRate: 1,
            inRange: true,
            driftSeconds,
        };
    }

    if (!Number.isFinite(driftSeconds) || Math.abs(driftSeconds) < softCorrectionThresholdSeconds) {
        return {
            mode: isMissionPlaying === true ? "play" : "pause",
            shouldPlay: isMissionPlaying === true,
            targetPlaybackTimeSeconds,
            playbackRate: 1,
            inRange: true,
            driftSeconds,
        };
    }

    const playbackRate = clampPlaybackRate(1 + (driftSeconds * 0.08));
    return {
        mode: "soft-correct",
        shouldPlay: isMissionPlaying === true,
        targetPlaybackTimeSeconds,
        playbackRate,
        inRange: true,
        driftSeconds,
    };
}

export {
    buildMediaStreamSyncPlan,
    resolveTargetPlaybackTimeSeconds,
};
