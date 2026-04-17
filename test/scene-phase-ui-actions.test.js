import { describe, expect, it } from "vitest";

import { createScenePhaseUiActions } from "../src/platform/js/app/scene-phase-ui-actions.js";

function createD3Stub(nodesBySelector) {
    return {
        select(selector) {
            const node = nodesBySelector[selector];
            return {
                html(value) {
                    node.innerHTML = value;
                    return this;
                },
            };
        },
    };
}

describe("scene phase ui actions", () => {
    it("renders active lunar mission phases and mobile text from the phase model", () => {
        const nodes = {
            "#phase-1": { innerHTML: "" },
            "#phase-2": { innerHTML: "" },
            "#phase-3": { innerHTML: "" },
        };
        const mobileText = {};
        const actions = createScenePhaseUiActions({
            d3: createD3Stub(nodes),
            setMobileText(id, text) {
                mobileText[id] = text;
            },
        });

        actions.updatePhaseIndicator({
            phase: "lunar-bound",
        }, {
            is_lunar: true,
        });

        expect(nodes["#phase-1"].innerHTML).toBe("Earth Bound Phase");
        expect(nodes["#phase-2"].innerHTML).toBe("<b><u>Lunar Bound Phase</u></b>");
        expect(nodes["#phase-3"].innerHTML).toBe("Lunar Orbit Phase");
        expect(mobileText["mobile-mission-phase"]).toBe("Lunar Bound");
    });

    it("keeps desktop updates empty for non-lunar missions but still updates mobile text", () => {
        const mobileValues = {};
        const actions = createScenePhaseUiActions({
            d3: createD3Stub({}),
            setMobileText(id, text) {
                mobileValues[id] = text;
            },
        });

        actions.updatePhaseIndicator({
            phase: "earth-bound",
        }, {
            is_lunar: false,
        });

        expect(mobileValues["mobile-mission-phase"]).toBe("Earth Bound");
    });
});
