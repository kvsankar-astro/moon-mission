function parseMissionTimeMs(value) {
    if (typeof value !== "string" || value.length === 0) return Number.NaN;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function resolvePhaseConfig(configData, phaseKey = "geo") {
    if (!configData || typeof configData !== "object") {
        return null;
    }
    if (phaseKey === "relative") {
        return configData.relative || configData.geo || configData.lunar || null;
    }
    if (phaseKey === "lunar") {
        return configData.lunar || configData.geo || configData.relative || null;
    }
    return configData.geo || configData.lunar || configData.relative || null;
}

export function resolvePostHorizonExtension(configData, phaseKey = "geo") {
    const extension = configData?.postHorizonExtension;
    if (!extension || typeof extension !== "object" || extension.enabled === false) {
        return null;
    }

    const sourceEndMs = parseMissionTimeMs(extension?.sourceEndTime);
    if (!Number.isFinite(sourceEndMs)) {
        return null;
    }

    const phaseConfig = resolvePhaseConfig(configData, phaseKey);
    const phaseEndMs = parseMissionTimeMs(phaseConfig?.endTime);
    if (!Number.isFinite(phaseEndMs) || phaseEndMs <= sourceEndMs) {
        return null;
    }

    const provenance = extension?.provenance && typeof extension.provenance === "object"
        ? extension.provenance
        : {};

    return {
        enabled: true,
        sourceEndMs,
        phaseEndMs,
        kind: String(provenance?.kind || "app-generated").trim(),
        segmentLabel: String(provenance?.segmentLabel || "Ballistic splashdown continuation").trim(),
        shortLabel: String(provenance?.shortLabel || "Generated final descent").trim(),
        summary: String(provenance?.summary || "").trim(),
        uiNote: String(provenance?.uiNote || "").trim(),
    };
}

export function buildPostHorizonUiNote(extension) {
    if (!extension) return "";
    if (extension.uiNote) {
        return extension.uiNote;
    }
    return "The final descent after the last published JPL HORIZONS Orion sample is app-generated ballistic continuation data.";
}

export function isGeneratedExtensionTime(timeMs, extension, epsilonMs = 0) {
    if (!Number.isFinite(timeMs) || !extension) {
        return false;
    }
    return timeMs > extension.sourceEndMs && timeMs <= (extension.phaseEndMs + epsilonMs);
}

export function resolveGeneratedCurvePoints(points, pointTimes, sourceEndMs) {
    if (
        !Array.isArray(points) ||
        !Array.isArray(pointTimes) ||
        points.length < 2 ||
        pointTimes.length !== points.length ||
        !Number.isFinite(sourceEndMs)
    ) {
        return [];
    }

    const firstGeneratedIndex = pointTimes.findIndex((timeMs) => Number.isFinite(timeMs) && timeMs > sourceEndMs);
    if (firstGeneratedIndex < 0) {
        return [];
    }
    const startIndex = Math.max(0, firstGeneratedIndex - 1);
    return points.slice(startIndex);
}

export function appendGeneratedUiText(baseText, extension, separator = " • ") {
    const normalizedBase = typeof baseText === "string" ? baseText.trim() : "";
    if (!extension) {
        return normalizedBase;
    }

    const note = buildPostHorizonUiNote(extension);
    if (!note) {
        return normalizedBase;
    }

    const loweredBase = normalizedBase.toLowerCase();
    const loweredNote = note.toLowerCase();
    if (
        loweredBase.includes("app-generated") ||
        loweredBase.includes("ballistic continuation") ||
        loweredBase.includes(loweredNote)
    ) {
        return normalizedBase;
    }

    return normalizedBase ? `${normalizedBase}${separator}${note}` : note;
}
