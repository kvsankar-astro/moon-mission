export function createModeSwitchActions({ d3, d3SelectAll }) {
    function applyModeSwitch({ centerLabel, newMode, otherModes }) {
        d3.select("#mode-" + newMode).attr(
            "style",
            "color: blue; font-weight: bold",
        );
        d3.select("#mode-" + newMode).attr("disabled", null);
        d3SelectAll("." + newMode).style("visibility", "visible");
        d3SelectAll("." + newMode).attr("display", "block");

        for (let i = 0; i < otherModes.length; i++) {
            const otherMode = otherModes[i];
            d3.select("#mode-" + otherMode).attr("style", null);
            d3.select("#mode-" + otherMode).attr("disabled", "disabled");
            d3SelectAll("." + otherMode).style("visibility", "hidden");
            d3SelectAll("." + otherMode).attr("display", "none");
        }

        d3.select("#center").text(centerLabel);
    }

    function switchToGeo() {
        applyModeSwitch({ centerLabel: "Earth", newMode: "geo", otherModes: ["lunar"] });
    }

    function switchToLunar() {
        applyModeSwitch({ centerLabel: "Moon", newMode: "lunar", otherModes: ["geo"] });
    }

    function switchMode(mode) {
        if (mode === "geo") switchToGeo();
        else if (mode === "lunar") switchToLunar();
    }

    function switchDimension(newDim) {
        const oldDim = newDim === "3D" ? "2D" : "3D";
        d3SelectAll(".dimension-" + newDim).style("visibility", "visible");
        d3SelectAll(".dimension-" + newDim).attr("display", "block");
        d3SelectAll(".dimension-" + oldDim).style("visibility", "hidden");
        d3SelectAll(".dimension-" + oldDim).attr("display", "none");
    }

    return {
        switchToGeo,
        switchToLunar,
        switchMode,
        switchDimension,
    };
}

