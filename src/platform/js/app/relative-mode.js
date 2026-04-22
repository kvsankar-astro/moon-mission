import { isCompareRuntimeMode } from "../core/domain/runtime-mode.js";

const ORIGIN_OVERRIDE_STORAGE_KEY = "mission.originOverride";
const LEGACY_ORIGIN_OVERRIDE_STORAGE_KEY = "cy3.originOverride";
const ANIM_TIME_OVERRIDE_STORAGE_KEY = "mission.animTimeOverride";
const LEGACY_ANIM_TIME_OVERRIDE_STORAGE_KEY = "cy3.animTimeOverride";

function createRelativeModeActions(deps) {
    const {
        isRelativeMode,
        isCompareMode,
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
                (
                    urlOrigin === "lunar" ||
                    urlOrigin === "geo" ||
                    urlOrigin === "relative"
                        ? urlOrigin
                        : null
                ) ??
                sessionStorage.getItem(ORIGIN_OVERRIDE_STORAGE_KEY) ??
                sessionStorage.getItem(LEGACY_ORIGIN_OVERRIDE_STORAGE_KEY);
            if (override === "relative") {
                setChecked("origin-relative", true);
                setChecked("origin-earth", false);
                setChecked("origin-moon", false);
            } else if (override === "lunar") {
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

    function normalizeCompareMissionParam(value) {
        const trimmed = typeof value === "string" ? value.trim() : "";
        return trimmed.length > 0 ? trimmed : "";
    }

    function normalizeCompareAlignmentEventParam(value) {
        const trimmed = typeof value === "string" ? value.trim().toLowerCase() : "";
        return trimmed.length > 0 ? trimmed : "";
    }

    function resolveRequestedCompareAlignmentEventKey(payloadValue, selectedValue, urlValue) {
        if (payloadValue !== undefined) {
            return normalizeCompareAlignmentEventParam(payloadValue);
        }

        return (
            normalizeCompareAlignmentEventParam(selectedValue) ||
            normalizeCompareAlignmentEventParam(urlValue)
        );
    }

    function normalizeOriginModeParam(value) {
        const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
        if (normalized === "earth") return "geo";
        if (normalized === "moon") return "lunar";
        if (normalized === "geo" || normalized === "lunar" || normalized === "relative") {
            return normalized;
        }
        return "";
    }

    function getSelectedOriginMode() {
        if (document.getElementById("origin-relative")?.checked) {
            return "relative";
        }
        return readOriginMode() === "lunar" ? "lunar" : "geo";
    }

    function getCompareMissionFromUrl() {
        try {
            const url = new URL(window.location.href);
            return normalizeCompareMissionParam(url.searchParams.get("compareMission"));
        } catch {
            return "";
        }
    }

    function getOriginModeFromUrl() {
        try {
            const url = new URL(window.location.href);
            return normalizeOriginModeParam(url.searchParams.get("origin"));
        } catch {
            return "";
        }
    }

    function getSelectedCompareMission() {
        const select = document.getElementById("compare-mission-select");
        return normalizeCompareMissionParam(select?.value);
    }

    function getSelectedComparePrimaryEventKey() {
        const select = document.getElementById("compare-primary-event-select");
        return normalizeCompareAlignmentEventParam(select?.value);
    }

    function getSelectedCompareSecondaryEventKey() {
        const select = document.getElementById("compare-secondary-event-select");
        return normalizeCompareAlignmentEventParam(select?.value);
    }

    function getComparePrimaryEventKeyFromUrl() {
        try {
            const url = new URL(window.location.href);
            return normalizeCompareAlignmentEventParam(url.searchParams.get("comparePrimaryEvent"));
        } catch {
            return "";
        }
    }

    function getCompareSecondaryEventKeyFromUrl() {
        try {
            const url = new URL(window.location.href);
            return normalizeCompareAlignmentEventParam(url.searchParams.get("compareSecondaryEvent"));
        } catch {
            return "";
        }
    }

    function replaceCompareMissionInUrl(compareMission) {
        try {
            const url = new URL(window.location.href);
            const normalizedCompareMission = normalizeCompareMissionParam(compareMission);
            if (normalizedCompareMission) {
                url.searchParams.set("compareMission", normalizedCompareMission);
            } else {
                url.searchParams.delete("compareMission");
            }
            window.history?.replaceState?.(null, "", url.toString());
        } catch {
            // Ignore URL mutation errors
        }
    }

    function applyOriginParamForNavigation(url, runtimeMode, originMode) {
        const normalizedOriginMode = normalizeOriginModeParam(originMode);
        if (runtimeMode === "compare") {
            if (normalizedOriginMode && normalizedOriginMode !== "relative") {
                url.searchParams.set("origin", normalizedOriginMode);
            } else {
                url.searchParams.delete("origin");
            }
            return;
        }

        if (runtimeMode === "relative") {
            url.searchParams.delete("origin");
            return;
        }

        if (normalizedOriginMode) {
            url.searchParams.set("origin", normalizedOriginMode);
        } else {
            url.searchParams.delete("origin");
        }
    }

    function navigateWithRuntimeMode(runtimeMode, options = {}) {
        const compareMission = options.compareMission;
        const primaryEventKey = normalizeCompareAlignmentEventParam(
            options.primaryEventKey !== undefined
                ? options.primaryEventKey
                : getComparePrimaryEventKeyFromUrl(),
        );
        const secondaryEventKey = normalizeCompareAlignmentEventParam(
            options.secondaryEventKey !== undefined
                ? options.secondaryEventKey
                : getCompareSecondaryEventKeyFromUrl(),
        );
        const originMode = normalizeOriginModeParam(
            options.originMode !== undefined ? options.originMode : getOriginModeFromUrl(),
        );
        const url = new URL(window.location.href);
        if (runtimeMode === "relative" || runtimeMode === "compare") {
            url.searchParams.set("mode", runtimeMode);
        } else {
            url.searchParams.delete("mode");
        }

        const normalizedCompareMission = normalizeCompareMissionParam(
            compareMission !== undefined ? compareMission : getCompareMissionFromUrl(),
        );
        if (normalizedCompareMission) {
            url.searchParams.set("compareMission", normalizedCompareMission);
        } else {
            url.searchParams.delete("compareMission");
        }
        if (primaryEventKey) {
            url.searchParams.set("comparePrimaryEvent", primaryEventKey);
        } else {
            url.searchParams.delete("comparePrimaryEvent");
        }
        if (secondaryEventKey) {
            url.searchParams.set("compareSecondaryEvent", secondaryEventKey);
        } else {
            url.searchParams.delete("compareSecondaryEvent");
        }
        applyOriginParamForNavigation(url, runtimeMode, originMode);
        window.location.href = url.toString();
    }

    function toggleRelativeMode() {
        if (isCompareMode) {
            persistAnimTimeOverrideToSession();
            navigateWithRuntimeMode("compare", {
                compareMission:
                    getSelectedCompareMission() ||
                    getCompareMissionFromUrl(),
                primaryEventKey:
                    getSelectedComparePrimaryEventKey() ||
                    getComparePrimaryEventKeyFromUrl(),
                secondaryEventKey:
                    getSelectedCompareSecondaryEventKey() ||
                    getCompareSecondaryEventKeyFromUrl(),
                originMode: "relative",
            });
            return;
        }
        if (isRelativeMode) return;
        try {
            sessionStorage.removeItem(ORIGIN_OVERRIDE_STORAGE_KEY);
            sessionStorage.removeItem(LEGACY_ORIGIN_OVERRIDE_STORAGE_KEY);
        } catch {
            // Ignore storage errors
        }

        persistAnimTimeOverrideToSession();
        navigateWithRuntimeMode("relative");
    }

    function toggleCompareMode(payload = {}) {
        const requestedEnabled =
            typeof payload.enabled === "boolean"
                ? payload.enabled
                : !isCompareMode;
        const compareMission =
            normalizeCompareMissionParam(payload.compareMission) ||
            getSelectedCompareMission() ||
            getCompareMissionFromUrl();
        const primaryEventKey = resolveRequestedCompareAlignmentEventKey(
            payload.primaryEventKey,
            getSelectedComparePrimaryEventKey(),
            getComparePrimaryEventKeyFromUrl(),
        );
        const secondaryEventKey = resolveRequestedCompareAlignmentEventKey(
            payload.secondaryEventKey,
            getSelectedCompareSecondaryEventKey(),
            getCompareSecondaryEventKeyFromUrl(),
        );

        if (requestedEnabled && !compareMission) {
            return;
        }

        const originMode = normalizeOriginModeParam(
            payload.originMode !== undefined ? payload.originMode : getSelectedOriginMode(),
        );
        const targetRuntimeMode = requestedEnabled
            ? "compare"
            : originMode === "relative"
                ? "relative"
                : null;

        try {
            sessionStorage.removeItem(ORIGIN_OVERRIDE_STORAGE_KEY);
            sessionStorage.removeItem(LEGACY_ORIGIN_OVERRIDE_STORAGE_KEY);
        } catch {
            // Ignore storage errors
        }

        persistAnimTimeOverrideToSession();
        navigateWithRuntimeMode(targetRuntimeMode, {
            compareMission,
            primaryEventKey,
            secondaryEventKey,
            originMode,
        });
    }

    function changeCompareMission(payload = {}) {
        const compareMission = normalizeCompareMissionParam(payload.compareMission);
        if (!compareMission) {
            return;
        }

        if (isCompareRuntimeMode(new URL(window.location.href).searchParams.get("mode"))) {
            persistAnimTimeOverrideToSession();
            navigateWithRuntimeMode("compare", {
                compareMission,
                primaryEventKey: resolveRequestedCompareAlignmentEventKey(
                    payload.primaryEventKey,
                    getSelectedComparePrimaryEventKey(),
                    getComparePrimaryEventKeyFromUrl(),
                ),
                secondaryEventKey: resolveRequestedCompareAlignmentEventKey(
                    payload.secondaryEventKey,
                    getSelectedCompareSecondaryEventKey(),
                    getCompareSecondaryEventKeyFromUrl(),
                ),
                originMode: getSelectedOriginMode() || getOriginModeFromUrl(),
            });
            return;
        }

        replaceCompareMissionInUrl(compareMission);
    }

    function changeCompareAlignment(payload = {}) {
        const primaryEventKey = resolveRequestedCompareAlignmentEventKey(
            payload.primaryEventKey,
            getSelectedComparePrimaryEventKey(),
            getComparePrimaryEventKeyFromUrl(),
        );
        const secondaryEventKey = resolveRequestedCompareAlignmentEventKey(
            payload.secondaryEventKey,
            getSelectedCompareSecondaryEventKey(),
            getCompareSecondaryEventKeyFromUrl(),
        );

        if (isCompareRuntimeMode(new URL(window.location.href).searchParams.get("mode"))) {
            persistAnimTimeOverrideToSession();
            navigateWithRuntimeMode("compare", {
                compareMission:
                    getSelectedCompareMission() ||
                    getCompareMissionFromUrl(),
                primaryEventKey,
                secondaryEventKey,
                originMode: getSelectedOriginMode() || getOriginModeFromUrl(),
            });
            return;
        }

        try {
            const url = new URL(window.location.href);
            if (primaryEventKey) {
                url.searchParams.set("comparePrimaryEvent", primaryEventKey);
            } else {
                url.searchParams.delete("comparePrimaryEvent");
            }
            if (secondaryEventKey) {
                url.searchParams.set("compareSecondaryEvent", secondaryEventKey);
            } else {
                url.searchParams.delete("compareSecondaryEvent");
            }
            window.history?.replaceState?.(null, "", url.toString());
        } catch {
            // Ignore URL mutation errors
        }
    }

    function toggleModeGuarded() {
        if (isCompareMode) {
            persistAnimTimeOverrideToSession();
            navigateWithRuntimeMode("compare", {
                compareMission:
                    getSelectedCompareMission() ||
                    getCompareMissionFromUrl(),
                primaryEventKey:
                    getSelectedComparePrimaryEventKey() ||
                    getComparePrimaryEventKeyFromUrl(),
                secondaryEventKey:
                    getSelectedCompareSecondaryEventKey() ||
                    getCompareSecondaryEventKeyFromUrl(),
                originMode: getSelectedOriginMode(),
            });
            syncOriginOptionAvailability();
            return;
        }

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
        navigateWithRuntimeMode(null);
    }

    return {
        consumeOriginOverrideFromSession,
        consumeAnimTimeOverrideFromSession,
        applyRelativeModeOriginSelection,
        navigateWithRuntimeMode,
        toggleRelativeMode,
        toggleCompareMode,
        changeCompareMission,
        changeCompareAlignment,
        toggleModeGuarded,
        syncOriginOptionAvailability,
    };
}

export { createRelativeModeActions };
