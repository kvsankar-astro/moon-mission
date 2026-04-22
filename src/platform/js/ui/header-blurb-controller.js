const HEADER_BLURB_AUTO_COLLAPSE_DELAY_MS = 10000;
const DEFAULT_MISSION_INTERACTIVE_REGION_SELECTOR = [
    "#header-pill-strip",
    "#settings-panel-button",
    "#compare-pill-button",
    "#advanced-controls-pill",
    "#settings-panel",
    "#compare-panel",
    "#control-panel",
    "#zoom-panel",
    "#timeline-dock",
    "#canvas-wrapper",
    "#svg-wrapper",
    ".aux-camera-view",
    "#ground-track-panel",
    "#mobile-shell-nav",
    ".mobile-shell__card",
    "#mobile-views-collapse",
    "#info-panel",
    "#shortcut-panel",
    ".panel-manager-menu",
].join(", ");

export function createHeaderBlurbController(deps = {}) {
    const documentRef = deps.documentRef || document;
    const windowRef = deps.windowRef || window;
    const isMobileViewport = typeof deps.isMobileViewport === "function"
        ? deps.isMobileViewport
        : () => false;
    const isInteractiveInputTarget = typeof deps.isInteractiveInputTarget === "function"
        ? deps.isInteractiveInputTarget
        : () => false;
    const meaningfulActivityKeys = deps.meaningfulActivityKeys || new Set();
    const missionInteractiveRegionSelector =
        deps.missionInteractiveRegionSelector || DEFAULT_MISSION_INTERACTIVE_REGION_SELECTOR;
    const autoCollapseDelayMs = Number.isFinite(deps.autoCollapseDelayMs)
        ? deps.autoCollapseDelayMs
        : HEADER_BLURB_AUTO_COLLAPSE_DELAY_MS;
    const elementCtor = windowRef.Element || globalThis.Element || null;

    let bound = false;

    function isElementLike(value) {
        if (!value) return false;
        if (elementCtor) return value instanceof elementCtor;
        return typeof value === "object";
    }

    function bind() {
        if (bound) return;
        bound = true;

        const blurb = documentRef.getElementById("blurb");
        const toggle = documentRef.getElementById("blurb-toggle");
        if (!blurb || !toggle) return;

        let compact = blurb.classList.contains("blurb--compact");
        let manualPreference = false;
        let autoCollapseTimerId = null;
        let autoCollapseEnabled = true;

        const syncUi = () => {
            blurb.classList.toggle("blurb--compact", compact);
            toggle.textContent = compact ? "About" : "Hide";
            toggle.setAttribute("aria-expanded", compact ? "false" : "true");
            toggle.setAttribute(
                "aria-label",
                compact ? "Show mission summary" : "Hide mission summary",
            );
            toggle.title = compact ? "Show mission summary" : "Hide mission summary";
        };

        const clearAutoCollapseTimer = () => {
            if (autoCollapseTimerId === null) return;
            windowRef.clearTimeout(autoCollapseTimerId);
            autoCollapseTimerId = null;
        };

        const canAutoCollapse = () =>
            autoCollapseEnabled && !manualPreference && !compact && !isMobileViewport();

        const scheduleAutoCollapse = () => {
            clearAutoCollapseTimer();
            if (!canAutoCollapse()) return;
            autoCollapseTimerId = windowRef.setTimeout(() => {
                if (!canAutoCollapse()) return;
                compact = true;
                syncUi();
                clearAutoCollapseTimer();
            }, autoCollapseDelayMs);
        };

        const setCompact = (nextCompact, { manual = false } = {}) => {
            compact = !!nextCompact;
            if (manual) {
                manualPreference = true;
            }
            syncUi();
            scheduleAutoCollapse();
        };

        const applyAutoCollapsePreference = (enabled) => {
            autoCollapseEnabled = enabled !== false;
            if (!manualPreference && !autoCollapseEnabled) {
                setCompact(false);
                return;
            }
            setCompact(compact);
        };

        const isMeaningfulInteractionTarget = (target) => {
            if (!isElementLike(target)) return false;
            if (target.closest?.("#blurb")) return false;
            if (target.closest?.(missionInteractiveRegionSelector)) return true;
            return !!target.closest?.(
                'button, a, input, select, textarea, summary, label, [role="button"], [role="tab"], [role="slider"]',
            );
        };

        const collapseFromInteraction = (target) => {
            if (!canAutoCollapse()) return;
            if (!isMeaningfulInteractionTarget(target)) return;
            compact = true;
            syncUi();
            clearAutoCollapseTimer();
        };

        toggle.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            setCompact(!compact, { manual: true });
        });

        documentRef.addEventListener("pointerdown", (event) => {
            collapseFromInteraction(event.target);
        }, true);

        documentRef.addEventListener("input", (event) => {
            collapseFromInteraction(event.target);
        }, true);

        documentRef.addEventListener("wheel", (event) => {
            collapseFromInteraction(event.target);
        }, { passive: true, capture: true });

        documentRef.addEventListener("keydown", (event) => {
            if (!canAutoCollapse()) return;
            if (isInteractiveInputTarget(event.target)) return;
            if (!meaningfulActivityKeys.has(event.key)) return;
            collapseFromInteraction(documentRef.getElementById("control-panel") || documentRef.body);
        }, true);

        windowRef.addEventListener("resize", () => {
            syncUi();
            scheduleAutoCollapse();
        }, { passive: true });

        documentRef.addEventListener("mission-ui-config-updated", (event) => {
            const configEvent = /** @type {CustomEvent | null} */ (event);
            const enabled = configEvent?.detail?.ui?.headerBlurbAutoCollapseEnabled;
            applyAutoCollapsePreference(enabled);
        });

        syncUi();
        scheduleAutoCollapse();
    }

    return {
        bind,
    };
}
