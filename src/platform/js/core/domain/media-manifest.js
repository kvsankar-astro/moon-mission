import { resolveDataPathUrl } from "./mission-asset-resolver.js";

const MEDIA_ITEM_KINDS = new Set(["image", "videoClip", "audioClip"]);
const MEDIA_STREAM_SOURCE_TYPES = new Set(["mp4", "hls", "youtube", "iframe"]);
const ARTEMIS_TIMELINE_DEFAULT_TIMEZONE_OFFSET = "-04:00";

function asTrimmedString(value) {
    if (typeof value !== "string") return "";
    return value.trim();
}

function normalizeTextArray(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => asTrimmedString(entry))
        .filter(Boolean);
}

function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function parseFixedOffsetTimestamp(value, timezoneOffset = "") {
    const text = asTrimmedString(value);
    const offset = asTrimmedString(timezoneOffset);
    if (!text || !offset) return Number.NaN;
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
        return Number.NaN;
    }
    const parsed = Date.parse(`${text.replace(" ", "T")}${offset}`);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseMediaTimestamp(value, { timezoneOffset = "" } = {}) {
    const text = asTrimmedString(value);
    if (!text) return Number.NaN;

    const fixedOffsetParsed = parseFixedOffsetTimestamp(text, timezoneOffset);
    if (Number.isFinite(fixedOffsetParsed)) {
        return fixedOffsetParsed;
    }

    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeMediaItemKind(value) {
    const normalized = asTrimmedString(value);
    return MEDIA_ITEM_KINDS.has(normalized) ? normalized : "image";
}

function normalizeStreamSourceType(value) {
    const normalized = asTrimmedString(value);
    return MEDIA_STREAM_SOURCE_TYPES.has(normalized) ? normalized : "mp4";
}

function resolveMediaAssetUrl(value, dataPath) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return resolveMediaAssetUrl(value.url, dataPath);
    }
    return resolveDataPathUrl(dataPath, value);
}

function normalizeSourceMetadata(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        const label = asTrimmedString(value);
        return {
            label,
            url: "",
        };
    }
    return {
        label: asTrimmedString(value.label || value.name),
        url: asTrimmedString(value.url || value.href),
    };
}

function normalizeCameraProfiles(cameraProfiles = {}) {
    const normalizedProfiles = {};

    const entries = Array.isArray(cameraProfiles)
        ? cameraProfiles.map((entry) => [entry?.id, entry])
        : Object.entries(cameraProfiles || {});

    for (const [rawId, rawProfile] of entries) {
        const id = asTrimmedString(rawId || rawProfile?.id);
        if (!id) continue;
        const profile = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
        normalizedProfiles[id] = {
            id,
            label: asTrimmedString(profile.label || profile.camera || id),
            timeOffsetSeconds: Number.isFinite(toFiniteNumber(profile.timeOffsetSeconds))
                ? toFiniteNumber(profile.timeOffsetSeconds)
                : 0,
            timeOffsetNote: asTrimmedString(profile.timeOffsetNote || profile.note),
        };
    }

    return normalizedProfiles;
}

function resolveMediaStartTimeMs(item, cameraProfile) {
    const explicitStartMs = parseMediaTimestamp(item?.startTime);
    if (Number.isFinite(explicitStartMs)) {
        return {
            startTimeMs: explicitStartMs,
            captureTimeMs: parseMediaTimestamp(item?.captureTime),
            effectiveTimeOffsetSeconds: 0,
            timeSource: "timelineTime",
        };
    }

    const captureTimeMs = parseMediaTimestamp(item?.captureTime);
    if (!Number.isFinite(captureTimeMs)) {
        return {
            startTimeMs: Number.NaN,
            captureTimeMs: Number.NaN,
            effectiveTimeOffsetSeconds: 0,
            timeSource: "",
        };
    }

    const itemOffset = toFiniteNumber(item?.timeOffsetSeconds);
    const effectiveTimeOffsetSeconds = Number.isFinite(itemOffset)
        ? itemOffset
        : Number(cameraProfile?.timeOffsetSeconds || 0);
    return {
        startTimeMs: captureTimeMs + (effectiveTimeOffsetSeconds * 1000),
        captureTimeMs,
        effectiveTimeOffsetSeconds,
        timeSource: effectiveTimeOffsetSeconds !== 0
            ? "captureTime+offset"
            : "captureTime",
    };
}

function normalizeMediaItem(item, index, cameraProfilesById, dataPath) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
    }

    const id = asTrimmedString(item.id) || `media-item-${index + 1}`;
    const cameraId = asTrimmedString(item.cameraId);
    const cameraProfile = cameraId ? cameraProfilesById[cameraId] : null;
    const timeState = resolveMediaStartTimeMs(item, cameraProfile);
    if (!Number.isFinite(timeState.startTimeMs)) {
        return null;
    }

    const kind = normalizeMediaItemKind(item.kind);
    const explicitEndMs = parseMediaTimestamp(item.endTime);
    const durationSeconds = toFiniteNumber(item.durationSeconds);
    const endTimeMs = Number.isFinite(explicitEndMs)
        ? explicitEndMs
        : (Number.isFinite(durationSeconds) && durationSeconds > 0
            ? timeState.startTimeMs + (durationSeconds * 1000)
            : Number.NaN);
    const source = normalizeSourceMetadata(item.source);
    const fileName = asTrimmedString(item.file || item.filename);
    const batch = toFiniteNumber(item.batch);

    return {
        id,
        kind,
        enabled: item.enabled !== false,
        startTimeMs: timeState.startTimeMs,
        endTimeMs,
        captureTimeMs: timeState.captureTimeMs,
        effectiveTimeOffsetSeconds: timeState.effectiveTimeOffsetSeconds,
        timeOffsetNote: asTrimmedString(item.timeOffsetNote || cameraProfile?.timeOffsetNote),
        timeSource: timeState.timeSource,
        title: asTrimmedString(item.title || item.label || fileName || id),
        description: asTrimmedString(item.description || item.summary),
        sourceLabel: source.label,
        sourceUrl: source.url,
        assetUrl: resolveMediaAssetUrl(item.asset, dataPath),
        posterAssetUrl: resolveMediaAssetUrl(item.posterAsset, dataPath),
        thumbnailAssetUrl: resolveMediaAssetUrl(item.thumbnailAsset, dataPath)
            || resolveMediaAssetUrl(item.posterAsset, dataPath)
            || resolveMediaAssetUrl(item.asset, dataPath),
        photographer: asTrimmedString(item.photographer),
        cameraId,
        cameraLabel: asTrimmedString(item.camera || cameraProfile?.label || cameraId),
        location: asTrimmedString(item.location),
        fileName,
        settings: asTrimmedString(item.settings),
        tags: normalizeTextArray(item.tags),
        crewCaptured: item.crewCaptured === true,
        external: item.external === true,
        batch: Number.isFinite(batch) ? batch : 0,
        availabilityStartPolicy: asTrimmedString(item.availabilityStartPolicy),
    };
}

function ensureTrailingSlash(value) {
    const normalized = asTrimmedString(value);
    if (!normalized) return "";
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function normalizeArtemisTimelineCameraId(photo) {
    const explicitCameraId = asTrimmedString(photo?.camera_id || photo?.cameraId);
    if (explicitCameraId) return explicitCameraId;

    const cameraText = asTrimmedString(photo?.camera).toUpperCase();
    if (!cameraText) return "";
    if (cameraText.includes("Z 9") || cameraText.includes("Z9")) return "z9";
    if (cameraText.includes("HERO")) return "gopro";
    if (cameraText.includes("IPHONE")) return "iphone";
    return "";
}

function isArtemisTimelineExteriorPhoto(photo) {
    if (photo?.exterior === true) return true;
    return asTrimmedString(photo?.camera).toUpperCase().includes("HERO");
}

function resolveArtemisTimelineWebAssetUrl(fileName, mediaBase, dataPath) {
    const normalizedFileName = asTrimmedString(fileName);
    if (!normalizedFileName) return "";

    const normalizedMediaBase = ensureTrailingSlash(mediaBase);
    if (normalizedMediaBase) {
        return `${normalizedMediaBase}web/${encodeURIComponent(normalizedFileName)}`;
    }

    return resolveDataPathUrl(dataPath, `web/${normalizedFileName}`) || "";
}

function encodePathSegments(value) {
    return asTrimmedString(value)
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

function resolveArtemisTimelineDirectAssetUrl(fileName, mediaBase, dataPath) {
    const normalizedFileName = asTrimmedString(fileName);
    if (!normalizedFileName) return "";

    const normalizedMediaBase = ensureTrailingSlash(mediaBase);
    if (normalizedMediaBase) {
        return `${normalizedMediaBase}${encodePathSegments(normalizedFileName)}`;
    }

    return resolveDataPathUrl(dataPath, normalizedFileName) || "";
}

function resolveArtemisTimelinePosterAssetUrl(fileName, mediaBase, dataPath) {
    const normalizedFileName = asTrimmedString(fileName);
    if (!normalizedFileName || !/\.mp4$/i.test(normalizedFileName)) {
        return "";
    }
    const posterFileName = normalizedFileName.replace(/\.mp4$/i, "-poster.jpg");
    return resolveArtemisTimelineWebAssetUrl(posterFileName, mediaBase, dataPath);
}

function normalizeArtemisTimelinePhoto(photo, index, {
    mediaBase = "",
    dataPath = "",
    timezoneOffset = ARTEMIS_TIMELINE_DEFAULT_TIMEZONE_OFFSET,
    cameraProfilesById = {},
} = {}) {
    if (!photo || typeof photo !== "object" || Array.isArray(photo)) {
        return null;
    }

    const fileName = asTrimmedString(photo.file);
    const startTimeMs = parseMediaTimestamp(photo.time, { timezoneOffset });
    if (!fileName || !Number.isFinite(startTimeMs)) {
        return null;
    }

    const isVideo = photo.video === true;
    const assetUrl = resolveArtemisTimelineWebAssetUrl(fileName, mediaBase, dataPath);
    const posterAssetUrl = isVideo
        ? resolveArtemisTimelinePosterAssetUrl(fileName, mediaBase, dataPath)
        : "";
    const source = normalizeSourceMetadata(photo.source);
    const cameraId = normalizeArtemisTimelineCameraId(photo);
    const cameraProfile = cameraId ? cameraProfilesById[cameraId] : null;
    const batch = toFiniteNumber(photo.batch);

    return {
        id: asTrimmedString(photo.id || fileName) || `media-item-${index + 1}`,
        kind: isVideo ? "videoClip" : "image",
        enabled: photo.enabled !== false,
        startTimeMs,
        endTimeMs: Number.NaN,
        captureTimeMs: Number.NaN,
        effectiveTimeOffsetSeconds: 0,
        timeOffsetNote: "",
        timeSource: "timelineTime",
        title: asTrimmedString(photo.title || fileName),
        description: asTrimmedString(photo.flickr_desc || photo.desc),
        sourceLabel: source.label || fileName,
        sourceUrl: source.url,
        assetUrl,
        posterAssetUrl,
        thumbnailAssetUrl: posterAssetUrl || assetUrl,
        photographer: asTrimmedString(photo.photographer),
        cameraId,
        cameraLabel: asTrimmedString(cameraProfile?.label || photo.camera),
        location: asTrimmedString(photo.location),
        fileName,
        settings: asTrimmedString(photo.settings),
        tags: normalizeTextArray(photo.tags),
        crewCaptured: photo.spacecraft === true,
        external: isArtemisTimelineExteriorPhoto(photo),
        batch: Number.isFinite(batch) ? batch : 0,
        availabilityStartPolicy: "",
    };
}

function normalizeArtemisTimelineMediaItems(manifest, dataPath, cameraProfilesById) {
    const photos = Array.isArray(manifest?.photos) ? manifest.photos : [];
    if (photos.length === 0) return [];

    const mediaBase = asTrimmedString(manifest?.mediaBase);
    const timezoneOffset = asTrimmedString(manifest?.timelineTimezoneOffset)
        || ARTEMIS_TIMELINE_DEFAULT_TIMEZONE_OFFSET;

    return photos
        .map((photo, index) => normalizeArtemisTimelinePhoto(photo, index, {
            mediaBase,
            dataPath,
            timezoneOffset,
            cameraProfilesById,
        }))
        .filter(Boolean);
}

function normalizeArtemisTimelineAudioItem(audio, index, {
    mediaBase = "",
    dataPath = "",
    timezoneOffset = ARTEMIS_TIMELINE_DEFAULT_TIMEZONE_OFFSET,
} = {}) {
    if (!audio || typeof audio !== "object" || Array.isArray(audio)) {
        return null;
    }

    const fileName = asTrimmedString(audio.file);
    const startTimeMs = parseMediaTimestamp(audio.time, { timezoneOffset });
    if (!fileName || !Number.isFinite(startTimeMs)) {
        return null;
    }

    const description = asTrimmedString(audio.desc || audio.title || fileName);
    return {
        id: asTrimmedString(audio.id) || `audio:${fileName}`,
        kind: "audioClip",
        enabled: audio.enabled !== false,
        startTimeMs,
        endTimeMs: Number.NaN,
        title: description,
        description,
        sourceLabel: fileName,
        sourceUrl: "",
        assetUrl: resolveArtemisTimelineDirectAssetUrl(fileName, mediaBase, dataPath),
        fileName,
    };
}

function normalizeArtemisTimelineAudioItems(manifest, dataPath) {
    const audio = Array.isArray(manifest?.audio) ? manifest.audio : [];
    if (audio.length === 0) return [];

    const mediaBase = asTrimmedString(manifest?.mediaBase);
    const timezoneOffset = asTrimmedString(manifest?.timelineTimezoneOffset)
        || ARTEMIS_TIMELINE_DEFAULT_TIMEZONE_OFFSET;

    return audio
        .map((item, index) => normalizeArtemisTimelineAudioItem(item, index, {
            mediaBase,
            dataPath,
            timezoneOffset,
        }))
        .filter(Boolean)
        .sort((a, b) => a.startTimeMs - b.startTimeMs);
}

function normalizeMediaStream(stream, index, dataPath) {
    if (!stream || typeof stream !== "object" || Array.isArray(stream)) {
        return null;
    }

    const id = asTrimmedString(stream.id) || `media-stream-${index + 1}`;
    const startTimeMs = parseMediaTimestamp(stream.startTime);
    if (!Number.isFinite(startTimeMs)) {
        return null;
    }
    const endTimeMs = parseMediaTimestamp(stream.endTime);

    return {
        id,
        enabled: stream.enabled !== false,
        title: asTrimmedString(stream.title || id),
        streamKind: asTrimmedString(stream.streamKind || "video") || "video",
        sourceType: normalizeStreamSourceType(stream.sourceType),
        sourceUrl: asTrimmedString(stream.sourceUrl),
        posterAssetUrl: resolveMediaAssetUrl(stream.posterAsset, dataPath),
        captions: normalizeTextArray(stream.captions),
        startTimeMs,
        endTimeMs,
        syncMode: asTrimmedString(stream.syncMode || "missionClock") || "missionClock",
        timeOffsetSeconds: Number.isFinite(toFiniteNumber(stream.timeOffsetSeconds))
            ? toFiniteNumber(stream.timeOffsetSeconds)
            : 0,
        defaultPanelState: asTrimmedString(stream.defaultPanelState || "closed") || "closed",
    };
}

function normalizeMissionMediaManifest(manifestData, { dataPath = "" } = {}) {
    const manifest = manifestData && typeof manifestData === "object" ? manifestData : {};
    const cameraProfilesById = normalizeCameraProfiles(manifest.cameraProfiles);
    const mediaItems = [
        ...(Array.isArray(manifest.mediaItems) ? manifest.mediaItems : [])
            .map((item, index) => normalizeMediaItem(item, index, cameraProfilesById, dataPath))
            .filter(Boolean),
        ...normalizeArtemisTimelineMediaItems(manifest, dataPath, cameraProfilesById),
    ].sort((a, b) => a.startTimeMs - b.startTimeMs);
    const mediaStreams = (Array.isArray(manifest.mediaStreams) ? manifest.mediaStreams : [])
        .map((stream, index) => normalizeMediaStream(stream, index, dataPath))
        .filter(Boolean)
        .sort((a, b) => a.startTimeMs - b.startTimeMs);
    const audioItems = [
        ...(Array.isArray(manifest.audioItems) ? manifest.audioItems : [])
            .map((item, index) => normalizeMediaItem({
                ...item,
                kind: "audioClip",
            }, index, cameraProfilesById, dataPath))
            .filter(Boolean),
        ...normalizeArtemisTimelineAudioItems(manifest, dataPath),
    ].sort((a, b) => a.startTimeMs - b.startTimeMs);

    return {
        title: asTrimmedString(manifest.title || manifest.ui?.title || "Mission Media"),
        ui: manifest.ui && typeof manifest.ui === "object" ? manifest.ui : {},
        filters: manifest.filters && typeof manifest.filters === "object" ? manifest.filters : {},
        provenance: manifest.provenance && typeof manifest.provenance === "object"
            ? manifest.provenance
            : {},
        cameraProfilesById,
        mediaItems,
        audioItems,
        mediaStreams,
    };
}

export {
    normalizeMissionMediaManifest,
    parseMediaTimestamp,
};
