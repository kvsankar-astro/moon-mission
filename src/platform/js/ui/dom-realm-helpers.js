(function attachDomRealmHelpers(globalObject) {
    if (!globalObject) return;

    function resolveRealmCtor(value, ctorName, fallbackRoot = globalObject) {
        return value?.ownerDocument?.defaultView?.[ctorName] ||
            fallbackRoot?.[ctorName] ||
            globalObject?.[ctorName] ||
            null;
    }

    function isDomInstance(value, ctorName, fallbackRoot = globalObject) {
        const ctor = resolveRealmCtor(value, ctorName, fallbackRoot);
        return typeof ctor === "function" && value instanceof ctor;
    }

    function isDomElement(value, fallbackRoot = globalObject) {
        return isDomInstance(value, "Element", fallbackRoot);
    }

    function isDomEventInstance(event, ctorName, fallbackRoot = globalObject) {
        const ctor = event?.view?.[ctorName] ||
            fallbackRoot?.[ctorName] ||
            globalObject?.[ctorName] ||
            null;
        return typeof ctor === "function" && event instanceof ctor;
    }

    globalObject.MissionDomHelpers = Object.freeze({
        isDomElement,
        isDomEventInstance,
        isDomInstance,
        resolveRealmCtor,
    });
})(typeof window !== "undefined" ? window : globalThis);
