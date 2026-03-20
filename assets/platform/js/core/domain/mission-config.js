function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function asTrimmedString(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function asStringArray(value) {
    if (!Array.isArray(value)) return [];
    const normalized = [];
    const seen = new Set();
    for (let i = 0; i < value.length; i++) {
        const item = asTrimmedString(value[i]);
        if (!item || seen.has(item)) continue;
        seen.add(item);
        normalized.push(item);
    }
    return normalized;
}

function derivePhaseKeys(rawConfig) {
    const configured = asStringArray(rawConfig?.phases);
    if (configured.length > 0) return configured;

    if (!isPlainObject(rawConfig)) return [];

    const knownNonPhaseKeys = new Set([
        "spacecraft_mnemonic",
        "spacecraft_id",
        "mission_name",
        "mission_name_short",
        "mission_url",
        "mission_description",
        "mission_keywords",
        "mission_github",
        "mission_image",
        "ephemeris_source",
        "ephemeris_sources",
        "ephemeris",
        "ephemeris_manifest",
        "ui",
        "is_lunar",
        "events",
        "eventConfigs",
        "landingSites",
        "missionTimes",
    ]);

    const derived = [];
    for (const key of Object.keys(rawConfig)) {
        if (knownNonPhaseKeys.has(key)) continue;
        const phase = rawConfig[key];
        if (!isPlainObject(phase)) continue;
        if (typeof phase.orbits_file === "string" || typeof phase.center === "string") {
            derived.push(key);
        }
    }
    return derived;
}

function normalizeEphemerisSource(value) {
    const normalized = asTrimmedString(value, "chebyshev").toLowerCase();
    return normalized === "npz" ? "npz" : "chebyshev";
}

function parseMissionConfig(rawConfig) {
    if (!isPlainObject(rawConfig)) {
        throw new Error("Mission config must be a JSON object");
    }

    return {
        ...rawConfig,
        phases: derivePhaseKeys(rawConfig),
    };
}

function validateMissionConfig(parsedConfig) {
    const errors = [];
    const warnings = [];

    const phaseKeys = derivePhaseKeys(parsedConfig);
    if (phaseKeys.length === 0) {
        errors.push("No mission phases were found. Add a non-empty `phases` array and phase definitions.");
    }

    for (let i = 0; i < phaseKeys.length; i++) {
        const phaseKey = phaseKeys[i];
        const phaseConfig = parsedConfig?.[phaseKey];
        if (!isPlainObject(phaseConfig)) {
            errors.push(`Phase '${phaseKey}' is missing its configuration object.`);
            continue;
        }

        const orbitsFile = asTrimmedString(phaseConfig.orbits_file);
        if (!orbitsFile) {
            warnings.push(`Phase '${phaseKey}' is missing 'orbits_file'; a default name will be synthesized.`);
        }
    }

    if (parsedConfig?.events !== undefined && !isPlainObject(parsedConfig.events)) {
        errors.push("`events` must be an object keyed by event id.");
    }

    if (parsedConfig?.eventConfigs !== undefined && !isPlainObject(parsedConfig.eventConfigs)) {
        errors.push("`eventConfigs` must be an object keyed by phase.");
    }

    if (isPlainObject(parsedConfig?.events) && isPlainObject(parsedConfig?.eventConfigs)) {
        const events = parsedConfig.events;
        const eventConfigs = parsedConfig.eventConfigs;
        for (const phaseKey of Object.keys(eventConfigs)) {
            const configuredEvents = eventConfigs[phaseKey];
            if (!Array.isArray(configuredEvents)) {
                errors.push(`eventConfigs.${phaseKey} must be an array of event ids.`);
                continue;
            }
            for (let i = 0; i < configuredEvents.length; i++) {
                const eventKey = asTrimmedString(configuredEvents[i]);
                if (!eventKey) {
                    warnings.push(`eventConfigs.${phaseKey} contains an empty event id entry.`);
                    continue;
                }
                if (!events[eventKey]) {
                    warnings.push(`eventConfigs.${phaseKey} references missing event '${eventKey}'.`);
                }
            }
        }
    }

    if (parsedConfig?.landingSites !== undefined && !Array.isArray(parsedConfig.landingSites)) {
        errors.push("`landingSites` must be an array when provided.");
    }

    return {
        errors,
        warnings,
    };
}

function normalizeUiConfig(rawUi, missionName, missionShort) {
    const ui = isPlainObject(rawUi) ? rawUi : {};
    const shortName = asTrimmedString(missionShort, "SC");
    const longName = asTrimmedString(missionName, shortName);

    return {
        ...ui,
        pageTitle: asTrimmedString(ui.pageTitle, `${longName} - Orbit Animation`),
        headerTitle: asTrimmedString(ui.headerTitle, longName),
        lockOnLabel: asTrimmedString(ui.lockOnLabel, longName),
        orbitLabel: asTrimmedString(ui.orbitLabel, `${shortName} Orbit`),
        descentOrbitLabel: asTrimmedString(ui.descentOrbitLabel, `${shortName} Descent Orbit`),
    };
}

function normalizePhaseConfigs(parsedConfig, phaseKeys, spacecraftMnemonic) {
    const normalizedPhases = {};
    for (let i = 0; i < phaseKeys.length; i++) {
        const phaseKey = phaseKeys[i];
        const phaseConfig = isPlainObject(parsedConfig?.[phaseKey]) ? parsedConfig[phaseKey] : {};
        normalizedPhases[phaseKey] = {
            ...phaseConfig,
            enabled: phaseConfig.enabled !== false,
            orbits_file: asTrimmedString(phaseConfig.orbits_file, `${phaseKey}-${spacecraftMnemonic}`),
        };
    }
    return normalizedPhases;
}

function normalizeEvents(rawEvents) {
    const events = isPlainObject(rawEvents) ? rawEvents : {};
    const normalized = {};
    for (const [eventKey, eventValue] of Object.entries(events)) {
        if (!isPlainObject(eventValue)) continue;

        const durationRaw = Number(eventValue.durationSeconds);
        const durationSeconds = Number.isFinite(durationRaw) && durationRaw >= 0 ? durationRaw : 0;
        normalized[eventKey] = {
            ...eventValue,
            startTime: asTrimmedString(eventValue.startTime, "dynamic"),
            durationSeconds,
            label: asTrimmedString(eventValue.label, eventKey),
            burnFlag: Boolean(eventValue.burnFlag),
            infoText: asTrimmedString(eventValue.infoText, ""),
            body: asTrimmedString(eventValue.body, ""),
        };
    }
    return normalized;
}

function normalizeEventConfigs(rawEventConfigs, phaseKeys) {
    const eventConfigs = isPlainObject(rawEventConfigs) ? rawEventConfigs : {};
    const normalized = {};

    for (const [phaseKey, eventList] of Object.entries(eventConfigs)) {
        normalized[phaseKey] = Array.isArray(eventList)
            ? eventList
                .map((entry) => asTrimmedString(entry))
                .filter((entry) => entry.length > 0)
            : [];
    }

    for (let i = 0; i < phaseKeys.length; i++) {
        const phaseKey = phaseKeys[i];
        if (!normalized[phaseKey]) {
            normalized[phaseKey] = [];
        }
    }

    return normalized;
}

function normalizeLandingSites(rawLandingSites) {
    if (!Array.isArray(rawLandingSites)) return [];
    return rawLandingSites
        .filter((site) => isPlainObject(site))
        .map((site, index) => {
            const longitude = Number(site.longitude);
            const latitude = Number(site.latitude);
            return {
                ...site,
                name: asTrimmedString(site.name, `Site ${index + 1}`),
                longitude: Number.isFinite(longitude) ? longitude : 0,
                latitude: Number.isFinite(latitude) ? latitude : 0,
                color: asTrimmedString(site.color, "#FFFF00"),
                description: asTrimmedString(site.description, ""),
            };
        });
}

function normalizeMissionConfig(parsedConfig) {
    const phaseKeys = derivePhaseKeys(parsedConfig);
    const spacecraftMnemonic = asTrimmedString(parsedConfig?.spacecraft_mnemonic, "SC");
    const missionName = asTrimmedString(parsedConfig?.mission_name, spacecraftMnemonic);
    const missionShort = asTrimmedString(parsedConfig?.mission_name_short, spacecraftMnemonic);
    const events = normalizeEvents(parsedConfig?.events);

    const normalized = {
        ...parsedConfig,
        spacecraft_mnemonic: spacecraftMnemonic,
        mission_name: missionName,
        mission_name_short: missionShort,
        mission_url: asTrimmedString(parsedConfig?.mission_url, "#"),
        is_lunar: Boolean(parsedConfig?.is_lunar),
        phases: phaseKeys,
        ui: normalizeUiConfig(parsedConfig?.ui, missionName, missionShort),
        ephemeris_source: normalizeEphemerisSource(parsedConfig?.ephemeris_source),
        ephemeris_sources: isPlainObject(parsedConfig?.ephemeris_sources)
            ? { ...parsedConfig.ephemeris_sources }
            : {},
        events,
        eventConfigs: normalizeEventConfigs(parsedConfig?.eventConfigs, phaseKeys),
        landingSites: normalizeLandingSites(parsedConfig?.landingSites),
        missionTimes: isPlainObject(parsedConfig?.missionTimes) ? { ...parsedConfig.missionTimes } : {},
    };

    const normalizedPhases = normalizePhaseConfigs(parsedConfig, phaseKeys, spacecraftMnemonic);
    for (const [phaseKey, phaseValue] of Object.entries(normalizedPhases)) {
        normalized[phaseKey] = phaseValue;
    }

    return normalized;
}

function formatMissionConfigDiagnostics(diagnostics) {
    const errors = diagnostics?.errors || [];
    const warnings = diagnostics?.warnings || [];
    const lines = [];

    if (errors.length > 0) {
        lines.push("Mission config validation failed:");
        for (let i = 0; i < errors.length; i++) {
            lines.push(`- ${errors[i]}`);
        }
    }

    if (warnings.length > 0) {
        lines.push("Mission config warnings:");
        for (let i = 0; i < warnings.length; i++) {
            lines.push(`- ${warnings[i]}`);
        }
    }

    return lines.join("\n");
}

export {
    formatMissionConfigDiagnostics,
    normalizeMissionConfig,
    parseMissionConfig,
    validateMissionConfig,
};
