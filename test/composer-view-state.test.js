import { describe, expect, it } from "vitest";

import {
    normalizeComposerLockTarget,
    resolveComposerViewIntent,
} from "../src/platform/js/core/domain/composer-view-state.js";

describe("composer view state", () => {
    it("normalizes unknown lock targets to Free", () => {
        expect(normalizeComposerLockTarget("earth")).toBe("earth");
        expect(normalizeComposerLockTarget("MOON")).toBe("moon");
        expect(normalizeComposerLockTarget("")).toBe("none");
        expect(normalizeComposerLockTarget("mars")).toBe("none");
    });

    it("keeps Free from carrying Auto FoV", () => {
        const result = resolveComposerViewIntent({
            lockTarget: "moon",
            autoFovEnabled: true,
        }, {
            type: "lock-target",
            target: "none",
        });

        expect(result.state.lockTarget).toBe("none");
        expect(result.state.autoFovEnabled).toBe(false);
    });

    it("preserves manual FoV state when re-clicking the same body lock", () => {
        const result = resolveComposerViewIntent({
            lockTarget: "moon",
            autoFovEnabled: false,
        }, {
            type: "lock-target",
            target: "moon",
        });

        expect(result.state.lockTarget).toBe("moon");
        expect(result.state.autoFovEnabled).toBe(false);
    });

    it("manual lock selection exits stale media-shot state", () => {
        const result = resolveComposerViewIntent({
            lockTarget: "earth",
            autoFovEnabled: false,
            mediaDriven: true,
            surfaceTarget: { bodyId: "moon" },
        }, {
            type: "lock-target",
            target: "moon",
        });

        expect(result.state.lockTarget).toBe("moon");
        expect(result.state.mediaDriven).toBe(false);
        expect(result.state.surfaceTarget).toBe(null);
    });

    it("forces guided views to Moon lock with Auto FoV and no media state", () => {
        const result = resolveComposerViewIntent({
            lockTarget: "earth",
            autoFovEnabled: false,
            orientationReference: "moon-north",
            mediaDriven: true,
            surfaceTarget: { bodyId: "moon" },
        }, {
            type: "guided",
        });

        expect(result.state).toMatchObject({
            lockTarget: "moon",
            autoFovEnabled: true,
            orientationReference: "world",
            mediaDriven: false,
            surfaceTarget: null,
        });
    });

    it("uses explicit media FoV as the only manual-FoV media path", () => {
        const result = resolveComposerViewIntent({
            lockTarget: "moon",
            autoFovEnabled: true,
        }, {
            type: "media-shot",
            hint: {
                lockTarget: "earth",
                verticalFovDegrees: 12.5,
            },
        });

        expect(result.applied).toBe(true);
        expect(result.state.lockTarget).toBe("earth");
        expect(result.state.autoFovEnabled).toBe(false);
        expect(result.state.orientationReference).toBe("moon-north");
        expect(result.state.manualFovDegrees).toBe(12.5);
        expect(result.state.mediaDriven).toBe(true);
    });

    it("keeps media shots without an explicit FoV in Auto FoV", () => {
        const result = resolveComposerViewIntent({
            lockTarget: "earth",
            autoFovEnabled: false,
        }, {
            type: "media-shot",
            hint: {
                lockTarget: "moon",
                verticalFovDegrees: Number.NaN,
            },
        });

        expect(result.applied).toBe(true);
        expect(result.state.lockTarget).toBe("moon");
        expect(result.state.autoFovEnabled).toBe(true);
        expect(result.state.orientationReference).toBe("world");
        expect(Number.isFinite(result.state.manualFovDegrees)).toBe(false);
    });

    it("does not apply media hints without an Earth or Moon lock target", () => {
        const result = resolveComposerViewIntent({
            lockTarget: "moon",
            autoFovEnabled: true,
        }, {
            type: "media-shot",
            hint: {
                lockTarget: "none",
                verticalFovDegrees: 8,
            },
        });

        expect(result.applied).toBe(false);
        expect(result.state.lockTarget).toBe("moon");
        expect(result.state.autoFovEnabled).toBe(true);
    });
});
