import { describe, expect, it } from "vitest";

import {
    DEFAULT_LUNAR_FEATURE_TYPES,
    LUNAR_FEATURE_PRESET_IDS,
    createDefaultLunarFeatureViewState,
} from "../src/platform/js/core/domain/lunar-feature-view.js";

describe("lunar feature view domain", () => {
    it("defaults to the first Lunar Features group only", () => {
        const state = createDefaultLunarFeatureViewState();
        const enabledTypes = Object.entries(state.lunarFeatureTypeFilters)
            .filter(([, filter]) => filter.enabled !== false)
            .map(([featureType]) => featureType)
            .sort();

        expect(enabledTypes).toEqual([...DEFAULT_LUNAR_FEATURE_TYPES].sort());
    });

    it("exposes the panel preset identifiers", () => {
        expect(LUNAR_FEATURE_PRESET_IDS.NONE).toBe("none");
        expect(LUNAR_FEATURE_PRESET_IDS.DEFAULT).toBe("default");
        expect(LUNAR_FEATURE_PRESET_IDS.ALL).toBe("all");
    });
});
