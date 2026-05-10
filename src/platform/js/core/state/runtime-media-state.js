import {
    createDefaultMediaFilterState,
    normalizeMediaFilterState,
} from "../domain/media-filter-state.js";

function createRuntimeMediaState({
    initialFilters = createDefaultMediaFilterState(),
} = {}) {
    let manifest = null;
    let loadState = "idle";
    let filters = normalizeMediaFilterState(initialFilters);
    let activeItemId = "";
    let activeItemAnchorTimeMs = Number.NaN;

    return {
        getManifest: () => manifest,
        setManifest: (value) => {
            manifest = value || null;
        },
        getLoadState: () => loadState,
        setLoadState: (value) => {
            loadState = String(value || "").trim() || "idle";
        },
        getFilters: () => filters,
        setFilters: (value) => {
            filters = normalizeMediaFilterState(value);
        },
        patchFilters: (patch) => {
            filters = normalizeMediaFilterState({
                ...filters,
                ...(patch && typeof patch === "object" ? patch : {}),
            });
        },
        getActiveItemId: () => activeItemId,
        getActiveItemAnchorTimeMs: () => activeItemAnchorTimeMs,
        setActiveItemId: (value, {
            anchorTimeMs = Number.NaN,
        } = {}) => {
            activeItemId = String(value || "").trim();
            activeItemAnchorTimeMs = activeItemId && Number.isFinite(Number(anchorTimeMs))
                ? Number(anchorTimeMs)
                : Number.NaN;
        },
    };
}

export {
    createRuntimeMediaState,
};
