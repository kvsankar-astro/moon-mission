import { TIME_CONSTANTS } from "../core/constants.js";
import {
    buildComparisonOverlayCraft,
    buildComparisonOverlayCraftId,
    buildComparisonOverlaySupportBodyId,
    normalizeComparisonMissionParam,
} from "../core/domain/comparison-overlay.js";
import { isCompareRuntimeMode } from "../core/domain/runtime-mode.js";
import { assembleMissionConfig } from "../core/domain/mission-config-assembly.js";
import {
    extractEphemerisManifest,
    resolveMissionConfigUrl,
    resolveMissionManifestUrl,
    resolveOrbitAssetUrls,
} from "../core/domain/mission-asset-resolver.js";
import { resolvePrimaryMissionCraft } from "../core/domain/mission-config.js";
import { computeEventsUpdate } from "./config-events.js";
import { resolveMissionBodyTimeRange } from "./start-end-times.js";

function asTrimmedString(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function parseCurrentMissionFolder(dataPath) {
    const normalizedDataPath = asTrimmedString(dataPath).replace(/\\/g, "/");
    const match = normalizedDataPath.match(/assets\/([^/]+)\/data\/?$/i);
    return match?.[1] || "";
}

function buildMissionDataPath(folder) {
    const normalizedFolder = asTrimmedString(folder);
    return normalizedFolder ? `assets/${normalizedFolder}/data/` : null;
}

function buildTimeRangeObject(rangeTuple) {
    const startMs = Number(rangeTuple?.[0]);
    const endMs = Number(rangeTuple?.[1]);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
        return null;
    }
    return { startMs, endMs };
}

function resolveCraftEphemerisSource(config, craft) {
    const sourceByBodyId = config?.ephemeris_sources;
    if (sourceByBodyId && typeof sourceByBodyId === "object") {
        const directSource = sourceByBodyId[craft?.id];
        if (typeof directSource === "string" && directSource.trim().length > 0) {
            return directSource.toLowerCase();
        }

        const mnemonicSource = sourceByBodyId[craft?.mnemonic];
        if (typeof mnemonicSource === "string" && mnemonicSource.trim().length > 0) {
            return mnemonicSource.toLowerCase();
        }

        const scSource = sourceByBodyId.SC;
        if (typeof scSource === "string" && scSource.trim().length > 0) {
            return scSource.toLowerCase();
        }
    }

    const fallbackSource = asTrimmedString(config?.ephemeris_source, "chebyshev");
    return fallbackSource.toLowerCase();
}

async function fetchJsonIfOk(url, fetchImpl) {
    if (!url) return null;

    try {
        const response = await fetchImpl(url, { cache: "no-store" });
        if (!response.ok) {
            return null;
        }
        return response.json();
    } catch (_error) {
        return null;
    }
}

function resolveComparisonMission(windowRef, compareMissionParam) {
    const missionCatalog = windowRef?.missionCatalog;
    const resolvedByCatalog =
        missionCatalog && typeof missionCatalog.resolveMission === "function"
            ? missionCatalog.resolveMission(compareMissionParam)
            : null;
    if (resolvedByCatalog) {
        return resolvedByCatalog;
    }

    const normalizedMission = normalizeComparisonMissionParam(compareMissionParam);
    if (!normalizedMission) {
        return null;
    }

    return {
        folder: normalizedMission,
        key: normalizedMission,
        queryValue: normalizedMission,
        missionName: normalizedMission,
    };
}

function collectOriginKeys(baseConfig, comparisonConfig) {
    const originKeys = new Set();
    for (const config of [baseConfig, comparisonConfig]) {
        for (const originKey of config?.origins || []) {
            if (typeof originKey === "string" && originKey.length > 0) {
                originKeys.add(originKey);
            }
        }
    }
    originKeys.add("geo");
    originKeys.add("lunar");
    return [...originKeys];
}

function buildComparisonTimeRanges({
    primaryConfig,
    primaryCraftId,
    comparisonConfig,
    comparisonCraftId,
    createUTCTimestamp,
}) {
    const displayTimeRangesByOrigin = {};
    const sourceTimeRangesByOrigin = {};
    const originKeys = collectOriginKeys(primaryConfig, comparisonConfig);

    for (const originKey of originKeys) {
        const displayRange = buildTimeRangeObject(
            resolveMissionBodyTimeRange({
                globalConfig: primaryConfig,
                config: originKey,
                bodyId: primaryCraftId,
                createUTCTimestamp,
                oneMinuteMs: TIME_CONSTANTS.ONE_MINUTE_MS,
            }),
        );
        if (displayRange) {
            displayTimeRangesByOrigin[originKey] = displayRange;
        }

        const sourceRange = buildTimeRangeObject(
            resolveMissionBodyTimeRange({
                globalConfig: comparisonConfig,
                config: originKey,
                bodyId: comparisonCraftId,
                createUTCTimestamp,
                oneMinuteMs: TIME_CONSTANTS.ONE_MINUTE_MS,
            }),
        );
        if (sourceRange) {
            sourceTimeRangesByOrigin[originKey] = sourceRange;
        }
    }

    return {
        displayTimeRangesByOrigin,
        sourceTimeRangesByOrigin,
    };
}

function buildComparisonOrbitUrlsByOrigin({ comparisonConfig, comparisonDataPath }) {
    const orbitUrlsByOrigin = {};
    const primaryCraft = resolvePrimaryMissionCraft(comparisonConfig);
    const configuredRelativeBase = asTrimmedString(comparisonConfig?.relative?.orbits_file);
    const relativeFallbackBase =
        configuredRelativeBase ||
        `relative-${asTrimmedString(primaryCraft?.mnemonic) || asTrimmedString(comparisonConfig?.spacecraft_mnemonic) || "SC"}`;

    for (const originKey of ["geo", "lunar", "relative"]) {
        const orbitUrls = resolveOrbitAssetUrls({
            dataPath: comparisonDataPath,
            manifest: extractEphemerisManifest(comparisonConfig),
            phaseKey: originKey,
            phaseConfig: comparisonConfig?.[originKey],
        });
        if (orbitUrls?.orbitsCheb) {
            orbitUrlsByOrigin[originKey] = orbitUrls.orbitsCheb;
            continue;
        }

        if (originKey === "relative" && relativeFallbackBase) {
            orbitUrlsByOrigin.relative = `${comparisonDataPath}${relativeFallbackBase}-cheb.json`;
        }
    }

    return orbitUrlsByOrigin;
}

function buildComparisonTimelineSourceEventsByOrigin({
    comparisonConfig,
    sourceTimeRangesByOrigin,
}) {
    const eventInfosByOrigin = {};
    const nowDate = new Date();

    for (const [originKey, sourceRange] of Object.entries(sourceTimeRangesByOrigin || {})) {
        const eventsUpdate = computeEventsUpdate({
            globalConfig: comparisonConfig,
            config: originKey,
            nowDate,
            getDataEndTimeMs: () => sourceRange?.endMs,
        });
        if (!Array.isArray(eventsUpdate?.eventInfos) || eventsUpdate.eventInfos.length === 0) {
            continue;
        }
        eventInfosByOrigin[originKey] = eventsUpdate.eventInfos;
    }

    return eventInfosByOrigin;
}

async function loadComparisonMissionConfig({
    compareMission,
    comparisonDataPath,
    fetchImpl,
}) {
    const comparisonConfigUrl = resolveMissionConfigUrl(comparisonDataPath);
    const comparisonManifestUrl = resolveMissionManifestUrl(comparisonDataPath);
    const baseConfig = await fetchJsonIfOk(comparisonConfigUrl, fetchImpl);
    if (!baseConfig) {
        return null;
    }

    const manifestData = await fetchJsonIfOk(comparisonManifestUrl, fetchImpl);
    const { config } = assembleMissionConfig({
        baseConfig,
        manifestData,
    });

    return {
        compareMission,
        comparisonDataPath,
        comparisonConfig: config,
    };
}

async function loadComparisonOverlayConfig({
    baseConfig,
    windowRef = typeof window !== "undefined" ? window : null,
    fetchImpl = typeof fetch === "function" ? fetch.bind(globalThis) : null,
    createUTCTimestamp,
}) {
    if (!baseConfig || !windowRef || typeof fetchImpl !== "function") {
        return baseConfig;
    }

    try {
        const params = new URLSearchParams(windowRef?.location?.search || "");
        if (!isCompareRuntimeMode(params.get("mode"))) {
            return baseConfig;
        }
        const compareMissionParam = params.get("compareMission");
        const normalizedCompareMission = normalizeComparisonMissionParam(compareMissionParam);
        if (!normalizedCompareMission) {
            return baseConfig;
        }

        const compareMission = resolveComparisonMission(windowRef, normalizedCompareMission);
        const comparisonDataPath = buildMissionDataPath(compareMission?.folder);
        if (!comparisonDataPath) {
            return baseConfig;
        }

        const comparisonMissionConfig = await loadComparisonMissionConfig({
            compareMission,
            comparisonDataPath,
            fetchImpl,
        });
        if (!comparisonMissionConfig?.comparisonConfig) {
            return baseConfig;
        }

        const primaryCraft = resolvePrimaryMissionCraft(baseConfig);
        const comparisonPrimaryCraft = resolvePrimaryMissionCraft(
            comparisonMissionConfig.comparisonConfig,
        );
        if (!primaryCraft || !comparisonPrimaryCraft) {
            return baseConfig;
        }

        const currentMissionFolder = parseCurrentMissionFolder(windowRef?.missionConfig?.dataPath);
        const missionFolder =
            asTrimmedString(compareMission?.folder) ||
            asTrimmedString(currentMissionFolder, "comparison");
        const compareCraftId = buildComparisonOverlayCraftId({
            missionFolder,
            sourceCraftId: comparisonPrimaryCraft.id,
        });
        const compareCraft = buildComparisonOverlayCraft({
            sourceCraft: comparisonPrimaryCraft,
            primaryCraft,
            compareCraftId,
            missionFolder,
            missionLabel:
                comparisonMissionConfig.comparisonConfig?.mission_name ||
                compareMission?.missionName ||
                missionFolder,
            missionShortLabel:
                comparisonMissionConfig.comparisonConfig?.mission_name_short ||
                compareMission?.missionName ||
                missionFolder,
        });
        const normalizationSourceBodyIdsByOrigin = {
            geo: "MOON",
            relative: "MOON",
            lunar: "EARTH",
        };
        const normalizationSupportBodyIdsByOrigin = Object.fromEntries(
            Object.entries(normalizationSourceBodyIdsByOrigin).map(
                ([originKey, sourceBodyId]) => [
                    originKey,
                    buildComparisonOverlaySupportBodyId({
                        compareCraftId,
                        sourceBodyId,
                    }),
                ],
            ),
        );

        const { displayTimeRangesByOrigin, sourceTimeRangesByOrigin } =
            buildComparisonTimeRanges({
                primaryConfig: baseConfig,
                primaryCraftId: primaryCraft.id,
                comparisonConfig: comparisonMissionConfig.comparisonConfig,
                comparisonCraftId: comparisonPrimaryCraft.id,
                createUTCTimestamp,
            });
        const supportOrbitChebyshevUrlsByOrigin = buildComparisonOrbitUrlsByOrigin({
            comparisonConfig: comparisonMissionConfig.comparisonConfig,
            comparisonDataPath,
        });
        const timelineSourceEventInfosByOrigin = buildComparisonTimelineSourceEventsByOrigin({
            comparisonConfig: comparisonMissionConfig.comparisonConfig,
            sourceTimeRangesByOrigin,
        });

        if (
            Object.keys(displayTimeRangesByOrigin).length === 0 ||
            Object.keys(sourceTimeRangesByOrigin).length === 0
        ) {
            return baseConfig;
        }

        return {
            ...baseConfig,
            crafts: [
                ...(Array.isArray(baseConfig.crafts) ? baseConfig.crafts : []),
                compareCraft,
            ],
            ephemeris_sources: {
                ...(baseConfig.ephemeris_sources || {}),
                [compareCraftId]: resolveCraftEphemerisSource(
                    comparisonMissionConfig.comparisonConfig,
                    comparisonPrimaryCraft,
                ),
            },
            comparisonOverlay: {
                missionFolder,
                missionKey:
                    compareMission?.key ||
                    compareMission?.queryValue ||
                    missionFolder,
                missionName:
                    comparisonMissionConfig.comparisonConfig?.mission_name ||
                    compareMission?.missionName ||
                    missionFolder,
                missionShortLabel:
                    comparisonMissionConfig.comparisonConfig?.mission_name_short ||
                    compareMission?.missionName ||
                    missionFolder,
                compareCraftId,
                sourceCraftId: comparisonPrimaryCraft.id,
                sourceCraftMnemonic: comparisonPrimaryCraft.mnemonic,
                normalizationSourceBodyIdsByOrigin,
                normalizationSupportBodyIdsByOrigin,
                displayTimeRangesByOrigin,
                sourceTimeRangesByOrigin,
                timelineSourceEventInfosByOrigin,
                supportOrbitChebyshevUrlsByOrigin,
                defaultVisibleCraftIds: [primaryCraft.id, compareCraftId],
            },
        };
    } catch (error) {
        console.warn("Could not load comparison overlay:", error);
        return baseConfig;
    }
}

export { loadComparisonOverlayConfig };
