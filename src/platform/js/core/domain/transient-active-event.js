function resolveEventTimeMs(event) {
    if (!event) return Number.NaN;
    const raw = event.startTime;
    if (raw instanceof Date) {
        return raw.getTime();
    }
    if (Number.isFinite(raw)) {
        return raw;
    }
    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isDisplayableTimelineEvent(event) {
    if (!event) return false;
    if (event.clickable === false) return false;

    const hasEventText = Boolean(
        (typeof event.infoText === "string" && event.infoText.trim()) ||
        (typeof event.label === "string" && event.label.trim()) ||
        (typeof event.key === "string" && event.key.trim()),
    );
    return hasEventText;
}

function findCrossedDisplayableEvent({ previousTimeMs, currentTimeMs, eventInfos }) {
    if (!Number.isFinite(previousTimeMs) || !Number.isFinite(currentTimeMs)) {
        return null;
    }
    if (previousTimeMs === currentTimeMs) {
        return null;
    }

    const forward = currentTimeMs > previousTimeMs;
    let candidateEvent = null;
    let candidateTime = forward ? -Infinity : Infinity;

    for (const event of eventInfos || []) {
        if (!isDisplayableTimelineEvent(event)) continue;
        const eventTimeMs = resolveEventTimeMs(event);
        if (!Number.isFinite(eventTimeMs)) continue;

        const crossed = forward
            ? (eventTimeMs > previousTimeMs && eventTimeMs <= currentTimeMs)
            : (eventTimeMs < previousTimeMs && eventTimeMs >= currentTimeMs);
        if (!crossed) continue;

        if (forward ? eventTimeMs > candidateTime : eventTimeMs < candidateTime) {
            candidateTime = eventTimeMs;
            candidateEvent = event;
        }
    }

    return candidateEvent;
}

function findWindowedDisplayableEvent({
    currentTimeMs,
    eventInfos,
    eventDisplayWindowMs,
}) {
    if (!Number.isFinite(currentTimeMs)) {
        return null;
    }

    let candidateEvent = null;
    let candidateTime = -Infinity;

    for (const event of eventInfos || []) {
        if (!isDisplayableTimelineEvent(event)) continue;
        const eventTimeMs = resolveEventTimeMs(event);
        if (!Number.isFinite(eventTimeMs)) continue;

        const elapsed = currentTimeMs - eventTimeMs;
        if (elapsed < 0 || elapsed >= eventDisplayWindowMs) continue;

        if (eventTimeMs > candidateTime) {
            candidateTime = eventTimeMs;
            candidateEvent = event;
        }
    }

    return candidateEvent;
}

function planTransientActiveEvent({
    animTime,
    previousTimeMs,
    eventInfos,
    currentLatch = null,
    nowWallTimeMs,
    eventDisplayWindowMs = 2000,
    eventDisplayMinStableUiMs = 2000,
}) {
    const inWindowEvent = findWindowedDisplayableEvent({
        currentTimeMs: animTime,
        eventInfos,
        eventDisplayWindowMs,
    });
    const crossedEvent = findCrossedDisplayableEvent({
        previousTimeMs,
        currentTimeMs: animTime,
        eventInfos,
    });
    const nextActiveEvent = inWindowEvent || crossedEvent;

    let nextLatch = currentLatch;
    if (nextActiveEvent) {
        const eventTimeMs = resolveEventTimeMs(nextActiveEvent);
        nextLatch = {
            event: nextActiveEvent,
            eventTimeMs: Number.isFinite(eventTimeMs) ? eventTimeMs : animTime,
            shownAtWallTimeMs: nowWallTimeMs,
        };
    }

    let activeEvent = null;
    if (nextLatch) {
        const elapsedAnimMs = Math.abs(animTime - nextLatch.eventTimeMs);
        const elapsedWallMs = nowWallTimeMs - nextLatch.shownAtWallTimeMs;
        const withinAnimationWindow = elapsedAnimMs < eventDisplayWindowMs;
        const withinStableUiWindow = elapsedWallMs < eventDisplayMinStableUiMs;

        if (withinAnimationWindow || withinStableUiWindow) {
            activeEvent = {
                ...nextLatch.event,
                _shownAtWallTimeMs: nextLatch.shownAtWallTimeMs,
            };
        } else {
            nextLatch = null;
        }
    }

    return {
        activeEvent,
        nextLatch,
        nextPreviousTimeMs: animTime,
    };
}

export { planTransientActiveEvent };
