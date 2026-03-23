import { describe, expect, it } from "vitest";
import { getHorizonsJulianDate } from "../src/platform/js/data/ephemeris-provider.js";

describe("ephemeris-provider", () => {
    it("converts Unix epoch to Julian Date", () => {
        expect(getHorizonsJulianDate(0)).toBe(2440587.5);
    });

    it("matches arithmetic Julian Date conversion for UTC timestamps", () => {
        const timeMs = Date.parse("2023-08-23T12:34:56.789Z");
        const expected = 2440587.5 + timeMs / 86400000;
        expect(getHorizonsJulianDate(timeMs)).toBeCloseTo(expected, 12);
    });
});
