import {
    applyZoomScaleToFovSlider,
    clampFovDegrees,
    formatFovDegreesLabel,
    fovDegreesToZoomSliderValue,
    zoomSliderValueToFovDegrees,
} from "./fov-slider-scale.js";

function addClasses(element, classNames = []) {
    const names = Array.isArray(classNames) ? classNames : [classNames];
    names
        .map((name) => String(name ?? "").trim())
        .filter(Boolean)
        .forEach((name) => element.classList.add(name));
}

function setOptionalId(element, id) {
    if (typeof id === "string" && id.trim()) {
        element.id = id;
    }
}

/**
 * @typedef {{ label?: string|string[], autoButton?: string|string[], track?: string|string[], edge?: string|string[], slider?: string|string[], value?: string|string[] }} MissionFovControlClassNames
 * @typedef {{ label?: string, autoButton?: string, track?: string, slider?: string, value?: string }} MissionFovControlIds
 */

function createElement(tagName, {
    classNames = [],
    textContent = "",
    id = "",
    type = "",
} = {}) {
    const element = document.createElement(tagName);
    addClasses(element, classNames);
    if (textContent) {
        element.textContent = textContent;
    }
    if (type && "type" in element) {
        element.type = type;
    }
    setOptionalId(element, id);
    return element;
}

export function mountMissionFovControl(container, {
    groupAriaLabel = "Field of view",
    labelText = "Zoom",
    autoButtonText = "Auto",
    tightText = "Tight",
    wideText = "Wide",
    autoButtonAriaLabel = "Automatic field of view",
    sliderAriaLabel = "Zoom slider",
    valueAriaLabel = "Field of view value",
    initialFovDegrees = 50,
    minDegrees = 0.1,
    maxDegrees = 179,
    classNames = {},
    ids = {},
} = {}) {
    /** @type {MissionFovControlClassNames} */
    const normalizedClassNames = classNames || {};
    /** @type {MissionFovControlIds} */
    const normalizedIds = ids || {};
    if (
        !container ||
        typeof container !== "object" ||
        typeof container.replaceChildren !== "function" ||
        typeof container.appendChild !== "function"
    ) {
        return null;
    }

    container.replaceChildren();
    if (groupAriaLabel) {
        container.setAttribute("role", "group");
        container.setAttribute("aria-label", groupAriaLabel);
    }

    const label = createElement("span", {
        classNames: /** @type {any} */ (normalizedClassNames.label),
        textContent: labelText,
        id: normalizedIds.label,
    });

    const autoButton = createElement("button", {
        classNames: /** @type {any} */ (normalizedClassNames.autoButton),
        textContent: autoButtonText,
        id: normalizedIds.autoButton,
        type: "button",
    });
    autoButton.setAttribute("aria-label", autoButtonAriaLabel);

    const track = createElement("div", {
        classNames: /** @type {any} */ (normalizedClassNames.track),
        id: normalizedIds.track,
    });

    const tightEdge = createElement("span", {
        classNames: /** @type {any} */ (normalizedClassNames.edge),
        textContent: tightText,
    });

    const slider = createElement("input", {
        classNames: /** @type {any} */ (normalizedClassNames.slider),
        id: normalizedIds.slider,
        type: "range",
    });
    applyZoomScaleToFovSlider(slider, {
        minDegrees,
        maxDegrees,
        initialFovDegrees,
    });
    slider.setAttribute("aria-label", sliderAriaLabel);

    const wideEdge = createElement("span", {
        classNames: /** @type {any} */ (normalizedClassNames.edge),
        textContent: wideText,
    });

    track.appendChild(tightEdge);
    track.appendChild(slider);
    track.appendChild(wideEdge);

    const value = createElement("output", {
        classNames: /** @type {any} */ (normalizedClassNames.value),
        id: normalizedIds.value,
    });
    value.setAttribute("aria-label", valueAriaLabel);

    container.appendChild(label);
    container.appendChild(autoButton);
    container.appendChild(track);
    container.appendChild(value);

    const control = {
        container,
        label,
        autoButton,
        track,
        tightEdge,
        slider,
        wideEdge,
        value,
        minDegrees,
        maxDegrees,
        clampFovDegrees(nextValue, fallbackDegrees = initialFovDegrees) {
            return clampFovDegrees(nextValue, {
                minDegrees: this.minDegrees,
                maxDegrees: this.maxDegrees,
                fallbackDegrees,
            });
        },
        formatFovDegrees(nextValue, fallbackDegrees = initialFovDegrees) {
            return formatFovDegreesLabel(nextValue, {
                minDegrees: this.minDegrees,
                maxDegrees: this.maxDegrees,
                fallbackDegrees,
                digits: 1,
            });
        },
        readSliderFovDegrees(fallbackDegrees = initialFovDegrees) {
            return zoomSliderValueToFovDegrees(this.slider.value, {
                minDegrees: this.minDegrees,
                maxDegrees: this.maxDegrees,
                fallbackDegrees,
            });
        },
        setFovDegrees(nextValue, fallbackDegrees = initialFovDegrees) {
            const fovDegrees = this.clampFovDegrees(nextValue, fallbackDegrees);
            const formatted = this.formatFovDegrees(fovDegrees, fallbackDegrees);
            this.slider.value = String(Math.round(fovDegreesToZoomSliderValue(fovDegrees, {
                minDegrees: this.minDegrees,
                maxDegrees: this.maxDegrees,
                fallbackDegrees: fovDegrees,
            })));
            this.slider.setAttribute("aria-valuetext", `${formatted} field of view`);
            this.value.value = formatted;
            this.value.textContent = formatted;
            return fovDegrees;
        },
        setAutoEnabled(enabled) {
            const isEnabled = enabled === true;
            this.autoButton.classList.toggle("is-active", isEnabled);
            this.autoButton.setAttribute("aria-pressed", isEnabled ? "true" : "false");
            this.autoButton.title = isEnabled ? "Auto FoV enabled" : "Auto FoV disabled";
        },
        setDisabledState({
            autoButtonDisabled = this.autoButton.disabled,
            sliderDisabled = this.slider.disabled,
            valueDisabled = this.value.getAttribute("aria-disabled") === "true",
        } = {}) {
            this.autoButton.disabled = autoButtonDisabled === true;
            this.slider.disabled = sliderDisabled === true;
            this.value.setAttribute("aria-disabled", valueDisabled === true ? "true" : "false");
            this.value.classList.toggle("is-disabled", valueDisabled === true);
        },
    };

    control.setFovDegrees(initialFovDegrees, initialFovDegrees);
    control.setAutoEnabled(false);
    control.setDisabledState({
        autoButtonDisabled: false,
        sliderDisabled: false,
        valueDisabled: false,
    });

    return control;
}
