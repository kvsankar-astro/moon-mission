function createInitConfigUiActions(deps) {
    const {
        d3,
        getEventInfos,
        bindBurnButtons,
        getBurnButtonHandler,
        SwiperClass,
        updateEventInfo,
        clearEventInfo,
    } = deps;

    function getEventHoverText(eventInfo) {
        return eventInfo?.hoverText || eventInfo?.infoText || eventInfo?.label || "";
    }

    function renderBurnButtons() {
        const eventInfos = getEventInfos() || [];
        d3.select("#burnbuttons").html("");

        for (let i = 0; i < eventInfos.length; ++i) {
            const eventInfo = eventInfos[i];
            const button = d3.select("#burnbuttons")
                .append("div")
                .attr("class", "swiper-slide")
                .append("button")
                .attr("id", "burn" + (i + 1))
                .attr("data-event-key", eventInfo["key"] || "")
                .attr("type", "button")
                .attr(
                    "class",
                    eventInfo.clickable === false
                        ? "button burnbutton burnbutton--inactive"
                        : "button burnbutton",
                )
                .attr("aria-disabled", eventInfo.clickable === false ? "true" : "false")
                .attr("title", getEventHoverText(eventInfo))
                .html(eventInfo["label"]);

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

    function bindBurnEventButtons() {
        const eventInfos = getEventInfos() || [];
        bindBurnButtons(eventInfos.length, getBurnButtonHandler());
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
            spaceBetween: 6,
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
        initializeSwipers,
    };
}

export { createInitConfigUiActions };
