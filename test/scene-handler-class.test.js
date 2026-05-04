import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

const {
    auxiliaryManagerInstances,
    auxiliaryManagerConstructor,
} = vi.hoisted(() => {
    const instances = [];
    return {
        auxiliaryManagerInstances: instances,
        auxiliaryManagerConstructor: vi.fn((options) => {
            const instance = {
                render: vi.fn(),
                dispose: vi.fn(),
            };
            instances.push(instance);
            options?.requestRender?.();
            return instance;
        }),
    };
});

vi.mock("../src/platform/js/app/auxiliary-camera-views.js", () => ({
    AuxiliaryCameraViewsManager: auxiliaryManagerConstructor,
}));

vi.mock("../src/platform/js/app/panel-manager.js", () => ({
    DesktopPanelManager: vi.fn(() => ({
        dispose: vi.fn(),
    })),
}));

import { createSceneHandlerClass } from "../src/platform/js/app/scene-handler-class.js";

describe("SceneHandler auxiliary panels", () => {
    beforeEach(() => {
        auxiliaryManagerConstructor.mockClear();
        auxiliaryManagerInstances.length = 0;
        globalThis.window = {
            innerWidth: 1280,
        };
        globalThis.document = {
            body: {},
            getElementById: () => null,
        };
    });

    it("does not recursively construct auxiliary panel managers during requestRender re-entry", () => {
        const renderer = {
            autoClear: true,
            render: vi.fn(),
            clearDepth: vi.fn(),
        };

        const SceneHandler = createSceneHandlerClass({
            THREE,
            d3: {},
            bindSettingsPanel: vi.fn(),
            initSceneHandlerDom: vi.fn(() => ({
                renderer,
                canvasNode: {},
            })),
            computeSVGDimensions: vi.fn(),
            getSvgWidth: vi.fn(() => 100),
            getSvgHeight: vi.fn(() => 100),
            isTestMode: false,
            onWindowResize: vi.fn(),
            updateCraftScale: vi.fn(),
            getRuntimeState: vi.fn(() => ({
                globalConfig: null,
                joyRideFlag: false,
                landingFlag: false,
                viewAuxiliaryPanels: true,
                earthRadius: 1,
                moonRadius: 1,
                timelineEventInfos: [],
            })),
        });

        const handler = new SceneHandler();
        handler.lastAnimationScene = {
            initialized3D: true,
            scene: {},
            camera: {
                updateMatrixWorld: vi.fn(),
                layers: { set: vi.fn() },
            },
            refreshBodyHalos: vi.fn(),
            stateSunDirection: null,
            stateSunDirections: null,
        };

        const manager = handler.ensureAuxiliaryCameraViews();

        expect(auxiliaryManagerConstructor).toHaveBeenCalledTimes(1);
        expect(manager).toBe(auxiliaryManagerInstances[0]);
        expect(handler.auxiliaryCameraViews).toBe(auxiliaryManagerInstances[0]);
    });
});
