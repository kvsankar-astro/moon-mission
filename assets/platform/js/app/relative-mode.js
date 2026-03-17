const ORIGIN_OVERRIDE_STORAGE_KEY = "cy3.originOverride";

function createRelativeModeActions(deps) {
    const {
        isRelativeMode,
        setChecked,
        readOriginMode,
        getToggleMode,
    } = deps;

    function consumeOriginOverrideFromSession() {
        try {
            const override = sessionStorage.getItem(ORIGIN_OVERRIDE_STORAGE_KEY);
            if (override === "lunar") {
                setChecked("origin-moon", true);
                setChecked("origin-earth", false);
                setChecked("origin-relative", false);
            } else if (override === "geo") {
                setChecked("origin-earth", true);
                setChecked("origin-moon", false);
                setChecked("origin-relative", false);
            }
            sessionStorage.removeItem(ORIGIN_OVERRIDE_STORAGE_KEY);
        } catch {
            // Ignore storage errors (private browsing, disabled storage, etc.)
        }
    }

    function applyRelativeModeOriginSelection() {
        if (!isRelativeMode) return;
        setChecked("origin-relative", true);
        setChecked("origin-earth", false);
        setChecked("origin-moon", false);
    }

    function navigateWithRelativeMode(enabled) {
        const url = new URL(window.location.href);
        if (enabled) {
            url.searchParams.set("mode", "relative");
        } else {
            url.searchParams.delete("mode");
        }
        window.location.href = url.toString();
    }

    function toggleRelativeMode() {
        if (isRelativeMode) return;
        try {
            sessionStorage.removeItem(ORIGIN_OVERRIDE_STORAGE_KEY);
        } catch {
            // Ignore storage errors
        }
        navigateWithRelativeMode(true);
    }

    function toggleModeGuarded() {
        if (!isRelativeMode) {
            const toggleMode = getToggleMode?.();
            if (typeof toggleMode === "function") {
                toggleMode();
            }
            return;
        }

        // Relative mode is URL-driven (mode=relative). Exiting requires a reload to reset frame/orbit sources.
        const nextOrigin = readOriginMode();
        try {
            if (nextOrigin === "lunar") {
                sessionStorage.setItem(ORIGIN_OVERRIDE_STORAGE_KEY, "lunar");
            } else {
                sessionStorage.removeItem(ORIGIN_OVERRIDE_STORAGE_KEY);
            }
        } catch {
            // Ignore storage errors
        }

        navigateWithRelativeMode(false);
    }

    return {
        consumeOriginOverrideFromSession,
        applyRelativeModeOriginSelection,
        navigateWithRelativeMode,
        toggleRelativeMode,
        toggleModeGuarded,
    };
}

export { createRelativeModeActions };
