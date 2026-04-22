import { describe, expect, it, vi } from "vitest";

import { createOrbitLoadActions } from "../src/platform/js/app/orbit-load-actions.js";

function createHarness({
    primaryChebData,
    planetsForLocations = ["MOON", "SC"],
    supportOrbitsChebByBodyId = {},
    orbitsMeta = null,
    globalConfig = null,
}) {
    const state = {
        config: "geo",
        dataLoaded: false,
    };

    const animationScenes = {
        geo: {
            orbitsCheb: "relative-CY2-cheb.json",
            orbitsSunCheb: "geo-SC-sun-cheb.json",
            relativeSupportOrbitsCheb: "geo-SC-cheb.json",
            supportOrbitsChebByBodyId,
            planetsForLocations,
            primaryCraftId: "CH3L",
            orbitsMeta,
        },
    };

    const orbitDataLoaded = { geo: false };
    const chebyshevData = {};
    const chebyshevDataLoaded = { geo: false };
    const npzData = {};
    const npzDataLoaded = { geo: false };

    const loadChebyshev = vi.fn(async (url) => {
        if (url === "relative-CY2-cheb.json") return primaryChebData;
        if (url === "geo-SC-sun-cheb.json") {
            return { segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }] };
        }
        if (url === "geo-SC-cheb.json") {
            return {
                MOON: {
                    segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
                },
            };
        }
        if (url === "geo-CH3O-cheb.json") {
            return {
                CH3O: {
                    segments: [{ t_start: 0, t_end: 1, cx: [1], cy: [1], cz: [1] }],
                },
            };
        }
        if (url === "relative-ORION-cheb.json") {
            return {
                segments: [{ t_start: 0, t_end: 1, cx: [2], cy: [2], cz: [2] }],
                MOON: {
                    segments: [{ t_start: 0, t_end: 1, cx: [3], cy: [3], cz: [3] }],
                },
            };
        }
        throw new Error(`Unexpected Chebyshev URL: ${url}`);
    });
    const loadJson = vi.fn(async () => ({
        bodies: {
            CH3L: {
                regime_intervals: [],
            },
        },
    }));

    const processOrbitData = vi.fn(async () => {});
    const callback = vi.fn();

    const actions = createOrbitLoadActions({
        d3: {},
        sleep: async () => {},
        getConfig: () => state.config,
        animationScenes,
        orbitDataLoaded,
        chebyshevData,
        chebyshevDataLoaded,
        npzData,
        npzDataLoaded,
        getDataLoaded: () => state.dataLoaded,
        setDataLoaded: (value) => {
            state.dataLoaded = value;
        },
        loadChebyshev,
        loadJson,
        loadNpz: vi.fn(async () => ({})),
        processOrbitData,
        ensureIndeterminateProgressBar: () => {},
        showElementById: () => {},
        hideElementById: () => {},
        updateProgressLabel: () => {},
        setEventInfoText: () => {},
        getEphemerisSource: () => "chebyshev",
        getBodySource: () => "chebyshev",
        getBodiesForConfig: () => animationScenes.geo.planetsForLocations,
        onEphemerisLoaded: () => {},
        onEphemerisStatus: () => {},
        getGlobalConfig: () => globalConfig,
        getViewOrbit: () => true,
        getOrbitStyle: () => "trail",
        render: () => {},
        loadProgress: null,
    });

    return {
        actions,
        callback,
        loadChebyshev,
        loadJson,
        processOrbitData,
        chebyshevData,
        chebyshevDataLoaded,
        orbitDataLoaded,
    };
}

describe("createOrbitLoadActions", () => {
    it("merges Moon series from support Chebyshev file when relative file has only spacecraft data", async () => {
        const { actions, callback, loadChebyshev, processOrbitData, chebyshevData, chebyshevDataLoaded, orbitDataLoaded } =
            createHarness({
                primaryChebData: {
                    segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
                },
            });

        await actions.loadOrbitDataIfNeededAndProcess(callback);

        expect(loadChebyshev).toHaveBeenCalledWith("relative-CY2-cheb.json");
        expect(loadChebyshev).toHaveBeenCalledWith("geo-SC-cheb.json");
        expect(chebyshevData.geo?.MOON).toBeTruthy();
        expect(chebyshevData.geo?.metadata?.sun_frame).toBe("inertial");
        expect(chebyshevDataLoaded.geo).toBe(true);
        expect(orbitDataLoaded.geo).toBe(true);
        expect(processOrbitData).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("does not load support Chebyshev when Moon series already exists in the primary file", async () => {
        const { actions, callback, loadChebyshev, chebyshevData } = createHarness({
            primaryChebData: {
                segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
                MOON: {
                    segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
                },
                SUN: {
                    segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
                },
            },
        });

        await actions.loadOrbitDataIfNeededAndProcess(callback);

        const supportLoads = loadChebyshev.mock.calls.filter(
            (args) => args[0] === "geo-SC-cheb.json",
        );
        expect(supportLoads.length).toBe(0);
        expect(chebyshevData.geo?.metadata?.sun_frame).toBe("inertial");
    });

    it("merges additional craft series from craft-specific support Chebyshev files", async () => {
        const { actions, callback, loadChebyshev, chebyshevData } = createHarness({
            primaryChebData: {
                segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
            },
            planetsForLocations: ["MOON", "CH3O", "CH3L"],
            supportOrbitsChebByBodyId: {
                CH3O: "geo-CH3O-cheb.json",
            },
        });

        await actions.loadOrbitDataIfNeededAndProcess(callback);

        expect(loadChebyshev).toHaveBeenCalledWith("geo-CH3O-cheb.json");
        expect(chebyshevData.geo?.CH3O).toBeTruthy();
        expect(chebyshevData.geo?.CH3O?.segments?.length).toBe(1);
    });

    it("starts authored orbit-style loading after the main orbit processing finishes", async () => {
        const { actions, callback, processOrbitData, loadJson } = createHarness({
            primaryChebData: {
                segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
            },
            orbitsMeta: "geo-style.json",
        });

        await actions.loadOrbitDataIfNeededAndProcess(callback);
        await Promise.resolve();

        expect(processOrbitData).toHaveBeenCalledTimes(1);
        expect(loadJson).toHaveBeenCalledWith("geo-style.json");
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("marks relative primary sun data as already relative", async () => {
        const { actions, callback, chebyshevData } = createHarness({
            primaryChebData: {
                metadata: { mode: "relative" },
                segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
                SUN: {
                    segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
                },
                MOON: {
                    segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
                },
            },
        });

        await actions.loadOrbitDataIfNeededAndProcess(callback);

        expect(chebyshevData.geo?.metadata?.sun_frame).toBe("relative");
    });

    it("merges synthetic comparison craft ids from single-series support files", async () => {
        const { actions, callback, loadChebyshev, chebyshevData } = createHarness({
            primaryChebData: {
                segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
            },
            planetsForLocations: ["MOON", "CH3L", "CMP_ARTEMIS1_ORION"],
            supportOrbitsChebByBodyId: {
                CMP_ARTEMIS1_ORION: "relative-ORION-cheb.json",
            },
        });

        await actions.loadOrbitDataIfNeededAndProcess(callback);

        expect(loadChebyshev).toHaveBeenCalledWith("relative-ORION-cheb.json");
        expect(chebyshevData.geo?.CMP_ARTEMIS1_ORION).toBeTruthy();
        expect(chebyshevData.geo?.CMP_ARTEMIS1_ORION?.segments?.length).toBe(1);
    });

    it("preserves comparison moon support series under a compare-only alias", async () => {
        const { actions, callback, chebyshevData } = createHarness({
            primaryChebData: {
                segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
                MOON: {
                    segments: [{ t_start: 0, t_end: 1, cx: [0], cy: [0], cz: [0] }],
                },
            },
            planetsForLocations: ["MOON", "CH3L", "CMP_ARTEMIS1_ORION"],
            supportOrbitsChebByBodyId: {
                CMP_ARTEMIS1_ORION: "relative-ORION-cheb.json",
            },
            globalConfig: {
                comparisonOverlay: {
                    compareCraftId: "CMP_ARTEMIS1_ORION",
                    normalizationSourceBodyIdsByOrigin: {
                        geo: "MOON",
                    },
                    normalizationSupportBodyIdsByOrigin: {
                        geo: "CMP_ARTEMIS1_ORION__MOON",
                    },
                },
            },
        });

        await actions.loadOrbitDataIfNeededAndProcess(callback);

        expect(chebyshevData.geo?.MOON?.segments?.length).toBe(1);
        expect(chebyshevData.geo?.CMP_ARTEMIS1_ORION__MOON?.segments?.length).toBe(1);
    });
});
