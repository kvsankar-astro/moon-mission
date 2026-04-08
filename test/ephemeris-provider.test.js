import { describe, expect, it } from "vitest";
import { getHorizonsJulianDate } from "../src/platform/js/data/ephemeris-provider.js";

// Chebyshev segment data uses JD in TDB.  getHorizonsJulianDate must return
// JD_TDB = JD_UNIX_EPOCH + (timeMs + TDB_OFFSET_MS) / MS_PER_DAY
// where TDB_OFFSET_MS = (37 + 32.184) * 1000 = 69184 ms.

const JD_UNIX_EPOCH = 2440587.5;
const MS_PER_DAY = 86400000;
const TDB_OFFSET_MS = (37.000 + 32.184) * 1000;

describe("ephemeris-provider", () => {
    it("converts Unix epoch to TDB Julian Date", () => {
        const expected = JD_UNIX_EPOCH + TDB_OFFSET_MS / MS_PER_DAY;
        expect(getHorizonsJulianDate(0)).toBeCloseTo(expected, 12);
    });

    it("matches arithmetic TDB Julian Date conversion for UTC timestamps", () => {
        const timeMs = Date.parse("2023-08-23T12:34:56.789Z");
        const expected = JD_UNIX_EPOCH + (timeMs + TDB_OFFSET_MS) / MS_PER_DAY;
        expect(getHorizonsJulianDate(timeMs)).toBeCloseTo(expected, 12);
    });

    it("TDB offset is approximately 69.184 seconds", () => {
        // The offset between TDB and UTC JD should be ~69.184s / 86400s/day
        const utcJd = JD_UNIX_EPOCH;
        const tdbJd = getHorizonsJulianDate(0);
        const offsetSeconds = (tdbJd - utcJd) * 86400;
        expect(offsetSeconds).toBeCloseTo(69.184, 2);
    });
});
