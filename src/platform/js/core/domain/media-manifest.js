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

function normalizeMetadataKey(value) {
    return buildMediaThumbnailKey(value).toLowerCase();
}

function normalizeMediaCompositionHints(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {
            suggestedLockTarget: "",
            confidence: Number.NaN,
            reason: "",
        };
    }
    const suggestedLockTarget = asTrimmedString(
        value.suggestedLockTarget || value.suggested_lock_target,
    ).toLowerCase();
    return {
        suggestedLockTarget,
        confidence: toFiniteNumber(value.confidence),
        reason: asTrimmedString(value.reason),
    };
}

function normalizeMediaMainBody(value) {
    const normalized = asTrimmedString(value).toLowerCase();
    if (normalized === "earth") return "Earth";
    if (normalized === "moon") return "Moon";
    if (normalized === "sun") return "Sun";
    return "";
}

function normalizeMediaMetadataEntry(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return {
        id: asTrimmedString(value.id),
        fileName: asTrimmedString(value.file || value.fileName || value.filename),
        thumbnail: asTrimmedString(value.thumbnail || value.thumbnailAsset),
        shortDescription: asTrimmedString(value.shortDescription || value.short_description),
        tags: normalizeTextArray(value.tags),
        subjects: normalizeTextArray(value.subjects),
        sceneType: asTrimmedString(value.sceneType || value.scene_type),
        bodies: normalizeTextArray(value.bodies),
        mainBody: normalizeMediaMainBody(value.mainBody || value.main_body || value.primaryBody || value.primary_body),
        compositionHints: normalizeMediaCompositionHints(value.compositionHints || value.composition_hints),
        qualityNotes: asTrimmedString(value.qualityNotes || value.quality_notes),
    };
}

function normalizeMediaMetadataMap(entries = []) {
    const metadataByKey = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
        const normalized = normalizeMediaMetadataEntry(entry);
        if (!normalized) continue;
        const keys = [
            normalized.id,
            normalized.fileName,
            normalized.thumbnail,
        ].map(normalizeMetadataKey).filter(Boolean);
        for (const key of keys) {
            metadataByKey.set(key, normalized);
        }
    }
    return metadataByKey;
}

function resolveMediaMetadata(metadataByKey, {
    id = "",
    fileName = "",
    thumbnailKey = "",
} = {}) {
    if (!(metadataByKey instanceof Map) || metadataByKey.size === 0) return null;
    const keys = [
        id,
        fileName,
        thumbnailKey,
    ].map(normalizeMetadataKey).filter(Boolean);
    for (const key of keys) {
        const metadata = metadataByKey.get(key);
        if (metadata) return metadata;
    }
    return null;
}

function applyMediaMetadata(item, metadata) {
    const normalizedItem = item || {};
    if (!metadata) {
        return {
            ...normalizedItem,
            tags: normalizeTextArray(normalizedItem.tags),
            metadataTags: [],
            subjects: normalizeTextArray(normalizedItem.subjects),
            bodies: normalizeTextArray(normalizedItem.bodies),
            mainBody: normalizeMediaMainBody(
                normalizedItem.mainBody || normalizedItem.main_body || normalizedItem.primaryBody || normalizedItem.primary_body,
            ),
            sceneType: asTrimmedString(normalizedItem.sceneType || normalizedItem.scene_type),
            shortDescription: asTrimmedString(normalizedItem.shortDescription || normalizedItem.short_description),
            compositionHints: normalizeMediaCompositionHints(
                normalizedItem.compositionHints || normalizedItem.composition_hints,
            ),
            qualityNotes: asTrimmedString(normalizedItem.qualityNotes || normalizedItem.quality_notes),
        };
    }
    const metadataTags = normalizeTextArray(metadata.tags);
    const itemTags = normalizeTextArray(normalizedItem.tags);
    return {
        ...normalizedItem,
        description: normalizedItem.description || metadata.shortDescription || "",
        shortDescription: metadata.shortDescription || asTrimmedString(normalizedItem.shortDescription),
        tags: [...new Set([...itemTags, ...metadataTags])],
        metadataTags,
        subjects: normalizeTextArray(metadata.subjects),
        bodies: normalizeTextArray(metadata.bodies),
        mainBody: metadata.mainBody || normalizeMediaMainBody(normalizedItem.mainBody),
        sceneType: metadata.sceneType || asTrimmedString(normalizedItem.sceneType),
        compositionHints: metadata.compositionHints,
        qualityNotes: metadata.qualityNotes,
    };
}

function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function parseDurationSeconds(value) {
    const numeric = toFiniteNumber(value);
    if (Number.isFinite(numeric) && numeric > 0) {
        return numeric;
    }
    const text = asTrimmedString(value);
    if (!text) return Number.NaN;
    const match = text.match(/(?:^|[\s,;|·])(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/i);
    if (!match) return Number.NaN;
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : Number.NaN;
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

function stripMediaFileExtension(value) {
    return asTrimmedString(value).replace(/\.[A-Za-z0-9]{2,5}$/u, "");
}

function buildMediaThumbnailKey(...values) {
    const source = values.map(asTrimmedString).find(Boolean);
    if (!source) return "";
    return stripMediaFileExtension(source)
        .replace(/\\/g, "/")
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        || "media";
}

function normalizeThumbnailConfig(thumbnails = {}) {
    if (!thumbnails || typeof thumbnails !== "object" || Array.isArray(thumbnails)) {
        return {};
    }
    return {
        basePath: asTrimmedString(thumbnails.basePath),
        imagePattern: asTrimmedString(thumbnails.imagePattern),
        videoPattern: asTrimmedString(thumbnails.videoPattern),
        audioPattern: asTrimmedString(thumbnails.audioPattern),
        audioFallbackAsset: asTrimmedString(thumbnails.audioFallbackAsset),
    };
}

function resolveThumbnailPattern(pattern, {
    id = "",
    key = "",
    fileName = "",
    kind = "",
} = {}) {
    const normalizedPattern = asTrimmedString(pattern);
    if (!normalizedPattern) return "";
    return normalizedPattern
        .replaceAll("{id}", buildMediaThumbnailKey(id))
        .replaceAll("{key}", buildMediaThumbnailKey(key || id || fileName))
        .replaceAll("{file}", buildMediaThumbnailKey(fileName || id))
        .replaceAll("{kind}", buildMediaThumbnailKey(kind));
}

function joinRelativePath(basePath, relativePath) {
    const base = asTrimmedString(basePath).replace(/\/+$/g, "");
    const relative = asTrimmedString(relativePath).replace(/^\/+/g, "");
    if (!relative) return "";
    if (/^(https?:)?\/\//.test(relative) || relative.startsWith("/")) {
        return relative;
    }
    return base ? `${base}/${relative}` : relative;
}

function resolveThumbnailConventionAssetUrl(thumbnailConfig, {
    id = "",
    kind = "",
    fileName = "",
    thumbnailKey = "",
} = {}, dataPath) {
    const config = normalizeThumbnailConfig(thumbnailConfig);
    if (!Object.keys(config).length) return "";
    const key = buildMediaThumbnailKey(thumbnailKey, id, fileName);
    const pattern = kind === "videoClip"
        ? config.videoPattern
        : (kind === "audioClip" ? config.audioPattern : config.imagePattern);
    const relativeAsset = kind === "audioClip" && config.audioFallbackAsset
        ? config.audioFallbackAsset
        : resolveThumbnailPattern(pattern, {
            id,
            key,
            fileName,
            kind,
        });
    return resolveMediaAssetUrl(joinRelativePath(config.basePath, relativeAsset), dataPath) || "";
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

function normalizeMediaItem(item, index, cameraProfilesById, dataPath, thumbnailConfig = {}, metadataByKey = new Map()) {
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
    const explicitThumbnailAssetUrl = resolveMediaAssetUrl(
        item.thumbnailAsset || item.thumbnail,
        dataPath,
    );
    const conventionThumbnailAssetUrl = resolveThumbnailConventionAssetUrl(thumbnailConfig, {
        id,
        kind,
        fileName,
        thumbnailKey: item.thumbnailKey,
    }, dataPath);

    const normalizedItem = {
        id,
        kind,
        enabled: item.enabled !== false,
        startTimeMs: timeState.startTimeMs,
        endTimeMs,
        durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0
            ? durationSeconds
            : Number.NaN,
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
        thumbnailAssetUrl: explicitThumbnailAssetUrl
            || conventionThumbnailAssetUrl
            || resolveMediaAssetUrl(item.posterAsset, dataPath)
            || resolveMediaAssetUrl(item.asset, dataPath),
        thumbnailKey: buildMediaThumbnailKey(item.thumbnailKey, id, fileName),
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
    return applyMediaMetadata(
        normalizedItem,
        resolveMediaMetadata(metadataByKey, {
            id,
            fileName,
            thumbnailKey: item.thumbnailKey,
        }),
    );
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
    thumbnailConfig = {},
    metadataByKey = new Map(),
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
    const durationSeconds = isVideo
        ? parseDurationSeconds(photo.durationSeconds || photo.duration || photo.settings)
        : Number.NaN;
    const endTimeMs = Number.isFinite(durationSeconds)
        ? startTimeMs + (durationSeconds * 1000)
        : Number.NaN;
    const id = asTrimmedString(photo.id || fileName) || `media-item-${index + 1}`;
    const explicitThumbnailAssetUrl = resolveMediaAssetUrl(
        photo.thumbnailAsset || photo.thumbnail,
        dataPath,
    );
    const conventionThumbnailAssetUrl = resolveThumbnailConventionAssetUrl(thumbnailConfig, {
        id,
        kind: isVideo ? "videoClip" : "image",
        fileName,
        thumbnailKey: photo.thumbnailKey,
    }, dataPath);

    const normalizedItem = {
        id,
        kind: isVideo ? "videoClip" : "image",
        enabled: photo.enabled !== false,
        startTimeMs,
        endTimeMs,
        durationSeconds,
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
        thumbnailAssetUrl: explicitThumbnailAssetUrl
            || conventionThumbnailAssetUrl
            || posterAssetUrl
            || assetUrl,
        thumbnailKey: buildMediaThumbnailKey(photo.thumbnailKey, id, fileName),
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
    return applyMediaMetadata(
        normalizedItem,
        resolveMediaMetadata(metadataByKey, {
            id,
            fileName,
            thumbnailKey: photo.thumbnailKey,
        }),
    );
}

function normalizeArtemisTimelineMediaItems(manifest, dataPath, cameraProfilesById, thumbnailConfig = {}, metadataByKey = new Map()) {
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
            thumbnailConfig,
            metadataByKey,
        }))
        .filter(Boolean);
}

function normalizeArtemisTimelineAudioItem(audio, index, {
    mediaBase = "",
    dataPath = "",
    timezoneOffset = ARTEMIS_TIMELINE_DEFAULT_TIMEZONE_OFFSET,
    thumbnailConfig = {},
    metadataByKey = new Map(),
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
    const durationSeconds = parseDurationSeconds(audio.durationSeconds || audio.duration || audio.settings);
    const endTimeMs = Number.isFinite(durationSeconds)
        ? startTimeMs + (durationSeconds * 1000)
        : Number.NaN;
    const id = asTrimmedString(audio.id) || `audio:${fileName}`;
    const explicitThumbnailAssetUrl = resolveMediaAssetUrl(
        audio.thumbnailAsset || audio.thumbnail,
        dataPath,
    );
    const normalizedItem = {
        id,
        kind: "audioClip",
        enabled: audio.enabled !== false,
        startTimeMs,
        endTimeMs,
        durationSeconds,
        title: description,
        description,
        sourceLabel: fileName,
        sourceUrl: "",
        assetUrl: resolveArtemisTimelineDirectAssetUrl(fileName, mediaBase, dataPath),
        thumbnailAssetUrl: explicitThumbnailAssetUrl
            || resolveThumbnailConventionAssetUrl(thumbnailConfig, {
                id,
                kind: "audioClip",
                fileName,
                thumbnailKey: audio.thumbnailKey,
            }, dataPath),
        thumbnailKey: buildMediaThumbnailKey(audio.thumbnailKey, id, fileName),
        fileName,
    };
    return applyMediaMetadata(
        normalizedItem,
        resolveMediaMetadata(metadataByKey, {
            id,
            fileName,
            thumbnailKey: audio.thumbnailKey,
        }),
    );
}

function normalizeArtemisTimelineAudioItems(manifest, dataPath, thumbnailConfig = {}, metadataByKey = new Map()) {
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
            thumbnailConfig,
            metadataByKey,
        }))
        .filter(Boolean)
        .sort((a, b) => a.startTimeMs - b.startTimeMs);
}

function normalizeMediaStream(stream, index, dataPath, metadataByKey = new Map()) {
    if (!stream || typeof stream !== "object" || Array.isArray(stream)) {
        return null;
    }

    const id = asTrimmedString(stream.id) || `media-stream-${index + 1}`;
    const startTimeMs = parseMediaTimestamp(stream.startTime);
    if (!Number.isFinite(startTimeMs)) {
        return null;
    }
    const endTimeMs = parseMediaTimestamp(stream.endTime);
    const explicitDurationSeconds = toFiniteNumber(stream.durationSeconds);
    const durationSeconds = Number.isFinite(explicitDurationSeconds) && explicitDurationSeconds > 0
        ? explicitDurationSeconds
        : (Number.isFinite(endTimeMs) ? Math.max(0, (endTimeMs - startTimeMs) / 1000) : Number.NaN);
    const source = normalizeSourceMetadata(stream.source);

    const normalizedItem = {
        id,
        enabled: stream.enabled !== false,
        title: asTrimmedString(stream.title || id),
        description: asTrimmedString(stream.description),
        streamKind: asTrimmedString(stream.streamKind || "video") || "video",
        sourceType: normalizeStreamSourceType(stream.sourceType),
        sourceUrl: asTrimmedString(stream.sourceUrl),
        posterAssetUrl: resolveMediaAssetUrl(stream.posterAsset, dataPath),
        captions: normalizeTextArray(stream.captions),
        startTimeMs,
        endTimeMs,
        durationSeconds,
        syncMode: asTrimmedString(stream.syncMode || "missionClock") || "missionClock",
        syncStatus: asTrimmedString(stream.syncStatus),
        syncAnchors: normalizeMediaStreamSyncAnchors(stream.syncAnchors),
        timeOffsetSeconds: Number.isFinite(toFiniteNumber(stream.timeOffsetSeconds))
            ? toFiniteNumber(stream.timeOffsetSeconds)
            : 0,
        sourceLabel: asTrimmedString(stream.sourceLabel || source.label),
        sourcePageUrl: asTrimmedString(stream.sourcePageUrl || source.url),
        sourceCredit: asTrimmedString(stream.sourceCredit),
        license: asTrimmedString(stream.license),
        defaultPanelState: asTrimmedString(stream.defaultPanelState || "closed") || "closed",
    };
    return applyMediaMetadata(
        normalizedItem,
        resolveMediaMetadata(metadataByKey, {
            id,
            fileName: stream.posterAsset || stream.sourceUrl,
            thumbnailKey: stream.thumbnailKey,
        }),
    );
}

function normalizeMediaStreamSyncAnchors(syncAnchors = []) {
    if (!Array.isArray(syncAnchors)) return [];
    return syncAnchors
        .map((anchor) => {
            if (!anchor || typeof anchor !== "object" || Array.isArray(anchor)) return null;
            const missionTimeMs = parseMediaTimestamp(anchor.missionTime || anchor.time);
            const streamTimeSeconds = toFiniteNumber(anchor.streamTimeSeconds);
            if (!Number.isFinite(missionTimeMs) || !Number.isFinite(streamTimeSeconds)) {
                return null;
            }
            return {
                label: asTrimmedString(anchor.label || anchor.id),
                missionTimeMs,
                streamTimeSeconds,
                note: asTrimmedString(anchor.note),
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.streamTimeSeconds - b.streamTimeSeconds);
}

function normalizeMissionMediaManifest(manifestData, { dataPath = "" } = {}) {
    const manifest = manifestData && typeof manifestData === "object" ? manifestData : {};
    const cameraProfilesById = normalizeCameraProfiles(manifest.cameraProfiles);
    const thumbnailConfig = normalizeThumbnailConfig(manifest.thumbnails);
    const metadataByKey = normalizeMediaMetadataMap(manifest.mediaMetadata);
    const mediaItems = [
        ...(Array.isArray(manifest.mediaItems) ? manifest.mediaItems : [])
            .map((item, index) => normalizeMediaItem(
                item,
                index,
                cameraProfilesById,
                dataPath,
                thumbnailConfig,
                metadataByKey,
            ))
            .filter(Boolean),
        ...normalizeArtemisTimelineMediaItems(manifest, dataPath, cameraProfilesById, thumbnailConfig, metadataByKey),
    ].sort((a, b) => a.startTimeMs - b.startTimeMs);
    const mediaStreams = (Array.isArray(manifest.mediaStreams) ? manifest.mediaStreams : [])
        .map((stream, index) => normalizeMediaStream(stream, index, dataPath, metadataByKey))
        .filter(Boolean)
        .sort((a, b) => a.startTimeMs - b.startTimeMs);
    const audioItems = [
        ...(Array.isArray(manifest.audioItems) ? manifest.audioItems : [])
            .map((item, index) => normalizeMediaItem({
                ...item,
                kind: "audioClip",
            }, index, cameraProfilesById, dataPath, thumbnailConfig, metadataByKey))
            .filter(Boolean),
        ...normalizeArtemisTimelineAudioItems(manifest, dataPath, thumbnailConfig, metadataByKey),
    ].sort((a, b) => a.startTimeMs - b.startTimeMs);

    return {
        title: asTrimmedString(manifest.title || manifest.ui?.title || "Mission Media"),
        ui: manifest.ui && typeof manifest.ui === "object" ? manifest.ui : {},
        filters: manifest.filters && typeof manifest.filters === "object" ? manifest.filters : {},
        provenance: manifest.provenance && typeof manifest.provenance === "object"
            ? manifest.provenance
            : {},
        thumbnails: thumbnailConfig,
        cameraProfilesById,
        mediaItems,
        audioItems,
        mediaStreams,
    };
}

export {
    buildMediaThumbnailKey,
    normalizeMissionMediaManifest,
    parseMediaTimestamp,
};
