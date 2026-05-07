function normalizeHipId(star) {
    const hip = Number(star?.hip ?? star?.hip_id ?? star?.hipId);
    return Number.isInteger(hip) && hip > 0 ? String(hip) : "";
}

function resolveStarDisplayName(star, nameIndex = {}) {
    const hipKey = normalizeHipId(star);
    const indexed = hipKey ? nameIndex?.[hipKey] : null;
    const indexedName = String(
        indexed?.displayName ||
        indexed?.curatedName ||
        indexed?.commonName ||
        indexed?.bayerName ||
        indexed?.flamsteedName ||
        indexed?.bayerSymbol ||
        "",
    ).trim();
    if (indexedName) {
        return indexedName;
    }

    const explicitName = String(star?.name || "").trim();
    if (explicitName && !/^HIP\s+\d+$/i.test(explicitName)) {
        return explicitName;
    }

    return "";
}

export {
    normalizeHipId,
    resolveStarDisplayName,
};
