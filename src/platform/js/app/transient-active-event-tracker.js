import { planTransientActiveEvent } from "../core/domain/transient-active-event.js";

function attachActiveEventToFramePlan({ framePlan, activeEvent }) {
    if (!framePlan) {
        return framePlan;
    }

    if (framePlan.renderIntent?.sceneState) {
        framePlan.renderIntent.sceneState.activeEvent = activeEvent;
    }
    if (framePlan.uiIntent?.sceneState) {
        framePlan.uiIntent.sceneState.activeEvent = activeEvent;
    }
    return framePlan;
}

function createTransientActiveEventTracker({
    eventDisplayWindowMs = 2000,
    eventDisplayMinStableUiMs = 2000,
    getNowWallTimeMs = () => Date.now(),
} = {}) {
    const lastFrameAnimTimeByConfig = new Map();
    const activeEventLatchByConfig = new Map();

    function applyToFramePlan({
        config,
        animTime,
        eventInfos,
        framePlan,
    }) {
        const transientActiveEventPlan = planTransientActiveEvent({
            animTime,
            previousTimeMs: lastFrameAnimTimeByConfig.get(config),
            eventInfos,
            currentLatch: activeEventLatchByConfig.get(config) || null,
            nowWallTimeMs: getNowWallTimeMs(),
            eventDisplayWindowMs,
            eventDisplayMinStableUiMs,
        });

        if (transientActiveEventPlan.nextLatch) {
            activeEventLatchByConfig.set(config, transientActiveEventPlan.nextLatch);
        } else {
            activeEventLatchByConfig.delete(config);
        }
        lastFrameAnimTimeByConfig.set(config, transientActiveEventPlan.nextPreviousTimeMs);

        return {
            activeEvent: transientActiveEventPlan.activeEvent,
            framePlan: attachActiveEventToFramePlan({
                framePlan,
                activeEvent: transientActiveEventPlan.activeEvent,
            }),
            transientActiveEventPlan,
        };
    }

    return {
        applyToFramePlan,
    };
}

export {
    attachActiveEventToFramePlan,
    createTransientActiveEventTracker,
};
