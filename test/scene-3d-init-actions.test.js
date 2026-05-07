import { describe, expect, it, vi } from "vitest";

import { createScene3dInitActions } from "../src/platform/js/app/scene-3d-init-actions.js";

function createScene() {
    return {
        initialized3D: false,
        init3dRest: vi.fn(function () {
            this.initialized3D = true;
        }),
    };
}

function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, resolve, reject };
}

describe("scene-3d-init-actions", () => {
    it("loads the requested detailed Moon profile during scene texture startup", async () => {
        const scene = createScene();
        const callback = vi.fn();
        const applyAndRefreshSceneTextures = vi.fn((targetScene, textures) => {
            targetScene.moonRenderProfile = textures.moonRenderProfile;
        });
        const loadSceneTextures = vi.fn().mockResolvedValue({
            moonMap: "quality-map",
            moonDisplacementMap: "quality-height",
            moonRenderProfile: "quality",
            moonRenderSettings: { displacementScale: 0.0128 },
        });
        const loadMoonRenderProfileTextures = vi.fn().mockResolvedValue({
            moonMap: "fast-map",
            moonDisplacementMap: "fast-height",
            moonRenderProfile: "fast",
            moonRenderSettings: { displacementScale: 0.0118 },
        });
        const actions = createScene3dInitActions({
            THREE: { LinearFilter: "linear" },
            createPlaceholderSceneTextures: vi.fn(() => ({ moonRenderProfile: "quality" })),
            loadSceneTextures,
            loadMoonRenderProfileTextures,
            applyAndRefreshSceneTextures,
            render: vi.fn(),
            globalObject: {
                location: {
                    search: "?moonRenderProfile=quality",
                },
            },
        });

        actions.init3d(scene, callback);
        await scene.beginTextureLoad();
        await scene.moonTextureLoadPromise;

        expect(callback).toHaveBeenCalled();
        expect(loadSceneTextures).toHaveBeenCalledWith(expect.objectContaining({
            moonRenderProfile: "quality",
        }));
        expect(loadMoonRenderProfileTextures).not.toHaveBeenCalled();
        expect(applyAndRefreshSceneTextures.mock.calls.map(([, textures]) => textures.moonRenderProfile))
            .toEqual(["quality", "quality"]);
        expect(scene.textureLoadState).toBe("ready");
        expect(scene.moonRenderProfile).toBe("quality");
    });

    it("keeps startup texture loading pending until a changed Moon profile refresh completes", async () => {
        const scene = createScene();
        const mainLoad = createDeferred();
        const moonRefresh = createDeferred();
        const globalObject = {
            MOON_RENDER_ASSET_PROFILE: "fast",
        };
        const applyAndRefreshSceneTextures = vi.fn((targetScene, textures) => {
            targetScene.moonRenderProfile = textures.moonRenderProfile;
        });
        const loadSceneTextures = vi.fn(() => mainLoad.promise);
        const loadMoonRenderProfileTextures = vi.fn(() => moonRefresh.promise);
        const actions = createScene3dInitActions({
            THREE: { LinearFilter: "linear" },
            createPlaceholderSceneTextures: vi.fn(() => ({ moonRenderProfile: "fast" })),
            loadSceneTextures,
            loadMoonRenderProfileTextures,
            applyAndRefreshSceneTextures,
            render: vi.fn(),
            globalObject,
        });

        actions.init3d(scene, vi.fn());
        const textureLoadPromise = scene.beginTextureLoad();

        globalObject.MOON_RENDER_ASSET_PROFILE = "quality";
        mainLoad.resolve({
            moonMap: "fast-map",
            moonDisplacementMap: "fast-height",
            moonRenderProfile: "fast",
            moonRenderSettings: {},
        });
        await Promise.resolve();
        await Promise.resolve();

        expect(loadMoonRenderProfileTextures).toHaveBeenCalledWith(expect.objectContaining({
            moonRenderProfile: "quality",
        }));
        expect(scene.textureLoadState).toBe("loading");
        expect(scene.textureLoadPending).toBe(true);
        expect(scene.moonTextureLoadPending).toBe(true);

        moonRefresh.resolve({
            moonMap: "quality-map",
            moonDisplacementMap: "quality-height",
            moonRenderProfile: "quality",
            moonRenderSettings: {},
        });
        await textureLoadPromise;

        expect(scene.textureLoadState).toBe("ready");
        expect(scene.textureLoadPending).toBe(false);
        expect(scene.moonTextureLoadPending).toBe(false);
        expect(scene.moonRenderProfile).toBe("quality");
    });
});
