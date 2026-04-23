/**
 * Functional test for Mission-Compare relative-mode scaling asymmetry.
 *
 * Loads the real relative-ORION Chebyshev ephemeris for Artemis 1 and
 * Artemis 2, then exercises the production `createNormalizedComparisonDisplayState`
 * in both orderings: (primary=A1, secondary=A2) and (primary=A2, secondary=A1).
 *
 * At each mission's own flyby, the craft is within a few hundred km of the
 * Moon.  After comparison normalization, the craft should land within that
 * same (tiny) offset from the rescaled reference Moon distance.  If either
 * ordering collapses the Moon anchor or the craft anchor, the scaled craft
 * magnitude will diverge from REFERENCE by hundreds of thousands of km.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
    COMPARISON_REFERENCE_DISTANCE_KM,
} from "../src/platform/js/core/domain/comparison-display.js";
import { getStateFromChebyshev } from "../src/platform/js/core/domain/ephemeris-core.js";
import { TIME_CONSTANTS } from "../src/platform/js/core/constants.js";
import { createNormalizedComparisonDisplayState, normalizeComparisonCurveVectors } from "../src/platform/js/app/comparison-normalization.js";
import { generateBodyCurve } from "../src/platform/js/data/ephemeris-provider.js";

const JD_UNIX_EPOCH = 2440587.5;
const MS_PER_DAY = 86400000;
const { TDB_OFFSET_MS } = TIME_CONSTANTS;

function jdTdbFromIso(iso) {
    const ms = new Date(iso).getTime();
    return JD_UNIX_EPOCH + (ms + TDB_OFFSET_MS) / MS_PER_DAY;
}

function msFromIso(iso) {
    return new Date(iso).getTime();
}

function loadRelative(mission) {
    const path = join(process.cwd(), "assets", mission, "data", "relative-ORION-cheb.json");
    return JSON.parse(readFileSync(path, "utf8"));
}

function magnitude(pos) {
    return Math.hypot(Number(pos?.x) || 0, Number(pos?.y) || 0, Number(pos?.z) || 0);
}

function evaluateBody(chebData, bodyId, jd) {
    const series = chebData?.[bodyId];
    if (!series?.segments) return null;
    const state = getStateFromChebyshev(series, jd);
    if (!state) return null;
    return state.pos;
}

const A1 = loadRelative("artemis1");
const A2 = loadRelative("artemis2");

const A1_OUTBOUND_FLYBY_ISO = "2022-11-21T11:44:00Z";
const A2_LUNAR_FLYBY_ISO = "2026-04-06T23:01:12Z";

// Build a scene state + globalConfig equivalent to what `orbit-load-actions.js`
// and `comparison-overlay-loader.js` produce at runtime for relative-mode
// compare.  Origin is "geo" because that's what `readOriginMode` returns even
// when the runtime frame is relative.
function buildCompareContext({ primary, secondary, displayTimeMs }) {
    const primaryName = primary.name;
    const secondaryName = secondary.name;
    const primaryCheb = primary.data;
    const secondaryCheb = secondary.data;

    const compareCraftId = `CMP_${secondaryName.toUpperCase()}_ORION`;
    const compareMoonAliasId = `${compareCraftId}__MOON`;

    // Mirror the merge that `mergeComparisonNormalizationSupportSeries` performs
    // in `src/platform/js/app/orbit-load-actions.js`.  Primary's relative file
    // supplies MOON and SC for the primary scene; the secondary mission's
    // relative file is aliased for the compare craft and its Moon anchor.
    const chebyshevData = {
        geo: {
            MOON: primaryCheb.MOON,
            SC: primaryCheb.SC,
            [compareCraftId]: secondaryCheb.SC,
            [compareMoonAliasId]: secondaryCheb.MOON,
        },
    };
    const chebyshevDataLoaded = { geo: true };

    const globalConfig = {
        spacecraft_mnemonic: "ORION",
        comparisonOverlay: {
            compareCraftId,
            sourceCraftId: "SC",
            sourceCraftMnemonic: "ORION",
            normalizationSourceBodyIdsByOrigin: {
                geo: "MOON",
                relative: "MOON",
                lunar: "EARTH",
            },
            normalizationSupportBodyIdsByOrigin: {
                geo: compareMoonAliasId,
                relative: compareMoonAliasId,
                lunar: `${compareCraftId}__EARTH`,
            },
            // Align each mission on its own flyby so the secondary craft is
            // sampled near its own Moon approach when the scene is at the
            // primary's flyby.
            displayTimeRangesByOrigin: {
                geo: {
                    startMs: msFromIso(
                        primaryName === "artemis1" ? "2022-11-16T00:00:00Z" : "2026-04-01T22:00:00Z",
                    ),
                    endMs: msFromIso(
                        primaryName === "artemis1" ? "2022-12-11T00:00:00Z" : "2026-04-10T12:00:00Z",
                    ),
                },
            },
            sourceTimeRangesByOrigin: {
                geo: {
                    startMs: msFromIso(
                        secondaryName === "artemis1" ? "2022-11-16T00:00:00Z" : "2026-04-01T22:00:00Z",
                    ),
                    endMs: msFromIso(
                        secondaryName === "artemis1" ? "2022-12-11T00:00:00Z" : "2026-04-10T12:00:00Z",
                    ),
                },
            },
            primaryTimelineEventInfosByOrigin: {
                geo: [
                    {
                        key: "launch",
                        label: "Launch",
                        startTime: new Date(
                            primaryName === "artemis1"
                                ? "2022-11-16T06:47:44Z"
                                : "2026-04-01T22:35:12Z",
                        ),
                    },
                ],
            },
            timelineSourceEventInfosByOrigin: {
                geo: [
                    {
                        key: "launch",
                        label: "Launch",
                        startTime: new Date(
                            secondaryName === "artemis1"
                                ? "2022-11-16T06:47:44Z"
                                : "2026-04-01T22:35:12Z",
                        ),
                    },
                ],
            },
            selectedPrimaryAlignmentEventKey: "launch",
            selectedComparisonAlignmentEventKey: "launch",
        },
        crafts: [
            { id: "SC", mnemonic: "ORION", primary: true },
            {
                id: compareCraftId,
                mnemonic: compareCraftId,
                primary: false,
                comparisonOverlay: true,
            },
        ],
    };

    // Build raw sceneState.bodies directly from the primary mission's cheb data
    // at the requested display time.  The compare craft is sampled at the
    // matching source time via the alignment offset that the resolver applies
    // internally, so we provide the *secondary's* raw position at the display
    // time here — createNormalizedComparisonDisplayState only scales the
    // values; it does not re-sample them.
    const jdDisplay = JD_UNIX_EPOCH + (displayTimeMs + TDB_OFFSET_MS) / MS_PER_DAY;

    const primaryLaunchMs = msFromIso(
        primaryName === "artemis1" ? "2022-11-16T06:47:44Z" : "2026-04-01T22:35:12Z",
    );
    const secondaryLaunchMs = msFromIso(
        secondaryName === "artemis1" ? "2022-11-16T06:47:44Z" : "2026-04-01T22:35:12Z",
    );
    const sourceTimeMs = displayTimeMs + (secondaryLaunchMs - primaryLaunchMs);
    const jdSource = JD_UNIX_EPOCH + (sourceTimeMs + TDB_OFFSET_MS) / MS_PER_DAY;

    const primaryMoonPos = evaluateBody(primaryCheb, "MOON", jdDisplay);
    const primarySCPos = evaluateBody(primaryCheb, "SC", jdDisplay);
    const secondaryCraftPos = evaluateBody(secondaryCheb, "SC", jdSource);

    const bodies = {
        MOON: {
            available: true,
            position: primaryMoonPos || { x: 0, y: 0, z: 0 },
            velocity: { vx: 0, vy: 0, vz: 0 },
        },
        SC: {
            available: true,
            position: primarySCPos || { x: 0, y: 0, z: 0 },
            velocity: { vx: 0, vy: 0, vz: 0 },
        },
        [compareCraftId]: {
            available: true,
            position: secondaryCraftPos || { x: 0, y: 0, z: 0 },
            velocity: { vx: 0, vy: 0, vz: 0 },
        },
    };

    return {
        compareCraftId,
        compareMoonAliasId,
        chebyshevData,
        chebyshevDataLoaded,
        globalConfig,
        sceneState: {
            time: displayTimeMs,
            config: "geo",
            bodies,
        },
        rawDistances: {
            primaryMoon: magnitude(primaryMoonPos),
            primarySC: magnitude(primarySCPos),
            secondarySC: magnitude(secondaryCraftPos),
        },
    };
}

function runCompare({ primary, secondary, displayTimeMs, label }) {
    const ctx = buildCompareContext({ primary, secondary, displayTimeMs });

    const displayState = createNormalizedComparisonDisplayState(ctx.sceneState, {
        globalConfig: ctx.globalConfig,
        npzData: {},
        npzDataLoaded: {},
        chebyshevData: ctx.chebyshevData,
        chebyshevDataLoaded: ctx.chebyshevDataLoaded,
        defaultSpacecraftSource: "chebyshev",
    });

    const moonScaled = magnitude(displayState.bodies.MOON.position);
    const primaryScScaled = magnitude(displayState.bodies.SC.position);
    const secondaryScScaled = magnitude(
        displayState.bodies[ctx.compareCraftId].position,
    );

    const scales = displayState.comparisonNormalizationScaleByBodyId;

    console.log(`\n=== ${label} ===`);
    console.log(`  raw primary MOON:        ${ctx.rawDistances.primaryMoon.toFixed(0)} km`);
    console.log(`  raw primary SC:          ${ctx.rawDistances.primarySC.toFixed(0)} km`);
    console.log(`  raw secondary SC:        ${ctx.rawDistances.secondarySC.toFixed(0)} km`);
    console.log(`  scaled MOON:             ${moonScaled.toFixed(0)} km (scale=${scales.MOON?.toFixed(4)})`);
    console.log(`  scaled primary SC:       ${primaryScScaled.toFixed(0)} km (scale=${scales.SC?.toFixed(4)})`);
    console.log(`  scaled secondary SC:     ${secondaryScScaled.toFixed(0)} km (scale=${scales[ctx.compareCraftId]?.toFixed(4)})`);
    console.log(`  REFERENCE:               ${COMPARISON_REFERENCE_DISTANCE_KM.toFixed(0)} km`);

    return { moonScaled, primaryScScaled, secondaryScScaled, rawDistances: ctx.rawDistances };
}

// Sweep the whole comparison display window.  At each display timestamp we
// report the maximum scaled magnitude across the primary and compare-craft
// trajectories — this is what actually gets painted on screen.
function sweepCurveBounds({ primary, secondary, displayTimeMs, label }) {
    const ctx = buildCompareContext({ primary, secondary, displayTimeMs });

    const primaryLaunchMs = msFromIso(
        primary.name === "artemis1" ? "2022-11-16T06:47:44Z" : "2026-04-01T22:35:12Z",
    );
    const secondaryLaunchMs = msFromIso(
        secondary.name === "artemis1" ? "2022-11-16T06:47:44Z" : "2026-04-01T22:35:12Z",
    );
    const alignmentOffsetMs = secondaryLaunchMs - primaryLaunchMs;

    const displayStart = ctx.globalConfig.comparisonOverlay
        .displayTimeRangesByOrigin.geo.startMs;
    const displayEnd = ctx.globalConfig.comparisonOverlay
        .displayTimeRangesByOrigin.geo.endMs;
    const STEP_MS = 30 * 60 * 1000; // 30 minutes

    let maxPrimaryScScaled = 0;
    let maxSecondaryScScaled = 0;
    let maxMoonScaled = 0;
    let minMoonScaled = Infinity;
    let samplesPrimary = 0;
    let samplesSecondary = 0;

    for (let t = displayStart; t <= displayEnd; t += STEP_MS) {
        const jdDisp = JD_UNIX_EPOCH + (t + TDB_OFFSET_MS) / MS_PER_DAY;
        const jdSrc = JD_UNIX_EPOCH + (t + alignmentOffsetMs + TDB_OFFSET_MS) / MS_PER_DAY;

        const moonPos = evaluateBody(primary.data, "MOON", jdDisp);
        const primaryScPos = evaluateBody(primary.data, "SC", jdDisp);
        const secondaryScPos = evaluateBody(secondary.data, "SC", jdSrc);
        const secondaryMoonPos = evaluateBody(secondary.data, "MOON", jdSrc);
        if (!moonPos) continue;

        const sceneState = {
            time: t,
            config: "geo",
            bodies: {
                MOON: { available: true, position: moonPos, velocity: { vx: 0, vy: 0, vz: 0 } },
            },
        };
        if (primaryScPos) {
            sceneState.bodies.SC = {
                available: true,
                position: primaryScPos,
                velocity: { vx: 0, vy: 0, vz: 0 },
            };
            samplesPrimary += 1;
        }
        if (secondaryScPos && secondaryMoonPos) {
            sceneState.bodies[ctx.compareCraftId] = {
                available: true,
                position: secondaryScPos,
                velocity: { vx: 0, vy: 0, vz: 0 },
            };
            samplesSecondary += 1;
        }

        const display = createNormalizedComparisonDisplayState(sceneState, {
            globalConfig: ctx.globalConfig,
            npzData: {},
            npzDataLoaded: {},
            chebyshevData: ctx.chebyshevData,
            chebyshevDataLoaded: ctx.chebyshevDataLoaded,
            defaultSpacecraftSource: "chebyshev",
        });

        const m = magnitude(display.bodies.MOON.position);
        if (Number.isFinite(m)) {
            if (m > maxMoonScaled) maxMoonScaled = m;
            if (m < minMoonScaled) minMoonScaled = m;
        }
        if (display.bodies.SC) {
            const s = magnitude(display.bodies.SC.position);
            if (s > maxPrimaryScScaled) maxPrimaryScScaled = s;
        }
        if (display.bodies[ctx.compareCraftId]) {
            const s = magnitude(display.bodies[ctx.compareCraftId].position);
            if (s > maxSecondaryScScaled) maxSecondaryScScaled = s;
        }
    }

    console.log(`\n=== sweep: ${label} ===`);
    console.log(`  samples primary=${samplesPrimary}  secondary=${samplesSecondary}`);
    console.log(`  MOON scaled range:       ${minMoonScaled.toFixed(0)} — ${maxMoonScaled.toFixed(0)} km`);
    console.log(`  primary SC max scaled:   ${maxPrimaryScScaled.toFixed(0)} km`);
    console.log(`  secondary SC max scaled: ${maxSecondaryScScaled.toFixed(0)} km`);
    console.log(`  REFERENCE:               ${COMPARISON_REFERENCE_DISTANCE_KM.toFixed(0)} km`);

    return {
        maxPrimaryScScaled,
        maxSecondaryScScaled,
        maxMoonScaled,
        minMoonScaled,
        samplesPrimary,
        samplesSecondary,
    };
}

describe("mission compare relative scaling (Artemis 1 vs Artemis 2)", () => {
    const EPS_KM = 20000; // generous margin — flyby close-approach is <500 km, plus cheb noise

    it("case A: A1 primary / A2 secondary at A1 outbound flyby", () => {
        const result = runCompare({
            primary: { name: "artemis1", data: A1 },
            secondary: { name: "artemis2", data: A2 },
            displayTimeMs: msFromIso(A1_OUTBOUND_FLYBY_ISO),
            label: "A1 primary / A2 secondary @ A1 outbound flyby",
        });

        expect(result.moonScaled).toBeCloseTo(COMPARISON_REFERENCE_DISTANCE_KM, -3);
        expect(Math.abs(result.primaryScScaled - COMPARISON_REFERENCE_DISTANCE_KM))
            .toBeLessThan(EPS_KM);
        expect(Math.abs(result.secondaryScScaled - COMPARISON_REFERENCE_DISTANCE_KM))
            .toBeLessThan(EPS_KM);
    });

    it("case B: A2 primary / A1 secondary at A2 lunar flyby", () => {
        const result = runCompare({
            primary: { name: "artemis2", data: A2 },
            secondary: { name: "artemis1", data: A1 },
            displayTimeMs: msFromIso(A2_LUNAR_FLYBY_ISO),
            label: "A2 primary / A1 secondary @ A2 lunar flyby",
        });

        expect(result.moonScaled).toBeCloseTo(COMPARISON_REFERENCE_DISTANCE_KM, -3);
        expect(Math.abs(result.primaryScScaled - COMPARISON_REFERENCE_DISTANCE_KM))
            .toBeLessThan(EPS_KM);
        expect(Math.abs(result.secondaryScScaled - COMPARISON_REFERENCE_DISTANCE_KM))
            .toBeLessThan(EPS_KM);
    });

    // Sweeps across the full display window so we can compare the shape/extent
    // of each trajectory after normalization.  If one ordering collapses the
    // scale, its max scaled distance will balloon well past ~450,000 km.
    it("case A sweep: primary+secondary scaled extents stay near the Moon reference", () => {
        const sweep = sweepCurveBounds({
            primary: { name: "artemis1", data: A1 },
            secondary: { name: "artemis2", data: A2 },
            displayTimeMs: msFromIso(A1_OUTBOUND_FLYBY_ISO),
            label: "A1 primary / A2 secondary",
        });

        expect(sweep.samplesPrimary).toBeGreaterThan(0);
        expect(sweep.samplesSecondary).toBeGreaterThan(0);
        // Both trajectories pass through DRO / flyby radii; after scaling they
        // should stay within a few tens of thousands of km of the reference
        // Earth-Moon distance.
        expect(sweep.maxPrimaryScScaled).toBeLessThan(520000);
        expect(sweep.maxSecondaryScScaled).toBeLessThan(520000);
    });

    it("case B sweep: primary+secondary scaled extents stay near the Moon reference", () => {
        const sweep = sweepCurveBounds({
            primary: { name: "artemis2", data: A2 },
            secondary: { name: "artemis1", data: A1 },
            displayTimeMs: msFromIso(A2_LUNAR_FLYBY_ISO),
            label: "A2 primary / A1 secondary",
        });

        expect(sweep.samplesPrimary).toBeGreaterThan(0);
        expect(sweep.samplesSecondary).toBeGreaterThan(0);
        expect(sweep.maxPrimaryScScaled).toBeLessThan(520000);
        expect(sweep.maxSecondaryScScaled).toBeLessThan(520000);
    });

    // Exercises the REAL runtime curve builder: generateBodyCurve() samples the
    // body ephemeris at display timestamps, and normalizeComparisonCurveVectors
    // applies the scale resolver across the full sampled curve.  If anything
    // along the path (time mapping, body aliasing, scale lookup) is asymmetric,
    // one ordering will produce a curve whose max magnitude balloons.
    function runRealCurveBuilder({ primary, secondary, displayTimeMs, label }) {
        const ctx = buildCompareContext({ primary, secondary, displayTimeMs });
        const startMs = ctx.globalConfig.comparisonOverlay
            .displayTimeRangesByOrigin.geo.startMs;
        const endMs = ctx.globalConfig.comparisonOverlay
            .displayTimeRangesByOrigin.geo.endMs;
        const STEP_MS = 60 * 1000; // 1 minute — matches real runtime step

        const commonArgs = {
            config: "geo",
            startTimeMs: startMs,
            endTimeMs: endMs,
            stepMs: STEP_MS,
            npzData: {},
            npzDataLoaded: {},
            chebyshevData: ctx.chebyshevData,
            chebyshevDataLoaded: ctx.chebyshevDataLoaded,
            globalConfig: ctx.globalConfig,
            resolvedSource: "chebyshev",
            spacecraftMnemonic: "ORION",
            defaultSpacecraftSource: "chebyshev",
        };

        const primaryRawVectors = generateBodyCurve({ ...commonArgs, bodyId: "SC" });
        const secondaryRawVectors = generateBodyCurve({
            ...commonArgs,
            bodyId: ctx.compareCraftId,
        });

        const primaryScaled = normalizeComparisonCurveVectors({
            compareMode: true,
            bodyId: "SC",
            vectors: primaryRawVectors,
            config: "geo",
            globalConfig: ctx.globalConfig,
            npzData: {},
            npzDataLoaded: {},
            chebyshevData: ctx.chebyshevData,
            chebyshevDataLoaded: ctx.chebyshevDataLoaded,
            defaultSpacecraftSource: "chebyshev",
        });
        const secondaryScaled = normalizeComparisonCurveVectors({
            compareMode: true,
            bodyId: ctx.compareCraftId,
            vectors: secondaryRawVectors,
            config: "geo",
            globalConfig: ctx.globalConfig,
            npzData: {},
            npzDataLoaded: {},
            chebyshevData: ctx.chebyshevData,
            chebyshevDataLoaded: ctx.chebyshevDataLoaded,
            defaultSpacecraftSource: "chebyshev",
        });

        const maxMag = (vs) => vs.reduce(
            (acc, v) => Math.max(acc, magnitude({ x: v.x, y: v.y, z: v.z })),
            0,
        );

        const primaryMax = maxMag(primaryScaled);
        const secondaryMax = maxMag(secondaryScaled);
        const primaryRawMax = maxMag(primaryRawVectors);
        const secondaryRawMax = maxMag(secondaryRawVectors);

        console.log(`\n=== real curve builder: ${label} ===`);
        console.log(`  primary raw  samples=${primaryRawVectors.length} max=${primaryRawMax.toFixed(0)} km`);
        console.log(`  primary scaled samples=${primaryScaled.length} max=${primaryMax.toFixed(0)} km`);
        console.log(`  secondary raw  samples=${secondaryRawVectors.length} max=${secondaryRawMax.toFixed(0)} km`);
        console.log(`  secondary scaled samples=${secondaryScaled.length} max=${secondaryMax.toFixed(0)} km`);
        console.log(`  REFERENCE: ${COMPARISON_REFERENCE_DISTANCE_KM.toFixed(0)} km`);

        return {
            primaryMax,
            secondaryMax,
            primarySamples: primaryScaled.length,
            secondarySamples: secondaryScaled.length,
        };
    }

    it("case A real curve: both craft curves stay near Moon reference after real pipeline", () => {
        const result = runRealCurveBuilder({
            primary: { name: "artemis1", data: A1 },
            secondary: { name: "artemis2", data: A2 },
            displayTimeMs: msFromIso(A1_OUTBOUND_FLYBY_ISO),
            label: "A1 primary / A2 secondary — real pipeline",
        });

        expect(result.primarySamples).toBeGreaterThan(100);
        expect(result.secondarySamples).toBeGreaterThan(100);
        expect(result.primaryMax).toBeLessThan(520000);
        expect(result.secondaryMax).toBeLessThan(520000);
    });

    it("case B real curve: both craft curves stay near Moon reference after real pipeline", () => {
        const result = runRealCurveBuilder({
            primary: { name: "artemis2", data: A2 },
            secondary: { name: "artemis1", data: A1 },
            displayTimeMs: msFromIso(A2_LUNAR_FLYBY_ISO),
            label: "A2 primary / A1 secondary — real pipeline",
        });

        expect(result.primarySamples).toBeGreaterThan(100);
        expect(result.secondarySamples).toBeGreaterThan(100);
        expect(result.primaryMax).toBeLessThan(520000);
        expect(result.secondaryMax).toBeLessThan(520000);
    });

    // Regression: when A2 is primary, its Moon/FRAME_ROT data ends ~April 10
    // but the compare display window extends to ~April 25 to cover A1's
    // alignment-mapped trajectory.  Past April 10 the scene Moon used to
    // render at the last primary-Moon distance (~397k km) while the
    // comparison scale fell back to 1 — so the Moon "jumped" and the A1
    // flyby curve no longer wrapped around it.  The fallback to the overlay
    // alias should now keep both the Moon body and the scale consistent.
    it("case B past A2 data end: Moon and compare craft stay at REFERENCE via alias fallback", () => {
        const primary = { name: "artemis2", data: A2 };
        const secondary = { name: "artemis1", data: A1 };
        // A2 MOON ends ~2026-04-10T12:06Z.  Pick a display time well past
        // that so only the alias can satisfy the lookup.
        const pastEndMs = msFromIso("2026-04-20T00:00:00Z");

        const ctx = buildCompareContext({
            primary,
            secondary,
            displayTimeMs: pastEndMs,
        });

        // Sanity: direct A2 MOON really is out of range at pastEndMs.  If
        // this becomes false in the future (e.g. data extended), the test
        // below is moot and this assertion will catch it.
        const jdPast = JD_UNIX_EPOCH + (pastEndMs + TDB_OFFSET_MS) / MS_PER_DAY;
        expect(evaluateBody(A2, "MOON", jdPast)).toBeNull();

        // Build a scene state with *no* primary Moon position (simulating
        // what computeBodyState would produce before the alias fallback
        // runs).  createNormalizedComparisonDisplayState only scales;
        // the alias-driven recovery of the Moon body position itself is
        // exercised indirectly through the scale resolver here.
        const aliasJd = JD_UNIX_EPOCH
            + (pastEndMs + (msFromIso("2022-11-16T06:47:44Z") - msFromIso("2026-04-01T22:35:12Z")) + TDB_OFFSET_MS)
            / MS_PER_DAY;
        const aliasMoonPos = evaluateBody(A1, "MOON", aliasJd);
        expect(aliasMoonPos).not.toBeNull();
        const aliasMoonDistanceKm = magnitude(aliasMoonPos);

        // Scale resolver should now fall back to the alias and produce
        // scale = REFERENCE / aliasMoonDistance.
        const scaleResolverInput = {
            compareMode: true,
            bodyId: "MOON",
            vectors: [
                { x: aliasMoonDistanceKm, y: 0, z: 0, vx: 0, vy: 0, vz: 0, timeMs: pastEndMs },
            ],
            config: "geo",
            globalConfig: ctx.globalConfig,
            npzData: {},
            npzDataLoaded: {},
            chebyshevData: ctx.chebyshevData,
            chebyshevDataLoaded: ctx.chebyshevDataLoaded,
            defaultSpacecraftSource: "chebyshev",
        };
        const scaledMoonVectors = normalizeComparisonCurveVectors(scaleResolverInput);
        const scaledMoonMag = magnitude({
            x: scaledMoonVectors[0].x,
            y: scaledMoonVectors[0].y,
            z: scaledMoonVectors[0].z,
        });
        expect(scaledMoonMag).toBeCloseTo(COMPARISON_REFERENCE_DISTANCE_KM, -3);

        // The scale applied past A2's end should come from the A1 Moon
        // alias, not 1.  Pre-fix it would have defaulted to 1 — so the
        // scaled-vs-raw ratio equalling raw's own `REFERENCE / aliasMoon`
        // proves the fallback kicked in.
        const expectedScale =
            COMPARISON_REFERENCE_DISTANCE_KM / aliasMoonDistanceKm;
        expect(scaledMoonMag / aliasMoonDistanceKm).toBeCloseTo(expectedScale, 6);
        expect(expectedScale).not.toBe(1);
    });
});
