const ORIGIN_OVERRIDE_STORAGE_KEY = "mission.originOverride";
const LEGACY_ORIGIN_OVERRIDE_STORAGE_KEY = "cy3.originOverride";
const ANIM_TIME_OVERRIDE_STORAGE_KEY = "mission.animTimeOverride";
const LEGACY_ANIM_TIME_OVERRIDE_STORAGE_KEY = "cy3.animTimeOverride";

function createRelativeModeActions(deps) {
    const {
        isRelativeMode,
        setChecked,
        readOriginMode,
        getToggleMode,
        getCurrentAnimTime,
    } = deps;

    function getLabelForControlId(id) {
        const element = document.getElementById(id);
        const wrapped = element?.closest?.("label");
        if (wrapped) return wrapped;
        return document.querySelector(`label[for="${id}"]`);
    }

    function setOriginOptionDisabled(id, disabled) {
        const element = document.getElementById(id);
        if (!element) return;
        element.disabled = !!disabled;

        const label = getLabelForControlId(id);
        if (label) {
            label.style.display = "";
            label.style.opacity = disabled ? "0.65" : "";
        }
    }

    function syncOriginOptionAvailability() {
        const isRelativeSelected = !!document.getElementById("origin-relative")?.checked;
        const selectedMode = isRelativeSelected
            ? "relative"
            : (readOriginMode() === "lunar" ? "moon" : "earth");

        setOriginOptionDisabled("origin-earth", selectedMode === "earth");
        setOriginOptionDisabled("origin-moon", selectedMode === "moon");
        setOriginOptionDisabled("origin-relative", selectedMode === "relative");
    }

    function consumeOriginOverrideFromSession() {
        try {
            const url = new URL(window.location.href);
            const urlOrigin = (url.searchParams.get("origin") || "").toLowerCase();
            const override =
                (urlOrigin === "lunar" || urlOrigin === "geo" ? urlOrigin : null) ??
                sessionStorage.getItem(ORIGIN_OVERRIDE_STORAGE_KEY) ??
                sessionStorage.getItem(LEGACY_ORIGIN_OVERRIDE_STORAGE_KEY);
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
            sessionStorage.removeItem(LEGACY_ORIGIN_OVERRIDE_STORAGE_KEY);
        } catch {
            // Ignore storage errors (private browsing, disabled storage, etc.)
        }

        syncOriginOptionAvailability();
    }

    function consumeAnimTimeOverrideFromSession() {
        try {
            const value =
                sessionStorage.getItem(ANIM_TIME_OVERRIDE_STORAGE_KEY) ??
                sessionStorage.getItem(LEGACY_ANIM_TIME_OVERRIDE_STORAGE_KEY);
            sessionStorage.removeItem(ANIM_TIME_OVERRIDE_STORAGE_KEY);
            sessionStorage.removeItem(LEGACY_ANIM_TIME_OVERRIDE_STORAGE_KEY);
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        } catch {
            // Ignore storage errors (private browsing, disabled storage, etc.)
            return null;
        }
    }

    function persistAnimTimeOverrideToSession() {
        try {
            const currentAnimTime = Number(getCurrentAnimTime?.());
            if (Number.isFinite(currentAnimTime)) {
                sessionStorage.setItem(ANIM_TIME_OVERRIDE_STORAGE_KEY, String(currentAnimTime));
                sessionStorage.setItem(LEGACY_ANIM_TIME_OVERRIDE_STORAGE_KEY, String(currentAnimTime));
            } else {
                sessionStorage.removeItem(ANIM_TIME_OVERRIDE_STORAGE_KEY);
                sessionStorage.removeItem(LEGACY_ANIM_TIME_OVERRIDE_STORAGE_KEY);
            }
        } catch {
            // Ignore storage errors (private browsing, disabled storage, etc.)
        }
    }

    function applyRelativeModeOriginSelection() {
        if (!isRelativeMode) return;
        setChecked("origin-relative", true);
        setChecked("origin-earth", false);
        setChecked("origin-moon", false);
        syncOriginOptionAvailability();
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
            sessionStorage.removeItem(LEGACY_ORIGIN_OVERRIDE_STORAGE_KEY);
        } catch {
            // Ignore storage errors
        }

        persistAnimTimeOverrideToSession();
        navigateWithRelativeMode(true);
    }

    function toggleModeGuarded() {
        if (!isRelativeMode) {
            const toggleMode = getToggleMode?.();
            if (typeof toggleMode === "function") {
                toggleMode();
            }
            syncOriginOptionAvailability();
            return;
        }

        // Relative mode is URL-driven (mode=relative). Exiting requires a reload to reset frame/orbit sources.
        const nextOrigin = readOriginMode();
        try {
            if (nextOrigin === "lunar") {
                sessionStorage.setItem(ORIGIN_OVERRIDE_STORAGE_KEY, "lunar");
                sessionStorage.setItem(LEGACY_ORIGIN_OVERRIDE_STORAGE_KEY, "lunar");
            } else {
                sessionStorage.removeItem(ORIGIN_OVERRIDE_STORAGE_KEY);
                sessionStorage.removeItem(LEGACY_ORIGIN_OVERRIDE_STORAGE_KEY);
            }
        } catch {
            // Ignore storage errors
        }

        persistAnimTimeOverrideToSession();
        navigateWithRelativeMode(false);
    }

    return {
        consumeOriginOverrideFromSession,
        consumeAnimTimeOverrideFromSession,
        applyRelativeModeOriginSelection,
        navigateWithRelativeMode,
        toggleRelativeMode,
        toggleModeGuarded,
        syncOriginOptionAvailability,
    };
}

export { createRelativeModeActions };
