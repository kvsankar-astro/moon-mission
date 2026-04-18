import { invokeMissionPanelAction } from "../app/panel-registry.js";
import {
    resolveBodyOrbitCopy,
    resolveCraftOrbitCopy,
} from "./orbit-control-labels.js";
import { bindMobileMissionCardSync } from "./mobile-mission-card-sync.js";
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

function onChangeAll(selector, handler) {
    const elements = document.querySelectorAll(selector);
    if (!elements.length) return;
    elements.forEach((element) => element.addEventListener("change", handler));
}

function onInput(id, handler) {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener("input", handler);
}

function getMissionDialogApi() {
    return window.MissionDialog || window.CY3Dialog || null;
}

let keyboardShortcutsBound = false;
let headerBlurbBehaviorBound = false;
let shortcutPanelGlobalBound = false;
let controlPanelResizeBound = false;
let timelineDockHeightSyncBound = false;
let timelineCarouselDragBound = false;
let desktopChromeAutohideBound = false;
let timelineDockResizeObserver = null;
let timelineDockMutationObserver = null;
let timelineCarouselWiggleTimeoutId = null;
let headerPillStripManualCollapsed = false;
let headerPillStripAutoCollapsed = false;
let headerPillStripLastAutoRevealAt = 0;
const TIMELINE_CAROUSEL_WIGGLE_CLASS = "timeline-dock__event-carousel--wiggle";
const HEADER_BLURB_AUTO_COLLAPSE_DELAY_MS = 10000;
const DESKTOP_CHROME_AUTO_HIDE_DELAY_MS = 10000;
const HEADER_PILL_AUTO_REVEAL_CLICK_GRACE_MS = 700;
const MISSION_INTERACTIVE_REGION_SELECTOR = [
    "#header-pill-strip",
    "#settings-panel-button",
    "#advanced-controls-pill",
    "#settings-panel",
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
const REPEAT_PRESS_BUTTON_IDS = new Set([
    "zoomin",
    "zoomout",
    "panleft",
    "panright",
    "panup",
    "pandown",
    "forward",
    "fastforward",
    "backward",
    "fastbackward",
    "slower",
    "resetspeed",
    "faster",
    "realtime",
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

function clickControlButton(id) {
    const button = document.getElementById(id);
    if (!button || button.disabled) return false;
    if (REPEAT_PRESS_BUTTON_IDS.has(id)) {
        return dispatchSyntheticPress(button, "mouse");
    }
    button.click();
    return true;
}

function toggleShortcutPanel(forceVisible) {
    const panel = document.getElementById("shortcut-panel");
    const toggleButton = document.getElementById("shortcut-help");
    if (!panel) return;
    const shouldShow = typeof forceVisible === "boolean"
        ? forceVisible
        : panel.classList.contains("shortcut-panel--hidden");
    if (shouldShow) {
        positionShortcutPanel(panel, toggleButton);
        panel.classList.remove("shortcut-panel--hidden");
        return;
    }
    panel.classList.add("shortcut-panel--hidden");
}

function positionShortcutPanel(panel, toggleButton) {
    if (!panel || !toggleButton) return;

    const wasHidden = panel.classList.contains("shortcut-panel--hidden");
    if (wasHidden) {
        panel.classList.remove("shortcut-panel--hidden");
        panel.style.visibility = "hidden";
    }

    panel.style.position = "fixed";
    panel.style.left = "0px";
    panel.style.top = "0px";

    const buttonRect = toggleButton.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const marginPx = 8;

    const unclampedLeft = buttonRect.right - panelRect.width;
    const maxLeft = Math.max(marginPx, window.innerWidth - panelRect.width - marginPx);
    const left = Math.min(Math.max(unclampedLeft, marginPx), maxLeft);

    let top = buttonRect.top - panelRect.height - marginPx;
    if (top < marginPx) {
        const maxTop = Math.max(marginPx, window.innerHeight - panelRect.height - marginPx);
        top = Math.min(buttonRect.bottom + marginPx, maxTop);
    }

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;

    if (wasHidden) {
        panel.classList.add("shortcut-panel--hidden");
        panel.style.visibility = "";
    }
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

function isSettingsPanelOpen() {
    return getSettingsPanelController().isSettingsPanelOpen();
}

function resetHeaderPillStripScrollPosition() {
    const primaryRow = document.getElementById("header-pill-strip-primary");
    const secondaryRow = document.getElementById("header-pill-strip-secondary");
    const tertiaryRow = document.getElementById("header-pill-strip-tertiary");
    if (primaryRow) primaryRow.scrollLeft = 0;
    if (secondaryRow) secondaryRow.scrollLeft = 0;
    if (tertiaryRow) tertiaryRow.scrollLeft = 0;
}

function isHeaderPillStripEffectivelyCollapsed() {
    return headerPillStripManualCollapsed || headerPillStripAutoCollapsed;
}

function syncHeaderPillStripCollapseUi() {
    const strip = document.getElementById("header-pill-strip");
    const toggle = document.getElementById("header-pill-strip-toggle");
    if (!strip || !toggle) return;
    const collapsed = isHeaderPillStripEffectivelyCollapsed();
    strip.classList.toggle("header-pill-strip--collapsed", collapsed);
    toggle.textContent = collapsed ? "›" : "‹";
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggle.setAttribute(
        "aria-label",
        collapsed ? "Expand mission controls" : "Collapse mission controls",
    );
    toggle.setAttribute(
        "title",
        collapsed ? "Expand mission controls" : "Collapse mission controls",
    );
    if (!collapsed) {
        resetHeaderPillStripScrollPosition();
    }
}

function setHeaderPillStripManualCollapsedState(collapsed) {
    const nextCollapsed = !!collapsed;
    if (headerPillStripManualCollapsed === nextCollapsed) return;
    headerPillStripManualCollapsed = nextCollapsed;
    syncHeaderPillStripCollapseUi();
}

function setHeaderPillStripAutoCollapsedState(collapsed) {
    const nextCollapsed = !!collapsed;
    if (headerPillStripAutoCollapsed === nextCollapsed) return;
    if (headerPillStripAutoCollapsed && !nextCollapsed) {
        headerPillStripLastAutoRevealAt = Date.now();
    }
    if (nextCollapsed) {
        headerPillStripLastAutoRevealAt = 0;
    }
    headerPillStripAutoCollapsed = nextCollapsed;
    syncHeaderPillStripCollapseUi();
}

function bindHeaderBlurbBehavior() {
    if (headerBlurbBehaviorBound) return;
    headerBlurbBehaviorBound = true;

    const blurb = document.getElementById("blurb");
    const toggle = document.getElementById("blurb-toggle");
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
        window.clearTimeout(autoCollapseTimerId);
        autoCollapseTimerId = null;
    };

    const canAutoCollapse = () => autoCollapseEnabled && !manualPreference && !compact && !isMobileViewport();

    const setCompact = (nextCompact, { manual = false } = {}) => {
        compact = !!nextCompact;
        if (manual) {
            manualPreference = true;
        }
        syncUi();
        if (canAutoCollapse()) {
            clearAutoCollapseTimer();
            autoCollapseTimerId = window.setTimeout(() => {
                if (!canAutoCollapse()) return;
                compact = true;
                syncUi();
                clearAutoCollapseTimer();
            }, HEADER_BLURB_AUTO_COLLAPSE_DELAY_MS);
            return;
        }
        clearAutoCollapseTimer();
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
        if (!(target instanceof Element)) return false;
        if (target.closest("#blurb")) return false;
        if (target.closest(MISSION_INTERACTIVE_REGION_SELECTOR)) return true;
        return !!target.closest(
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

    document.addEventListener("pointerdown", (event) => {
        collapseFromInteraction(event.target);
    }, true);

    document.addEventListener("input", (event) => {
        collapseFromInteraction(event.target);
    }, true);

    document.addEventListener("wheel", (event) => {
        collapseFromInteraction(event.target);
    }, { passive: true, capture: true });

    document.addEventListener("keydown", (event) => {
        if (!canAutoCollapse()) return;
        if (isInteractiveInputTarget(event.target)) return;
        if (!MEANINGFUL_ACTIVITY_KEYS.has(event.key)) return;
        collapseFromInteraction(document.getElementById("control-panel") || document.body);
    }, true);

    window.addEventListener("resize", () => {
        syncUi();
        if (canAutoCollapse()) {
            clearAutoCollapseTimer();
            autoCollapseTimerId = window.setTimeout(() => {
                if (!canAutoCollapse()) return;
                compact = true;
                syncUi();
                clearAutoCollapseTimer();
            }, HEADER_BLURB_AUTO_COLLAPSE_DELAY_MS);
            return;
        }
        clearAutoCollapseTimer();
    }, { passive: true });

    document.addEventListener("mission-ui-config-updated", (event) => {
        const configEvent = /** @type {CustomEvent | null} */ (event);
        const enabled = configEvent?.detail?.ui?.headerBlurbAutoCollapseEnabled;
        applyAutoCollapsePreference(enabled);
    });

    syncUi();
    if (canAutoCollapse()) {
        autoCollapseTimerId = window.setTimeout(() => {
            if (!canAutoCollapse()) return;
            compact = true;
            syncUi();
            clearAutoCollapseTimer();
        }, HEADER_BLURB_AUTO_COLLAPSE_DELAY_MS);
    }
}

function bindDesktopChromeAutohideBehavior() {
    if (desktopChromeAutohideBound) return;
    desktopChromeAutohideBound = true;

    let autoHideEnabled = true;
    let animationPlaying = false;
    let autoHideTimerId = null;

    const hoverSelectors = [
        "#header-pill-strip",
        "#control-panel",
        "#timeline-dock",
        "#zoom-panel",
        "#info-panel",
        "#shortcut-panel",
        ".aux-camera-view",
        "#ground-track-panel",
        ".panel-manager-menu.is-open",
    ];

    const clearAutoHideTimer = () => {
        if (autoHideTimerId === null) return;
        window.clearTimeout(autoHideTimerId);
        autoHideTimerId = null;
    };

    const isDesktopViewportActive = () => !isMobileViewport() &&
        !document.body?.classList.contains("mobile-shell-enabled") &&
        document.visibilityState !== "hidden";

    const isAnySelectorHovered = (selector) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).some((element) => {
            if (!(element instanceof Element)) return false;
            if (!isElementLayoutVisible(element)) return false;
            if (typeof element.matches === "function" && element.matches(":hover")) return true;
            return !!element.querySelector?.(":hover");
        });
    };

    const isSettingsPanelHovered = () => {
        const dialogApi = getMissionDialogApi();
        const wrapper = dialogApi?.widgetElement?.("#settings-panel");
        if (wrapper && isElementLayoutVisible(wrapper)) {
            if (wrapper.matches(":hover")) return true;
            return !!wrapper.querySelector?.(":hover");
        }
        const panel = document.getElementById("settings-panel");
        if (!isElementLayoutVisible(panel)) return false;
        if (panel.matches(":hover")) return true;
        return !!panel.querySelector?.(":hover");
    };

    const hasInteractiveFocus = () => {
        const active = document.activeElement;
        if (!(active instanceof Element)) return false;
        if (isInteractiveInputTarget(active)) return true;
        if (active.matches?.('[role="slider"]')) return true;
        return !!active.closest("#settings-panel, #info-panel, #shortcut-panel, .panel-manager-menu");
    };

    const hasBlockingUiOpen = () => {
        if (isSettingsPanelOpen()) return true;
        const infoPanel = document.getElementById("info-panel");
        if (infoPanel && !infoPanel.classList.contains("info-panel--hidden") && isElementLayoutVisible(infoPanel)) {
            return true;
        }
        const shortcutPanel = document.getElementById("shortcut-panel");
        if (
            shortcutPanel &&
            !shortcutPanel.classList.contains("shortcut-panel--hidden") &&
            isElementLayoutVisible(shortcutPanel)
        ) {
            return true;
        }
        const panelMenu = document.querySelector(".panel-manager-menu.is-open");
        if (panelMenu && isElementLayoutVisible(panelMenu)) {
            return true;
        }
        return false;
    };

    const isChromeHovered = () => isSettingsPanelHovered() || hoverSelectors.some(isAnySelectorHovered);

    const canAutoHideChrome = () => autoHideEnabled &&
        animationPlaying &&
        isDesktopViewportActive() &&
        !hasBlockingUiOpen() &&
        !hasInteractiveFocus() &&
        !isChromeHovered();

    const revealChrome = () => {
        setHeaderPillStripAutoCollapsedState(false);
        setControlPanelCollapsedState(false);
    };

    const scheduleAutoHide = () => {
        clearAutoHideTimer();
        if (!canAutoHideChrome()) return;
        autoHideTimerId = window.setTimeout(() => {
            if (!canAutoHideChrome()) {
                revealChrome();
                clearAutoHideTimer();
                return;
            }
            setHeaderPillStripAutoCollapsedState(true);
            setControlPanelCollapsedState(true);
            clearAutoHideTimer();
        }, DESKTOP_CHROME_AUTO_HIDE_DELAY_MS);
    };

    const syncChromeVisibility = () => {
        clearAutoHideTimer();
        if (!canAutoHideChrome()) {
            revealChrome();
            return;
        }
        revealChrome();
        scheduleAutoHide();
    };

    const handleUserActivity = () => {
        if (!isDesktopViewportActive()) {
            clearAutoHideTimer();
            revealChrome();
            return;
        }
        revealChrome();
        scheduleAutoHide();
    };

    const syncAnimationPlaying = (isPlaying) => {
        animationPlaying = isPlaying === true;
        syncChromeVisibility();
    };

    const readInitialPlayState = () => {
        const button = document.getElementById("animate");
        return ((button?.textContent || "").trim().toLowerCase() === "pause");
    };

    document.addEventListener("animation-play-state-updated", (event) => {
        const customEvent = /** @type {CustomEvent | null} */ (event);
        syncAnimationPlaying(customEvent?.detail?.isPlaying === true);
    });

    document.addEventListener("mission-ui-config-updated", (event) => {
        const configEvent = /** @type {CustomEvent | null} */ (event);
        autoHideEnabled = configEvent?.detail?.ui?.desktopChromeAutoHideEnabled !== false;
        syncChromeVisibility();
    });

    document.addEventListener("pointermove", () => {
        handleUserActivity();
    }, { passive: true, capture: true });

    document.addEventListener("pointerdown", () => {
        requestAnimationFrame(handleUserActivity);
    }, true);

    document.addEventListener("wheel", () => {
        handleUserActivity();
    }, { passive: true, capture: true });

    document.addEventListener("focusin", () => {
        handleUserActivity();
    }, true);

    document.addEventListener("keydown", (event) => {
        if (isInteractiveInputTarget(event.target)) {
            handleUserActivity();
            return;
        }
        if (!MEANINGFUL_ACTIVITY_KEYS.has(event.key)) return;
        handleUserActivity();
    }, true);

    document.addEventListener("visibilitychange", () => {
        syncChromeVisibility();
    });

    window.addEventListener("resize", () => {
        syncChromeVisibility();
    }, { passive: true });

    syncAnimationPlaying(readInitialPlayState());
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
    bindHeaderBlurbBehavior();
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
    const followPillPairs = [
        ["follow-pill-earth", "earth"],
        ["follow-pill-moon", "moon"],
        ["follow-pill-craft", "spacecraft"],
    ];
    const viewPillPairs = [
        ["view-pill-free", "manual", "manual"],
        ["view-pill-earth-moon", "earth", "moon"],
        ["view-pill-moon-earth", "moon", "earth"],
        ["view-pill-craft-moon", "spacecraft", "moon"],
        ["view-pill-craft-earth", "spacecraft", "earth"],
    ];
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
    const getSelectedCameraPillValue = (name) => {
        if (name === "camera-position-pill") {
            return document.getElementById("camera-position")?.value || "manual";
        }
        if (name === "camera-look-pill") {
            return document.getElementById("camera-look")?.value || "manual";
        }
        const selected = document.querySelector(`input[name="${name}"]:checked`);
        return selected?.value || "manual";
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
    const syncFollowPillState = () => {
        const positionValue = getSelectedCameraPillValue("camera-position-pill");
        const lookValue = getSelectedCameraPillValue("camera-look-pill");
        followPillPairs.forEach(([pillId, value]) => {
            const pill = document.getElementById(pillId);
            if (!pill) return;
            const isActive = positionValue === "manual" && lookValue === value;
            pill.classList.toggle("is-active", isActive);
            pill.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    };
    const syncViewPillState = () => {
        const positionValue = getSelectedCameraPillValue("camera-position-pill");
        const lookValue = getSelectedCameraPillValue("camera-look-pill");
        viewPillPairs.forEach(([pillId, position, look]) => {
            const pill = document.getElementById(pillId);
            if (!pill) return;
            const isActive = positionValue === position && lookValue === look;
            pill.classList.toggle("is-active", isActive);
            pill.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
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
    onChange("camera-position", function (event) {
        controlBackend.commitCameraPositionMode(event?.target?.value || "manual", {
            sourceId: "camera-position",
            sourceName: "camera-position",
            preserveManualRelease: event?.detail?.preserveManualRelease === true,
        });
    });
    onChange("camera-look", function (event) {
        controlBackend.commitCameraLookMode(event?.target?.value || "manual", {
            sourceId: "camera-look",
            sourceName: "camera-look",
            preserveManualRelease: event?.detail?.preserveManualRelease === true,
        });
    });
    onChangeAll('input[name="camera-position-pill"]', function (event) {
        controlBackend.commitCameraPositionMode(event?.target?.value || "manual", {
            sourceId: "camera-position-pill",
            sourceName: "camera-position-pill",
            preserveManualRelease: event?.detail?.preserveManualRelease === true,
        });
    });
    onChangeAll('input[name="camera-look-pill"]', function (event) {
        controlBackend.commitCameraLookMode(event?.target?.value || "manual", {
            sourceId: "camera-look-pill",
            sourceName: "camera-look-pill",
            preserveManualRelease: event?.detail?.preserveManualRelease === true,
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
    followPillPairs.forEach(([pillId, value]) => {
        const pill = document.getElementById(pillId);
        if (!pill) return;
        pill.addEventListener("click", function () {
            const positionValue = getSelectedCameraPillValue("camera-position-pill");
            const lookValue = getSelectedCameraPillValue("camera-look-pill");
            const isAlreadyActive = positionValue === "manual" && lookValue === value;
            controlBackend.commitCameraPair(
                "manual",
                isAlreadyActive ? "manual" : value,
                { preserveManualRelease: isAlreadyActive },
            );
            syncFollowPillState();
            syncViewPillState();
        });
    });
    viewPillPairs.forEach(([pillId, position, look]) => {
        const pill = document.getElementById(pillId);
        if (!pill) return;
        pill.addEventListener("click", function () {
            const positionValue = getSelectedCameraPillValue("camera-position-pill");
            const lookValue = getSelectedCameraPillValue("camera-look-pill");
            const isAlreadyActive = positionValue === position && lookValue === look;
            const nextPosition = isAlreadyActive ? "manual" : position;
            const nextLook = isAlreadyActive ? "manual" : look;
            // Semantic source->target views should return to a clean free camera when released.
            controlBackend.commitCameraPair(nextPosition, nextLook);
            syncFollowPillState();
            syncViewPillState();
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
    document.querySelectorAll('input[name="camera-position-pill"], input[name="camera-look-pill"]')
        .forEach((input) => input.addEventListener("change", function () {
            syncFollowPillState();
            syncViewPillState();
        }));
    document.addEventListener("camera-from-to-ui-updated", function () {
        syncFollowPillState();
        syncViewPillState();
    });
    if (landingToggle) {
        landingToggle.addEventListener("change", function () {
            syncTogglePillVisibility();
            syncLandingPillState();
        });
    }
    bindLandingPillVisibilityObserver();
    onClick("header-pill-strip-toggle", function () {
        const recentlyAutoRevealed = headerPillStripLastAutoRevealAt > 0 &&
            (Date.now() - headerPillStripLastAutoRevealAt) <= HEADER_PILL_AUTO_REVEAL_CLICK_GRACE_MS;
        if (headerPillStripAutoCollapsed || recentlyAutoRevealed) {
            headerPillStripLastAutoRevealAt = 0;
            setHeaderPillStripManualCollapsedState(false);
            setHeaderPillStripAutoCollapsedState(false);
            return;
        }
        setHeaderPillStripManualCollapsedState(!isHeaderPillStripEffectivelyCollapsed());
    });
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
    syncFollowPillState();
    syncViewPillState();
    syncTogglePillVisibility();
    syncTogglePillState();
    syncLandingPillState();
    syncDimensionPillState();
    syncMoonRenderProfilePillState();
    syncPlanePillState();
    syncHeaderPillStripCollapseUi();
    requestAnimationFrame(resetHeaderPillStripScrollPosition);
    window.addEventListener("resize", resetHeaderPillStripScrollPosition);
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
    if (keyboardShortcutsBound) return;
    keyboardShortcutsBound = true;

    onClick("shortcut-help", function () {
        toggleShortcutPanel();
    });

    if (!shortcutPanelGlobalBound) {
        shortcutPanelGlobalBound = true;
        window.addEventListener("resize", function () {
            const panel = document.getElementById("shortcut-panel");
            const button = document.getElementById("shortcut-help");
            if (!panel || !button || panel.classList.contains("shortcut-panel--hidden")) return;
            positionShortcutPanel(panel, button);
        });

        document.addEventListener("pointerdown", function (event) {
            const panel = document.getElementById("shortcut-panel");
            const button = document.getElementById("shortcut-help");
            if (!panel || panel.classList.contains("shortcut-panel--hidden")) return;
            if (!(event.target instanceof Node)) return;
            if (panel.contains(event.target)) return;
            if (button && button.contains(event.target)) return;
            toggleShortcutPanel(false);
        });
    }

    document.addEventListener("keydown", function (event) {
        if (event.defaultPrevented) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (isInteractiveInputTarget(event.target)) return;

        const key = event.key;
        const lowerKey = typeof key === "string" ? key.toLowerCase() : "";

        if (key === "Escape") {
            toggleShortcutPanel(false);
            return;
        }

        if (key === "?" || key === "/") {
            event.preventDefault();
            toggleShortcutPanel();
            return;
        }

        if (key === " " || lowerKey === "k") {
            event.preventDefault();
            clickControlButton("animate");
            return;
        }

        if (key === "ArrowLeft") {
            event.preventDefault();
            clickControlButton(event.shiftKey ? "fastbackward" : "backward");
            return;
        }

        if (key === "ArrowRight") {
            event.preventDefault();
            clickControlButton(event.shiftKey ? "fastforward" : "forward");
            return;
        }

        if (lowerKey === "j") {
            event.preventDefault();
            clickControlButton("fastbackward");
            return;
        }

        if (lowerKey === "l") {
            event.preventDefault();
            clickControlButton("fastforward");
            return;
        }

        if (
            key === "-" ||
            key === "_" ||
            event.code === "Minus" ||
            event.code === "NumpadSubtract"
        ) {
            event.preventDefault();
            clickControlButton("slower");
            return;
        }

        if (
            key === "+" ||
            key === "=" ||
            event.code === "Equal" ||
            event.code === "NumpadAdd"
        ) {
            event.preventDefault();
            clickControlButton("faster");
            return;
        }

        if (lowerKey === "r") {
            event.preventDefault();
            clickControlButton("realtime");
            return;
        }

        if (lowerKey === "n") {
            event.preventDefault();
            clickControlButton("missionnow");
        }
    });
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
