import { describe, expect, it, vi } from "vitest";

import {
    applyOrbitStyleMetadataToScene,
    getSceneOrbitStyleMetadata,
    normalizePhaseOrbitStyleMetadata,
    seedSceneOrbitStyleMetadata,
} from "../src/platform/js/app/orbit-style-meta-actions.js";

describe("orbit style meta actions", () => {
    it("normalizes sidecar body ids and seeds scene metadata", () => {
        const scene = {
            loadedOrbitStyleMetadataByBodyId: {
                CH3L: { density_hint: [0.2] },
            },
        };

        expect(normalizePhaseOrbitStyleMetadata({
            bodies: {
                ch3o: { density_hint: [0.4] },
            },
        })).toEqual({
            CH3O: { density_hint: [0.4] },
        });

        seedSceneOrbitStyleMetadata(scene);
        expect(getSceneOrbitStyleMetadata(scene, "ch3l")).toEqual({ density_hint: [0.2] });
    });

    it("applies sidecar metadata to existing scene background opacities", () => {
        const render = vi.fn();
        const scene = {
            loadedOrbitStyleMetadataByBodyId: {},
            orbitStyleMetadataByBodyId: {},
            orbitOverlapOpacitiesByBodyId: { CH3L: [0.01] },
            orbitBackgroundChunksByBodyId: {
                CH3L: [{ points: [{}, {}], startIndex: 0, endIndex: 1 }],
            },
            curveTimesById: {
                CH3L: [0, 30 * 60 * 1000],
            },
            orbitBackgroundBaseOpacitiesByBodyId: {
                CH3L: [],
            },
            orbitLinesByBodyId: {
                CH3L: [
                    {
                        userData: {},
                        material: { opacity: 1, needsUpdate: false },
                    },
                ],
            },
            orbitSvgBackgroundChunksByBodyId: {},
            orbitTimesByBodyId: {},
            orbitSvgBackgroundBaseOpacitiesByBodyId: {},
        };

        const applied = applyOrbitStyleMetadataToScene({
            scene,
            phaseMeta: {
                bodies: {
                    CH3L: {
                        sample_times_jd: [2440587.5, 2440587.75],
                        density_hint: [0.8, 0.8],
                    },
                },
            },
            render,
        });

        expect(applied).toBe(true);
        expect(scene.loadedOrbitStyleMetadataByBodyId.CH3L).toBeTruthy();
        expect(scene.orbitBackgroundBaseOpacitiesByBodyId.CH3L[0]).toBeLessThan(0.15);
        expect(scene.orbitLinesByBodyId.CH3L[0].material.opacity).toBe(
            scene.orbitBackgroundBaseOpacitiesByBodyId.CH3L[0],
        );
        expect(scene.orbitOverlapOpacitiesByBodyId.CH3L).toBeUndefined();
        expect(render).toHaveBeenCalled();
    });
});
