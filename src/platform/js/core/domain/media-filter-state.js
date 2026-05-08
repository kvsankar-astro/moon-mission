const MEDIA_AUDIENCE_VALUES = new Set(["all", "crew", "external"]);
const MEDIA_KIND_VALUES = new Set(["all", "image", "videoClip", "audioClip"]);
const MEDIA_QUICK_FILTER_VALUES = new Set(["all", "crew", "new", "exterior", "videos"]);
const CAMERA_BUTTON_ORDER = [
    { id: "d5a", label: "D5 #1", title: "Nikon D5 body 3500015" },
    { id: "d5b", label: "D5 #2", title: "Nikon D5 body 3500017" },
    { id: "z9", label: "Z9", title: "Nikon Z 9" },
    { id: "gopro", label: "GoPro", title: "GoPro exterior camera" },
    { id: "iphone", label: "iPhone", title: "Crew iPhone" },
];

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

function normalizeMediaQuickFilter(value) {
    const normalized = asTrimmedString(value);
    return MEDIA_QUICK_FILTER_VALUES.has(normalized) ? normalized : "";
}

function normalizeMediaCameraIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((entry) => asTrimmedString(entry)).filter(Boolean))];
}

function createDefaultMediaFilterState() {
    return {
        quick: "all",
        cameraId: "all",
        cameraIds: [],
        audience: "all",
        kind: "all",
    };
}

function normalizeMediaFilterState(value = {}) {
    const kind = normalizeMediaKindFilter(value.kind);
    const audience = normalizeMediaAudienceFilter(value.audience);
    const explicitQuick = normalizeMediaQuickFilter(value.quick);
    const quick = explicitQuick
        || (kind === "videoClip" ? "videos" : "")
        || (audience === "crew" ? "crew" : "")
        || (audience === "external" ? "exterior" : "")
        || "all";
    const legacyCameraId = normalizeMediaCameraFilter(value.cameraId);
    const cameraIds = normalizeMediaCameraIds(value.cameraIds);
    if (cameraIds.length === 0 && legacyCameraId !== "all") {
        cameraIds.push(legacyCameraId);
    }

    return {
        quick,
        cameraIds,
        cameraId: cameraIds.length === 1 ? cameraIds[0] : "all",
        audience: quick === "crew"
            ? "crew"
            : (quick === "exterior" ? "external" : "all"),
        kind: quick === "videos" ? "videoClip" : kind,
    };
}

function matchesMediaFilter(item, filterState) {
    if (!item || item.enabled === false) return false;
    const filters = normalizeMediaFilterState(filterState);

    if (filters.quick === "crew" && item.crewCaptured !== true) {
        return false;
    }
    if (filters.quick === "new" && item.batch !== 2) {
        return false;
    }
    if (filters.quick === "exterior" && item.external !== true) {
        return false;
    }
    if (filters.quick === "videos" && item.kind !== "videoClip") {
        return false;
    }
    if (filters.quick === "all" && filters.kind !== "all" && item.kind !== filters.kind) {
        return false;
    }

    if (filters.cameraIds.length > 0 && !filters.cameraIds.includes(item.cameraId)) {
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
    const quickCounts = {
        all: normalizedItems.length,
        crew: normalizedItems.filter((item) => item.crewCaptured === true).length,
        new: normalizedItems.filter((item) => item.batch === 2).length,
        exterior: normalizedItems.filter((item) => item.external === true).length,
        videos: normalizedItems.filter((item) => item.kind === "videoClip").length,
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
    const activeCameraIds = new Set(filters.cameraIds);
    const cameraButtonOptions = CAMERA_BUTTON_ORDER.map((cameraOption) => {
        const counted = cameraCounts.get(cameraOption.id);
        return {
            ...cameraOption,
            count: counted?.count || 0,
            active: activeCameraIds.has(cameraOption.id),
        };
    });

    return {
        quick: filters.quick,
        audience: filters.audience,
        kind: filters.kind,
        cameraId: filters.cameraId,
        cameraIds: filters.cameraIds,
        quickOptions: [
            { id: "all", label: "All Photos and Video", count: quickCounts.all, active: filters.quick === "all" && filters.cameraIds.length === 0 },
            { id: "crew", label: "Crew Photos Only", count: quickCounts.crew, active: filters.quick === "crew" && filters.cameraIds.length === 0 },
            { id: "new", label: "New Crew Photos", count: quickCounts.new, active: filters.quick === "new" && filters.cameraIds.length === 0 },
            { id: "exterior", label: "Spacecraft Exterior", count: quickCounts.exterior, active: filters.quick === "exterior" && filters.cameraIds.length === 0 },
        ],
        videoOption: {
            id: "videos",
            label: "Videos",
            count: quickCounts.videos,
            active: filters.quick === "videos" && filters.cameraIds.length === 0,
        },
        cameraButtonOptions,
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
