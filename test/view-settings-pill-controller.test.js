import { describe, expect, it, vi } from "vitest";

import { createViewSettingsPillController } from "../src/platform/js/ui/view-settings-pill-controller.js";

function createClassList(initial = []) {
    const values = new Set(initial);
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        contains(value) {
            return values.has(value);
        },
        toggle(value, force) {
            if (force === true) {
                values.add(value);
                return true;
            }
            if (force === false) {
                values.delete(value);
                return false;
            }
            if (values.has(value)) {
                values.delete(value);
                return false;
            }
            values.add(value);
            return true;
        },
    };
}

function createElement(id, options = {}) {
    const listeners = new Map();
    const attributes = new Map();
    return {
        id,
        checked: options.checked === true,
        disabled: options.disabled === true,
        hidden: options.hidden === true,
        textContent: options.textContent || "",
        title: options.title || "",
        style: {
            display: options.display || "",
            visibility: options.visibility || "",
        },
        classList: createClassList(options.classes || []),
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = listeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
            this[name] = String(value);
        },
        getAttribute(name) {
            return attributes.get(name) || "";
        },
        closest(selector) {
            if (selector === ".settings-option" || selector === "label") {
                return options.closestSettingsOption || null;
            }
            return null;
        },
    };
}

function createHarness(options = {}) {
    const rafQueue = [];
    const observerInstances = [];
    let moonProfile = options.moonProfile || "fast";
    let photoMode = options.photoMode === true;

    class FakeMutationObserver {
        constructor(callback) {
            this.callback = callback;
            this.targets = [];
            observerInstances.push(this);
        }

        observe(target, config) {
            this.targets.push({ config, target });
        }
    }

    const landingOptionRow = createElement("landing-option-row");
    const originEarthInput = createElement("origin-earth", { checked: true });
    const originMoonInput = createElement("origin-moon");
    const originRelativeInput = createElement("origin-relative");
    const originEarthPill = createElement("origin-pill-earth");
    const originMoonPill = createElement("origin-pill-moon");
    const originRelativePill = createElement("origin-pill-relative");
    const dimension2DInput = createElement("dimension-2D", { checked: true });
    const dimension3DInput = createElement("dimension-3D");
    const dimension2DPill = createElement("dimension-pill-2d");
    const dimension3DPill = createElement("dimension-pill-3d");
    const viewOrbitInput = createElement("view-orbit", { checked: true });
    const viewCratersInput = createElement("view-craters");
    const viewMoonOrbitInput = createElement("view-moon-osculating-orbit", {
        closestSettingsOption: createElement("secondary-orbit-row"),
    });
    const bodyHaloToggle = createElement("view-body-halos", { checked: true });
    const locatorsPill = createElement("locators-pill");
    const orbitPill = createElement("toggle-pill-orbit");
    const cratersPill = createElement("toggle-pill-craters");
    const landingPill = createElement("toggle-pill-landing");
    const moonOrbitPill = createElement("toggle-pill-moon-orbit");
    const descentPill = createElement("toggle-pill-descent");
    const orbitDescentOption = createElement("orbit-descent-option");
    const landingToggle = createElement("landing", { closestSettingsOption: landingOptionRow });
    const landingButton = createElement("landingbutton");
    const orbitLabel = createElement("label-orbit");
    const secondaryOrbitLabel = createElement("label-secondary-body-orbit");
    const fastPill = createElement("moon-profile-pill-fast");
    const qualityPill = createElement("moon-profile-pill-quality");
    const photoModePill = createElement("photo-mode-pill");

    const byId = new Map([
        ["origin-earth", originEarthInput],
        ["origin-moon", originMoonInput],
        ["origin-relative", originRelativeInput],
        ["origin-pill-earth", originEarthPill],
        ["origin-pill-moon", originMoonPill],
        ["origin-pill-relative", originRelativePill],
        ["dimension-2D", dimension2DInput],
        ["dimension-3D", dimension3DInput],
        ["dimension-pill-2d", dimension2DPill],
        ["dimension-pill-3d", dimension3DPill],
        ["view-orbit", viewOrbitInput],
        ["view-craters", viewCratersInput],
        ["view-moon-osculating-orbit", viewMoonOrbitInput],
        ["view-body-halos", bodyHaloToggle],
        ["locators-pill", locatorsPill],
        ["toggle-pill-orbit", orbitPill],
        ["toggle-pill-craters", cratersPill],
        ["toggle-pill-landing", landingPill],
        ["toggle-pill-moon-orbit", moonOrbitPill],
        ["toggle-pill-descent", descentPill],
        ["orbit-descent-option", orbitDescentOption],
        ["landing", landingToggle],
        ["landingbutton", landingButton],
        ["label-orbit", orbitLabel],
        ["label-secondary-body-orbit", secondaryOrbitLabel],
        ["moon-profile-pill-fast", fastPill],
        ["moon-profile-pill-quality", qualityPill],
        ["photo-mode-pill", photoModePill],
    ]);

    const documentRef = {
        body: {
            dataset: {
                mobileActiveTab: options.mobileActiveTab || "",
            },
        },
        getElementById(id) {
            return byId.get(id) || null;
        },
    };

    const windowRef = {
        innerWidth: options.innerWidth || 1024,
        getComputedStyle(element) {
            return {
                display: element.style.display || "",
                visibility: element.style.visibility || "",
            };
        },
    };

    const controlBackend = {
        commitDimensionSelection: vi.fn(),
        commitOriginMode: vi.fn(),
        commitViewSetting: vi.fn(),
        toggleLandingMode: vi.fn(),
    };

    const controller = createViewSettingsPillController({
        controlBackend,
        documentRef,
        windowRef,
        requestAnimationFrameImpl(callback) {
            rafQueue.push(callback);
        },
        MutationObserverImpl: FakeMutationObserver,
        getMoonRenderProfile() {
            return moonProfile;
        },
        setMoonRenderProfile(profile) {
            moonProfile = profile;
            return Promise.resolve(profile);
        },
        getPhotoMode() {
            return photoMode;
        },
        setPhotoMode(value) {
            photoMode = value === true;
            return Promise.resolve(photoMode);
        },
        originPillPairs: [
            ["origin-pill-earth", "origin-earth", "geo"],
            ["origin-pill-moon", "origin-moon", "lunar"],
            ["origin-pill-relative", "origin-relative", "relative"],
        ],
        dimensionPillPairs: [
            ["dimension-pill-2d", "dimension-2D", "2D"],
            ["dimension-pill-3d", "dimension-3D", "3D"],
        ],
        moonProfilePillPairs: [
            ["moon-profile-pill-fast", "fast"],
            ["moon-profile-pill-quality", "quality"],
        ],
        togglePillPairs: [
            ["toggle-pill-orbit", "view-orbit", "viewOrbit"],
            ["toggle-pill-craters", "view-craters", "viewCraters"],
        ],
    });

    function flushRaf() {
        while (rafQueue.length) {
            const callback = rafQueue.shift();
            callback();
        }
    }

    return {
        bodyHaloToggle,
        controlBackend,
        controller,
        cratersPill,
        documentRef,
        fastPill,
        flushRaf,
        landingOptionRow,
        landingPill,
        landingToggle,
        locatorsPill,
        moonOrbitPill,
        observerInstances,
        orbitLabel,
        orbitPill,
        photoModePill,
        originEarthPill,
        originMoonPill,
        originMoonInput,
        originRelativeInput,
        qualityPill,
        secondaryOrbitLabel,
        viewMoonOrbitInput,
        viewOrbitInput,
    };
}

describe("createViewSettingsPillController", function () {
    it("syncs the initial pill states and orbit labels", function () {
        const harness = createHarness();

        harness.controller.bind();

        expect(harness.originEarthPill.classList.contains("is-active")).toBe(true);
        expect(harness.originEarthPill["aria-pressed"]).toBe("true");
        expect(harness.orbitPill.textContent).toBe("Craft Orbit");
        expect(harness.secondaryOrbitLabel.textContent).toBe("Moon Orbit");
        expect(harness.locatorsPill["aria-pressed"]).toBe("true");
    });

    it("ignores disabled origin pills", function () {
        const harness = createHarness();
        harness.originMoonInput.disabled = true;
        harness.originMoonPill.disabled = true;
        harness.originMoonPill.setAttribute("aria-disabled", "true");

        harness.controller.bind();
        harness.originMoonPill.dispatchEvent({ type: "click", target: harness.originMoonPill });
        harness.originMoonInput.checked = false;
        harness.originMoonInput.dispatchEvent({ type: "click", target: harness.originMoonInput });
        harness.originMoonInput.dispatchEvent({ type: "change", target: harness.originMoonInput });

        expect(harness.controlBackend.commitOriginMode).not.toHaveBeenCalledWith("lunar");
    });

    it("commits relative origin changes and hides secondary orbit controls", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.originMoonInput.checked = false;
        harness.originRelativeInput.checked = true;
        harness.originRelativeInput.dispatchEvent({ type: "click" });

        expect(harness.controlBackend.commitOriginMode).toHaveBeenCalledWith("relative");
        expect(harness.viewMoonOrbitInput.disabled).toBe(true);
        expect(harness.viewMoonOrbitInput.checked).toBe(false);
        expect(harness.moonOrbitPill.hidden).toBe(true);
        expect(harness.secondaryOrbitLabel.textContent).toBe("Moon Orbit");
    });

    it("forces locators off on mobile views and commits the false setting", function () {
        const harness = createHarness({
            innerWidth: 480,
            mobileActiveTab: "views",
        });

        harness.controller.bind();
        harness.locatorsPill.dispatchEvent({ type: "click" });

        expect(harness.controlBackend.commitViewSetting).toHaveBeenCalledWith(
            "viewBodyHalos",
            false,
            { sourceId: "locators-pill" },
        );
    });

    it("switches moon profile pills through the async setter", async function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.qualityPill.dispatchEvent({ type: "click" });
        await Promise.resolve();
        await Promise.resolve();

        expect(harness.qualityPill.disabled).toBe(false);
        expect(harness.qualityPill.classList.contains("is-active")).toBe(true);
        expect(harness.fastPill.classList.contains("is-active")).toBe(false);
    });

    it("toggles the photo mode pill through the async setter", async function () {
        const harness = createHarness();

        harness.controller.bind();
        expect(harness.photoModePill.classList.contains("is-active")).toBe(false);

        harness.photoModePill.dispatchEvent({ type: "click" });
        await Promise.resolve();
        await Promise.resolve();

        expect(harness.photoModePill.classList.contains("is-active")).toBe(true);
        expect(harness.photoModePill["aria-pressed"]).toBe("true");
    });

    it("re-syncs landing pill visibility from the mutation observer", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.landingOptionRow.classList.add("settings-option--hidden");
        harness.observerInstances[0].callback();
        harness.flushRaf();

        expect(harness.landingPill.hidden).toBe(true);
        expect(harness.landingPill.disabled).toBe(true);
        expect(harness.cratersPill.title).toBe("Moon Sites available for landing missions");
    });
});
