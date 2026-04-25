import {
    normalizeComparisonAlignmentEventKey,
    normalizeComparisonMissionParam,
} from "../core/domain/comparison-overlay.js";
import { isCompareRuntimeMode } from "../core/domain/runtime-mode.js";
import { assembleMissionConfig } from "../core/domain/mission-config-assembly.js";
import {
    resolveMissionConfigUrl,
    resolveMissionManifestUrl,
} from "../core/domain/mission-asset-resolver.js";
import {
    buildComparisonOverlayAugmentation,
    mergeComparisonOverlayIntoBaseConfig,
} from "./comparison-overlay-model.js";

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

function resolveSelectedAlignmentEventKeys(params) {
    return {
        selectedPrimaryAlignmentEventKey: normalizeComparisonAlignmentEventKey(
            params?.get("comparePrimaryEvent"),
        ),
        selectedComparisonAlignmentEventKey: normalizeComparisonAlignmentEventKey(
            params?.get("compareSecondaryEvent"),
        ),
    };
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

        const compareMission = {
            folder: normalizedCompareMission,
            missionName: normalizedCompareMission,
        };
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

        const currentMissionFolder = parseCurrentMissionFolder(windowRef?.missionConfig?.dataPath);
        const {
            selectedPrimaryAlignmentEventKey,
            selectedComparisonAlignmentEventKey,
        } = resolveSelectedAlignmentEventKeys(params);
        const augmentation = buildComparisonOverlayAugmentation({
            baseConfig,
            comparisonConfig: comparisonMissionConfig.comparisonConfig,
            comparisonDataPath,
            compareMission,
            currentMissionFolder,
            createUTCTimestamp,
            selectedPrimaryAlignmentEventKey,
            selectedComparisonAlignmentEventKey,
        });
        if (!augmentation) {
            return baseConfig;
        }
        return mergeComparisonOverlayIntoBaseConfig(baseConfig, augmentation);
    } catch (error) {
        console.warn("Could not load comparison overlay:", error);
        return baseConfig;
    }
}

export { loadComparisonOverlayConfig };
