const MEDIA_AUDIENCE_VALUES = new Set(["all", "crew", "external"]);
const MEDIA_KIND_VALUES = new Set(["all", "image", "videoClip", "audioClip"]);
const MEDIA_KIND_FILTER_IDS = ["image", "audioClip", "videoClip"];
const MEDIA_SUBJECT_FILTER_IDS = ["crew", "space"];
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
    if (normalized === "new") return "crew";
    return MEDIA_QUICK_FILTER_VALUES.has(normalized) ? normalized : "";
}

function normalizeMediaCameraIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((entry) => asTrimmedString(entry)).filter(Boolean))];
}

function normalizeMediaKindIds(value) {
    if (!Array.isArray(value)) return null;
    const normalized = [...new Set(value.map((entry) => asTrimmedString(entry)).filter((entry) => (
        MEDIA_KIND_FILTER_IDS.includes(entry)
    )))];
    return normalized;
}

function normalizeMediaSubjectId(value) {
    const normalized = asTrimmedString(value);
    if (normalized === "new") return "crew";
    if (normalized === "external" || normalized === "exterior") return "space";
    return MEDIA_SUBJECT_FILTER_IDS.includes(normalized) ? normalized : "";
}

function normalizeMediaSubjectIds(value) {
    if (!Array.isArray(value)) return null;
    return [...new Set(value.map((entry) => normalizeMediaSubjectId(entry)).filter(Boolean))];
}

function createDefaultMediaFilterState() {
    return {
        quick: "all",
        cameraId: "all",
        cameraIds: [],
        audience: "all",
        kind: "all",
        mediaKinds: [...MEDIA_KIND_FILTER_IDS],
        subjects: [],
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
    const explicitMediaKinds = normalizeMediaKindIds(value.mediaKinds);
    const mediaKinds = explicitMediaKinds || (
        quick === "videos"
            ? ["videoClip"]
            : (kind === "all" ? [...MEDIA_KIND_FILTER_IDS] : [kind])
    );
    const normalizedKind = mediaKinds.length === 1 ? mediaKinds[0] : "all";
    const explicitSubjects = normalizeMediaSubjectIds(value.subjects);
    const subjects = explicitSubjects || (
        quick === "crew"
            ? ["crew"]
            : (quick === "exterior"
                ? ["space"]
                : (audience === "crew"
                    ? ["crew"]
                    : (audience === "external" ? ["space"] : [])))
    );
    const normalizedAudience = subjects.length === 1
        ? (subjects[0] === "crew" ? "crew" : "external")
        : "all";

    return {
        quick,
        cameraIds,
        cameraId: cameraIds.length === 1 ? cameraIds[0] : "all",
        audience: normalizedAudience,
        kind: normalizedKind,
        mediaKinds,
        subjects,
    };
}

function matchesSubjectFilter(item, subjects) {
    if (!Array.isArray(subjects) || subjects.length === 0) return true;
    return subjects.some((subject) => (
        (subject === "crew" && item.crewCaptured === true)
        || (subject === "space" && item.external === true)
    ));
}

function matchesKindFilter(item, filters) {
    if (filters.quick === "videos" && item.kind !== "videoClip") return false;
    return filters.mediaKinds.includes(item.kind);
}

function matchesCameraFilter(item, cameraIds) {
    return !Array.isArray(cameraIds) || cameraIds.length === 0 || cameraIds.includes(item.cameraId);
}

function matchesMediaFilterParts(item, filters, {
    ignoreKind = false,
    ignoreSubject = false,
    ignoreCamera = false,
} = {}) {
    if (!item || item.enabled === false) return false;
    if (!ignoreSubject && !matchesSubjectFilter(item, filters.subjects)) return false;
    if (!ignoreKind && !matchesKindFilter(item, filters)) return false;
    if (!ignoreCamera && !matchesCameraFilter(item, filters.cameraIds)) return false;
    return true;
}

function matchesMediaFilter(item, filterState) {
    const filters = normalizeMediaFilterState(filterState);
    return matchesMediaFilterParts(item, filters);
}

function filterMediaItems(items, filterState) {
    return (Array.isArray(items) ? items : []).filter((item) => matchesMediaFilter(item, filterState));
}

function countMediaKinds(items) {
    const normalizedItems = Array.isArray(items) ? items : [];
    return {
        all: normalizedItems.length,
        image: normalizedItems.filter((item) => item.kind === "image").length,
        videoClip: normalizedItems.filter((item) => item.kind === "videoClip").length,
        audioClip: normalizedItems.filter((item) => item.kind === "audioClip").length,
    };
}

function countSubjects(items) {
    const normalizedItems = Array.isArray(items) ? items : [];
    return {
        all: normalizedItems.length,
        crew: normalizedItems.filter((item) => item.crewCaptured === true).length,
        space: normalizedItems.filter((item) => item.external === true).length,
    };
}

function buildCameraCountMap(items) {
    const cameraCounts = new Map();
    for (const item of Array.isArray(items) ? items : []) {
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
    return cameraCounts;
}

function buildMediaFilterModel(items, filterState) {
    const normalizedItems = (Array.isArray(items) ? items : []).filter((item) => item?.enabled !== false);
    const filters = normalizeMediaFilterState(filterState);
    const currentItems = normalizedItems.filter((item) => matchesMediaFilterParts(item, filters));
    const kindScopedItems = normalizedItems.filter((item) => matchesMediaFilterParts(item, filters, {
        ignoreKind: true,
    }));
    const subjectScopedItems = normalizedItems.filter((item) => matchesMediaFilterParts(item, filters, {
        ignoreSubject: true,
    }));
    const cameraScopedItems = normalizedItems.filter((item) => matchesMediaFilterParts(item, filters, {
        ignoreCamera: true,
    }));
    const audienceCounts = countSubjects(normalizedItems);
    const subjectCounts = countSubjects(subjectScopedItems);
    const currentKindCounts = countMediaKinds(currentItems);
    const kindCounts = countMediaKinds(kindScopedItems);
    const cameraCounts = buildCameraCountMap(cameraScopedItems);
    const activeCameraIds = new Set(filters.cameraIds);
    const activeKindIds = new Set(filters.mediaKinds);
    const activeSubjectIds = new Set(filters.subjects);
    const cameraButtonOptions = CAMERA_BUTTON_ORDER.map((cameraOption) => {
        const counted = cameraCounts.get(cameraOption.id);
        return {
            ...cameraOption,
            count: counted?.count || 0,
            active: activeCameraIds.has(cameraOption.id),
        };
    });
    const subjectOptions = [
        { id: "crew", label: "Crew", count: subjectCounts.crew, active: activeSubjectIds.has("crew") },
        { id: "space", label: "Space", count: subjectCounts.space, active: activeSubjectIds.has("space") },
    ];

    return {
        totalCount: normalizedItems.length,
        matchCount: currentItems.length,
        matchKindCounts: currentKindCounts,
        quick: filters.quick,
        audience: filters.audience,
        kind: filters.kind,
        mediaKinds: filters.mediaKinds,
        subjects: filters.subjects,
        cameraId: filters.cameraId,
        cameraIds: filters.cameraIds,
        kindPillOptions: [
            { id: "image", label: "Images", count: kindCounts.image, active: activeKindIds.has("image") },
            { id: "audioClip", label: "Audio", count: kindCounts.audioClip, active: activeKindIds.has("audioClip") },
            { id: "videoClip", label: "Video", count: kindCounts.videoClip, active: activeKindIds.has("videoClip") },
        ],
        subjectOptions,
        quickOptions: subjectOptions,
        videoOption: {
            id: "videos",
            label: "Videos",
            count: kindCounts.videoClip,
            active: filters.mediaKinds.length === 1 && activeKindIds.has("videoClip"),
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
                count: cameraScopedItems.length,
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
    MEDIA_KIND_FILTER_IDS,
    MEDIA_SUBJECT_FILTER_IDS,
    normalizeMediaFilterState,
};
