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

function deriveOriginKeys(rawConfig) {
    const configuredOrigins = asStringArray(rawConfig?.origins).filter((origin) => origin !== "landing");
    if (configuredOrigins.length > 0) return configuredOrigins;

    if (!isPlainObject(rawConfig)) return [];

    const knownNonOriginKeys = new Set([
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
        "origins",
        "phases",
    ]);

    const derived = [];
    for (const key of Object.keys(rawConfig)) {
        if (knownNonOriginKeys.has(key)) continue;
        if (key === "landing") continue;
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
        origins: deriveOriginKeys(rawConfig),
    };
}

function validateMissionConfig(parsedConfig) {
    const errors = [];
    const warnings = [];

    const originKeys = deriveOriginKeys(parsedConfig);
    if (originKeys.length === 0) {
        errors.push(
            "No mission origins were found. Add a non-empty `origins` array and origin definitions.",
        );
    }

    for (let i = 0; i < originKeys.length; i++) {
        const originKey = originKeys[i];
        const originConfig = parsedConfig?.[originKey];
        if (!isPlainObject(originConfig)) {
            errors.push(`Origin '${originKey}' is missing its configuration object.`);
            continue;
        }

        const orbitsFile = asTrimmedString(originConfig.orbits_file);
        if (!orbitsFile) {
            warnings.push(`Origin '${originKey}' is missing 'orbits_file'; a default name will be synthesized.`);
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

function normalizeOriginConfigs(parsedConfig, originKeys, spacecraftMnemonic) {
    const normalizedOrigins = {};
    for (let i = 0; i < originKeys.length; i++) {
        const originKey = originKeys[i];
        const originConfig = isPlainObject(parsedConfig?.[originKey]) ? parsedConfig[originKey] : {};
        normalizedOrigins[originKey] = {
            ...originConfig,
            enabled: originConfig.enabled !== false,
            orbits_file: asTrimmedString(originConfig.orbits_file, `${originKey}-${spacecraftMnemonic}`),
        };
    }
    return normalizedOrigins;
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

function normalizeEventConfigs(rawEventConfigs, originKeys) {
    const eventConfigs = isPlainObject(rawEventConfigs) ? rawEventConfigs : {};
    const normalized = {};

    for (const [phaseKey, eventList] of Object.entries(eventConfigs)) {
        normalized[phaseKey] = Array.isArray(eventList)
            ? eventList
                .map((entry) => asTrimmedString(entry))
                .filter((entry) => entry.length > 0)
            : [];
    }

    for (let i = 0; i < originKeys.length; i++) {
        const originKey = originKeys[i];
        if (!normalized[originKey]) {
            normalized[originKey] = [];
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
    const originKeys = deriveOriginKeys(parsedConfig);
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
        origins: originKeys,
        ui: normalizeUiConfig(parsedConfig?.ui, missionName, missionShort),
        ephemeris_source: normalizeEphemerisSource(parsedConfig?.ephemeris_source),
        ephemeris_sources: isPlainObject(parsedConfig?.ephemeris_sources)
            ? { ...parsedConfig.ephemeris_sources }
            : {},
        events,
        eventConfigs: normalizeEventConfigs(parsedConfig?.eventConfigs, originKeys),
        landingSites: normalizeLandingSites(parsedConfig?.landingSites),
        missionTimes: isPlainObject(parsedConfig?.missionTimes) ? { ...parsedConfig.missionTimes } : {},
    };

    const normalizedOrigins = normalizeOriginConfigs(parsedConfig, originKeys, spacecraftMnemonic);
    for (const [originKey, originValue] of Object.entries(normalizedOrigins)) {
        normalized[originKey] = originValue;
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
