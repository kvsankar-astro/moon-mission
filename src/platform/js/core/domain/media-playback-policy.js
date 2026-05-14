function isPlayableMediaKind(kind) {
    return kind === "audioClip" || kind === "videoClip";
}

function hasBackgroundPlaybackRole(item) {
    if (!item) return false;
    const roles = Array.isArray(item.playbackRoles) ? item.playbackRoles : [];
    return roles.includes("background") || item.backgroundPlayback?.enabled === true;
}

function isBackgroundPlaybackMediaItem(item) {
    if (!item || item.kind !== "videoClip" || item.enabled === false) return false;
    return hasBackgroundPlaybackRole(item);
}

function isForegroundPlayableMediaItem(item) {
    if (!item || !isPlayableMediaKind(item.kind) || item.enabled === false) return false;
    if (!item.assetUrl) return false;
    return !isBackgroundPlaybackMediaItem(item);
}

function resolvePlayableDurationSeconds(item, fallbackDurationSeconds = Number.NaN) {
    const durationSeconds = Number(item?.durationSeconds);
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return durationSeconds;
    }
    const fallbackSeconds = Number(fallbackDurationSeconds);
    return Number.isFinite(fallbackSeconds) && fallbackSeconds > 0 ? fallbackSeconds : Number.NaN;
}

function clampMediaCurrentTimeSeconds(item, currentTimeSeconds, fallbackDurationSeconds = Number.NaN) {
    const nextTime = Number(currentTimeSeconds);
    if (!Number.isFinite(nextTime) || nextTime < 0) return 0;
    const durationSeconds = resolvePlayableDurationSeconds(item, fallbackDurationSeconds);
    if (Number.isFinite(durationSeconds)) {
        return Math.min(nextTime, durationSeconds);
    }
    return nextTime;
}

function resolveMediaItemEndTimeMs(item, {
    fallbackDurationSeconds = Number.NaN,
} = {}) {
    const startTimeMs = Number(item?.startTimeMs);
    if (!item || !Number.isFinite(startTimeMs)) {
        return Number.NaN;
    }
    const explicitEndTimeMs = Number(item.endTimeMs);
    if (Number.isFinite(explicitEndTimeMs) && explicitEndTimeMs > startTimeMs) {
        return explicitEndTimeMs;
    }
    const durationSeconds = resolvePlayableDurationSeconds(item, fallbackDurationSeconds);
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return startTimeMs + (durationSeconds * 1000);
    }
    return Number.NaN;
}

function isMediaItemActiveAtTime(item, timeMs, {
    fallbackDurationSeconds = Number.NaN,
} = {}) {
    const startTimeMs = Number(item?.startTimeMs);
    const missionTimeMs = Number(timeMs);
    if (!item || !Number.isFinite(startTimeMs) || !Number.isFinite(missionTimeMs)) {
        return false;
    }
    const endTimeMs = resolveMediaItemEndTimeMs(item, { fallbackDurationSeconds });
    if (Number.isFinite(endTimeMs) && endTimeMs >= startTimeMs) {
        return missionTimeMs >= startTimeMs && missionTimeMs <= endTimeMs;
    }
    return missionTimeMs === startTimeMs;
}

function shouldPreserveMissionTimeForPlayableSelection(item, missionTimeMs, {
    fallbackDurationSeconds = Number.NaN,
} = {}) {
    if (!isForegroundPlayableMediaItem(item)) return false;
    const startTimeMs = Number(item.startTimeMs);
    const currentTimeMs = Number(missionTimeMs);
    if (!Number.isFinite(startTimeMs) || !Number.isFinite(currentTimeMs) || currentTimeMs < startTimeMs) {
        return false;
    }
    const endTimeMs = resolveMediaItemEndTimeMs(item, { fallbackDurationSeconds });
    if (Number.isFinite(endTimeMs) && endTimeMs >= startTimeMs) {
        return currentTimeMs <= endTimeMs;
    }
    return true;
}

function planMissionMediaSelectionSync({
    item,
    currentMissionTimeMs = Number.NaN,
    seekTimeline = true,
    preserveCurrentPlayableOffset = false,
    autoStartPlayable = false,
    frameScrubMode = false,
    fallbackDurationSeconds = Number.NaN,
} = {}) {
    if (!item) {
        return {
            canApply: false,
        };
    }
    const playable = isForegroundPlayableMediaItem(item);
    const shouldPreserveCurrentMissionTime = preserveCurrentPlayableOffset
        && seekTimeline === true
        && frameScrubMode !== true
        && shouldPreserveMissionTimeForPlayableSelection(item, currentMissionTimeMs, { fallbackDurationSeconds });
    return {
        canApply: true,
        itemId: item.id,
        playable,
        shouldSeekTimeline: seekTimeline === true,
        targetTimeMs: shouldPreserveCurrentMissionTime
            ? currentMissionTimeMs
            : Number(item.startTimeMs),
        shouldStopExistingPlayable: autoStartPlayable !== true || playable !== true,
        shouldStartPlayable: autoStartPlayable === true && playable === true,
        keepAnimationRunning: autoStartPlayable === true,
    };
}

function buildForegroundMediaPlaybackState({
    playbackState = {},
    animationRunning = false,
    frameScrubMode = false,
    item = null,
} = {}) {
    const kind = String(playbackState.kind || "").trim();
    const activeKind = kind === "audioClip" || kind === "videoClip";
    const mediaBusy = playbackState.playing === true || playbackState.buffering === true;
    const activeVideoPreview = kind === "videoClip"
        && playbackState.active === true
        && animationRunning === true
        && frameScrubMode === true
        && isForegroundPlayableMediaItem(item);
    return {
        active: activeKind && (mediaBusy || activeVideoPreview),
        itemId: playbackState.itemId || "",
        kind,
        playing: playbackState.playing === true,
        buffering: playbackState.buffering === true,
        previewing: activeVideoPreview && mediaBusy !== true,
    };
}

export {
    buildForegroundMediaPlaybackState,
    clampMediaCurrentTimeSeconds,
    hasBackgroundPlaybackRole,
    isBackgroundPlaybackMediaItem,
    isForegroundPlayableMediaItem,
    isMediaItemActiveAtTime,
    isPlayableMediaKind,
    planMissionMediaSelectionSync,
    resolveMediaItemEndTimeMs,
    resolvePlayableDurationSeconds,
    shouldPreserveMissionTimeForPlayableSelection,
};
