import {
    buildTelemetryDisplayModel,
    resolveTelemetryUnitLabels,
    UNIT_MODE_KM,
    UNIT_MODE_MILES,
} from "./telemetry-display-model.js";

const TELEMETRY_UNIT_BUTTON_IDS = [
    "stats-unit-km",
    "stats-unit-miles",
    "mobile-unit-km",
    "mobile-unit-miles",
];

function normalizeTelemetryUnitMode(unitMode) {
    return unitMode === UNIT_MODE_MILES ? UNIT_MODE_MILES : UNIT_MODE_KM;
}

function buildTelemetryUnitControlModel(unitMode) {
    const normalizedUnitMode = normalizeTelemetryUnitMode(unitMode);
    const isMiles = normalizedUnitMode === UNIT_MODE_MILES;
    return {
        unitLabels: resolveTelemetryUnitLabels(normalizedUnitMode),
        buttons: TELEMETRY_UNIT_BUTTON_IDS.map((id) => {
            const buttonWantsMiles = id.includes("miles");
            const isActive = buttonWantsMiles ? isMiles : !isMiles;
            return {
                id,
                isActive,
                ariaPressed: isActive ? "true" : "false",
            };
        }),
    };
}

function buildSceneTelemetryUiState({
    telemetry,
    primaryBody,
    angleDegrees,
    unitMode,
    formatMetric,
}) {
    const normalizedUnitMode = normalizeTelemetryUnitMode(unitMode);
    return {
        telemetryDisplayModel: buildTelemetryDisplayModel({
            telemetry,
            primaryBody,
            angleDegrees,
            unitMode: normalizedUnitMode,
            formatMetric,
        }),
        unitControlModel: buildTelemetryUnitControlModel(normalizedUnitMode),
    };
}

export {
    buildSceneTelemetryUiState,
    buildTelemetryUnitControlModel,
    normalizeTelemetryUnitMode,
    UNIT_MODE_KM,
    UNIT_MODE_MILES,
};
