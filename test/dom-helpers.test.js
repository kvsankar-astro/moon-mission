import { describe, expect, it } from "vitest";

import {
    isDomElement,
    isDomEventInstance,
    isDomInstance,
} from "../src/platform/js/ui/dom-helpers.js";

describe("dom-helpers realm checks", () => {
    it("uses the node ownerDocument realm for element checks", () => {
        class ForeignElement {}
        const element = new ForeignElement();
        element.ownerDocument = {
            defaultView: {
                Element: ForeignElement,
                HTMLElement: ForeignElement,
            },
        };

        expect(isDomElement(element)).toBe(true);
        expect(isDomInstance(element, "HTMLElement")).toBe(true);
    });

    it("uses the event view realm for event checks", () => {
        class ForeignWheelEvent {}
        const event = new ForeignWheelEvent();
        event.view = {
            WheelEvent: ForeignWheelEvent,
        };

        expect(isDomEventInstance(event, "WheelEvent")).toBe(true);
    });
});
