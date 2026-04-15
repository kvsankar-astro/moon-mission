import { planFrameStep } from "../core/plans/frame-plan.js";

function createSceneFrameOrchestrationActions(deps) {
    const {
        getConfig,
        isOrbitDataProcessed,
        getAnimTime,
        computeSunLongitude,
        computeSceneState,
        getChebyshevData,
        getChebyshevDataLoaded,
        getNpzData,
        getNpzDataLoaded,
        getLandingNpzData,
        getLandingNpzLoaded,
        getLandingChebyshevData,
        getLandingChebyshevLoaded,
        getGlobalConfig,
        getStartLandingTime,
        getEndLandingTime,
        getEventInfos,
        getMissionTimes,
        getAnimationScene,
        getFrameMode,
        getBodySources,
        getActiveEphemerisSource,
        setSunLongitude,
        getCraftId,
        getPixelsPerAU,
        updateCraftScale,
        getCurrentDimension,
        frameRenderer,
        frameUiUpdater,
        render,
    } = deps;
    const EVENT_DISPLAY_WINDOW_MS = 2000;
    const EVENT_DISPLAY_MIN_STABLE_UI_MS = 2000;
    let lastFrameAnimTimeByConfig = new Map();
    let activeEventLatchByConfig = new Map();

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

    function findCrossedBurnEvent({ previousTimeMs, currentTimeMs, eventInfos, globalConfig }) {
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

    function findWindowedBurnEvent({ currentTimeMs, eventInfos, globalConfig }) {
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
            if (elapsed < 0 || elapsed >= EVENT_DISPLAY_WINDOW_MS) continue;

            if (eventTimeMs > candidateTime) {
                candidateTime = eventTimeMs;
                candidateEvent = event;
            }
        }

        return candidateEvent;
    }

    function resolveTransientActiveEvent({ config, animTime, eventInfos, globalConfig }) {
        const nowWallTimeMs = Date.now();
        const inWindowEvent = findWindowedBurnEvent({
            currentTimeMs: animTime,
            eventInfos,
            globalConfig,
        });

        const previousTimeMs = lastFrameAnimTimeByConfig.get(config);
        const crossedEvent = findCrossedBurnEvent({
            previousTimeMs,
            currentTimeMs: animTime,
            eventInfos,
            globalConfig,
        });
        const nextActiveEvent = inWindowEvent || crossedEvent;

        if (nextActiveEvent) {
            const eventTimeMs = resolveEventTimeMs(nextActiveEvent);
            activeEventLatchByConfig.set(config, {
                event: nextActiveEvent,
                eventTimeMs: Number.isFinite(eventTimeMs) ? eventTimeMs : animTime,
                shownAtWallTimeMs: nowWallTimeMs,
            });
        }

        let activeEvent = null;
        const latchedEvent = activeEventLatchByConfig.get(config);
        if (latchedEvent) {
            const elapsedAnimMs = Math.abs(animTime - latchedEvent.eventTimeMs);
            const elapsedWallMs = nowWallTimeMs - latchedEvent.shownAtWallTimeMs;
            const withinAnimationWindow = elapsedAnimMs < EVENT_DISPLAY_WINDOW_MS;
            const withinStableUiWindow = elapsedWallMs < EVENT_DISPLAY_MIN_STABLE_UI_MS;

            if (withinAnimationWindow || withinStableUiWindow) {
                activeEvent = {
                    ...latchedEvent.event,
                    _shownAtWallTimeMs: latchedEvent.shownAtWallTimeMs,
                };
            } else {
                activeEventLatchByConfig.delete(config);
            }
        }

        lastFrameAnimTimeByConfig.set(config, animTime);
        return activeEvent;
    }

    function setLocation() {
        const config = getConfig();
        if (!isOrbitDataProcessed(config)) {
            return;
        }

        const animTime = getAnimTime();
        const scene = getAnimationScene(config);
        if (!scene) {
            return;
        }

        const npzData = getNpzData();
        const npzDataLoaded = getNpzDataLoaded();
        const chebyshevData = getChebyshevData();
        const chebyshevDataLoaded = getChebyshevDataLoaded();
        const bodySources = getBodySources();
        const activeEphemerisSource = getActiveEphemerisSource(config);
        const globalConfig = getGlobalConfig();
        const computeSunLongitudeForFrame = (timeMs) =>
            computeSunLongitude(timeMs, {
                config,
                chebyshevData,
                chebyshevDataLoaded,
                npzData,
                npzDataLoaded,
                bodySources,
                defaultSpacecraftSource: activeEphemerisSource,
                spacecraftMnemonic: globalConfig?.spacecraft_mnemonic || "SC",
            });

        const activeSceneCraftId =
            scene?.activeCraftId ||
            scene?.primaryCraftId ||
            getCraftId();

        const eventInfos = getEventInfos();
        const framePlan = planFrameStep({
            config,
            animTime,
            scene,
            computeSunLongitude: computeSunLongitudeForFrame,
            computeSceneState,
            chebyshevData,
            chebyshevDataLoaded,
            npzData,
            npzDataLoaded,
            landingNpzData: getLandingNpzData(config),
            landingNpzLoaded: getLandingNpzLoaded(config),
            landingChebyshevData: getLandingChebyshevData(config),
            landingChebyshevLoaded: getLandingChebyshevLoaded(config),
            globalConfig,
            startLandingTime: getStartLandingTime(),
            endLandingTime: getEndLandingTime(),
            eventInfos,
            missionTimes: getMissionTimes(),
            frameMode: getFrameMode(),
            bodySources,
            ephemerisSource: activeEphemerisSource,
            craftId: activeSceneCraftId,
            pixelsPerAU: getPixelsPerAU(),
            updateCraftScale,
            currentDimension: getCurrentDimension(),
        });

        if (!framePlan.shouldRun) {
            return;
        }

        const transientActiveEvent = resolveTransientActiveEvent({
            config,
            animTime,
            eventInfos,
            globalConfig,
        });
        if (framePlan.renderIntent?.sceneState) {
            framePlan.renderIntent.sceneState.activeEvent = transientActiveEvent;
        }
        if (framePlan.uiIntent?.sceneState) {
            framePlan.uiIntent.sceneState.activeEvent = transientActiveEvent;
        }

        setSunLongitude(framePlan.statePatchIntent.sunLongitude);
        frameRenderer.applyRenderIntent(framePlan.renderIntent);
        frameUiUpdater.applyUiIntent(framePlan.uiIntent);

        render();
    }

    return {
        setLocation,
    };
}

export { createSceneFrameOrchestrationActions };
