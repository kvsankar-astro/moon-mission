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
        setActiveItemId: (value) => {
            activeItemId = String(value || "").trim();
        },
    };
}

export {
    createRuntimeMediaState,
};
