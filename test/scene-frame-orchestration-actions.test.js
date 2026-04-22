import { describe, expect, it, vi } from "vitest";

import { createSceneFrameOrchestrationActions } from "../src/platform/js/app/scene-frame-orchestration-actions.js";

function createBaseDeps(overrides = {}) {
    return {
        getConfig: () => "geo",
        isOrbitDataProcessed: () => true,
        getAnimTime: () => 12345,
        computeSunLongitude: vi.fn(),
        computeSceneState: vi.fn(),
        getChebyshevData: () => ({ geo: true }),
        getChebyshevDataLoaded: () => ({ geo: true }),
        getNpzData: () => ({ geo: false }),
        getNpzDataLoaded: () => ({ geo: false }),
        getLandingNpzData: () => null,
        getLandingNpzLoaded: () => false,
        getLandingChebyshevData: () => null,
        getLandingChebyshevLoaded: () => false,
        getGlobalConfig: () => ({ spacecraft_mnemonic: "SC" }),
        getStartLandingTime: () => null,
        getEndLandingTime: () => null,
        getEventInfos: () => [{ key: "burn-a", startTime: 12000, label: "Burn A" }],
        getMissionTimes: () => ({ timeTransLunarInjection: 1000 }),
        getAnimationScene: () => ({ primaryBody: "EARTH" }),
        getFrameMode: () => "inertial",
        getBodySources: () => ({ SC: "npz" }),
        getActiveEphemerisSource: () => "npz",
        getIsCompareMode: () => false,
        setSunLongitude: vi.fn(),
        getCraftId: () => "SC",
        getPixelsPerAU: () => 100,
        updateCraftScale: vi.fn(),
        getCurrentDimension: () => "3D",
        frameRenderer: {
            applyRenderIntent: vi.fn(),
        },
        frameUiUpdater: {
            applyUiIntent: vi.fn(),
        },
        render: vi.fn(),
        ...overrides,
    };
}

describe("scene frame orchestration actions", () => {
    it("returns early when orbit data is not ready", () => {
        const planSceneFrame = vi.fn();
        const createTransientEventTracker = vi.fn();
        const deps = createBaseDeps({
            isOrbitDataProcessed: () => false,
            planSceneFrame,
            createTransientEventTracker,
        });

        const actions = createSceneFrameOrchestrationActions(deps);
        actions.setLocation();

        expect(planSceneFrame).not.toHaveBeenCalled();
        expect(createTransientEventTracker).toHaveBeenCalledTimes(1);
        expect(deps.setSunLongitude).not.toHaveBeenCalled();
        expect(deps.frameRenderer.applyRenderIntent).not.toHaveBeenCalled();
        expect(deps.frameUiUpdater.applyUiIntent).not.toHaveBeenCalled();
        expect(deps.render).not.toHaveBeenCalled();
    });

    it("applies render and ui intents from the planned frame", () => {
        const framePlan = {
            shouldRun: true,
            statePatchIntent: {
                sunLongitude: 2,
            },
            renderIntent: {
                sceneState: { phase: "coast" },
            },
            uiIntent: {
                sceneState: { phase: "coast" },
            },
        };
        const trackedFramePlan = {
            ...framePlan,
            statePatchIntent: {
                sunLongitude: 3,
            },
            renderIntent: {
                sceneState: { activeEvent: { key: "burn-a" } },
            },
            uiIntent: {
                sceneState: { activeEvent: { key: "burn-a" } },
            },
        };
        const planSceneFrame = vi.fn(() => framePlan);
        const applyToFramePlan = vi.fn(() => ({
            activeEvent: { key: "burn-a" },
            framePlan: trackedFramePlan,
            transientActiveEventPlan: { activeEvent: { key: "burn-a" } },
        }));
        const deps = createBaseDeps({
            planSceneFrame,
            createTransientEventTracker: () => ({ applyToFramePlan }),
        });

        const actions = createSceneFrameOrchestrationActions(deps);
        actions.setLocation();

        expect(planSceneFrame).toHaveBeenCalledWith(
            expect.objectContaining({
                config: "geo",
                animTime: 12345,
                activeEphemerisSource: "npz",
                compareMode: false,
                craftId: "SC",
                eventInfos: [{ key: "burn-a", startTime: 12000, label: "Burn A" }],
            }),
        );
        expect(applyToFramePlan).toHaveBeenCalledWith({
            config: "geo",
            animTime: 12345,
            eventInfos: [{ key: "burn-a", startTime: 12000, label: "Burn A" }],
            framePlan,
        });
        expect(deps.setSunLongitude).toHaveBeenCalledWith(3);
        expect(deps.frameRenderer.applyRenderIntent).toHaveBeenCalledWith(trackedFramePlan.renderIntent);
        expect(deps.frameUiUpdater.applyUiIntent).toHaveBeenCalledWith(trackedFramePlan.uiIntent);
        expect(deps.render).toHaveBeenCalledTimes(1);
    });

    it("skips shell side effects when the planner says not to run", () => {
        const planSceneFrame = vi.fn(() => ({
            shouldRun: false,
            reason: "scene-missing",
        }));
        const applyToFramePlan = vi.fn();
        const deps = createBaseDeps({
            getAnimationScene: () => null,
            planSceneFrame,
            createTransientEventTracker: () => ({ applyToFramePlan }),
        });

        const actions = createSceneFrameOrchestrationActions(deps);
        actions.setLocation();

        expect(planSceneFrame).toHaveBeenCalledWith(
            expect.objectContaining({
                scene: null,
                compareMode: false,
            }),
        );
        expect(applyToFramePlan).not.toHaveBeenCalled();
        expect(deps.setSunLongitude).not.toHaveBeenCalled();
        expect(deps.frameRenderer.applyRenderIntent).not.toHaveBeenCalled();
        expect(deps.frameUiUpdater.applyUiIntent).not.toHaveBeenCalled();
        expect(deps.render).not.toHaveBeenCalled();
    });

    it("passes compare-mode state into the frame planner", () => {
        const planSceneFrame = vi.fn(() => ({
            shouldRun: false,
            reason: "scene-missing",
        }));
        const deps = createBaseDeps({
            getIsCompareMode: () => true,
            planSceneFrame,
            createTransientEventTracker: () => ({ applyToFramePlan: vi.fn() }),
        });

        const actions = createSceneFrameOrchestrationActions(deps);
        actions.setLocation();

        expect(planSceneFrame).toHaveBeenCalledWith(
            expect.objectContaining({
                compareMode: true,
            }),
        );
    });
});
