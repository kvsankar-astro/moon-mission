import { describe, expect, it, vi } from "vitest";

import { createInitOrchestrationActions } from "../src/platform/js/app/init-orchestration.js";

describe("createInitOrchestrationActions", () => {
    it("starts at Now and enables realtime when current time is inside the active data span", async () => {
        const setAnimTime = vi.fn();
        const missionSetTime = vi.fn();
        const setLocation = vi.fn();
        const setDimension = vi.fn();
        const setView = vi.fn();
        const changeCameraFromTo = vi.fn();
        const updateCraftScale = vi.fn();
        const render = vi.fn();
        const requestAnimationFrame = vi.fn();
        const animateLoop = vi.fn();
        const setRealtimeSpeed = vi.fn();
        const playAnimation = vi.fn();

        const actions = createInitOrchestrationActions({
            initConfig: vi.fn().mockResolvedValue(undefined),
            init: vi.fn().mockResolvedValue(undefined),
            getConfig: () => "geo",
            isOrbitDataProcessed: () => true,
            missionStart: vi.fn(),
            missionSetTime,
            setRealtimeSpeed,
            playAnimation,
            setAnimTime,
            setLocation,
            setDimension,
            getSetView: () => setView,
            getChangeCameraFromTo: () => changeCameraFromTo,
            updateCraftScale,
            d3: { select: () => ({ text: vi.fn() }) },
            d3SelectAll: () => ({ attr: vi.fn() }),
            render,
            requestAnimationFrame,
            animateLoop,
            getStartTime: () => Date.UTC(2026, 0, 1),
            getLatestEndTime: () => Date.UTC(2026, 11, 31),
        });

        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 3, 2, 8, 0, 0));
        try {
            await actions.initAnimation({ reset: true });
        } finally {
            nowSpy.mockRestore();
        }

        expect(setAnimTime).toHaveBeenCalledWith(Date.UTC(2026, 3, 2, 8, 0, 0));
        expect(missionSetTime).toHaveBeenCalled();
        expect(setRealtimeSpeed).toHaveBeenCalled();
        expect(playAnimation).toHaveBeenCalled();
        expect(setLocation).toHaveBeenCalled();
        expect(setDimension).toHaveBeenCalledWith(true);
        expect(setView).toHaveBeenCalled();
        expect(changeCameraFromTo).toHaveBeenCalled();
        expect(updateCraftScale).toHaveBeenCalled();
        expect(render).toHaveBeenCalled();
        expect(requestAnimationFrame).toHaveBeenCalledWith(animateLoop);
    });

    it("falls back to mission start when current time is outside the active data span", async () => {
        const missionStart = vi.fn();
        const setRealtimeSpeed = vi.fn();
        const playAnimation = vi.fn();

        const actions = createInitOrchestrationActions({
            initConfig: vi.fn().mockResolvedValue(undefined),
            init: vi.fn().mockResolvedValue(undefined),
            getConfig: () => "geo",
            isOrbitDataProcessed: () => true,
            missionStart,
            missionSetTime: vi.fn(),
            setRealtimeSpeed,
            playAnimation,
            setAnimTime: vi.fn(),
            setLocation: vi.fn(),
            setDimension: vi.fn(),
            getSetView: () => vi.fn(),
            getChangeCameraFromTo: () => vi.fn(),
            updateCraftScale: vi.fn(),
            d3: { select: () => ({ text: vi.fn() }) },
            d3SelectAll: () => ({ attr: vi.fn() }),
            render: vi.fn(),
            requestAnimationFrame: vi.fn(),
            animateLoop: vi.fn(),
            getStartTime: () => Date.UTC(2026, 0, 1),
            getLatestEndTime: () => Date.UTC(2026, 0, 2),
        });

        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 3, 2, 8, 0, 0));
        try {
            await actions.initAnimation({ reset: true });
        } finally {
            nowSpy.mockRestore();
        }

        expect(missionStart).toHaveBeenCalled();
        expect(setRealtimeSpeed).not.toHaveBeenCalled();
        expect(playAnimation).not.toHaveBeenCalled();
    });

    it("preserves startup override on reset when current time is outside the active data span", async () => {
        const missionStart = vi.fn();
        const missionSetTime = vi.fn();
        const setAnimTime = vi.fn();
        const setRealtimeSpeed = vi.fn();
        const playAnimation = vi.fn();

        const actions = createInitOrchestrationActions({
            initConfig: vi.fn().mockResolvedValue(undefined),
            init: vi.fn().mockResolvedValue(undefined),
            getConfig: () => "geo",
            isOrbitDataProcessed: () => true,
            missionStart,
            missionSetTime,
            setRealtimeSpeed,
            playAnimation,
            setAnimTime,
            setLocation: vi.fn(),
            setDimension: vi.fn(),
            getSetView: () => vi.fn(),
            getChangeCameraFromTo: () => vi.fn(),
            updateCraftScale: vi.fn(),
            d3: { select: () => ({ text: vi.fn() }) },
            d3SelectAll: () => ({ attr: vi.fn() }),
            render: vi.fn(),
            requestAnimationFrame: vi.fn(),
            animateLoop: vi.fn(),
            getStartTime: () => Date.UTC(2026, 0, 1),
            getLatestEndTime: () => Date.UTC(2026, 0, 2),
        });

        const startupOverrideMs = Date.UTC(2026, 1, 1, 0, 0, 0);
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 3, 2, 8, 0, 0));
        try {
            await actions.initAnimation({
                reset: true,
                startupAnimTimeOverride: startupOverrideMs,
            });
        } finally {
            nowSpy.mockRestore();
        }

        expect(missionStart).not.toHaveBeenCalled();
        expect(setAnimTime).toHaveBeenCalledWith(startupOverrideMs);
        expect(missionSetTime).toHaveBeenCalled();
        expect(setRealtimeSpeed).not.toHaveBeenCalled();
        expect(playAnimation).not.toHaveBeenCalled();
    });

    it("prefers Now over startup override on reset when current time is in range", async () => {
        const setAnimTime = vi.fn();
        const missionSetTime = vi.fn();
        const setRealtimeSpeed = vi.fn();
        const playAnimation = vi.fn();

        const actions = createInitOrchestrationActions({
            initConfig: vi.fn().mockResolvedValue(undefined),
            init: vi.fn().mockResolvedValue(undefined),
            getConfig: () => "geo",
            isOrbitDataProcessed: () => true,
            missionStart: vi.fn(),
            missionSetTime,
            setRealtimeSpeed,
            playAnimation,
            setAnimTime,
            setLocation: vi.fn(),
            setDimension: vi.fn(),
            getSetView: () => vi.fn(),
            getChangeCameraFromTo: () => vi.fn(),
            updateCraftScale: vi.fn(),
            d3: { select: () => ({ text: vi.fn() }) },
            d3SelectAll: () => ({ attr: vi.fn() }),
            render: vi.fn(),
            requestAnimationFrame: vi.fn(),
            animateLoop: vi.fn(),
            getStartTime: () => Date.UTC(2026, 0, 1),
            getLatestEndTime: () => Date.UTC(2026, 11, 31),
        });

        const nowMs = Date.UTC(2026, 3, 2, 8, 0, 0);
        const startupOverrideMs = Date.UTC(2026, 1, 1, 0, 0, 0);
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(nowMs);
        try {
            await actions.initAnimation({
                reset: true,
                startupAnimTimeOverride: startupOverrideMs,
            });
        } finally {
            nowSpy.mockRestore();
        }

        expect(setAnimTime).toHaveBeenCalledWith(nowMs);
        expect(setAnimTime).not.toHaveBeenCalledWith(startupOverrideMs);
        expect(missionSetTime).toHaveBeenCalled();
        expect(setRealtimeSpeed).toHaveBeenCalled();
        expect(playAnimation).toHaveBeenCalled();
    });

    it("starts the animation loop only once across repeated init calls", async () => {
        const requestAnimationFrame = vi.fn();
        const animateLoop = vi.fn();

        const actions = createInitOrchestrationActions({
            initConfig: vi.fn().mockResolvedValue(undefined),
            init: vi.fn().mockResolvedValue(undefined),
            getConfig: () => "geo",
            isOrbitDataProcessed: () => true,
            missionStart: vi.fn(),
            missionSetTime: vi.fn(),
            setRealtimeSpeed: vi.fn(),
            playAnimation: vi.fn(),
            setAnimTime: vi.fn(),
            setLocation: vi.fn(),
            setDimension: vi.fn(),
            getSetView: () => vi.fn(),
            getChangeCameraFromTo: () => vi.fn(),
            updateCraftScale: vi.fn(),
            d3: { select: () => ({ text: vi.fn() }) },
            d3SelectAll: () => ({ attr: vi.fn() }),
            render: vi.fn(),
            requestAnimationFrame,
            animateLoop,
            getStartTime: () => Date.UTC(2026, 0, 1),
            getLatestEndTime: () => Date.UTC(2026, 11, 31),
        });

        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 3, 2, 8, 0, 0));
        try {
            await actions.initAnimation({ reset: true });
            await actions.initAnimation({ reset: false });
        } finally {
            nowSpy.mockRestore();
        }

        expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
        expect(requestAnimationFrame).toHaveBeenCalledWith(animateLoop);
    });
});
