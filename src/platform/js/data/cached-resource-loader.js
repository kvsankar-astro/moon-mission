function createCachedResourceLoader({ label = "loadResource", load }) {
    if (typeof load !== "function") {
        throw new Error("createCachedResourceLoader requires a load function");
    }

    const valueCache = new Map();
    const promiseCache = new Map();

    return async function loadResource(url) {
        if (!url) {
            throw new Error(`${label}(url) requires a URL`);
        }

        const cachedValue = valueCache.get(url);
        if (cachedValue) return cachedValue;

        const cachedPromise = promiseCache.get(url);
        if (cachedPromise) return cachedPromise;

        const promise = Promise.resolve()
            .then(() => load(url))
            .then((data) => {
                valueCache.set(url, data);
                promiseCache.delete(url);
                return data;
            })
            .catch((error) => {
                promiseCache.delete(url);
                throw error;
            });

        promiseCache.set(url, promise);
        return promise;
    };
}

export { createCachedResourceLoader };
