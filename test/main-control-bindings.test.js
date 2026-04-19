import { describe, expect, it, vi } from "vitest";

import {
    bindMainControlControllerSet,
    bindMainControlElements,
    createMainControlControllers,
    syncMainControlControllerSet,
} from "../src/platform/js/ui/main-control-bindings.js";

describe("main control bindings", () => {
    it("builds the main control controllers from the shared backend and shell adapters", () => {
        const createSharedControlBackendImpl = vi.fn(() => ({ backend: true }));
        const createCameraPillControllerImpl = vi.fn(() => ({ bind: vi.fn() }));
        const createPlanePillControllerImpl = vi.fn(() => ({ bind: vi.fn() }));
        const createViewSettingsPillControllerImpl = vi.fn(() => ({ bind: vi.fn(), sync: vi.fn() }));
        const createFocusPillControllerImpl = vi.fn(() => ({ bind: vi.fn(), sync: vi.fn() }));
        const headerPillStripController = { bind: vi.fn(), syncUi: vi.fn() };
        const invokeMissionPanelActionImpl = vi.fn();

        const controllers = createMainControlControllers({
            toggleMode: vi.fn(),
            toggleRelativeMode: vi.fn(),
            changeCameraFromTo: vi.fn(),
            togglePlane: vi.fn(),
            setView: vi.fn(),
            setDimensionTop: vi.fn(),
            toggleLanding: vi.fn(),
            getMoonRenderProfile: vi.fn(),
            setMoonRenderProfile: vi.fn(),
            headerPillStripController,
            createSharedControlBackendImpl,
            createCameraPillControllerImpl,
            createPlanePillControllerImpl,
            createViewSettingsPillControllerImpl,
            createFocusPillControllerImpl,
            invokeMissionPanelActionImpl,
        });

        expect(createSharedControlBackendImpl).toHaveBeenCalledTimes(1);
        expect(createCameraPillControllerImpl).toHaveBeenCalledWith({ controlBackend: { backend: true } });
        expect(createPlanePillControllerImpl).toHaveBeenCalledWith({ controlBackend: { backend: true } });
        expect(createViewSettingsPillControllerImpl).toHaveBeenCalledWith(expect.objectContaining({
            controlBackend: { backend: true },
        }));
        expect(createFocusPillControllerImpl).toHaveBeenCalledWith({
            invokeMissionPanelAction: invokeMissionPanelActionImpl,
            setView: expect.any(Function),
        });
        expect(controllers.headerPillStripController).toBe(headerPillStripController);
    });

    it("binds and syncs the controller set in the expected lifecycle order", () => {
        const calls = [];
        const controllers = {
            cameraPillController: { bind: () => calls.push("camera.bind") },
            focusPillController: { bind: () => calls.push("focus.bind"), sync: () => calls.push("focus.sync") },
            planePillController: { bind: () => calls.push("plane.bind") },
            viewSettingsPillController: { bind: () => calls.push("view.bind"), sync: () => calls.push("view.sync") },
            headerPillStripController: { bind: () => calls.push("header.bind"), syncUi: () => calls.push("header.sync") },
        };

        bindMainControlControllerSet({
            controllers,
            bindHeaderBlurbBehavior: () => calls.push("headerBlurb.bind"),
            bindDesktopChromeAutohideBehavior: () => calls.push("autohide.bind"),
        });
        syncMainControlControllerSet(controllers);

        expect(calls).toEqual([
            "headerBlurb.bind",
            "camera.bind",
            "focus.bind",
            "plane.bind",
            "view.bind",
            "header.bind",
            "autohide.bind",
            "focus.sync",
            "view.sync",
            "header.sync",
        ]);
    });

    it("binds the remaining main control DOM events and preserves the animate fallback", () => {
        const clickBindings = [];
        const changeBindings = [];
        const inputBindings = [];
        const toggleAnimation = vi.fn();
        const cy3Animate = vi.fn();

        bindMainControlElements({
            onClick: (id, handler) => clickBindings.push([id, handler]),
            onChange: (id, handler) => changeBindings.push([id, handler]),
            onInput: (id, handler) => inputBindings.push([id, handler]),
            reset: vi.fn(),
            changeDesktopMainFov: vi.fn(),
            toggleDesktopMainFovAuto: vi.fn(),
            setView: vi.fn(),
            toggleAnimation,
            cy3Animate,
            toggleJoyRide: vi.fn(),
            toggleLanding: vi.fn(),
            toggleInfo: vi.fn(),
        });

        expect(clickBindings.map(([id]) => id)).toEqual([
            "reset",
            "desktop-main-fov-auto",
            "view-additional-crafts",
            "view-aux-camera-panels",
            "view-fps",
            "joyride",
            "joyridebutton",
            "landingbutton",
            "info-button",
            "animate",
        ]);
        expect(changeBindings.map(([id]) => id)).toEqual([
            "active-craft-select",
            "orbit-style-classic",
            "orbit-style-trail",
        ]);
        expect(inputBindings.map(([id]) => id)).toEqual([
            "desktop-main-fov-slider",
            "trail-track-brightness-2d",
            "trail-track-brightness-3d",
            "trail-tail-brightness-2d",
            "trail-tail-brightness-3d",
        ]);
        expect(clickBindings.at(-1)?.[1]).toBe(toggleAnimation);
        expect(cy3Animate).not.toHaveBeenCalled();
    });

    it("falls back to the legacy animate handler when toggleAnimation is unavailable", () => {
        const clickBindings = [];
        const cy3Animate = vi.fn();

        bindMainControlElements({
            onClick: (id, handler) => clickBindings.push([id, handler]),
            onChange: vi.fn(),
            onInput: vi.fn(),
            reset: vi.fn(),
            changeDesktopMainFov: vi.fn(),
            toggleDesktopMainFovAuto: vi.fn(),
            setView: vi.fn(),
            cy3Animate,
            toggleJoyRide: vi.fn(),
            toggleLanding: vi.fn(),
            toggleInfo: vi.fn(),
        });

        expect(clickBindings.at(-1)?.[0]).toBe("animate");
        expect(clickBindings.at(-1)?.[1]).toBe(cy3Animate);
    });
});
