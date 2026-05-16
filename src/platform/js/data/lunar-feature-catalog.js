import { resolveRuntimeAssetUrl } from "../core/domain/runtime-asset-url.js";

const LUNAR_FEATURE_CATALOG_PATH = "assets/lunar-features.json";

let loadedCatalog = null;
let loadingPromise = null;

function validateLunarFeatureCatalog(catalog, url) {
    if (!catalog || !Array.isArray(catalog.features)) {
        throw new Error(`Invalid lunar feature catalog at ${url}`);
    }
    return catalog;
}

function getLoadedLunarFeatureCatalog() {
    return loadedCatalog;
}

function setLoadedLunarFeatureCatalogForTests(catalog) {
    loadedCatalog = catalog || null;
    loadingPromise = null;
}

async function loadLunarFeatureCatalog({
    fetchFn = typeof fetch === "function" ? fetch : null,
    path = LUNAR_FEATURE_CATALOG_PATH,
    url = null,
    globalObject = typeof window !== "undefined" ? window : globalThis,
} = {}) {
    if (loadedCatalog) {
        return loadedCatalog;
    }
    if (loadingPromise) {
        return loadingPromise;
    }
    if (typeof fetchFn !== "function") {
        throw new Error("Lunar feature catalog loading requires fetch support");
    }

    const resolvedUrl = url || resolveRuntimeAssetUrl(path, { globalObject });
    loadingPromise = fetchFn(resolvedUrl, { cache: "no-store" })
        .then((response) => {
            if (!response?.ok) {
                throw new Error(`Failed to load lunar feature catalog from ${resolvedUrl}: ${response?.status}`);
            }
            return response.json();
        })
        .then((catalog) => {
            loadedCatalog = validateLunarFeatureCatalog(catalog, resolvedUrl);
            return loadedCatalog;
        })
        .finally(() => {
            loadingPromise = null;
        });

    return loadingPromise;
}

export {
    LUNAR_FEATURE_CATALOG_PATH,
    getLoadedLunarFeatureCatalog,
    loadLunarFeatureCatalog,
    setLoadedLunarFeatureCatalogForTests,
};
