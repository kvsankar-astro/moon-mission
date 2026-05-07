import { describe, expect, it } from "vitest";

import {
    resolveStarDisplayName,
} from "../src/platform/js/core/domain/star-display-names.js";
import {
    STAR_NAME_CROSS_INDEX,
} from "../src/platform/js/rendering/star-name-cross-index.js";

describe("resolveStarDisplayName", () => {
    it("uses HIP-keyed common names from the generated cross index", () => {
        expect(resolveStarDisplayName({ hip: 32349 }, STAR_NAME_CROSS_INDEX)).toBe("Sirius");
        expect(resolveStarDisplayName({ hip: 91262 }, STAR_NAME_CROSS_INDEX)).toBe("Vega");
    });

    it("prefers curated common names before alternate Skyfield names", () => {
        expect(resolveStarDisplayName({ hip: 67301 }, STAR_NAME_CROSS_INDEX)).toBe("Alkaid");
    });

    it("uses Bayer or Flamsteed designations for stars without common names", () => {
        expect(resolveStarDisplayName({ hip: 1067 }, STAR_NAME_CROSS_INDEX)).toBe("γ Peg");
        expect(resolveStarDisplayName({ hip: 145 }, STAR_NAME_CROSS_INDEX)).toBe("29 Psc");
    });

    it("does not expose anonymous HIP identifiers as display labels", () => {
        expect(resolveStarDisplayName({ hip: 999999, name: "HIP 999999" }, STAR_NAME_CROSS_INDEX)).toBe("");
    });
});
