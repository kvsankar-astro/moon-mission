const MEDIA_AUDIENCE_VALUES = new Set(["all", "crew", "external"]);
const MEDIA_KIND_VALUES = new Set(["all", "image", "videoClip", "audioClip"]);

function asTrimmedString(value) {
    if (typeof value !== "string") return "";
    return value.trim();
}

function normalizeMediaAudienceFilter(value) {
    const normalized = asTrimmedString(value);
    return MEDIA_AUDIENCE_VALUES.has(normalized) ? normalized : "all";
}

function normalizeMediaKindFilter(value) {
    const normalized = asTrimmedString(value);
    return MEDIA_KIND_VALUES.has(normalized) ? normalized : "all";
}

function normalizeMediaCameraFilter(value) {
    const normalized = asTrimmedString(value);
    return normalized || "all";
}

function createDefaultMediaFilterState() {
    return {
        audience: "all",
        kind: "all",
        cameraId: "all",
    };
}

function normalizeMediaFilterState(value = {}) {
    return {
        audience: normalizeMediaAudienceFilter(value.audience),
        kind: normalizeMediaKindFilter(value.kind),
        cameraId: normalizeMediaCameraFilter(value.cameraId),
    };
}

function matchesMediaFilter(item, filterState) {
    if (!item || item.enabled === false) return false;
    const filters = normalizeMediaFilterState(filterState);

    if (filters.kind !== "all" && item.kind !== filters.kind) {
        return false;
    }

    if (filters.audience === "crew" && item.crewCaptured !== true) {
        return false;
    }
    if (filters.audience === "external" && item.external !== true) {
        return false;
    }

    if (filters.cameraId !== "all" && item.cameraId !== filters.cameraId) {
        return false;
    }

    return true;
}

function filterMediaItems(items, filterState) {
    return (Array.isArray(items) ? items : []).filter((item) => matchesMediaFilter(item, filterState));
}

function buildMediaFilterModel(items, filterState) {
    const normalizedItems = (Array.isArray(items) ? items : []).filter((item) => item?.enabled !== false);
    const filters = normalizeMediaFilterState(filterState);
    const audienceCounts = {
        all: normalizedItems.length,
        crew: normalizedItems.filter((item) => item.crewCaptured === true).length,
        external: normalizedItems.filter((item) => item.external === true).length,
    };

    const kindCounts = {
        all: normalizedItems.length,
        image: normalizedItems.filter((item) => item.kind === "image").length,
        videoClip: normalizedItems.filter((item) => item.kind === "videoClip").length,
        audioClip: normalizedItems.filter((item) => item.kind === "audioClip").length,
    };

    const cameraCounts = new Map();
    for (const item of normalizedItems) {
        const cameraId = asTrimmedString(item.cameraId);
        const cameraLabel = asTrimmedString(item.cameraLabel || cameraId);
        if (!cameraId || !cameraLabel) continue;
        const existing = cameraCounts.get(cameraId) || {
            id: cameraId,
            label: cameraLabel,
            count: 0,
        };
        existing.count += 1;
        cameraCounts.set(cameraId, existing);
    }

    return {
        audience: filters.audience,
        kind: filters.kind,
        cameraId: filters.cameraId,
        audienceOptions: [
            { id: "all", label: "All", count: audienceCounts.all, active: filters.audience === "all" },
            { id: "crew", label: "Crew", count: audienceCounts.crew, active: filters.audience === "crew" },
            { id: "external", label: "Exterior", count: audienceCounts.external, active: filters.audience === "external" },
        ],
        kindOptions: [
            { id: "all", label: "All Media", count: kindCounts.all, active: filters.kind === "all" },
            { id: "image", label: "Images", count: kindCounts.image, active: filters.kind === "image" },
            { id: "videoClip", label: "Clips", count: kindCounts.videoClip, active: filters.kind === "videoClip" },
            { id: "audioClip", label: "Audio", count: kindCounts.audioClip, active: filters.kind === "audioClip" },
        ].filter((option) => option.id === "all" || option.count > 0),
        cameraOptions: [
            {
                id: "all",
                label: "All Cameras",
                count: normalizedItems.length,
                active: filters.cameraId === "all",
            },
            ...Array.from(cameraCounts.values())
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((cameraOption) => ({
                    ...cameraOption,
                    active: filters.cameraId === cameraOption.id,
                })),
        ],
    };
}

export {
    buildMediaFilterModel,
    createDefaultMediaFilterState,
    filterMediaItems,
    matchesMediaFilter,
    normalizeMediaFilterState,
};
