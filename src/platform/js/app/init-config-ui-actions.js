import { formatDateTimeUTC } from "../utils/time-utils.js";
import { buildEventHoverText } from "./burn-event-metadata.js";
import {
    resolveTimelineEventHoverText,
    resolveTimelineEventLabel,
} from "./comparison-timeline.js";

function createInitConfigUiActions(deps) {
    const {
        d3,
        getEventInfos,
        getTimelineEventInfos = getEventInfos,
        bindBurnButtons,
        getBurnButtonHandler,
        SwiperClass,
        updateEventInfo,
        clearEventInfo,
    } = deps;

    function resolveEventTimeMs(eventInfo) {
        if (!eventInfo) return Number.NaN;
        if (eventInfo.startTime instanceof Date) {
            return eventInfo.startTime.getTime();
        }
        if (Number.isFinite(eventInfo.startTime)) {
            return eventInfo.startTime;
        }
        const parsed = new Date(eventInfo.startTime).getTime();
        return Number.isFinite(parsed) ? parsed : Number.NaN;
    }

    function getEventHoverText(eventInfo) {
        if (eventInfo?.timelineHoverText) {
            return eventInfo.timelineHoverText;
        }

        const baseText = resolveTimelineEventHoverText(eventInfo, buildEventHoverText);
        const eventTimeMs = resolveEventTimeMs(eventInfo);
        if (!Number.isFinite(eventTimeMs)) {
            return baseText;
        }

        const when = formatDateTimeUTC(eventTimeMs);
        return baseText ? `${baseText} • ${when}` : when;
    }

    function renderBurnButtonsWithEventInfos(eventInfos = []) {
        d3.select("#burnbuttons").html("");
        let numberedButtonIndex = 0;

        for (let i = 0; i < eventInfos.length; ++i) {
            const eventInfo = eventInfos[i];
            const eventTimeMs = resolveEventTimeMs(eventInfo);
            const isNowButton = eventInfo?.kind === "now" || eventInfo?.key === "now";
            const buttonId = isNowButton ? "burn-now" : "burn" + (++numberedButtonIndex);
            const button = d3.select("#burnbuttons")
                .append("div")
                .attr("class", "swiper-slide")
                .append("button")
                .attr("id", buttonId)
                .attr("data-event-index", String(i))
                .attr("data-event-key", eventInfo["key"] || "")
                .attr("data-event-time-ms", Number.isFinite(eventTimeMs) ? String(eventTimeMs) : "")
                .attr("data-burn-flag", eventInfo?.burnFlag ? "true" : "false")
                .attr("data-duration-seconds", String(eventInfo?.durationSeconds ?? 0))
                .attr("type", "button")
                .attr(
                    "class",
                    eventInfo.clickable === false
                        ? "button burnbutton burnbutton--inactive"
                        : "button burnbutton",
                )
                .classed("burnbutton--generated", !!eventInfo.generated)
                .classed("burnbutton--comparison", !!eventInfo.comparisonEvent)
                .attr("data-generated", eventInfo.generated ? "true" : "false")
                .attr("aria-disabled", eventInfo.clickable === false ? "true" : "false")
                .attr("title", getEventHoverText(eventInfo))
                .html(resolveTimelineEventLabel(eventInfo));

            const node = button.node();
            if (!node) continue;
            const showHoverText = () => {
                const hoverText = getEventHoverText(eventInfo);
                if (hoverText) {
                    updateEventInfo?.(hoverText);
                }
            };
            const clearHoverText = () => {
                clearEventInfo?.();
            };
            node.addEventListener("mouseenter", showHoverText);
            node.addEventListener("focus", showHoverText);
            node.addEventListener("mouseleave", clearHoverText);
            node.addEventListener("blur", clearHoverText);
        }
    }

    function renderBurnButtons() {
        renderBurnButtonsWithEventInfos(getTimelineEventInfos() || []);
    }

    function bindBurnEventButtons(eventInfos = getTimelineEventInfos() || []) {
        bindBurnButtons(eventInfos.length, getBurnButtonHandler());
    }

    function syncBurnButtons(eventInfos = getTimelineEventInfos() || []) {
        renderBurnButtonsWithEventInfos(eventInfos);
        bindBurnEventButtons(eventInfos);
    }

    function initializeSwipers() {
        new SwiperClass(".swiper1", {
            direction: "horizontal",
            loop: false,
            slidesPerView: "auto",
            watchOverflow: true,
            freeMode: false,
            allowTouchMove: false,
            spaceBetween: 6,
        });

        new SwiperClass(".swiper2", {
            direction: "horizontal",
            loop: false,
            slidesPerView: "auto",
            watchOverflow: true,
            freeMode: true,
            noSwiping: false,
            simulateTouch: true,
            touchStartPreventDefault: false,
            touchMoveStopPropagation: false,
            // Allow drag-to-scroll even when pointer starts on an event button.
            // Swiper treats "button" as focusable by default and skips swiping.
            focusableElements: "input, select, option, textarea, video, label",
            grabCursor: true,
            threshold: 4,
            // Spacing is handled by CSS gap so connector segments can align
            // precisely between adjacent event chips.
            spaceBetween: 0,
        });
    }

    function configureInitConfigControls() {
        renderBurnButtons();
        bindBurnEventButtons();
        initializeSwipers();
    }

    return {
        configureInitConfigControls,
        renderBurnButtons,
        bindBurnEventButtons,
        syncBurnButtons,
        initializeSwipers,
    };
}

export { createInitConfigUiActions };
