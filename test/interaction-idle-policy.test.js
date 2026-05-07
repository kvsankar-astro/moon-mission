import { describe, expect, it } from "vitest";
import {
    resolveDelayUntilInputIdle,
    resolveInputIdleMs,
    shouldDeferForRecentInput,
} from "../src/platform/js/core/domain/interaction-idle-policy.js";

describe("interaction-idle-policy", () => {
    it("computes input idle duration", () => {
        expect(resolveInputIdleMs({
            nowMs: 1500,
            lastInputActivityMs: 1000,
        })).toBe(500);
    });

    it("defers background work until the minimum idle window passes", () => {
        const context = {
            nowMs: 1500,
            lastInputActivityMs: 1000,
            minIdleMs: 800,
        };

        expect(shouldDeferForRecentInput(context)).toBe(true);
        expect(resolveDelayUntilInputIdle(context)).toBe(300);
    });

    it("allows background work when input history is unknown", () => {
        expect(shouldDeferForRecentInput({
            nowMs: 1500,
            lastInputActivityMs: -Infinity,
            minIdleMs: 800,
        })).toBe(false);
    });
});
