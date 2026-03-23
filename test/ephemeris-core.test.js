import { describe, expect, it } from "vitest";
import {
    evaluateChebyshev,
    findSegment,
    getPositionFromChebyshev,
    getStateFromChebyshev,
} from "../src/platform/js/core/domain/ephemeris-core.js";

describe("ephemeris-core", () => {
    it("evaluates Chebyshev polynomials using Clenshaw recurrence", () => {
        expect(evaluateChebyshev([], 0)).toBe(0);
        expect(evaluateChebyshev([42], 0.25)).toBe(42);
        expect(evaluateChebyshev([0, 1], 0.5)).toBeCloseTo(0.5, 10);
        expect(evaluateChebyshev([0, 0, 1], 0.5)).toBeCloseTo(-0.5, 10);
    });

    it("finds segments with binary search and respects boundaries", () => {
        const segments = [
            { t_start: 10, t_end: 20 },
            { t_start: 20, t_end: 30 },
            { t_start: 30, t_end: 40 },
        ];

        expect(findSegment(segments, 10)).toBe(segments[0]);
        expect(findSegment(segments, 20)).toBe(segments[1]);
        expect(findSegment(segments, 35)).toBe(segments[2]);
        expect(findSegment(segments, 9.99)).toBeNull();
        expect(findSegment(segments, 40.01)).toBeNull();
    });

    it("returns position/state from Chebyshev segments", () => {
        const chebData = {
            segments: [
                {
                    t_start: 100,
                    t_end: 102,
                    cx: [2000, 1000],
                    cy: [5000, 1000],
                    cz: [8000, 1000],
                },
            ],
        };

        const posStart = getPositionFromChebyshev(chebData, 100);
        const posMid = getPositionFromChebyshev(chebData, 101);
        const posEnd = getPositionFromChebyshev(chebData, 102);
        expect(posStart).toEqual({ x: 1000, y: 4000, z: 7000 });
        expect(posMid).toEqual({ x: 2000, y: 5000, z: 8000 });
        expect(posEnd).toEqual({ x: 3000, y: 6000, z: 9000 });

        const state = getStateFromChebyshev(chebData, 101);
        expect(state).toBeDefined();
        expect(state.pos.x).toBeCloseTo(2000, 10);
        expect(Number.isFinite(state.vel.vx)).toBe(true);
        expect(Number.isFinite(state.vel.vy)).toBe(true);
        expect(Number.isFinite(state.vel.vz)).toBe(true);
    });
});
