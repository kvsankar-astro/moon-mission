import { describe, expect, it, vi } from "vitest";

import { createOrbitLoadActions } from "../src/platform/js/app/orbit-load-actions.js";

function createHarness({ primaryChebData }) {
    const state = {
        config: "geo",
        dataLoaded: false,
    };

    const animationScenes = {
        geo: {
            orbitsCheb: "relative-CY2-cheb.json",
            orbitsSunCheb: "geo-SC-sun-cheb.json",
            relativeSupportOrbitsCheb: "geo-SC-cheb.json",
            planetsForLocations: ["MOON", "SC"],
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
        throw new Error(`Unexpected Chebyshev URL: ${url}`);
    });

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
        loadProgress: null,
    });

    return {
        actions,
        callback,
        loadChebyshev,
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
        expect(chebyshevDataLoaded.geo).toBe(true);
        expect(orbitDataLoaded.geo).toBe(true);
        expect(processOrbitData).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("does not load support Chebyshev when Moon series already exists in the primary file", async () => {
        const { actions, callback, loadChebyshev } = createHarness({
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
    });
});
