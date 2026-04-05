import { describe, expect, it, vi } from "vitest";

import { initRepeatButtons } from "../src/platform/js/app/init-repeat-buttons.js";

describe("initRepeatButtons", () => {
    it("disables only repeat controls during startup and never blanket-disables all buttons", () => {
        const animationScene = {
            lockOnSC: true,
            lockOnMoon: true,
            lockOnEarth: true,
        };
        const setChecked = vi.fn();
        const d3SelectAll = vi.fn(() => ({ attr: vi.fn() }));
        const disabledSelectors = [];
        const d3Select = vi.fn((selector) => ({
            attr: (name, value) => {
                if (name === "disabled" && value === true) {
                    disabledSelectors.push(selector);
                }
                return this;
            },
        }));
        const bindRepeatButtons = vi.fn();
        const resetMouseRepeatState = vi.fn();

        initRepeatButtons({
            d3SelectAll,
            setChecked,
            animationScene,
            bindRepeatButtons,
            d3Select,
            handlersById: {},
            resetMouseRepeatState,
        });

        expect(animationScene.lockOnSC).toBe(false);
        expect(animationScene.lockOnMoon).toBe(false);
        expect(animationScene.lockOnEarth).toBe(false);

        expect(setChecked).toHaveBeenCalledTimes(3);
        expect(setChecked).toHaveBeenNthCalledWith(1, "checkbox-lock-sc", false);
        expect(setChecked).toHaveBeenNthCalledWith(2, "checkbox-lock-moon", false);
        expect(setChecked).toHaveBeenNthCalledWith(3, "checkbox-lock-earth", false);

        // Regression guard: startup should not disable every button globally.
        expect(d3SelectAll).not.toHaveBeenCalled();

        expect(disabledSelectors).toEqual([
            "#zoomin",
            "#zoomout",
            "#panleft",
            "#panright",
            "#panup",
            "#pandown",
            "#forward",
            "#fastforward",
            "#backward",
            "#fastbackward",
            "#slower",
            "#resetspeed",
            "#faster",
            "#realtime",
        ]);

        expect(bindRepeatButtons).toHaveBeenCalledTimes(1);
        const bindArgs = bindRepeatButtons.mock.calls[0][0];
        expect(bindArgs.buttons).toEqual([
            "zoomin",
            "zoomout",
            "panleft",
            "panright",
            "panup",
            "pandown",
            "forward",
            "fastforward",
            "backward",
            "fastbackward",
            "slower",
            "resetspeed",
            "faster",
            "realtime",
        ]);

        bindArgs.onMouseUp();
        expect(resetMouseRepeatState).toHaveBeenLastCalledWith();
        bindArgs.onMouseOut();
        expect(resetMouseRepeatState).toHaveBeenLastCalledWith({ mouseOut: true });
    });
});
