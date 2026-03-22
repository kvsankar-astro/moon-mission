import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../assets/platform/js/data/ephemeris-provider.js", () => ({
    getBodyEphemerisState: vi.fn(),
}));

import { getBodyEphemerisState } from "../assets/platform/js/data/ephemeris-provider.js";
import { computeBodyState } from "../assets/platform/js/scene-state.js";

function createData(overrides = {}) {
    return {
        chebyshevData: {},
        chebyshevDataLoaded: {},
        npzData: {},
        npzDataLoaded: {},
        landingNpzData: null,
        landingNpzLoaded: false,
        landingChebyshevData: null,
        landingChebyshevLoaded: false,
        globalConfig: { spacecraft_mnemonic: "SC", landing: { enabled: false } },
        startLandingTime: Number.NEGATIVE_INFINITY,
        endLandingTime: Number.POSITIVE_INFINITY,
        frameMode: "inertial",
        ephemerisSource: "chebyshev",
        bodySources: {},
        ...overrides,
    };
}

describe("computeBodyState", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("skips next-state ephemeris lookup when includeNextState is false", () => {
        getBodyEphemerisState.mockReturnValue({
            position: { x: 1, y: 2, z: 3 },
            velocity: { vx: 4, vy: 5, vz: 6 },
            available: true,
        });

        const state = computeBodyState(
            "SC",
            Date.parse("2023-07-14T10:00:00Z"),
            "geo",
            createData({ includeNextState: false }),
        );

        expect(getBodyEphemerisState).toHaveBeenCalledTimes(1);
        expect(state.available).toBe(true);
        expect(state.nextPosition).toEqual(state.position);
        expect(state.nextVelocity).toEqual(state.velocity);
    });

    it("keeps next-state lookup enabled by default", () => {
        getBodyEphemerisState.mockReturnValue({
            position: { x: 1, y: 2, z: 3 },
            velocity: { vx: 4, vy: 5, vz: 6 },
            available: true,
        });

        const state = computeBodyState(
            "SC",
            Date.parse("2023-07-14T10:00:00Z"),
            "geo",
            createData(),
        );

        expect(getBodyEphemerisState).toHaveBeenCalledTimes(2);
        expect(state.available).toBe(true);
        expect(state.nextPosition).toEqual({ x: 1, y: 2, z: 3 });
        expect(state.nextVelocity).toEqual({ vx: 4, vy: 5, vz: 6 });
    });
});
