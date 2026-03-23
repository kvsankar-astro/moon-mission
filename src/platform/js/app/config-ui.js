export function computeMoonUiPatch() {
    // Always show moon-related controls; availability is managed elsewhere.
    /** @type {{ nextConfig?: string, showSelectors: string[], hideSelectors: string[], showLabelForIds: string[], hideLabelForIds: string[], checked: Record<string, boolean> }} */
    const patch = {
        showSelectors: ["#origin-moon", "#origin-relative", "#view-moonsoi", ".geo"],
        hideSelectors: [],
        showLabelForIds: ["origin-moon", "origin-relative", "view-moonsoi"],
        hideLabelForIds: [],
        checked: {},
    };
    return patch;
}

function setVisible(node, visible) {
    if (!node) return;
    node.style.display = visible ? "" : "none";
}

function setVisibleForSelector(selector, visible) {
    if (!selector) return;
    const nodes = document.querySelectorAll(selector);
    for (let i = 0; i < nodes.length; i++) {
        setVisible(nodes[i], visible);
    }
}

function getLabelForControlId(id) {
    if (!id) return null;
    const element = document.getElementById(id);
    const wrapped = element?.closest?.("label");
    if (wrapped) return wrapped;
    return document.querySelector(`label[for="${id}"]`);
}

export function applyMoonUiPatch({ setChecked, patch, setConfig }) {
    if (!patch) return;

    for (let i = 0; i < patch.showLabelForIds.length; i++) {
        const id = patch.showLabelForIds[i];
        setVisible(getLabelForControlId(id), true);
    }
    for (let i = 0; i < patch.hideLabelForIds.length; i++) {
        const id = patch.hideLabelForIds[i];
        setVisible(getLabelForControlId(id), false);
    }

    for (let i = 0; i < patch.showSelectors.length; i++) {
        setVisibleForSelector(patch.showSelectors[i], true);
    }
    for (let i = 0; i < patch.hideSelectors.length; i++) {
        setVisibleForSelector(patch.hideSelectors[i], false);
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

export function applyLandingUiPatch({ setChecked, patch, setLandingFlag }) {
    if (!patch) return;

    for (let i = 0; i < patch.showLabelForIds.length; i++) {
        const id = patch.showLabelForIds[i];
        setVisible(getLabelForControlId(id), true);
    }
    for (let i = 0; i < patch.hideLabelForIds.length; i++) {
        const id = patch.hideLabelForIds[i];
        setVisible(getLabelForControlId(id), false);
    }

    for (let i = 0; i < patch.showSelectors.length; i++) {
        setVisibleForSelector(patch.showSelectors[i], true);
    }
    for (let i = 0; i < patch.hideSelectors.length; i++) {
        setVisibleForSelector(patch.hideSelectors[i], false);
    }

    if (typeof patch.nextLandingFlag === "boolean") {
        setLandingFlag?.(patch.nextLandingFlag);
    }

    for (let i = 0; i < patch.removeClasses.length; i++) {
        const { selector, className } = patch.removeClasses[i];
        const nodes = document.querySelectorAll(selector);
        for (let j = 0; j < nodes.length; j++) {
            nodes[j].classList.remove(className);
        }
    }

    for (const [id, value] of Object.entries(patch.checked)) {
        setChecked(id, value);
    }
}
