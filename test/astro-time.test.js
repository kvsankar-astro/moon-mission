// Regression coverage for TDB time conversion methods on Date.prototype.
// These attach as side-effects of importing astro.js, so we import it for the
// side-effect, then exercise the methods on standard Date instances.
import { describe, expect, it } from "vitest";
import "../src/platform/js/astro.js";
import { lunar_pole } from "../src/platform/js/astro.js";

const MS_PER_DAY = 86400000;

describe("Date.prototype TDB conversions", () => {
    it("getJD_TDB shifts UTC by 69.184 seconds (37 leap + 32.184 fixed)", () => {
        const epochMs = Date.parse("2026-04-02T01:57:23.000Z");
        const date = new Date(epochMs);
        const jdTdb = date.getJD_TDB();
        const jdUtc = date.getJD_UTC();
        // 69.184 seconds expressed in days; allow ~1e-9 day tolerance for
        // floating-point round trips through Julian Date arithmetic.
        expect(jdTdb - jdUtc).toBeCloseTo(69.184 / 86400, 9);
    });

    it("getMJD_TDB returns days since J2000 with the J2000 epoch at 2451545.0", () => {
        // J2000 (TT epoch): 2000-01-01 12:00:00 TT = 2000-01-01 11:58:55.816 UTC.
        // After adding TDB offset (69.184s) to UTC, we land roughly at the
        // J2000 reference; mjd_tdb should be near zero (within ~6e-5 days
        // because TT vs TDB is sub-millisecond).
        const j2000UtcEquivalent = Date.UTC(2000, 0, 1, 11, 58, 55, 816);
        const date = new Date(j2000UtcEquivalent);
        const mjdTdb = date.getMJD_TDB();
        expect(Math.abs(mjdTdb)).toBeLessThan(1e-3);
    });

    it("getT_TDB uses the standard Julian century divisor (36525), not the legacy 35625", () => {
        // Pick a date roughly 1 century after J2000.
        const epochMs = Date.UTC(2100, 0, 1, 12, 0, 0);
        const date = new Date(epochMs);
        const t = date.getT_TDB();
        // 100 years between 2000-01-01 and 2100-01-01 ≈ 36525 days.
        // T should be very close to 1.0 (slightly off due to TDB shift and
        // the J2000 epoch being noon TT, not midnight UTC).
        expect(t).toBeGreaterThan(0.9999);
        expect(t).toBeLessThan(1.0002);
        // Sanity: explicitly NOT the legacy 35625 result, which would give ~1.0252.
        expect(t).toBeLessThan(1.025);
    });
});

describe("lunar_pole IAU model", () => {
    it("returns alpha/delta near the J2000 base values (269.9949°, 66.5392°)", () => {
        // J2000 epoch in TDB ≈ 2000-01-01 11:58:55.816 UTC.
        const j2000UtcEquivalent = Date.UTC(2000, 0, 1, 11, 58, 55, 816);
        const lp = lunar_pole(new Date(j2000UtcEquivalent));
        const radToDeg = (r) => r * 180 / Math.PI;
        // E-term perturbations at T=0 are bounded ~3.9° on alpha (the largest
        // is -3.8787 * sin(E1)); after normalization to [0, 360) we land near
        // 269.9949 ± 4°. We just need to confirm the rotation is not absurdly
        // off (e.g. 0 or 90).
        const alphaDeg = radToDeg(lp.alpha);
        const deltaDeg = radToDeg(lp.delta);
        expect(alphaDeg).toBeGreaterThan(265);
        expect(alphaDeg).toBeLessThan(275);
        expect(deltaDeg).toBeGreaterThan(64);
        expect(deltaDeg).toBeLessThan(69);
    });

    it("rotation rate W picks up days (not centuries) — independent of getT_TDB divisor", () => {
        // Sanity check: the W (rotation phase) calculation in lunar_pole uses
        // 'd' (days since J2000), not T (centuries), so it is unaffected by the
        // 35625 -> 36525 divisor change. One day of clock advance produces
        // ~13.176 degrees of W advance regardless of which divisor is in use.
        const radToDeg = (r) => r * 180 / Math.PI;
        const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);
        const t1 = t0 + MS_PER_DAY;
        const w0 = radToDeg(lunar_pole(new Date(t0)).W);
        const w1 = radToDeg(lunar_pole(new Date(t1)).W);
        // Unwrap potential 360 deg boundary.
        let dW = w1 - w0;
        while (dW < -180) dW += 360;
        while (dW > 180) dW -= 360;
        // Linear coefficient in W formula is 13.17635815 deg/day; E-term
        // contribution per day is dominated by E4 (~13.34 deg/day) producing
        // up to ~0.02 deg perturbation on the daily delta. So allow a 1 deg
        // tolerance.
        expect(dW).toBeGreaterThan(13.0);
        expect(dW).toBeLessThan(13.4);
    });
});
