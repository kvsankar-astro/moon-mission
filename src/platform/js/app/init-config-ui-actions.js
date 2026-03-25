function createInitConfigUiActions(deps) {
    const {
        d3,
        getEventInfos,
        bindBurnButtons,
        getBurnButtonHandler,
        SwiperClass,
    } = deps;

    function renderBurnButtons() {
        const eventInfos = getEventInfos() || [];
        d3.select("#burnbuttons").html("");

        for (let i = 0; i < eventInfos.length; ++i) {
            d3.select("#burnbuttons")
                .append("div")
                .attr("class", "swiper-slide")
                .append("button")
                .attr("id", "burn" + (i + 1))
                .attr("type", "button")
                .attr("class", "button burnbutton")
                .attr("title", eventInfos[i]["label"])
                .html(eventInfos[i]["label"]);
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
