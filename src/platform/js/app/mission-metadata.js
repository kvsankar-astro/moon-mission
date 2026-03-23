export function computeDynamicLabels({ globalConfig }) {
    if (!globalConfig) return null;

    const spacecraftName = globalConfig.mission_name || "Spacecraft";
    const spacecraftShort =
        globalConfig.mission_name_short || globalConfig.spacecraft_mnemonic || "SC";
    const ui = globalConfig.ui || {};

    return {
        pageTitle: ui.pageTitle || `${spacecraftName} - Orbit Animation`,
        headerTitle: ui.headerTitle || spacecraftName,
        missionUrl: globalConfig.mission_url || "#",
        spacecraftShort,
        labelElements: [
            { id: "label-lock-spacecraft", text: ui.lockOnLabel || spacecraftName },
            { id: "label-orbit", text: ui.orbitLabel || `${spacecraftShort} Orbit` },
            {
                id: "label-orbit-descent",
                text: ui.descentOrbitLabel || `${spacecraftShort} Descent Orbit`,
            },
        ],
    };
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

    updateMultipleElementsText(labels.labelElements, true);
    updateSpacecraftMnemonic(labels.spacecraftShort);
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

    if (globalConfig?.spacecraft_mnemonic) {
        planetProperties["SC"]["name"] = globalConfig.spacecraft_mnemonic;
    }
}

