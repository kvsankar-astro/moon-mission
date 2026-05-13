import { describe, expect, it } from "vitest";

import {
    SunRenderer,
    sampleSolarCoronaOuterFade,
    sampleSolarCoronaModel,
} from "../src/platform/js/rendering/sun-renderer.js";

describe("sampleSolarCoronaModel", () => {
    it("falls off from the inner K-corona into the broad outer F-corona", () => {
        const inner = sampleSolarCoronaModel(1.15, 0);
        const middle = sampleSolarCoronaModel(8, 0);
        const outer = sampleSolarCoronaModel(45, 0);

        expect(inner.alpha).toBeGreaterThan(middle.alpha);
        expect(middle.alpha).toBeGreaterThan(outer.alpha);
        expect(outer.fCorona).toBeGreaterThan(0);
        expect(outer.alpha).toBeGreaterThan(0);
    });

    it("keeps the wide F-corona brighter along the ecliptic than over the poles", () => {
        const alongEcliptic = sampleSolarCoronaModel(35, -0.16);
        const overPole = sampleSolarCoronaModel(35, -0.16 + (Math.PI * 0.5));

        expect(alongEcliptic.fCorona).toBeGreaterThan(overPole.fCorona);
        expect(alongEcliptic.alpha).toBeGreaterThan(overPole.alpha);
    });

    it("adds structured streamers in the inner and middle corona", () => {
        const streamerAxis = sampleSolarCoronaModel(4, -0.24);
        const quietAngle = sampleSolarCoronaModel(4, 1.2);

        expect(streamerAxis.streamers).toBeGreaterThan(quietAngle.streamers);
        expect(streamerAxis.alpha).toBeGreaterThan(quietAngle.alpha);
    });

    it("can shift streamer texture phases for layered corona motion", () => {
        const base = sampleSolarCoronaModel(4, -0.24);
        const shifted = sampleSolarCoronaModel(4, -0.24, {
            streamerPhaseRad: 0.63,
            streamerStrengthMul: 1.55,
            weavePhaseRad: 1.9,
        });

        expect(shifted.signal).not.toBeCloseTo(base.signal, 5);
        expect(shifted.alpha).toBeGreaterThan(0);
    });

    it("uses an angular outer fade so the corona does not end as a perfect circle", () => {
        const streamerDirection = sampleSolarCoronaOuterFade(0.89, -0.24);
        const quietDirection = sampleSolarCoronaOuterFade(0.89, 1.45);

        expect(streamerDirection).toBeGreaterThan(quietDirection);
        expect(Math.abs(streamerDirection - quietDirection)).toBeGreaterThan(0.2);
    });
});

describe("SunRenderer corona animation", () => {
    it("animates layered corona material state without enabling flare sprites", () => {
        const renderer = Object.assign(Object.create(SunRenderer.prototype), {
            _visualState: {
                coronaOpacity: 0.8,
                coronaFlowOpacity: 0.4,
                coronaFlowScaleMul: 84,
                coronaMotionMul: 1,
            },
            coronaSprite: {
                material: {},
            },
            coronaFlowSprite: {
                material: {},
                scale: {
                    value: 0,
                    setScalar(nextValue) {
                        this.value = nextValue;
                    },
                },
                visible: false,
            },
            radius: 1,
        });

        renderer.updateAppearance(0);
        const firstBaseRotation = renderer.coronaSprite.material.rotation;
        const firstFlowRotation = renderer.coronaFlowSprite.material.rotation;
        const firstFlowOpacity = renderer.coronaFlowSprite.material.opacity;
        const firstFlowScale = renderer.coronaFlowSprite.scale.value;

        renderer.updateAppearance(5000);

        expect(renderer.coronaSprite.material.rotation).not.toBeCloseTo(firstBaseRotation, 6);
        expect(renderer.coronaFlowSprite.material.rotation).not.toBeCloseTo(firstFlowRotation, 6);
        expect(renderer.coronaFlowSprite.material.opacity).not.toBeCloseTo(firstFlowOpacity, 6);
        expect(renderer.coronaFlowSprite.scale.value).not.toBeCloseTo(firstFlowScale, 6);
        expect(renderer.coronaFlowSprite.visible).toBe(true);
    });
});
