function resolveNearestMediaIndex(items, timeMs) {
    const normalizedItems = Array.isArray(items) ? items : [];
    if (normalizedItems.length === 0) return -1;
    if (!Number.isFinite(timeMs)) return 0;

    const firstItem = normalizedItems[0];
    const lastItem = normalizedItems[normalizedItems.length - 1];
    if (timeMs <= firstItem.startTimeMs) return 0;
    if (timeMs >= lastItem.startTimeMs) return normalizedItems.length - 1;

    for (let index = 1; index < normalizedItems.length; index += 1) {
        const currentItem = normalizedItems[index];
        if (timeMs < currentItem.startTimeMs) return index - 1;
    }

    return normalizedItems.length - 1;
}

function resolveMediaSelectionState({
    items,
    timeMs,
    nearbyRadius = 3,
} = {}) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const activeIndex = resolveNearestMediaIndex(normalizedItems, timeMs);
    if (activeIndex < 0) {
        return {
            hasItems: false,
            activeIndex: -1,
            activeItem: null,
            previousItem: null,
            nextItem: null,
            nearbyItems: [],
            activeDeltaMs: Number.NaN,
        };
    }

    const activeItem = normalizedItems[activeIndex] || null;
    const startIndex = Math.max(0, activeIndex - Math.max(0, nearbyRadius));
    const endIndex = Math.min(normalizedItems.length, activeIndex + Math.max(0, nearbyRadius) + 1);

    return {
        hasItems: true,
        activeIndex,
        activeItem,
        previousItem: activeIndex > 0 ? normalizedItems[activeIndex - 1] : null,
        nextItem: activeIndex < (normalizedItems.length - 1) ? normalizedItems[activeIndex + 1] : null,
        nearbyItems: normalizedItems.slice(startIndex, endIndex),
        activeDeltaMs: activeItem ? timeMs - activeItem.startTimeMs : Number.NaN,
    };
}

export {
    resolveMediaSelectionState,
    resolveNearestMediaIndex,
};
