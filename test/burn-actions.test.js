import { describe, expect, it, vi } from "vitest";
import { createBurnActions } from "../assets/platform/js/app/burn-actions.js";

describe("createBurnActions", () => {
    it("uses typed now events instead of label text", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-02-01T00:00:00Z"));

        const setAnimTime = vi.fn();
        const missionSetTime = vi.fn();
        const burnActions = createBurnActions({
            getEventInfos: () => [
                {
                    kind: "now",
                    label: "Now",
                    startTime: new Date("2020-01-01T00:00:00Z"),
                },
            ],
            setAnimTime,
            missionSetTime,
        });

        burnActions.burnButtonHandler(0);

        expect(setAnimTime).toHaveBeenCalledWith(new Date("2024-02-01T00:00:00Z").getTime());
        expect(missionSetTime).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it("uses event start time for non-now events", () => {
        const setAnimTime = vi.fn();
        const missionSetTime = vi.fn();
        const eventTime = new Date("2023-01-01T12:00:00Z");
        const burnActions = createBurnActions({
            getEventInfos: () => [
                {
                    kind: "fixed",
                    label: "Launch",
                    startTime: eventTime,
                },
            ],
            setAnimTime,
            missionSetTime,
        });

        burnActions.burnButtonHandler(0);

        expect(setAnimTime).toHaveBeenCalledWith(eventTime.getTime());
        expect(missionSetTime).toHaveBeenCalledTimes(1);
    });
});
