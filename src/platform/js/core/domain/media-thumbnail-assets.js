function resolveMediaThumbnailAssetUrl(item) {
    if (!item) return "";
    return item.thumbnailAssetUrl ||
        item.posterAssetUrl ||
        (item.kind === "audioClip" ? "" : item.assetUrl) ||
        "";
}

function resolveMediaThumbnailFallbackAssetUrl(item) {
    if (!item || item.kind === "audioClip") return "";
    if (item.kind === "videoClip") {
        return item.posterAssetUrl || "";
    }
    return item.assetUrl || item.posterAssetUrl || "";
}

export {
    resolveMediaThumbnailAssetUrl,
    resolveMediaThumbnailFallbackAssetUrl,
};
