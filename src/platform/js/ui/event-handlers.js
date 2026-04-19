import { invokeMissionPanelAction } from "../app/panel-registry.js";
import {
    resolveBodyOrbitCopy,
    resolveCraftOrbitCopy,
} from "./orbit-control-labels.js";
import { createCameraPillController } from "./camera-pill-controller.js";
import { createDesktopChromeAutohideController } from "./desktop-chrome-autohide.js";
import { createHeaderBlurbController } from "./header-blurb-controller.js";
import { createHeaderPillStripController } from "./header-pill-strip-controller.js";
import { bindMobileMissionCardSync } from "./mobile-mission-card-sync.js";
import { createKeyboardShortcutsController } from "./keyboard-shortcuts-controller.js";
import { createSettingsPanelController } from "./settings-panel-controller.js";
import { createSharedControlBackend } from "./shared-control-backend.js";
import { resolveMoonRenderAssetProfile } from "../app/moon-render-asset-profiles.js";

/**
 * UI Event Handlers
 *
 * Centralizes DOM event wiring for mission.html.
 * This keeps mission.js focused on orchestration and business logic.
 */

function onClick(id, handler) {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener("click", handler);
}

function onChange(id, handler) {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener("change", handler);
}

function onInput(id, handler) {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener("input", handler);
}

function getMissionDialogApi() {
    return window.MissionDialog || window.CY3Dialog || null;
}

let controlPanelResizeBound = false;
let timelineDockHeightSyncBound = false;
let timelineCarouselDragBound = false;
let timelineDockResizeObserver = null;
let timelineDockMutationObserver = null;
let timelineCarouselWiggleTimeoutId = null;
const TIMELINE_CAROUSEL_WIGGLE_CLASS = "timeline-dock__event-carousel--wiggle";
const MEANINGFUL_ACTIVITY_KEYS = new Set([
    " ",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    "Home",
    "End",
]);
function isInteractiveInputTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return target.isContentEditable === true;
}

function dispatchSyntheticPress(target, pointerType = "mouse") {
    if (!target || target.disabled) return false;
    if (typeof window.PointerEvent === "function") {
        target.dispatchEvent(new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType,
            isPrimary: true,
            button: 0,
        }));
        target.dispatchEvent(new PointerEvent("pointerup", {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType,
            isPrimary: true,
            button: 0,
        }));
        return true;
    }
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    return true;
}

function isMobileViewport() {
    return window.innerWidth <= 600;
}

function isElementLayoutVisible(element) {
    if (!(element instanceof Element)) return false;
    if (element.hasAttribute("hidden")) return false;
    const style = window.getComputedStyle?.(element);
    if (!style) return false;
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
    }
    const rect = element.getBoundingClientRect?.();
    return !!rect && rect.width > 0 && rect.height > 0;
}

let settingsPanelController = null;
let keyboardShortcutsController = null;
let desktopChromeAutohideController = null;
let headerBlurbController = null;
let headerPillStripController = null;

function getSettingsPanelController() {
    if (!settingsPanelController) {
        settingsPanelController = createSettingsPanelController({
            onClick,
            getMissionDialogApi,
            isMobileViewport,
            isElementLayoutVisible,
            setControlPanelCollapsedState,
        });
    }
    return settingsPanelController;
}

function getKeyboardShortcutsController() {
    if (!keyboardShortcutsController) {
        keyboardShortcutsController = createKeyboardShortcutsController({
            onClick,
            isInteractiveInputTarget,
            dispatchSyntheticPress,
        });
    }
    return keyboardShortcutsController;
}

function getDesktopChromeAutohideController() {
    if (!desktopChromeAutohideController) {
        desktopChromeAutohideController = createDesktopChromeAutohideController({
            getMissionDialogApi,
            isElementLayoutVisible,
            isInteractiveInputTarget,
            isMobileViewport,
            isSettingsPanelOpen,
            meaningfulActivityKeys: MEANINGFUL_ACTIVITY_KEYS,
            requestAnimationFrameImpl: requestAnimationFrame,
            setControlPanelCollapsedState,
            setHeaderPillStripAutoCollapsedState: (collapsed) =>
                getHeaderPillStripController().setAutoCollapsedState(collapsed),
        });
    }
    return desktopChromeAutohideController;
}

function getHeaderBlurbController() {
    if (!headerBlurbController) {
        headerBlurbController = createHeaderBlurbController({
            isInteractiveInputTarget,
            isMobileViewport,
            meaningfulActivityKeys: MEANINGFUL_ACTIVITY_KEYS,
        });
    }
    return headerBlurbController;
}

function getHeaderPillStripController() {
    if (!headerPillStripController) {
        headerPillStripController = createHeaderPillStripController({
            requestAnimationFrameImpl: requestAnimationFrame,
        });
    }
    return headerPillStripController;
}

function isSettingsPanelOpen() {
    return getSettingsPanelController().isSettingsPanelOpen();
}

function bindHeaderBlurbBehavior() {
    getHeaderBlurbController().bind();
}

function bindDesktopChromeAutohideBehavior() {
    getDesktopChromeAutohideController().bind();
}

function syncControlPanelInfoOffset(panel = document.getElementById("control-panel")) {
    if (!panel) return;
    const root = document.documentElement;
    const collapsed = panel.classList.contains("control-panel--collapsed");
    const height = collapsed ? 0 : Math.max(0, Math.round(panel.getBoundingClientRect().height));
    root.style.setProperty("--control-panel-visual-height", `${height}px`);
}

function syncTimelineDockHeight(timelineDock = document.getElementById("timeline-dock")) {
    if (!timelineDock) return;
    const root = document.documentElement;
    const height = Math.max(0, Math.round(timelineDock.getBoundingClientRect().height));
    root.style.setProperty("--timeline-dock-height", `${height}px`);
}

function bindTimelineDockHeightSync(timelineDock = document.getElementById("timeline-dock")) {
    if (!timelineDock || timelineDockHeightSyncBound) return;
    timelineDockHeightSyncBound = true;

    const scheduleSync = () => requestAnimationFrame(() => syncTimelineDockHeight(timelineDock));
    scheduleSync();

    // Initial content (event chips/fonts/layout) settles asynchronously on load.
    [80, 180, 320, 520, 900].forEach((delayMs) => {
        window.setTimeout(scheduleSync, delayMs);
    });

    if (typeof ResizeObserver === "function") {
        timelineDockResizeObserver = new ResizeObserver(() => {
            scheduleSync();
        });
        timelineDockResizeObserver.observe(timelineDock);
    }

    const burnButtons = document.getElementById("burnbuttons");
    if (burnButtons && typeof MutationObserver === "function") {
        timelineDockMutationObserver = new MutationObserver(() => {
            scheduleSync();
        });
        timelineDockMutationObserver.observe(burnButtons, {
            childList: true,
            subtree: true,
            attributes: true,
        });
    }
}

function bindTimelineCarouselDragGesture() {
    if (timelineCarouselDragBound) return;
    const carousel = document.querySelector("#timeline-dock .timeline-dock__event-carousel");
    if (!carousel) return;
    timelineCarouselDragBound = true;

    const dragState = {
        pointerId: null,
        startX: 0,
        startScrollLeft: 0,
        dragging: false,
        suppressClickUntilMs: 0,
    };
    const DRAG_THRESHOLD_PX = 4;
    const CLICK_SUPPRESS_MS = 220;

    const clearDragState = () => {
        dragState.pointerId = null;
        dragState.dragging = false;
        carousel.classList.remove("is-dragging");
    };

    const onPointerMoveWindow = (event) => {
        if (dragState.pointerId == null || event.pointerId !== dragState.pointerId) return;
        const deltaX = event.clientX - dragState.startX;
        if (!dragState.dragging && Math.abs(deltaX) >= DRAG_THRESHOLD_PX) {
            dragState.dragging = true;
            carousel.classList.add("is-dragging");
        }
        if (!dragState.dragging) return;
        carousel.scrollLeft = dragState.startScrollLeft - deltaX;
        event.preventDefault();
    };

    const endDragWindow = (event) => {
        if (dragState.pointerId == null || event.pointerId !== dragState.pointerId) return;
        if (dragState.dragging) {
            dragState.suppressClickUntilMs = Date.now() + CLICK_SUPPRESS_MS;
        }
        clearDragState();
    };

    const onPointerDown = (event) => {
        if (event.button !== 0) return;
        if (event.pointerType !== "mouse") return;
        dragState.pointerId = event.pointerId;
        dragState.startX = event.clientX;
        dragState.startScrollLeft = carousel.scrollLeft;
        dragState.dragging = false;
        carousel.classList.remove("is-dragging");
    };

    // Use capture phase so button targets inside chips cannot swallow drag-start.
    carousel.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMoveWindow, true);
    window.addEventListener("pointerup", endDragWindow, true);
    window.addEventListener("pointercancel", endDragWindow, true);
    window.addEventListener("blur", clearDragState);

    carousel.addEventListener("click", (event) => {
        if (Date.now() > dragState.suppressClickUntilMs) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);
}

function setControlPanelCollapsedState(collapsed) {
    const panel = document.getElementById("control-panel");
    if (!panel) return;
    const nextCollapsed = !!collapsed;
    if (panel.classList.contains("control-panel--collapsed") === nextCollapsed) return;
    panel.classList.toggle("control-panel--collapsed", nextCollapsed);
    requestAnimationFrame(() => syncControlPanelInfoOffset(panel));
}

function getTimelineCurrentTimeMs() {
    const slider = document.getElementById("timeline-slider");
    if (!slider) return Number.NaN;
    const value = Number(slider.value);
    return Number.isFinite(value) ? value : Number.NaN;
}

function resolveUpcomingTimelineEventButton() {
    const buttons = document.querySelectorAll("#burnbuttons button[data-event-index]");
    if (!buttons.length) return null;

    const currentTimeMs = getTimelineCurrentTimeMs();
    if (!Number.isFinite(currentTimeMs)) {
        return buttons[0] || null;
    }
    let bestFutureButton = null;
    let bestFutureDelta = Number.POSITIVE_INFINITY;
    let bestNearestButton = null;
    let bestNearestDelta = Number.POSITIVE_INFINITY;

    for (const button of buttons) {
        const rawTime = button?.dataset?.eventTimeMs;
        const eventTimeMs = Number(rawTime);
        if (!Number.isFinite(eventTimeMs)) continue;
        const absoluteDelta = Math.abs(eventTimeMs - currentTimeMs);
        if (absoluteDelta < bestNearestDelta) {
            bestNearestDelta = absoluteDelta;
            bestNearestButton = button;
        }
        const futureDelta = eventTimeMs - currentTimeMs;
        if (futureDelta < 0) continue;
        if (futureDelta < bestFutureDelta) {
            bestFutureDelta = futureDelta;
            bestFutureButton = button;
        }
    }

    return bestFutureButton || bestNearestButton;
}

function scrollTimelineEventButtonIntoView(button) {
    if (!button || typeof button.scrollIntoView !== "function") return;
    button.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
    });
}

function focusUpcomingTimelineEventButton() {
    scrollTimelineEventButtonIntoView(resolveUpcomingTimelineEventButton());
}

function triggerTimelineCarouselWiggle() {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    const carousel = document.querySelector("#timeline-dock .timeline-dock__event-carousel");
    if (!carousel) return;
    carousel.classList.remove(TIMELINE_CAROUSEL_WIGGLE_CLASS);
    void carousel.offsetWidth;
    carousel.classList.add(TIMELINE_CAROUSEL_WIGGLE_CLASS);
    if (timelineCarouselWiggleTimeoutId !== null) {
        clearTimeout(timelineCarouselWiggleTimeoutId);
    }
    timelineCarouselWiggleTimeoutId = window.setTimeout(() => {
        carousel.classList.remove(TIMELINE_CAROUSEL_WIGGLE_CLASS);
        timelineCarouselWiggleTimeoutId = null;
    }, 480);
}

function setTimelineEventCarouselExpandedState(expanded, options = {}) {
    const timelineDock = document.getElementById("timeline-dock");
    const button = document.getElementById("control-panel-toggle");
    if (!timelineDock || !button) return;
    const wasExpanded = !timelineDock.classList.contains("timeline-dock--events-collapsed");
    timelineDock.classList.toggle("timeline-dock--events-collapsed", !expanded);
    requestAnimationFrame(() => syncTimelineDockHeight(timelineDock));
    button.setAttribute("aria-expanded", String(expanded));
    button.setAttribute(
        "aria-label",
        expanded ? "Pull down events carousel" : "Pull up events carousel",
    );
    button.title = expanded ? "Pull down events carousel" : "Pull up events carousel";

    const opened = expanded && !wasExpanded;
    if (!opened) return;

    const { focusUpcoming = true, wiggleCue = true } = options;
    requestAnimationFrame(() => {
        if (focusUpcoming) {
            focusUpcomingTimelineEventButton();
        }
        if (wiggleCue) {
            triggerTimelineCarouselWiggle();
        }
    });
}

/**
 * Bind the Settings panel opener.
 */
export function bindSettingsPanel() {
    getSettingsPanelController().bind();
}

/**
 * Bind the dynamically-created burn buttons to the provided handler.
 * @param {number} eventCount
 * @param {(index: number) => void} onBurn
 */
export function bindBurnButtons(eventCount, onBurn) {
    const burnButtons = document.querySelectorAll("#burnbuttons button[data-event-index]");
    if (burnButtons.length > 0) {
        burnButtons.forEach((button) => {
            const eventIndex = Number.parseInt(button.getAttribute("data-event-index") || "", 10);
            if (!Number.isFinite(eventIndex)) return;
            button.onclick = function () {
                onBurn(eventIndex);
            };
        });
        return;
    }

    for (let i = 0; i < eventCount; ++i) {
        onClick("burn" + (i + 1), function () {
            onBurn(i);
        });
    }
}

/**
 * Bind main UI controls.
 * @param {Object} handlers
 */
export function bindMainControls(handlers) {
    const {
        reset,
        toggleMode,
        toggleRelativeMode,
        changeCameraFromTo,
        changeDesktopMainFov,
        toggleDesktopMainFovAuto,
        togglePlane,
        setView,
        setDimensionTop,
        toggleAnimation,
        // Legacy compatibility while callers migrate.
        cy3Animate,
        toggleJoyRide,
        toggleLanding,
        toggleInfo,
        setMoonRenderProfile,
        getMoonRenderProfile,
    } = handlers;
    const controlBackend = createSharedControlBackend({
        toggleMode,
        toggleRelativeMode,
        changeCameraFromTo,
        togglePlane,
        setView,
        setDimensionTop,
        toggleLanding,
    });
    const cameraPillController = createCameraPillController({ controlBackend });
    bindHeaderBlurbBehavior();
    cameraPillController.bind();
    getHeaderPillStripController().bind();
    bindDesktopChromeAutohideBehavior();
    const bodyHaloToggle = typeof document !== "undefined"
        ? document.getElementById("view-body-halos")
        : null;
    const auxiliaryPanelsToggle = typeof document !== "undefined"
        ? document.getElementById("view-aux-camera-panels")
        : null;
    const locatorsPill = typeof document !== "undefined"
        ? document.getElementById("locators-pill")
        : null;
    const flybyPill = typeof document !== "undefined"
        ? document.getElementById("flyby-pill")
        : null;
    const splashdownFocusPill = typeof document !== "undefined"
        ? document.getElementById("focus-pill-splashdown")
        : null;
    const flybyPillWrap = typeof document !== "undefined"
        ? document.getElementById("flyby-pill-wrap")
        : null;
    const descentOrbitOption = typeof document !== "undefined"
        ? document.getElementById("orbit-descent-option")
        : null;
    const landingToggle = typeof document !== "undefined"
        ? document.getElementById("landing")
        : null;
    const moonSitesToggle = typeof document !== "undefined"
        ? document.getElementById("view-craters")
        : null;
    const secondaryOrbitLabel = typeof document !== "undefined"
        ? document.getElementById("label-secondary-body-orbit")
        : null;
    const orbitLabel = typeof document !== "undefined"
        ? document.getElementById("label-orbit")
        : null;
    const orbitPill = typeof document !== "undefined"
        ? document.getElementById("toggle-pill-orbit")
        : null;
    const secondaryOrbitPill = typeof document !== "undefined"
        ? document.getElementById("toggle-pill-moon-orbit")
        : null;
    const landingPill = typeof document !== "undefined"
        ? document.getElementById("toggle-pill-landing")
        : null;
    const landingOptionRow = landingToggle?.closest?.(".settings-option")
        || landingToggle?.closest?.("label")
        || null;
    const originPillPairs = [
        ["origin-pill-earth", "origin-earth", "geo"],
        ["origin-pill-moon", "origin-moon", "lunar"],
        ["origin-pill-relative", "origin-relative", "relative"],
    ];
    const planePillPairs = [
        ["plane-pill-default", "checkbox-lock-default", "DEFAULT"],
        ["plane-pill-xy", "checkbox-lock-xy", "XY"],
        ["plane-pill-yz", "checkbox-lock-yz", "YZ"],
        ["plane-pill-zx", "checkbox-lock-zx", "ZX"],
        ["plane-pill-xy-minus", "checkbox-lock-xy-minus", "XY-"],
        ["plane-pill-yz-minus", "checkbox-lock-yz-minus", "YZ-"],
        ["plane-pill-zx-minus", "checkbox-lock-zx-minus", "ZX-"],
    ];
    let planePresetReleasedByNavigation = false;
    const dimensionPillPairs = [
        ["dimension-pill-2d", "dimension-2D", "2D"],
        ["dimension-pill-3d", "dimension-3D", "3D"],
    ];
    const moonProfilePillPairs = [
        ["moon-profile-pill-fast", "fast"],
        ["moon-profile-pill-quality", "quality"],
    ];
    const togglePillPairs = [
        ["toggle-pill-orbit", "view-orbit", "viewOrbit"],
        ["toggle-pill-descent", "view-orbit-descent", "viewOrbitDescent"],
        ["toggle-pill-sky", "view-sky", "viewSky"],
        ["toggle-pill-craters", "view-craters", "viewCraters"],
        ["toggle-pill-xyz", "view-xyz-axes", "viewXYZAxes"],
        ["toggle-pill-poles", "view-poles", "viewPoles"],
        ["toggle-pill-polar-axes", "view-polar-axes", "viewPolarAxes"],
        ["toggle-pill-constellations", "view-constellation-lines", "viewConstellationLines"],
        ["toggle-pill-moon-soi", "view-moonsoi", "viewMoonSOI"],
        ["toggle-pill-moon-hill-sphere", "view-moon-hill-sphere", "viewMoonHillSphere"],
        ["toggle-pill-moon-orbit", "view-moon-osculating-orbit", "viewMoonOsculatingOrbit"],
        ["toggle-pill-ecliptic", "view-eclipticplane", "viewEclipticPlane"],
        ["toggle-pill-equatorial", "view-equatorialplane", "viewEquatorialPlane"],
    ];

    const syncLocatorsPillState = () => {
        if (!locatorsPill || !bodyHaloToggle) return;
        locatorsPill.setAttribute("aria-pressed", bodyHaloToggle.checked ? "true" : "false");
    };
    const syncPlanePillState = () => {
        planePillPairs.forEach(([pillId, inputId]) => {
            const pill = document.getElementById(pillId);
            const input = document.getElementById(inputId);
            if (!pill || !input) return;
            const isActive = !planePresetReleasedByNavigation && input.checked === true;
            pill.classList.toggle("is-active", isActive);
            pill.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    };
    const syncOriginPillState = () => {
        originPillPairs.forEach(([pillId, inputId]) => {
            const pill = document.getElementById(pillId);
            const input = document.getElementById(inputId);
            if (!pill || !input) return;
            const isActive = input.checked === true;
            pill.classList.toggle("is-active", isActive);
            pill.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    };
    const syncDimensionPillState = () => {
        dimensionPillPairs.forEach(([pillId, inputId]) => {
            const pill = document.getElementById(pillId);
            const input = document.getElementById(inputId);
            if (!pill || !input) return;
            const isActive = input.checked === true;
            pill.classList.toggle("is-active", isActive);
            pill.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    };
    const syncMoonRenderProfilePillState = () => {
        const activeProfile = typeof getMoonRenderProfile === "function"
            ? getMoonRenderProfile()
            : resolveMoonRenderAssetProfile();
        moonProfilePillPairs.forEach(([pillId, profile]) => {
            const pill = document.getElementById(pillId);
            if (!pill) return;
            const isActive = activeProfile === profile;
            pill.classList.toggle("is-active", isActive);
            pill.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    };
    const isArtemis2Mission = () => {
        if (typeof window === "undefined") return false;
        try {
            const params = new URLSearchParams(window.location.search || "");
            const mission = String(params.get("mission") || "").trim().toLowerCase();
            return mission === "artemis2";
        } catch {
            return false;
        }
    };
    const resolveTimelineEventButtonByKeys = (keys) => {
        if (!Array.isArray(keys) || keys.length === 0) return null;
        const normalizedKeys = keys
            .map((key) => String(key || "").trim())
            .filter(Boolean);
        if (normalizedKeys.length === 0) return null;
        const buttons = document.querySelectorAll("#burnbuttons button[data-event-key]");
        for (const button of buttons) {
            const key = String(button?.dataset?.eventKey || "").trim();
            if (normalizedKeys.includes(key)) {
                return button;
            }
        }
        return null;
    };
    const syncFocusPillVisibility = () => {
        if (!flybyPillWrap) return;
        const flybyVisible = isArtemis2Mission();
        const splashdownVisible = isArtemis2Mission() && !!resolveTimelineEventButtonByKeys(["splashdown"]);
        if (flybyPill) {
            flybyPill.hidden = !flybyVisible;
        }
        if (splashdownFocusPill) {
            splashdownFocusPill.hidden = !splashdownVisible;
        }
        const visible = flybyVisible || splashdownVisible;
        const flybyGroup = flybyPillWrap.closest(".header-pill-group");
        if (flybyGroup) {
            flybyGroup.hidden = !visible;
        } else {
            flybyPillWrap.hidden = !visible;
        }
        requestAnimationFrame(() => {
            const tertiaryRow = document.getElementById("header-pill-strip-tertiary");
            if (!tertiaryRow) return;
            tertiaryRow.scrollLeft = 0;
        });
    };
    const syncFlybyPillState = (isActive = false) => {
        if (!flybyPill) return;
        flybyPill.classList.toggle("is-active", !!isActive);
        flybyPill.setAttribute("aria-pressed", isActive ? "true" : "false");
    };
    const syncSplashdownFocusPillState = (isActive = false) => {
        if (!splashdownFocusPill) return;
        splashdownFocusPill.classList.toggle("is-active", !!isActive);
        splashdownFocusPill.setAttribute("aria-pressed", isActive ? "true" : "false");
    };
    const syncFocusPillState = () => {
        const composerPanelVisible = !!document.querySelector(
            "#aux-camera-views .aux-camera-view[data-mode=\"composer\"]:not([hidden])",
        );
        const groundTrackPanelVisible = !!document.querySelector(
            "#ground-track-panel:not(.ground-track-panel--hidden)",
        );
        syncFlybyPillState(composerPanelVisible);
        syncSplashdownFocusPillState(groundTrackPanelVisible);
    };
    const releasePlanePresetFromManualNavigation = () => {
        const activePlaneInput = planePillPairs
            .map(([, inputId]) => document.getElementById(inputId))
            .find((input) => input?.checked);
        if (!activePlaneInput) return;
        if (activePlaneInput.id === "checkbox-lock-default") return;
        planePresetReleasedByNavigation = true;
        syncPlanePillState();
    };
    const bindPlanePresetReleaseOnSceneDrag = () => {
        const canvasWrapper = document.getElementById("canvas-wrapper");
        if (!canvasWrapper) return;

        let activePointerId = null;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragReleased = false;
        const DRAG_RELEASE_THRESHOLD_PX = 4;
        const DRAG_RELEASE_THRESHOLD_SQUARED = DRAG_RELEASE_THRESHOLD_PX * DRAG_RELEASE_THRESHOLD_PX;

        const resetDragState = (pointerId = null) => {
            if (pointerId !== null && activePointerId !== pointerId) return;
            activePointerId = null;
            dragStartX = 0;
            dragStartY = 0;
            dragReleased = false;
        };

        canvasWrapper.addEventListener("pointerdown", function (event) {
            if (event.isPrimary === false) return;
            activePointerId = event.pointerId;
            dragStartX = Number.isFinite(event.clientX) ? event.clientX : 0;
            dragStartY = Number.isFinite(event.clientY) ? event.clientY : 0;
            dragReleased = false;
        }, true);

        window.addEventListener("pointermove", function (event) {
            if (activePointerId === null || event.pointerId !== activePointerId || dragReleased) return;
            const deltaX = (Number.isFinite(event.clientX) ? event.clientX : 0) - dragStartX;
            const deltaY = (Number.isFinite(event.clientY) ? event.clientY : 0) - dragStartY;
            if ((deltaX * deltaX) + (deltaY * deltaY) < DRAG_RELEASE_THRESHOLD_SQUARED) return;
            dragReleased = true;
            releasePlanePresetFromManualNavigation();
        }, { passive: true });

        window.addEventListener("pointerup", function (event) {
            resetDragState(event.pointerId);
        }, { passive: true });

        window.addEventListener("pointercancel", function (event) {
            resetDragState(event.pointerId);
        }, { passive: true });
    };
    const syncTogglePillState = () => {
        togglePillPairs.forEach(([pillId, inputId]) => {
            const pill = document.getElementById(pillId);
            const input = document.getElementById(inputId);
            if (!pill || !input) return;
            const isActive = input.checked === true;
            pill.classList.toggle("is-active", isActive);
            pill.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    };
    const syncTogglePillVisibility = () => {
        const isElementVisible = (element) => {
            if (!element) return false;
            if (element.classList?.contains("settings-option--hidden")) return false;
            const style = window.getComputedStyle?.(element);
            return style ? style.display !== "none" && style.visibility !== "hidden" : true;
        };
        const isRelativeOrigin = !!document.getElementById("origin-relative")?.checked;
        const hasLanding = !!landingToggle
            && !landingToggle.disabled
            && isElementVisible(landingOptionRow);

        if (landingPill) {
            landingPill.hidden = !hasLanding;
            landingPill.disabled = !hasLanding;
            landingPill.setAttribute("aria-disabled", hasLanding ? "false" : "true");
            if (!hasLanding) {
                landingPill.classList.remove("is-active");
                landingPill.setAttribute("aria-pressed", "false");
            }
        }

        const descentPill = document.getElementById("toggle-pill-descent");
        if (descentPill) {
            const hasDescentOrbit = !!descentOrbitOption
                && !descentOrbitOption.classList.contains("settings-option--hidden");
            descentPill.hidden = !hasDescentOrbit;
        }
        const secondaryOrbitToggle = document.getElementById("view-moon-osculating-orbit");
        const secondaryOrbitOption = secondaryOrbitToggle?.closest?.(".settings-option") || null;
        if (secondaryOrbitToggle) {
            secondaryOrbitToggle.disabled = isRelativeOrigin;
            if (isRelativeOrigin) {
                secondaryOrbitToggle.checked = false;
            }
        }
        if (secondaryOrbitOption) {
            secondaryOrbitOption.classList.toggle("settings-option--hidden", isRelativeOrigin);
        }
        if (secondaryOrbitPill) {
            secondaryOrbitPill.hidden = isRelativeOrigin;
            secondaryOrbitPill.disabled = isRelativeOrigin;
            secondaryOrbitPill.setAttribute("aria-disabled", isRelativeOrigin ? "true" : "false");
            if (isRelativeOrigin) {
                secondaryOrbitPill.classList.remove("is-active");
                secondaryOrbitPill.setAttribute("aria-pressed", "false");
            }
        }
        const moonSitesPill = document.getElementById("toggle-pill-craters");
        if (moonSitesPill) {
            if (moonSitesToggle) {
                moonSitesToggle.disabled = !hasLanding;
                if (!hasLanding) {
                    moonSitesToggle.checked = false;
                }
            }
            moonSitesPill.disabled = !hasLanding;
            moonSitesPill.setAttribute("aria-disabled", hasLanding ? "false" : "true");
            if (!hasLanding) {
                moonSitesPill.classList.remove("is-active");
                moonSitesPill.setAttribute("aria-pressed", "false");
                moonSitesPill.title = "Moon Sites available for landing missions";
            } else {
                moonSitesPill.title = "Toggle Moon Sites";
            }
        }
    };
    const syncLandingPillState = () => {
        if (!landingPill || !landingToggle) return;
        const isActive = landingToggle.checked === true;
        landingPill.classList.toggle("is-active", isActive);
        landingPill.setAttribute("aria-pressed", isActive ? "true" : "false");
    };
    let landingPillSyncScheduled = false;
    const scheduleLandingPillSync = () => {
        if (landingPillSyncScheduled) return;
        landingPillSyncScheduled = true;
        requestAnimationFrame(() => {
            landingPillSyncScheduled = false;
            syncTogglePillVisibility();
            syncLandingPillState();
        });
    };
    const bindLandingPillVisibilityObserver = () => {
        if (!landingToggle || typeof MutationObserver === "undefined") return;
        const observerTargets = [
            landingOptionRow,
            landingToggle,
            document.getElementById("landingbutton"),
        ].filter(Boolean);
        if (!observerTargets.length) return;
        const observer = new MutationObserver(() => {
            scheduleLandingPillSync();
        });
        observerTargets.forEach((target) => {
            observer.observe(target, {
                attributes: true,
                attributeFilter: ["class", "style", "hidden", "disabled", "aria-hidden"],
            });
        });
    };
    const syncOrbitLabels = () => {
        const originMode = document.getElementById("origin-relative")?.checked
            ? "relative"
            : document.getElementById("origin-moon")?.checked
                ? "lunar"
                : "geo";
        const craftOrbitCopy = resolveCraftOrbitCopy();
        const bodyOrbitCopy = resolveBodyOrbitCopy(originMode);
        if (orbitLabel) {
            orbitLabel.title = craftOrbitCopy.title;
        }
        if (orbitPill) {
            orbitPill.textContent = craftOrbitCopy.label;
            orbitPill.title = craftOrbitCopy.title;
        }
        if (secondaryOrbitLabel) {
            secondaryOrbitLabel.textContent = bodyOrbitCopy.label;
            secondaryOrbitLabel.title = bodyOrbitCopy.title;
        }
        if (secondaryOrbitPill) {
            secondaryOrbitPill.textContent = bodyOrbitCopy.label;
            secondaryOrbitPill.title = bodyOrbitCopy.title;
        }
    };
    const isMobileViewsOrComposeTab = () => {
        if (typeof window === "undefined" || window.innerWidth > 600) return false;
        const activeTab = document.body?.dataset?.mobileActiveTab || "";
        return activeTab === "views" || activeTab === "compose";
    };
    const enforceMobileLocatorTabPolicy = () => {
        if (!bodyHaloToggle) return;
        // Mobile Views/Compose never show locators.
        if (isMobileViewsOrComposeTab()) {
            bodyHaloToggle.checked = false;
        }
    };
    const commitOriginMode = (originMode) => {
        controlBackend.commitOriginMode(originMode);
        syncOriginPillState();
        syncOrbitLabels();
        syncTogglePillVisibility();
    };
    const commitPlaneSelection = (planeSelection) => {
        planePresetReleasedByNavigation = false;
        controlBackend.commitPlaneSelection(planeSelection);
        syncPlanePillState();
    };
    const commitDimensionSelection = (dimension) => {
        controlBackend.commitDimensionSelection(dimension);
        syncDimensionPillState();
    };
    const commitSharedViewSetting = (settingKey, value, options = {}) => {
        controlBackend.commitViewSetting(settingKey, value, options);
        syncTogglePillVisibility();
        syncTogglePillState();
        syncLocatorsPillState();
    };
    const commitBodyHaloSetting = (value, options = {}) => {
        enforceMobileLocatorTabPolicy();
        const nextValue = isMobileViewsOrComposeTab() ? false : !!value;
        commitSharedViewSetting("viewBodyHalos", nextValue, options);
    };
    const toggleLandingMode = (options = {}) => {
        controlBackend.toggleLandingMode(options);
        syncTogglePillVisibility();
        syncLandingPillState();
    };

    onClick("reset", reset);

    originPillPairs.forEach(([, inputId, originMode]) => {
        onClick(inputId, function () {
            commitOriginMode(originMode);
        });
    });
    onInput("desktop-main-fov-slider", changeDesktopMainFov);
    onClick("desktop-main-fov-auto", toggleDesktopMainFovAuto);

    planePillPairs.forEach(([, inputId, planeSelection]) => {
        onClick(inputId, function () {
            commitPlaneSelection(planeSelection);
        });
    });

    togglePillPairs.forEach(([, inputId, settingKey]) => {
        onClick(inputId, function (event) {
            commitSharedViewSetting(settingKey, !!event?.target?.checked, {
                sourceId: inputId,
            });
        });
    });
    onClick("view-additional-crafts", setView);
    onClick("view-aux-camera-panels", setView);
    onChange("active-craft-select", setView);
    onClick("view-body-halos", function (event) {
        commitBodyHaloSetting(!!event?.target?.checked, {
            sourceId: "view-body-halos",
        });
    });
    onClick("view-fps", setView);
    onChange("orbit-style-classic", setView);
    onChange("orbit-style-trail", setView);
    onInput("trail-track-brightness-2d", setView);
    onInput("trail-track-brightness-3d", setView);
    onInput("trail-tail-brightness-2d", setView);
    onInput("trail-tail-brightness-3d", setView);

    dimensionPillPairs.forEach(([, inputId, dimension]) => {
        onClick(inputId, function () {
            commitDimensionSelection(dimension);
        });
    });

    const animateHandler = typeof toggleAnimation === "function" ? toggleAnimation : cy3Animate;
    if (typeof animateHandler === "function") {
        onClick("animate", animateHandler);
    }
    onClick("joyride", toggleJoyRide);
    onClick("joyridebutton", toggleJoyRide);
    onClick("flyby-pill", function () {
        if (
            auxiliaryPanelsToggle instanceof HTMLInputElement &&
            !auxiliaryPanelsToggle.checked &&
            !auxiliaryPanelsToggle.disabled
        ) {
            auxiliaryPanelsToggle.checked = true;
            setView();
        }
        const restored = invokeMissionPanelAction("aux:earth-rise-composer", "restore");
        if (!restored) {
            // Legacy fallback while the remaining aux panel code migrates to panel-registry actions.
            const composerChip = document.querySelector(
                "#aux-camera-views .aux-camera-chip--composer-tab",
            ) || Array.from(
                document.querySelectorAll("#aux-camera-views .aux-camera-chip"),
            ).find((button) =>
                button instanceof HTMLButtonElement &&
                /^flyby\b/i.test((button.textContent || "").trim()),
            );
            if (composerChip instanceof HTMLButtonElement && !composerChip.hidden) {
                composerChip.click();
            }
        }
        requestAnimationFrame(() => syncFocusPillState());
    });
    onClick("focus-pill-splashdown", function () {
        if (!isArtemis2Mission()) return;
        document.dispatchEvent(new CustomEvent("ground-track-panel-open"));
        syncFocusPillState();
    });
    onClick("landing", function () {
        toggleLandingMode({ sourceId: "landing" });
    });
    onClick("landingbutton", toggleLanding);
    onClick("toggle-pill-landing", function () {
        if (!landingToggle || landingToggle.disabled) return;
        toggleLandingMode({ sourceId: "toggle-pill-landing" });
    });

    onClick("info-button", toggleInfo);
    onClick("locators-pill", function () {
        if (!bodyHaloToggle) return;
        commitBodyHaloSetting(!bodyHaloToggle.checked, {
            sourceId: "locators-pill",
        });
    });
    togglePillPairs.forEach(([pillId, inputId, settingKey]) => {
        const pill = document.getElementById(pillId);
        const input = document.getElementById(inputId);
        if (!pill || !input) return;
        pill.addEventListener("click", function () {
            if (pill.disabled || pill.getAttribute("aria-disabled") === "true") return;
            commitSharedViewSetting(settingKey, !input.checked, {
                sourceId: pillId,
            });
        });
        input.addEventListener("change", function () {
            syncTogglePillVisibility();
            syncTogglePillState();
            syncLocatorsPillState();
        });
    });
    originPillPairs.forEach(([pillId, inputId, originMode]) => {
        const pill = document.getElementById(pillId);
        const input = document.getElementById(inputId);
        if (!pill || !input) return;
        pill.addEventListener("click", function () {
            commitOriginMode(originMode);
        });
        input.addEventListener("change", function () {
            syncOriginPillState();
            syncOrbitLabels();
            syncTogglePillVisibility();
        });
    });
    dimensionPillPairs.forEach(([pillId, inputId, dimension]) => {
        const pill = document.getElementById(pillId);
        const input = document.getElementById(inputId);
        if (!pill || !input) return;
        pill.addEventListener("click", function () {
            commitDimensionSelection(dimension);
        });
        input.addEventListener("change", syncDimensionPillState);
    });
    moonProfilePillPairs.forEach(([pillId, profile]) => {
        const pill = document.getElementById(pillId);
        if (!pill) return;
        pill.addEventListener("click", function () {
            const currentProfile = typeof getMoonRenderProfile === "function"
                ? getMoonRenderProfile()
                : resolveMoonRenderAssetProfile();
            if (currentProfile === profile) {
                syncMoonRenderProfilePillState();
                return;
            }
            pill.disabled = true;
            Promise.resolve(
                typeof setMoonRenderProfile === "function"
                    ? setMoonRenderProfile(profile)
                    : profile,
            ).catch((error) => {
                console.error("Failed to switch Moon render profile:", error);
            }).finally(() => {
                pill.disabled = false;
                syncMoonRenderProfilePillState();
            });
        });
    });
    if (landingToggle) {
        landingToggle.addEventListener("change", function () {
            syncTogglePillVisibility();
            syncLandingPillState();
        });
    }
    bindLandingPillVisibilityObserver();
    planePillPairs.forEach(([pillId, inputId, planeSelection]) => {
        const pill = document.getElementById(pillId);
        const input = document.getElementById(inputId);
        if (pill && input) {
            pill.addEventListener("click", function () {
                commitPlaneSelection(planeSelection);
            });
            input.addEventListener("change", function () {
                planePresetReleasedByNavigation = false;
                syncPlanePillState();
            });
        }
    });
    ["panleft", "panright", "panup", "pandown"].forEach((id) => {
        const button = document.getElementById(id);
        button?.addEventListener("click", releasePlanePresetFromManualNavigation);
    });
    bindPlanePresetReleaseOnSceneDrag();
    syncFocusPillVisibility();
    syncFocusPillState();
    syncOriginPillState();
    syncLocatorsPillState();
    syncOrbitLabels();
    syncTogglePillVisibility();
    syncTogglePillState();
    syncLandingPillState();
    syncDimensionPillState();
    syncMoonRenderProfilePillState();
    syncPlanePillState();
    getHeaderPillStripController().syncUi();
    const burnButtonsHost = document.getElementById("burnbuttons");
    if (burnButtonsHost && typeof MutationObserver !== "undefined") {
        const focusPillObserver = new MutationObserver(() => {
            syncFocusPillVisibility();
            syncFocusPillState();
        });
        focusPillObserver.observe(burnButtonsHost, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "data-event-key", "data-event-time-ms", "title"],
        });
    }
    document.addEventListener("ground-track-panel-visibilitychange", syncFocusPillState);
}

export function bindKeyboardShortcuts() {
    getKeyboardShortcutsController().bind();
}

export function bindControlPanelToggle() {
    const panel = document.getElementById("control-panel");
    const timelineDock = document.getElementById("timeline-dock");
    const button = document.getElementById("control-panel-toggle");
    if (!panel || !timelineDock || !button) return;
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    bindTimelineCarouselDragGesture();
    bindTimelineDockHeightSync(timelineDock);
    setControlPanelCollapsedState(false);
    setTimelineEventCarouselExpandedState(true, { focusUpcoming: true, wiggleCue: false });
    requestAnimationFrame(() => {
        syncControlPanelInfoOffset(panel);
        syncTimelineDockHeight(timelineDock);
    });
    button.addEventListener("click", function () {
        const shouldExpand = timelineDock.classList.contains("timeline-dock--events-collapsed");
        setTimelineEventCarouselExpandedState(shouldExpand);
    });

    if (!controlPanelResizeBound) {
        controlPanelResizeBound = true;
        window.addEventListener("resize", function () {
            syncControlPanelInfoOffset();
            syncTimelineDockHeight();
        });
    }
}

export function bindMobileMissionCard() {
    bindMobileMissionCardSync({
        dispatchSyntheticPress,
        isMobileViewport,
        resetSettingsPanelForMobileMode: () => getSettingsPanelController().resetForMobileMode(),
    });
}
