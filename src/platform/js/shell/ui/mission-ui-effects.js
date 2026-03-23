function createMissionUiEffects({ d3 }) {
    return {
        setEventInfoText: (text) => {
            d3.select("#eventinfo").text(text);
        },
        setEpochDisplay: ({ epochJD, epochDate }) => {
            d3.select("#epochjd").html(epochJD);
            d3.select("#epochdate").html(epochDate);
        },
    };
}

export { createMissionUiEffects };
