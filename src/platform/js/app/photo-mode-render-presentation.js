import { computePhotoModeLightingPresentation } from "../core/domain/flyby-lighting-presentation.js";

const PHOTO_MODE_EARTH_CLOUD_BLEND = 0.56;

function clamp(value, minValue, maxValue) {
    if (!Number.isFinite(value)) {
        return minValue;
    }
    return Math.max(minValue, Math.min(maxValue, value));
}

function distanceBetween(pointA, pointB) {
    const ax = Number(pointA?.x);
    const ay = Number(pointA?.y);
    const az = Number(pointA?.z);
    const bx = Number(pointB?.x);
    const by = Number(pointB?.y);
    const bz = Number(pointB?.z);
    if (
        !Number.isFinite(ax) ||
        !Number.isFinite(ay) ||
        !Number.isFinite(az) ||
        !Number.isFinite(bx) ||
        !Number.isFinite(by) ||
        !Number.isFinite(bz)
    ) {
        return Number.NaN;
    }
    return Math.hypot(ax - bx, ay - by, az - bz);
}

function applyBodyMaterialOverride(bodyObject, predicate, captureRecord) {
    if (!bodyObject || typeof predicate !== "function" || typeof captureRecord !== "function") {
        return [];
    }
    const touchedMaterials = new Set();
    const records = [];
    bodyObject.traverse((node) => {
        if (!node?.isMesh) {
            return;
        }
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
            if (!material || touchedMaterials.has(material) || !material.userData) {
                continue;
            }
            if (!predicate(material)) {
                continue;
            }
            touchedMaterials.add(material);
            const record = captureRecord(material);
            if (record) {
                records.push(record);
            }
        }
    });
    return records;
}

export function resolvePhotoModeLightingPresentation({
    enabled = false,
    cameraPosition = null,
    earthPosition = null,
    earthRadius = Number.NaN,
    moonPosition = null,
    moonRadius = Number.NaN,
} = {}) {
    if (!enabled) {
        return null;
    }
    const distanceToEarth = distanceBetween(cameraPosition, earthPosition);
    const distanceToMoon = distanceBetween(cameraPosition, moonPosition);
    if (!Number.isFinite(distanceToEarth) || !Number.isFinite(distanceToMoon)) {
        return null;
    }
    return computePhotoModeLightingPresentation({
        distanceToEarth,
        earthRadius,
        distanceToMoon,
        moonRadius,
    });
}

export function applyPhotoModeBodyPresentation({
    earth = null,
    moon = null,
    presentation = null,
    earthDayTexture = null,
    earthDayTextureBlend = null,
} = {}) {
    const hasEarthTextureOverride = !!earthDayTexture || Number.isFinite(earthDayTextureBlend);
    if (!presentation && !hasEarthTextureOverride) {
        return () => {};
    }

    const restoreRecords = [
        ...applyBodyMaterialOverride(
            earth,
            (material) => Object.prototype.hasOwnProperty.call(material.userData, "earthNightMapIntensity"),
            (material) => {
                const record = {
                    kind: "earth",
                    material,
                    earthPhotoTexture: material.userData.earthPhotoTexture || material.map || null,
                    earthPhotoBlend: material.userData.earthPhotoBlend,
                    earthNightMapIntensity: material.userData.earthNightMapIntensity,
                    earthNightMapExponent: material.userData.earthNightMapExponent,
                    earthDayGain: material.userData.earthDayGain,
                    earthDaySaturation: material.userData.earthDaySaturation,
                    earthAtmosphereRimStrength: material.userData.earthAtmosphereRimStrength,
                };
                if (earthDayTexture) {
                    material.userData.earthPhotoTexture = earthDayTexture;
                }
                if (Number.isFinite(earthDayTextureBlend)) {
                    material.userData.earthPhotoBlend = clamp(earthDayTextureBlend, 0, 1);
                } else if (earthDayTexture) {
                    material.userData.earthPhotoBlend = PHOTO_MODE_EARTH_CLOUD_BLEND;
                }
                if (presentation) {
                    material.userData.earthNightMapIntensity = presentation.earthNightLightsGain;
                    material.userData.earthNightMapExponent = presentation.earthNightMapExponent;
                    material.userData.earthDayGain = presentation.earthDayGain;
                    material.userData.earthDaySaturation = presentation.earthDaySaturation;
                    material.userData.earthAtmosphereRimStrength = presentation.earthAtmosphereRimStrength;
                }
                return record;
            },
        ),
        ...(presentation
            ? applyBodyMaterialOverride(
                moon,
                (material) => Object.prototype.hasOwnProperty.call(material.userData, "moonTerminatorShadowFloor"),
                (material) => {
                    const record = {
                        kind: "moon",
                        material,
                        moonShadowLift: material.userData.moonShadowLift,
                        moonShadowWeightExponent: material.userData.moonShadowWeightExponent,
                        moonHighlightWeightExponent: material.userData.moonHighlightWeightExponent,
                        moonTerminatorContrast: material.userData.moonTerminatorContrast,
                        moonTerminatorReliefStrength: material.userData.moonTerminatorReliefStrength,
                        moonTerminatorShadowFloor: material.userData.moonTerminatorShadowFloor,
                        moonTerminatorIndirectOcclusion: material.userData.moonTerminatorIndirectOcclusion,
                        moonHighlightBoost: material.userData.moonHighlightBoost,
                    };
                    material.userData.moonShadowLift = presentation.moonShadowLift;
                    material.userData.moonShadowWeightExponent = presentation.moonShadowWeightExponent;
                    material.userData.moonHighlightWeightExponent = presentation.moonHighlightWeightExponent;
                    material.userData.moonTerminatorContrast = presentation.moonTerminatorContrast;
                    material.userData.moonTerminatorReliefStrength = presentation.moonTerminatorReliefStrength;
                    material.userData.moonTerminatorShadowFloor = presentation.moonTerminatorShadowFloor;
                    material.userData.moonTerminatorIndirectOcclusion = presentation.moonTerminatorIndirectOcclusion;
                    material.userData.moonHighlightBoost = presentation.moonHighlightBoost;
                    return record;
                },
            )
            : []),
    ];

    return () => {
        for (const record of restoreRecords) {
            if (record.kind === "earth") {
                record.material.userData.earthPhotoTexture = record.earthPhotoTexture;
                record.material.userData.earthPhotoBlend = record.earthPhotoBlend;
                record.material.userData.earthNightMapIntensity = record.earthNightMapIntensity;
                record.material.userData.earthNightMapExponent = record.earthNightMapExponent;
                record.material.userData.earthDayGain = record.earthDayGain;
                record.material.userData.earthDaySaturation = record.earthDaySaturation;
                record.material.userData.earthAtmosphereRimStrength = record.earthAtmosphereRimStrength;
                continue;
            }
            if (record.kind === "moon") {
                record.material.userData.moonShadowLift = record.moonShadowLift;
                record.material.userData.moonShadowWeightExponent = record.moonShadowWeightExponent;
                record.material.userData.moonHighlightWeightExponent = record.moonHighlightWeightExponent;
                record.material.userData.moonTerminatorContrast = record.moonTerminatorContrast;
                record.material.userData.moonTerminatorReliefStrength = record.moonTerminatorReliefStrength;
                record.material.userData.moonTerminatorShadowFloor = record.moonTerminatorShadowFloor;
                record.material.userData.moonTerminatorIndirectOcclusion = record.moonTerminatorIndirectOcclusion;
                record.material.userData.moonHighlightBoost = record.moonHighlightBoost;
            }
        }
    };
}

export function applyPhotoModeExposure({
    renderer = null,
    presentation = null,
    minBias = 0.5,
    maxBias = 1.5,
} = {}) {
    if (!renderer || !presentation) {
        return () => {};
    }
    const originalExposure = Number(renderer.toneMappingExposure);
    if (!Number.isFinite(originalExposure)) {
        return () => {};
    }
    const boundedBias = clamp(Number(presentation.exposureBias), minBias, maxBias);
    renderer.toneMappingExposure = originalExposure * boundedBias;
    return () => {
        renderer.toneMappingExposure = originalExposure;
    };
}
