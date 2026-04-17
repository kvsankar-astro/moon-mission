const KM_TO_MILES = 0.621371192237334;
const KMPS_TO_MPH = 2236.9362920544;
const UNIT_MODE_KM = "km";
const UNIT_MODE_MILES = "miles";

function resolveTelemetryUnitLabels(unitMode) {
    const normalizedUnitMode = unitMode === UNIT_MODE_MILES ? UNIT_MODE_MILES : UNIT_MODE_KM;
    return {
        distance: normalizedUnitMode === UNIT_MODE_MILES ? "miles" : "km",
        speed: normalizedUnitMode === UNIT_MODE_MILES ? "miles/h" : "km/s",
    };
}

function convertMetricValue(value, metricType, unitMode) {
    if (!Number.isFinite(value)) return null;
    if (unitMode === UNIT_MODE_MILES) {
        return metricType === "speed"
            ? value * KMPS_TO_MPH
            : value * KM_TO_MILES;
    }
    return value;
}

function formatDisplayMetric(
    value,
    metricType,
    unitMode,
    formatMetric,
    { includeUnits = false } = {},
) {
    const converted = convertMetricValue(value, metricType, unitMode);
    if (!Number.isFinite(converted)) {
        return includeUnits ? "--" : "";
    }
    const formatted = formatMetric(converted);
    if (!includeUnits) {
        return formatted;
    }
    const unitLabels = resolveTelemetryUnitLabels(unitMode);
    const unitText = metricType === "speed" ? unitLabels.speed : unitLabels.distance;
    return `${formatted} ${unitText}`;
}

function formatAngleMetric(angleDegrees) {
    if (!Number.isFinite(angleDegrees)) return "--";
    return `${angleDegrees.toFixed(1)}°`;
}

function resolveSecondaryTelemetryValue({
    telemetry,
    primaryBody,
    bodyKey,
    field,
}) {
    const normalizedPrimaryBody = typeof primaryBody === "string"
        ? primaryBody.trim().toUpperCase()
        : "";
    const normalizedBodyKey = typeof bodyKey === "string"
        ? bodyKey.trim().toUpperCase()
        : "";
    const secondaryValue = telemetry?.[`${field}${bodyKey}`];
    if (secondaryValue !== undefined && secondaryValue !== null) {
        return secondaryValue;
    }
    return normalizedPrimaryBody === normalizedBodyKey
        ? telemetry?.[`${field}Primary`]
        : null;
}

function buildTelemetryDisplayModel({
    telemetry,
    primaryBody,
    angleDegrees,
    unitMode,
    formatMetric,
}) {
    const unitLabels = resolveTelemetryUnitLabels(unitMode);
    if (!telemetry) {
        return {
            unitLabels,
            desktop: {
                distanceEarth: "",
                altitudeEarth: "",
                velocityEarth: "",
                distanceMoon: "",
                altitudeMoon: "",
                velocityMoon: "",
            },
            mobile: {
                earth: "--",
                moon: "--",
                speed: "--",
                angle: "--",
            },
        };
    }

    const earthDistance = resolveSecondaryTelemetryValue({
        telemetry,
        primaryBody,
        bodyKey: "Earth",
        field: "distance",
    });
    const earthAltitude = resolveSecondaryTelemetryValue({
        telemetry,
        primaryBody,
        bodyKey: "Earth",
        field: "altitude",
    });
    const earthVelocity = resolveSecondaryTelemetryValue({
        telemetry,
        primaryBody,
        bodyKey: "Earth",
        field: "velocity",
    });
    const moonDistance = resolveSecondaryTelemetryValue({
        telemetry,
        primaryBody,
        bodyKey: "Moon",
        field: "distance",
    });
    const moonAltitude = resolveSecondaryTelemetryValue({
        telemetry,
        primaryBody,
        bodyKey: "Moon",
        field: "altitude",
    });
    const moonVelocity = resolveSecondaryTelemetryValue({
        telemetry,
        primaryBody,
        bodyKey: "Moon",
        field: "velocity",
    });

    return {
        unitLabels,
        desktop: {
            distanceEarth: formatDisplayMetric(earthDistance, "distance", unitMode, formatMetric),
            altitudeEarth: formatDisplayMetric(earthAltitude, "distance", unitMode, formatMetric),
            velocityEarth: formatDisplayMetric(earthVelocity, "speed", unitMode, formatMetric),
            distanceMoon: formatDisplayMetric(moonDistance, "distance", unitMode, formatMetric),
            altitudeMoon: formatDisplayMetric(moonAltitude, "distance", unitMode, formatMetric),
            velocityMoon: formatDisplayMetric(moonVelocity, "speed", unitMode, formatMetric),
        },
        mobile: {
            earth: formatDisplayMetric(earthDistance, "distance", unitMode, formatMetric, { includeUnits: true }),
            moon: formatDisplayMetric(moonDistance, "distance", unitMode, formatMetric, { includeUnits: true }),
            speed: formatDisplayMetric(telemetry.velocityPrimary, "speed", unitMode, formatMetric, { includeUnits: true }),
            angle: formatAngleMetric(angleDegrees),
        },
    };
}

export {
    buildTelemetryDisplayModel,
    resolveTelemetryUnitLabels,
    UNIT_MODE_KM,
    UNIT_MODE_MILES,
};
