import {
    buildComposeTimelineDisplay,
    resolveComposeTimelineRange,
    resolveComposeTimelineSliderValue,
    resolveComposeTimelineTime,
} from "../core/domain/mobile-compose-timeline-state.js";

function createMobileComposeTimelineSync(deps) {
    const {
        mobileComposeTimelineSlider,
        mobileComposeTimelineValue,
        mobileComposeTimelineLocal,
        timelineSlider,
        burnButtonsHost,
        composeTimelineResolution,
        composeTimelineWindowMs,
        getActiveTab = () => "",
        readEventInfos = () => [],
        resolveFlybyWindowMs,
        resolveFlybyTimeMs,
        formatLocalDateTimeShort,
        createInputEvent = () => new Event("input", { bubbles: true }),
        createChangeEvent = () => new Event("change", { bubbles: true }),
        MutationObserverRef = typeof MutationObserver === "function" ? MutationObserver : null,
    } = deps;

    let dragging = false;
    let activeRange = null;

    function readMainTimelineState() {
        if (
            !timelineSlider ||
            typeof timelineSlider.value === "undefined" ||
            typeof timelineSlider.min === "undefined" ||
            typeof timelineSlider.max === "undefined"
        ) {
            return null;
        }
        const min = Number(timelineSlider.min);
        const max = Number(timelineSlider.max);
        const preciseValue = Number(timelineSlider.dataset?.currentTimeMs);
        const value = Number.isFinite(preciseValue) ? preciseValue : Number(timelineSlider.value);
        if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(value)) {
            return null;
        }
        return {
            slider: timelineSlider,
            min: Math.min(min, max),
            max: Math.max(min, max),
            value: Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max)),
        };
    }

    function seekMainTimelineTime(timeMs, finalize = false) {
        const timelineState = readMainTimelineState();
        if (!timelineState) return;
        const clamped = Math.min(Math.max(timeMs, timelineState.min), timelineState.max);
        timelineState.slider.value = String(clamped);
        const dataset = timelineState.slider.dataset || (timelineState.slider.dataset = {});
        dataset.currentTimeMs = String(clamped);
        dataset.programmaticSeekSource = "mobile-compose";
        dataset.programmaticSeekTimeMs = String(clamped);
        timelineState.slider.dispatchEvent(createInputEvent());
        if (finalize) {
            dataset.programmaticSeekSource = "mobile-compose";
            dataset.programmaticSeekTimeMs = String(clamped);
            timelineState.slider.dispatchEvent(createChangeEvent());
        }
    }

    function renderEmptyState() {
        activeRange = null;
        if (mobileComposeTimelineValue) {
            mobileComposeTimelineValue.textContent = "--";
            mobileComposeTimelineValue.value = "--";
        }
        if (mobileComposeTimelineLocal) {
            mobileComposeTimelineLocal.textContent = "Local: --";
        }
    }

    function sync() {
        const timelineState = readMainTimelineState();
        if (!timelineState || !mobileComposeTimelineSlider) {
            renderEmptyState();
            return;
        }

        const eventInfos = readEventInfos();
        activeRange = resolveComposeTimelineRange({
            timelineState,
            flybyWindow: resolveFlybyWindowMs(eventInfos),
            flybyTimeMs: resolveFlybyTimeMs(eventInfos),
            windowMs: composeTimelineWindowMs,
        });

        if (!dragging) {
            mobileComposeTimelineSlider.value = resolveComposeTimelineSliderValue({
                timelineState,
                range: activeRange,
                resolution: composeTimelineResolution,
            });
        }

        const display = buildComposeTimelineDisplay({
            timelineState,
            formatLocalDateTimeShort,
        });
        if (mobileComposeTimelineValue) {
            mobileComposeTimelineValue.value = display.utcText;
            mobileComposeTimelineValue.textContent = display.utcText;
        }
        if (mobileComposeTimelineLocal) {
            mobileComposeTimelineLocal.textContent = display.localText;
        }
    }

    function handleSliderInput() {
        if (!activeRange) {
            return;
        }
        dragging = true;
        const nextTimeMs = resolveComposeTimelineTime({
            sliderValue: mobileComposeTimelineSlider.value,
            range: activeRange,
            resolution: composeTimelineResolution,
        });
        if (!Number.isFinite(nextTimeMs)) {
            return;
        }
        seekMainTimelineTime(nextTimeMs, false);
        sync();
    }

    function handleSliderFinalize() {
        dragging = false;
        if (!activeRange) {
            return;
        }
        const nextTimeMs = resolveComposeTimelineTime({
            sliderValue: mobileComposeTimelineSlider.value,
            range: activeRange,
            resolution: composeTimelineResolution,
        });
        if (!Number.isFinite(nextTimeMs)) {
            return;
        }
        seekMainTimelineTime(nextTimeMs, true);
        sync();
    }

    function bind() {
        if (mobileComposeTimelineSlider) {
            mobileComposeTimelineSlider.addEventListener("input", handleSliderInput, { passive: true });
            mobileComposeTimelineSlider.addEventListener("pointerdown", () => {
                dragging = true;
            });
            mobileComposeTimelineSlider.addEventListener("pointerup", handleSliderFinalize);
            mobileComposeTimelineSlider.addEventListener("change", handleSliderFinalize);
        }

        if (timelineSlider) {
            const syncFromTimeline = () => {
                if (getActiveTab() === "compose") {
                    sync();
                }
            };
            timelineSlider.addEventListener("input", syncFromTimeline);
            timelineSlider.addEventListener("change", syncFromTimeline);
        }

        if (burnButtonsHost && typeof MutationObserverRef === "function") {
            const observer = new MutationObserverRef(() => {
                if (getActiveTab() === "compose") {
                    sync();
                }
            });
            observer.observe(burnButtonsHost, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["data-event-time-ms", "data-event-key", "title"],
            });
        }
    }

    return {
        bind,
        sync,
    };
}

export { createMobileComposeTimelineSync };
