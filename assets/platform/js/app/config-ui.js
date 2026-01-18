export function computeMoonUiPatch({ globalConfig, currentConfig }) {
    const isMoonEnabled = !!globalConfig?.is_lunar;

    /** @type {{ nextConfig?: string, showSelectors: string[], hideSelectors: string[], showLabelForIds: string[], hideLabelForIds: string[], checked: Record<string, boolean> }} */
    const patch = {
        showSelectors: [],
        hideSelectors: [],
        showLabelForIds: [],
        hideLabelForIds: [],
        checked: {},
    };

    if (isMoonEnabled) {
        patch.showLabelForIds.push("origin-moon", "view-moonsoi");
        patch.showSelectors.push("#origin-moon", "#view-moonsoi", ".geo");
        return patch;
    }

    patch.hideLabelForIds.push("origin-moon", "view-moonsoi");
    patch.hideSelectors.push("#origin-moon", "#view-moonsoi", ".geo");

    if (currentConfig === "lunar") {
        patch.nextConfig = "geo";
        patch.checked["origin-earth"] = true;
        patch.checked["origin-moon"] = false;
    }

    patch.checked["checkbox-lock-moon"] = false;
    patch.checked["view-moonsoi"] = false;

    return patch;
}

export function applyMoonUiPatch({ $, setChecked, patch, setConfig }) {
    if (!patch) return;

    for (let i = 0; i < patch.showLabelForIds.length; i++) {
        const id = patch.showLabelForIds[i];
        $("#" + id).closest("label").show();
    }
    for (let i = 0; i < patch.hideLabelForIds.length; i++) {
        const id = patch.hideLabelForIds[i];
        $("#" + id).closest("label").hide();
    }

    for (let i = 0; i < patch.showSelectors.length; i++) {
        $(patch.showSelectors[i]).show();
    }
    for (let i = 0; i < patch.hideSelectors.length; i++) {
        $(patch.hideSelectors[i]).hide();
    }

    if (patch.nextConfig) {
        setConfig?.(patch.nextConfig);
    }

    for (const [id, value] of Object.entries(patch.checked)) {
        setChecked(id, value);
    }
}

export function computeLandingUiPatch({ globalConfig, landingFlag }) {
    const isLandingEnabled = !!globalConfig?.landing?.enabled;

    /** @type {{ showSelectors: string[], hideSelectors: string[], showLabelForIds: string[], hideLabelForIds: string[], checked: Record<string, boolean>, removeClasses: Array<{selector: string, className: string}>, nextLandingFlag?: boolean }} */
    const patch = {
        showSelectors: [],
        hideSelectors: [],
        showLabelForIds: [],
        hideLabelForIds: [],
        checked: {},
        removeClasses: [],
    };

    if (isLandingEnabled) {
        patch.showLabelForIds.push("landing");
        patch.showSelectors.push("#landing", "#landingbutton");
        return patch;
    }

    patch.hideLabelForIds.push("landing");
    patch.hideSelectors.push("#landing", "#landingbutton");

    if (landingFlag) {
        patch.nextLandingFlag = false;
        patch.removeClasses.push({ selector: "#landingbutton", className: "down" });
        patch.checked["landing"] = false;
    }

    return patch;
}

export function applyLandingUiPatch({ $, setChecked, patch, setLandingFlag }) {
    if (!patch) return;

    for (let i = 0; i < patch.showLabelForIds.length; i++) {
        const id = patch.showLabelForIds[i];
        $("#" + id).closest("label").show();
    }
    for (let i = 0; i < patch.hideLabelForIds.length; i++) {
        const id = patch.hideLabelForIds[i];
        $("#" + id).closest("label").hide();
    }

    for (let i = 0; i < patch.showSelectors.length; i++) {
        $(patch.showSelectors[i]).show();
    }
    for (let i = 0; i < patch.hideSelectors.length; i++) {
        $(patch.hideSelectors[i]).hide();
    }

    if (typeof patch.nextLandingFlag === "boolean") {
        setLandingFlag?.(patch.nextLandingFlag);
    }

    for (let i = 0; i < patch.removeClasses.length; i++) {
        const { selector, className } = patch.removeClasses[i];
        $(selector).removeClass(className);
    }

    for (const [id, value] of Object.entries(patch.checked)) {
        setChecked(id, value);
    }
}
