export function computeDynamicLabels({ globalConfig }) {
    if (!globalConfig) return null;

    const spacecraftName = globalConfig.mission_name || "Spacecraft";
    const spacecraftShort =
        globalConfig.mission_name_short || globalConfig.spacecraft_mnemonic || "SC";
    const ui = globalConfig.ui || {};
    const crafts = Array.isArray(globalConfig.crafts) ? globalConfig.crafts : [];
    const secondaryCraft = crafts.find((craft) => craft && craft.primary !== true);
    const additionalCraftLabel =
        ui.additionalCraftLabel ||
        secondaryCraft?.viewLabel ||
        secondaryCraft?.name ||
        secondaryCraft?.mnemonic ||
        secondaryCraft?.id ||
        "Secondary Craft";
    const additionalCraftToggleLabel =
        ui.additionalCraftToggleLabel || `Show ${additionalCraftLabel}`;
    const headerSummary =
        globalConfig.mission_description ||
        ui.headerSummary ||
        "Created by Sankar Viswanathan using NASA JPL HORIZONS ephemerides.";
    const metaDescription =
        globalConfig.mission_description ||
        ui.metaDescription ||
        "Interactive 2D/3D lunar mission orbit visualizations by Sankar Viswanathan.";

    return {
        pageTitle: ui.pageTitle || `${spacecraftName} - Orbit Animation`,
        headerTitle: ui.headerTitle || spacecraftName,
        headerSummary,
        metaDescription,
        missionUrl: globalConfig.mission_url || "#",
        spacecraftShort,
        labelElements: [
            { id: "label-lock-spacecraft", text: ui.lockOnLabel || spacecraftName },
            { id: "label-orbit", text: ui.orbitLabel || `${spacecraftShort} Orbit` },
            {
                id: "label-orbit-descent",
                text: ui.descentOrbitLabel || `${spacecraftShort} Descent Orbit`,
            },
            {
                id: "label-additional-crafts",
                text: additionalCraftToggleLabel,
            },
        ],
    };
}

function updateMetaDescription(document, content) {
    if (!document || !content) return;
    const selectors = [
        'meta[name="description"]',
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
    ];
    selectors.forEach((selector) => {
        const element = document.querySelector(selector);
        if (element) {
            element.setAttribute("content", content);
        }
    });
}

export function applyDynamicLabels({
    labels,
    document,
    updateMultipleElementsText,
    updateSpacecraftMnemonic,
}) {
    if (!labels) return;

    document.title = labels.pageTitle;

    const missionLink = document.getElementById("mission-link");
    if (missionLink) {
        missionLink.textContent = labels.headerTitle;
        missionLink.href = labels.missionUrl;
    }
    const missionSummary = document.getElementById("mission-summary");
    if (missionSummary) {
        missionSummary.textContent = labels.headerSummary;
    }
    updateMetaDescription(document, labels.metaDescription);

    updateMultipleElementsText(labels.labelElements, true);
    updateSpacecraftMnemonic(labels.spacecraftShort);
}

function dispatchMissionUiConfig(document, globalConfig) {
    if (!document || !globalConfig) return;
    document.dispatchEvent(new CustomEvent("mission-ui-config-updated", {
        detail: {
            ui: globalConfig.ui || {},
        },
    }));
}

export function applyMissionMetadata({
    globalConfig,
    planetProperties,
    document,
    updateMultipleElementsText,
    updateSpacecraftMnemonic,
}) {
    const labels = computeDynamicLabels({ globalConfig });
    applyDynamicLabels({
        labels,
        document,
        updateMultipleElementsText,
        updateSpacecraftMnemonic,
    });
    dispatchMissionUiConfig(document, globalConfig);

    if (globalConfig?.spacecraft_mnemonic) {
        planetProperties["SC"]["name"] = globalConfig.spacecraft_mnemonic;
    }
}
