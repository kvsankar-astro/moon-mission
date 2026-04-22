import { computeTelemetry, determinePhase } from "../../scene-state.js";
import { resolveComparisonOverlay, mapComparisonBodyTimeMs } from "./comparison-overlay.js";
import { resolveMissionCraft, resolvePrimaryMissionCraft } from "./mission-config.js";
import { buildPhaseIndicatorModel } from "./phase-indicator-state.js";
import { buildTelemetryDisplayModel } from "./telemetry-display-model.js";

function asTrimmedString(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeTelemetryConfig(config) {
    const normalized = asTrimmedString(config).toLowerCase();
    if (normalized === "lunar") return "lunar";
    return "geo";
}

function hasMissionEventTimes(missionEventTimes) {
    return Number.isFinite(missionEventTimes?.timeTransLunarInjection) &&
        Number.isFinite(missionEventTimes?.timeLunarOrbitInsertion);
}

function resolveMissionShortLabel(globalConfig, fallback = "Mission") {
    return asTrimmedString(
        globalConfig?.mission_name_short,
        asTrimmedString(globalConfig?.mission_name, fallback),
    );
}

function resolveCraftBaseLabel(craft, fallback = "Craft") {
    return asTrimmedString(
        craft?.viewLabel,
        asTrimmedString(
            craft?.name,
            asTrimmedString(craft?.mnemonic, asTrimmedString(craft?.id, fallback)),
        ),
    );
}

function buildCompareEntryLabel({ craft, missionLabel, fallback }) {
    const labelBase = resolveCraftBaseLabel(craft, fallback);
    const missionPrefix = asTrimmedString(missionLabel);
    if (!missionPrefix) {
        return labelBase;
    }

    const normalizedMissionPrefix = missionPrefix.toLowerCase();
    if (labelBase.toLowerCase().startsWith(normalizedMissionPrefix)) {
        return labelBase;
    }
    return `${missionPrefix} ${labelBase}`;
}

function resolvePhaseText({ phase, isLunarMission, available }) {
    if (!available) {
        return "Outside mission window";
    }
    if (!isLunarMission) {
        return "No phase";
    }

    return buildPhaseIndicatorModel({
        phase,
        isLunarMission,
    }).mobilePhaseText || "--";
}

function buildCompareEntry({
    id,
    roleLabel,
    label,
    telemetry,
    primaryBody,
    unitMode,
    formatMetric,
    phaseText,
}) {
    const telemetryDisplayModel = buildTelemetryDisplayModel({
        telemetry,
        primaryBody,
        angleDegrees: null,
        unitMode,
        formatMetric,
    });

    return {
        id,
        roleLabel,
        label,
        phaseText,
        desktop: telemetryDisplayModel.desktop,
        mobile: {
            earth: telemetryDisplayModel.mobile.earth,
            moon: telemetryDisplayModel.mobile.moon,
            speed: telemetryDisplayModel.mobile.speed,
        },
    };
}

function buildCompareModeUiModel({
    sceneState,
    globalConfig,
    primaryBody,
    unitMode,
    formatMetric,
}) {
    const comparisonOverlay = resolveComparisonOverlay(globalConfig);
    if (!comparisonOverlay?.compareCraftId) {
        return {
            enabled: false,
            desktopTitle: "Mission Info",
            mobileTitle: "Mission Info",
            entries: [],
        };
    }

    const config = normalizeTelemetryConfig(sceneState?.config);
    const bodies = sceneState?.bodies || {};
    const earthState = bodies.EARTH || null;
    const moonState = bodies.MOON || null;
    const primaryCraft = resolvePrimaryMissionCraft(globalConfig);
    const compareCraft = resolveMissionCraft(globalConfig, comparisonOverlay.compareCraftId);

    const primaryCraftId = primaryCraft?.id || sceneState?.telemetryBodyId || "SC";
    const primaryCraftState = bodies[primaryCraftId] || null;
    const compareCraftState = bodies[comparisonOverlay.compareCraftId] || null;

    const primaryTelemetry =
        sceneState?.telemetryBodyId === primaryCraftId && sceneState?.telemetry
            ? sceneState.telemetry
            : computeTelemetry(primaryCraftState, config, moonState, earthState);
    const compareTelemetry = computeTelemetry(compareCraftState, config, moonState, earthState);

    const primaryPhaseText = resolvePhaseText({
        phase: sceneState?.phase,
        isLunarMission: !!globalConfig?.is_lunar,
        available: !!primaryCraftState?.available,
    });

    const compareSourceTimeMs = mapComparisonBodyTimeMs({
        globalConfig,
        bodyId: comparisonOverlay.compareCraftId,
        config: sceneState?.config,
        timeMs: sceneState?.time,
    });
    const comparePhase = comparisonOverlay.isLunarMission &&
        hasMissionEventTimes(comparisonOverlay.missionEventTimes)
        ? determinePhase(compareSourceTimeMs, comparisonOverlay.missionEventTimes)
        : null;
    const comparePhaseText = resolvePhaseText({
        phase: comparePhase,
        isLunarMission: !!comparisonOverlay.isLunarMission,
        available: !!compareCraftState?.available,
    });

    return {
        enabled: true,
        desktopTitle: "Mission Compare",
        mobileTitle: "Mission Compare",
        entries: [
            buildCompareEntry({
                id: "primary",
                roleLabel: "Primary",
                label: buildCompareEntryLabel({
                    craft: primaryCraft,
                    missionLabel: resolveMissionShortLabel(globalConfig, "Primary"),
                    fallback: "Primary Craft",
                }),
                telemetry: primaryTelemetry,
                primaryBody,
                unitMode,
                formatMetric,
                phaseText: primaryPhaseText,
            }),
            buildCompareEntry({
                id: "secondary",
                roleLabel: "Additional",
                label: buildCompareEntryLabel({
                    craft: compareCraft,
                    missionLabel: asTrimmedString(
                        comparisonOverlay.missionShortLabel,
                        asTrimmedString(comparisonOverlay.missionName, "Additional"),
                    ),
                    fallback: "Additional Craft",
                }),
                telemetry: compareTelemetry,
                primaryBody,
                unitMode,
                formatMetric,
                phaseText: comparePhaseText,
            }),
        ],
    };
}

export { buildCompareModeUiModel };
