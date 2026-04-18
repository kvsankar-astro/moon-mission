import {
    AUXILIARY_VIEW_CAMERA_PRESETS,
    resolveLunarFlybyTimeMs,
    resolveLunarFlybyWindowMs,
} from "../app/auxiliary-camera-views.js";
import { invokeMissionPanelAction } from "../app/panel-registry.js";
import {
    resolveBodyOrbitCopy,
    resolveCraftOrbitCopy,
} from "./orbit-control-labels.js";
import { createMobileComposeControlsSync } from "./mobile-compose-controls-sync.js";
import { createMobileComposeLockSync } from "./mobile-compose-lock-sync.js";
import { createMobileComposeTimelineSync } from "./mobile-compose-timeline-sync.js";
import { createMobileViewPresetSync } from "./mobile-view-preset-sync.js";
import { bindMobileTransportSync } from "./mobile-transport-sync.js";
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

function extractTimelineEventMetadataFromButtons() {
    const buttons = document.querySelectorAll("#burnbuttons button[data-event-index]");
    if (!buttons.length) return [];
    const events = [];
    buttons.forEach((button) => {
        const startTime = Number(button.dataset.eventTimeMs);
        if (!Number.isFinite(startTime)) return;
        const key = button.dataset.eventKey || "";
        const label = (button.textContent || "").trim();
        const hoverText = button.getAttribute("title") || "";
        const infoText = hoverText;
        const burnFlag = button.dataset.burnFlag === "true";
        events.push({
            startTime,
            key,
            label,
            hoverText,
            infoText,
            burnFlag,
        });
    });
    return events;
}

function formatLocalDateTimeShort(timeMs) {
    if (!Number.isFinite(timeMs)) {
        return "--";
    }
    try {
        const datePart = new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "2-digit",
        }).format(timeMs);
        const timePart = new Intl.DateTimeFormat(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZoneName: "short",
        }).format(timeMs);
        return `${datePart} ${timePart}`;
    } catch {
        return new Date(timeMs).toLocaleString();
    }
}

let keyboardShortcutsBound = false;
let headerBlurbBehaviorBound = false;
let settingsPanelResizeBound = false;
let settingsOutsideClickBound = false;
let shortcutPanelGlobalBound = false;
let controlPanelResizeBound = false;
let timelineDockHeightSyncBound = false;
let timelineCarouselDragBound = false;
let desktopChromeAutohideBound = false;
let timelineDockResizeObserver = null;
let timelineDockMutationObserver = null;
let settingsAutoCollapsedControls = false;
let settingsPanelPresentationMode = "full";
let settingsPanelLauncherId = null;
let timelineCarouselWiggleTimeoutId = null;
let headerPillStripManualCollapsed = false;
let headerPillStripAutoCollapsed = false;
let headerPillStripLastAutoRevealAt = 0;
const mobileSettingsSectionState = new Map();
const TIMELINE_CAROUSEL_WIGGLE_CLASS = "timeline-dock__event-carousel--wiggle";
const HEADER_BLURB_AUTO_COLLAPSE_DELAY_MS = 10000;
const DESKTOP_CHROME_AUTO_HIDE_DELAY_MS = 10000;
const HEADER_PILL_AUTO_REVEAL_CLICK_GRACE_MS = 700;
const SETTINGS_PANEL_FILTERED_CLASS = "settings-panel__filtered-hidden";
const SETTINGS_PANEL_MODE_FULL = "full";
const SETTINGS_PANEL_MODE_ADVANCED = "advanced";
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

function adjustSettingsPanelBodyOverflow() {
    const panel = document.getElementById("settings-panel");
    const body = document.getElementById("settings-panel-body");
    if (!panel || !body) return;
    body.style.maxHeight = "none";
    body.style.overflowY = "visible";

    const panelRect = panel.getBoundingClientRect();
    const bottomGapPx = 14;
    const minBodyHeightPx = isMobileViewport() ? 140 : 220;
    let availableHeight = Math.max(
        minBodyHeightPx,
        Math.floor(window.innerHeight - panelRect.top - bottomGapPx),
    );

    // When the settings content is inside a constrained dialog wrapper, clamp
    // body height to the wrapper's usable space so long sections can scroll.
    const dialogApi = getMissionDialogApi();
    const wrapper = dialogApi?.widgetElement?.("#settings-panel");
    if (wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const wrapperAvailable = Math.floor(wrapperRect.bottom - bodyRect.top - 8);
        if (Number.isFinite(wrapperAvailable) && wrapperAvailable > 0) {
            availableHeight = Math.max(minBodyHeightPx, Math.min(availableHeight, wrapperAvailable));
        }
    }

    const needsScroll = body.scrollHeight > availableHeight + 1;

    body.style.maxHeight = `${availableHeight}px`;
    body.style.overflowY = needsScroll ? "auto" : "hidden";
}

function applyMobileSettingsPanelLayout(wrapper) {
    if (!wrapper || window.innerWidth > 600) return;
    const header = document.getElementById("header");
    const headerBottom = header?.getBoundingClientRect()?.bottom ?? 0;
    const panelTop = Math.round(headerBottom + 5);
    const panelLeft = 6;
    const bottomInset = 10;
    const viewportLimitedHeight = Math.floor(window.innerHeight - panelTop - bottomInset);
    const targetHeight = Math.floor(window.innerHeight * 0.64);
    const maxHeight = Math.max(240, Math.min(viewportLimitedHeight, targetHeight));
    const maxWidth = Math.min(320, Math.floor(window.innerWidth - panelLeft * 2));

    wrapper.style.top = `${panelTop}px`;
    wrapper.style.left = `${panelLeft}px`;
    wrapper.style.width = `${maxWidth}px`;
    wrapper.style.maxWidth = `${maxWidth}px`;
    wrapper.style.maxHeight = `${maxHeight}px`;
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

function isSettingsPanelOpen() {
    const dialogApi = getMissionDialogApi();
    const wrapper = dialogApi?.widgetElement?.("#settings-panel");
    if (wrapper) {
        return isElementLayoutVisible(wrapper);
    }
    const panel = document.getElementById("settings-panel");
    return isElementLayoutVisible(panel);
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

function setSettingsPanelLauncherState(buttonId, isOpen) {
    const button = buttonId ? document.getElementById(buttonId) : null;
    if (!button) return;
    button.setAttribute("aria-expanded", String(!!isOpen));
    button.classList.toggle("is-open", !!isOpen);
}

function syncSettingsPanelLauncherStates(openLauncherId = null) {
    ["settings-panel-button", "advanced-controls-pill"].forEach((buttonId) => {
        setSettingsPanelLauncherState(buttonId, buttonId === openLauncherId);
    });
}

function setSettingsPanelFilteredHidden(element, hidden) {
    if (!(element instanceof Element)) return;
    element.classList.toggle(SETTINGS_PANEL_FILTERED_CLASS, !!hidden);
}

function resolveSettingsPanelAdvancedViewItems() {
    const items = [];
    const addClosestOption = (controlId) => {
        const control = document.getElementById(controlId);
        const option = control?.closest(".settings-option");
        if (option) {
            items.push(option);
        }
    };

    addClosestOption("view-additional-crafts");
    addClosestOption("view-aux-camera-panels");
    addClosestOption("view-fps");

    const activeCraftRow = document.getElementById("active-craft-row");
    if (activeCraftRow) {
        items.push(activeCraftRow);
    }

    const orbitStyleOption = document.querySelector(".settings-option--orbit-style");
    if (orbitStyleOption) {
        items.push(orbitStyleOption);
    }

    const trailControls = document.querySelector(".settings-row--trail-controls");
    if (trailControls) {
        items.push(trailControls);
    }

    return items;
}

function applySettingsPanelPresentation(mode = SETTINGS_PANEL_MODE_FULL) {
    const panel = document.getElementById("settings-panel");
    if (!panel) return;

    const normalizedMode = mode === SETTINGS_PANEL_MODE_ADVANCED
        ? SETTINGS_PANEL_MODE_ADVANCED
        : SETTINGS_PANEL_MODE_FULL;
    settingsPanelPresentationMode = normalizedMode;

    panel.classList.toggle("settings-panel--advanced", normalizedMode === SETTINGS_PANEL_MODE_ADVANCED);

    const title = panel.querySelector(".settings-panel__title");
    if (title) {
        title.textContent = normalizedMode === SETTINGS_PANEL_MODE_ADVANCED ? "Advanced" : "Settings";
    }

    const sections = panel.querySelectorAll(".settings-section");
    sections.forEach((section) => setSettingsPanelFilteredHidden(section, false));

    const viewSection = panel.querySelector(".settings-section--view");
    const viewSectionTitle = viewSection?.querySelector(".settings-section__title");
    if (viewSectionTitle) {
        if (!viewSectionTitle.dataset.fullTitle) {
            viewSectionTitle.dataset.fullTitle = viewSectionTitle.textContent || "View";
        }
        viewSectionTitle.textContent = normalizedMode === SETTINGS_PANEL_MODE_ADVANCED
            ? "Craft / Display"
            : viewSectionTitle.dataset.fullTitle;
    }

    const viewOptions = viewSection?.querySelector(".settings-options");
    if (viewOptions) {
        Array.from(viewOptions.children).forEach((child) => setSettingsPanelFilteredHidden(child, false));
    }

    if (normalizedMode !== SETTINGS_PANEL_MODE_ADVANCED) {
        return;
    }

    sections.forEach((section) => {
        const keepSection = section.classList.contains("settings-section--camera") ||
            section.classList.contains("settings-section--view");
        setSettingsPanelFilteredHidden(section, !keepSection);
    });

    if (viewOptions) {
        Array.from(viewOptions.children).forEach((child) => setSettingsPanelFilteredHidden(child, true));
        resolveSettingsPanelAdvancedViewItems().forEach((item) => {
            setSettingsPanelFilteredHidden(item, false);
        });
    }
}

function resolveSettingsPanelAnchorSelector(options = {}) {
    const launcherId = options.launcherId || settingsPanelLauncherId;
    if (launcherId === "advanced-controls-pill") {
        return "#advanced-controls-pill";
    }

    const sourceLine = document.querySelector("#blurb .desktoponly");
    const sourceLineVisible = !!(sourceLine && sourceLine.getClientRects().length);
    if (sourceLineVisible && window.innerWidth > 600) {
        return "#blurb .desktoponly";
    }
    return "#settings-panel-button";
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

function resolveDefaultMobileSectionCollapsed(sectionKey) {
    return sectionKey === "camera" || sectionKey === "plane" || sectionKey === "view";
}

function setSettingsSectionCollapsed(section, collapsed) {
    section.classList.toggle("settings-section--collapsed", collapsed);
    const legend = section.querySelector(".settings-section__title");
    if (!legend) return;
    legend.setAttribute("aria-expanded", String(!collapsed));
}

function applyMobileSettingsSections() {
    const sections = document.querySelectorAll("#settings-panel .settings-section");
    if (!sections.length) return;

    const mobile = isMobileViewport();

    sections.forEach((section) => {
        const legend = section.querySelector(".settings-section__title");
        if (!legend) return;

        section.classList.toggle("settings-section--mobile-collapsible", mobile);
        if (!mobile) {
            section.classList.remove("settings-section--collapsed");
            legend.removeAttribute("role");
            legend.removeAttribute("tabindex");
            legend.removeAttribute("aria-expanded");
            return;
        }

        const sectionKey = section.dataset.sectionKey || "";
        const shouldCollapse = mobileSettingsSectionState.has(sectionKey)
            ? mobileSettingsSectionState.get(sectionKey)
            : resolveDefaultMobileSectionCollapsed(sectionKey);
        setSettingsSectionCollapsed(section, shouldCollapse);

        legend.setAttribute("role", "button");
        legend.setAttribute("tabindex", "0");

        if (!legend.dataset.mobileBound) {
            legend.dataset.mobileBound = "true";
            legend.addEventListener("click", function () {
                if (!isMobileViewport()) return;
                const nextCollapsed = !section.classList.contains("settings-section--collapsed");
                setSettingsSectionCollapsed(section, nextCollapsed);
                mobileSettingsSectionState.set(sectionKey, nextCollapsed);
                adjustSettingsPanelBodyOverflow();
                requestAnimationFrame(adjustSettingsPanelBodyOverflow);
            });

            legend.addEventListener("keydown", function (event) {
                if (!isMobileViewport()) return;
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                legend.click();
            });
        }
    });
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
    const settingsButton = document.getElementById("settings-panel-button");
    const advancedButton = document.getElementById("advanced-controls-pill");
    const closeSettingsPanel = (dialogApi) => {
        dialogApi?.close?.("#settings-panel");
        settingsPanelLauncherId = null;
        applySettingsPanelPresentation(SETTINGS_PANEL_MODE_FULL);
        syncSettingsPanelLauncherStates(null);
        if (settingsAutoCollapsedControls) {
            setControlPanelCollapsedState(false);
            settingsAutoCollapsedControls = false;
        }
    };

    const openSettingsPanel = ({
        launcherId,
        mode = SETTINGS_PANEL_MODE_FULL,
    }) => {
        const dialogApi = getMissionDialogApi();
        const isOpen = isSettingsPanelOpen();
        if (isOpen && settingsPanelLauncherId === launcherId) {
            closeSettingsPanel(dialogApi);
            return;
        }
        if (isOpen) {
            dialogApi?.close?.("#settings-panel");
        }

        settingsPanelLauncherId = launcherId;
        applySettingsPanelPresentation(mode);

        const options = {
            dialogClass: "dialog settings-dialog",
            modal: false,
            position: {
                my: "left top",
                at: "left bottom",
                of: resolveSettingsPanelAnchorSelector({ launcherId }),
                collision: "fit flip"
            },
            title: mode === SETTINGS_PANEL_MODE_ADVANCED ? "Advanced" : "Settings",
            closeOnEscape: false
        };

        // Route through the lightweight dialog shim (not jQuery UI).
        dialogApi?.init?.("#settings-panel", options);
        dialogApi?.open?.("#settings-panel");

        // Keep the existing styling adjustments applied to the wrapper.
        const wrapper = dialogApi?.widgetElement?.("#settings-panel");
        if (wrapper) {
            wrapper.style.backgroundImage = "none";
            wrapper.style.border = "0";
            wrapper.style.maxWidth = window.innerWidth <= 600
                ? "92vw"
                : mode === SETTINGS_PANEL_MODE_ADVANCED
                    ? "380px"
                    : "80%";
            wrapper.style.zIndex = "18";
            const titleBar = wrapper.querySelector(".ui-dialog-titlebar");
            if (titleBar) titleBar.style.display = "none";
            applyMobileSettingsPanelLayout(wrapper);
        }

        applyMobileSettingsSections();

        adjustSettingsPanelBodyOverflow();
        requestAnimationFrame(adjustSettingsPanelBodyOverflow);

        if (isMobileViewport()) {
            const controlsPanel = document.getElementById("control-panel");
            const controlsCollapsed = !!controlsPanel?.classList.contains("control-panel--collapsed");
            settingsAutoCollapsedControls = !controlsCollapsed;
            if (!controlsCollapsed) {
                setControlPanelCollapsedState(true);
            }
        } else {
            settingsAutoCollapsedControls = false;
        }

        if (!settingsPanelResizeBound) {
            settingsPanelResizeBound = true;
            window.addEventListener("resize", function () {
                if (!isSettingsPanelOpen()) return;
                adjustSettingsPanelBodyOverflow();
                const dialogApi = getMissionDialogApi();
                const wrapper = dialogApi?.widgetElement?.("#settings-panel");
                if (wrapper) applyMobileSettingsPanelLayout(wrapper);
                applyMobileSettingsSections();
            });
        }

        if (!settingsOutsideClickBound) {
            settingsOutsideClickBound = true;
            document.addEventListener("pointerdown", function (event) {
                if (!isSettingsPanelOpen()) return;
                if (!(event.target instanceof Node)) return;
                const dialogWrapper = dialogApi?.widgetElement?.("#settings-panel");
                if (dialogWrapper && dialogWrapper.contains(event.target)) return;
                if (settingsButton && settingsButton.contains(event.target)) return;
                if (advancedButton && advancedButton.contains(event.target)) return;
                closeSettingsPanel(dialogApi);
            });
        }

        syncSettingsPanelLauncherStates(launcherId);
    };

    onClick("settings-panel-button", function () {
        openSettingsPanel({
            launcherId: "settings-panel-button",
            mode: SETTINGS_PANEL_MODE_FULL,
        });
    });

    onClick("advanced-controls-pill", function () {
        openSettingsPanel({
            launcherId: "advanced-controls-pill",
            mode: SETTINGS_PANEL_MODE_ADVANCED,
        });
    });
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
    const shell = document.getElementById("mobile-shell");
    if (!shell) return;
    if (shell.dataset.bound === "true") return;
    shell.dataset.bound = "true";

    const missionCard = document.getElementById("mobile-card-mission");
    const missionCardBody = document.getElementById("mobile-mission-body");
    const viewsCard = document.getElementById("mobile-card-views");
    const viewsCardBody = document.getElementById("mobile-views-body");
    const panelCollapseButton = document.getElementById("mobile-views-collapse");
    const composeCard = document.getElementById("mobile-card-compose");
    const missionControls = {
        play: document.getElementById("mobile-control-play"),
        slower: document.getElementById("mobile-control-slower"),
        faster: document.getElementById("mobile-control-faster"),
        speed: document.getElementById("mobile-control-speed"),
        now: document.getElementById("mobile-control-realtime"),
    };
    const viewsControls = {
        play: document.getElementById("mobile-views-control-play"),
        slower: document.getElementById("mobile-views-control-slower"),
        faster: document.getElementById("mobile-views-control-faster"),
        speed: document.getElementById("mobile-views-control-speed"),
        now: document.getElementById("mobile-views-control-realtime"),
    };
    const composeControls = {
        play: document.getElementById("mobile-compose-control-play"),
        slower: document.getElementById("mobile-compose-control-slower"),
        faster: document.getElementById("mobile-compose-control-faster"),
        speed: document.getElementById("mobile-compose-control-speed"),
        now: document.getElementById("mobile-compose-control-realtime"),
    };
    const mobileTransportSets = [missionControls, viewsControls, composeControls];

    const mobileViewButtons = document.querySelectorAll(".mobile-shell__view-btn");
    const mobileComposeLockButtons = document.querySelectorAll(".mobile-shell__compose-lock-btn");
    const mobileComposeTimelineSlider = document.getElementById("mobile-compose-timeline-slider");
    const mobileComposeTimelineValue = document.getElementById("mobile-compose-timeline-value");
    const mobileComposeTimelineLocal = document.getElementById("mobile-compose-timeline-local");
    const mobileComposeEarthshineSlider = document.getElementById("mobile-compose-earthshine-slider");
    const mobileComposeEarthshineValue = document.getElementById("mobile-compose-earthshine-value");
    const mobileComposeRollSlider = document.getElementById("mobile-compose-roll-slider");
    const mobileComposeRollValue = document.getElementById("mobile-compose-roll-value");
    const mobileComposeFovSlider = document.getElementById("mobile-compose-fov-slider");
    const mobileComposeFovValue = document.getElementById("mobile-compose-fov-value");
    const mobileComposeFovAuto = document.getElementById("mobile-compose-fov-auto");
    const mobileViewsFovSlider = document.getElementById("mobile-views-fov-slider");
    const mobileViewsFovValue = document.getElementById("mobile-views-fov-value");
    const mobileViewsFovAuto = document.getElementById("mobile-views-fov-auto");
    const mobileViewsMoonVisibility = document.getElementById("mobile-views-moon-visibility");
    const mobileViewsMoonVisibilitySummary = document.getElementById("mobile-views-moon-visibility-summary");
    const mobileViewsMoonVisibilityHead = mobileViewsMoonVisibilitySummary?.querySelector(".mobile-shell__views-visibility-head");
    const mobileViewsMoonVisibilityValues = mobileViewsMoonVisibilitySummary?.querySelector(".mobile-shell__views-visibility-values");
    const mobileViewsFarSideToggle = document.getElementById("mobile-views-farside-toggle");
    const mobileMoonFarSideOverlay = document.getElementById("mobile-moon-farside-overlay");
    const contentWrapper = document.getElementById("content-wrapper");
    const missionEvent = document.getElementById("mobile-mission-event");
    const setMissionEventMessage = (message) => {
        if (!missionEvent) return;
        const text = typeof message === "string" ? message.trim() : "";
        missionEvent.hidden = text.length === 0;
        missionEvent.textContent = text;
    };
    setMissionEventMessage("");
    const mobileShellNav = shell.querySelector(".mobile-shell__nav");
    const navButtons = document.querySelectorAll(".mobile-shell__nav-btn");
    const composeNavButton = shell.querySelector('.mobile-shell__nav-btn[data-mobile-tab="compose"]');
    const desktopPosition = document.getElementById("camera-position");
    const desktopLook = document.getElementById("camera-look");
    const mobileViewPresetById = new Map(
        AUXILIARY_VIEW_CAMERA_PRESETS.map((preset) => [preset.id, preset]),
    );
    const mobileComposePresetById = new Map([
        ["free", { positionMode: "spacecraft", lookMode: "manual" }],
        ["earth", { positionMode: "spacecraft", lookMode: "earth" }],
        ["moon", { positionMode: "spacecraft", lookMode: "moon" }],
    ]);
    const mobileTabCards = {
        mission: missionCard,
        views: viewsCard,
        compose: composeCard,
    };
    const MISSION_PANEL_COLLAPSE_STORAGE_KEY = "moon-mission:mobile-mission-panel-collapsed:v1";
    const VIEWS_PANEL_COLLAPSE_STORAGE_KEY = "moon-mission:mobile-views-panel-collapsed:v1";
    const COMPOSE_TIMELINE_RESOLUTION = 1000;
    const COMPOSE_TIMELINE_WINDOW_MS = 2 * 60 * 60 * 1000;
    const COMPOSE_DEFAULT_FOV = 110;
    let activeMobileTab = "mission";
    let activeMobileViewPresetId = "moon";
    let activeMobileComposeLockPresetId = "free";
    let mobileViewsAutoFovEnabled = true;
    const radiusByObject = new WeakMap();
    const AUTO_FOV_MARGIN_SCALE = 1.03;
    const AUTO_FOV_EPSILON_DEGREES = 1e-4;
    const MIN_FOV = 1;
    const MAX_FOV = 179;
    let mobileViewsPresetInitialized = false;
    let mobileViewsSavedViewState = null;
    let mobileAlwaysSuppressedViewState = null;
    let mobileSavedMissionCameraModes = null;
    const mobileAutoFovRadiusCacheByScene = new WeakMap();
    let mobileViewPresetEnforceInProgress = false;
    let mobileMoonFarOverlayEnabled = true;
    let mobileMoonOverlayLastUpdateMs = -Infinity;
    let mobileMoonOverlayLoopHandle = null;
    let mobileMoonOverlayCtx = null;
    let mobileViewsPinchState = null;
    let mobileMoonVisibilitySignature = "";
    let mobileComposeDefaultFovApplied = false;
    let mobileMissionLocatorBaseline = null;
    const MOBILE_MOON_OVERLAY_UPDATE_INTERVAL_MS = 180;
    const moonVisibilitySamples = createFibonacciSphereSamples(240);
    const MOBILE_ALWAYS_SUPPRESSED_VIEW_IDS = [
        "view-aux-camera-panels",
    ];
    const MOBILE_VIEWS_SUPPRESSED_VIEW_IDS = [];
    // Hotfix gate: keep mobile Earthrise UI disabled in production until feature completion.
    const MOBILE_EARTHRISE_ENABLED = false;
    const composeFeatureEnabled = (() => {
        if (!MOBILE_EARTHRISE_ENABLED) return false;
        const dataPath = String(window?.missionConfig?.dataPath || "").toLowerCase();
        return dataPath.includes("/artemis2/") || dataPath.includes("\\artemis2\\");
    })();
    const isViewsVisualSimplificationTab = (tabName) => tabName === "views" || tabName === "compose";
    const shouldEnableMobileTapPlaybackToggle = () => {
        if (!isMobileViewport()) return false;
        return activeMobileTab === "mission" || activeMobileTab === "views";
    };

    const syncMobilePanelCollapseButton = () => {
        if (!panelCollapseButton) return;
        const tabKey = activeMobileTab;
        let collapsed = false;
        let label = "Collapse panel";
        let hidden = false;
        if (tabKey === "mission") {
            collapsed = !!missionCard?.classList.contains("mobile-shell__card--collapsed");
            label = collapsed ? "Expand mission panel" : "Collapse mission panel";
        } else if (tabKey === "views") {
            collapsed = !!viewsCard?.classList.contains("mobile-shell__card--collapsed");
            label = collapsed ? "Expand views controls" : "Collapse views controls";
        } else {
            hidden = true;
        }
        panelCollapseButton.hidden = hidden;
        if (hidden) return;
        panelCollapseButton.textContent = collapsed ? "+" : "−";
        panelCollapseButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
        panelCollapseButton.setAttribute("aria-label", label);
        panelCollapseButton.title = label;
    };

    if (!composeFeatureEnabled) {
        if (composeCard) {
            composeCard.hidden = true;
        }
        if (composeNavButton) {
            composeNavButton.hidden = true;
            composeNavButton.disabled = true;
        }
    }

    const syncMobileNavLayout = () => {
        if (!mobileShellNav) return;
        const visibleNavCount = Array.from(navButtons).reduce((count, button) => {
            return button.hidden ? count : count + 1;
        }, 0);
        mobileShellNav.style.setProperty("--mobile-shell-tab-count", String(Math.max(1, visibleNavCount)));
    };
    syncMobileNavLayout();

    const toggleMobileMode = () => {
        const mobile = isMobileViewport();
        document.body.classList.toggle("mobile-shell-enabled", mobile);
        if (mobile) {
            const bodyHaloToggle = document.getElementById("view-body-halos");
            if (mobileMissionLocatorBaseline === null && bodyHaloToggle) {
                mobileMissionLocatorBaseline = !!bodyHaloToggle.checked;
            }
            const dialogApi = getMissionDialogApi();
            dialogApi?.close?.("#settings-panel");
            const settingsPanel = document.getElementById("settings-panel");
            if (settingsPanel) {
                settingsPanel.style.display = "none";
            }
            settingsPanelLauncherId = null;
            applySettingsPanelPresentation(SETTINGS_PANEL_MODE_FULL);
            syncSettingsPanelLauncherStates(null);
            applyMobileAlwaysSuppressedViews();
            if (isViewsVisualSimplificationTab(activeMobileTab)) {
                applyViewsVisualSimplification();
                startMobileMoonVisibilityLoop();
            }
            syncMobileMoonVisibilityInfo({ force: true });
            syncMobileComposeControls();
        } else {
            if (isViewsVisualSimplificationTab(activeMobileTab)) {
                restoreViewsVisualSimplification();
                if (mobileSavedMissionCameraModes && desktopPosition && desktopLook) {
                    desktopPosition.value = mobileSavedMissionCameraModes.positionMode || "manual";
                    desktopLook.value = mobileSavedMissionCameraModes.lookMode || "manual";
                    desktopPosition.dispatchEvent(new Event("change", { bubbles: true }));
                    mobileSavedMissionCameraModes = null;
                }
            }
            restoreMobileAlwaysSuppressedViews();
            if (mobileMissionLocatorBaseline !== null) {
                setCheckboxState("view-body-halos", mobileMissionLocatorBaseline);
                mobileMissionLocatorBaseline = null;
            }
            stopMobileMoonVisibilityLoop();
            syncMobileMoonVisibilityInfo({ force: true });
            mobileComposeControlsSync?.syncPresentation?.();
        }
        applyMobileRenderViewportCentering();
    };

    const setMissionCardCollapsed = (collapsed) => {
        if (!missionCard || !missionCardBody) return;
        missionCard.classList.toggle("mobile-shell__card--collapsed", !!collapsed);
        syncMobilePanelCollapseButton();
        try {
            window.localStorage?.setItem(MISSION_PANEL_COLLAPSE_STORAGE_KEY, collapsed ? "true" : "false");
        } catch {
            // Ignore localStorage failures.
        }
    };

    const setViewsCardCollapsed = (collapsed) => {
        if (!viewsCard || !viewsCardBody) return;
        viewsCard.classList.toggle("mobile-shell__card--collapsed", !!collapsed);
        syncMobilePanelCollapseButton();
        try {
            window.localStorage?.setItem(VIEWS_PANEL_COLLAPSE_STORAGE_KEY, collapsed ? "true" : "false");
        } catch {
            // Ignore localStorage failures.
        }
    };

    const isLayoutVisible = (element) => {
        if (!element || element.hidden) return false;
        const style = window.getComputedStyle?.(element);
        if (!style || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
            return false;
        }
        const rect = element.getBoundingClientRect?.();
        return !!rect && rect.height > 0 && rect.width > 0;
    };

    const applyMobileRenderViewportCentering = () => {
        if (!contentWrapper) return;
        let shiftPx = 0;
        const rootStyle = document.documentElement?.style;
        const shouldCenterForTab =
            activeMobileTab === "mission" ||
            activeMobileTab === "views" ||
            activeMobileTab === "compose";
        let activeCardBottomPx = Number.NaN;
        if (isMobileViewport() && shouldCenterForTab) {
            const viewportHeight = Math.max(1, window.innerHeight || 1);
            const activeCard = mobileTabCards[activeMobileTab] || null;
            let topInset = 0;
            if (isLayoutVisible(activeCard)) {
                const rect = activeCard.getBoundingClientRect();
                topInset = Math.max(0, Math.min(viewportHeight, rect.bottom));
                activeCardBottomPx = rect.bottom;
            }
            const pillStrip = document.getElementById("header-pill-strip");
            const pillStripExpanded = !!(
                pillStrip &&
                isLayoutVisible(pillStrip) &&
                !pillStrip.classList.contains("header-pill-strip--collapsed")
            );
            if (pillStripExpanded) {
                const stripRect = pillStrip.getBoundingClientRect();
                const stripBottom = Math.max(0, Math.min(viewportHeight, stripRect.bottom));
                topInset = Math.max(topInset, stripBottom);
            }
            let bottomInset = viewportHeight;
            const bottomCandidates = [mobileShellNav, document.getElementById("timeline-dock")];
            bottomCandidates.forEach((candidate) => {
                if (!isLayoutVisible(candidate)) return;
                const rect = candidate.getBoundingClientRect();
                const top = Math.max(0, Math.min(viewportHeight, rect.top));
                bottomInset = Math.min(bottomInset, top);
            });
            if (bottomInset > topInset + 24) {
                shiftPx = Math.round(((topInset + bottomInset) * 0.5) - (viewportHeight * 0.5));
            }
        }
        contentWrapper.style.setProperty("--mobile-render-shift-y", `${shiftPx}px`);
        if (isMobileViewport() && document.body?.classList.contains("mobile-shell-enabled")) {
            const headerBottomPx = (() => {
                const header = document.getElementById("header");
                if (!header) return Number.NaN;
                const rect = header.getBoundingClientRect?.();
                return rect ? rect.bottom : Number.NaN;
            })();
            const collapsedTopPx = Number.isFinite(headerBottomPx)
                ? Math.round(headerBottomPx + 4)
                : 56;
            const topPx = Number.isFinite(activeCardBottomPx)
                ? Math.max(48, Math.round(activeCardBottomPx + 4))
                : Math.max(48, collapsedTopPx);
            rootStyle?.setProperty("--mobile-pill-strip-top", `${topPx}px`);
        } else {
            rootStyle?.removeProperty("--mobile-pill-strip-top");
        }
    };

    const clampFov = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return COMPOSE_DEFAULT_FOV;
        return Math.min(MAX_FOV, Math.max(MIN_FOV, numeric));
    };

    const updateMobileViewsFovDisplay = (fovDegrees) => {
        const nextFov = clampFov(fovDegrees);
        const rounded = Math.round(nextFov);
        if (mobileViewsFovSlider) {
            mobileViewsFovSlider.value = String(rounded);
        }
        if (mobileComposeFovSlider) {
            mobileComposeFovSlider.value = String(rounded);
        }
        if (mobileViewsFovValue) {
            mobileViewsFovValue.textContent = `${rounded}°`;
            mobileViewsFovValue.value = `${rounded}°`;
        }
        if (mobileComposeFovValue) {
            mobileComposeFovValue.textContent = `${rounded}°`;
            mobileComposeFovValue.value = `${rounded}°`;
        }
    };

    const resolveActiveOriginConfig = () => {
        const selectedMode = document.querySelector('input[name="mode"]:checked');
        const mode = (selectedMode?.value || "geo").trim();
        if (mode === "geo" || mode === "lunar" || mode === "relative") return mode;
        return "geo";
    };

    const resolveActiveScene = () => {
        const scenes = window.animationScenes;
        if (!scenes || typeof scenes !== "object") return null;
        return scenes[resolveActiveOriginConfig()] || null;
    };

    const resolveActiveCraft = (scene) =>
        scene?.craft ||
        Object.values(scene?.craftsById || {}).find((craft) => !!craft) ||
        null;

    const resolveSceneObject = (scene, mode) => {
        if (!scene) return null;
        if (mode === "earth") return scene.earthContainer || scene.earth || null;
        if (mode === "moon") return scene.moonContainer || scene.moon || null;
        if (mode === "spacecraft") return resolveActiveCraft(scene);
        return null;
    };

    function createFibonacciSphereSamples(count = 720) {
        const sampleCount = Math.max(64, Math.floor(count));
        const points = new Float32Array(sampleCount * 3);
        const golden = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < sampleCount; i += 1) {
            const y = 1 - (2 * (i + 0.5)) / sampleCount;
            const radius = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = golden * i;
            points[i * 3] = Math.cos(theta) * radius;
            points[i * 3 + 1] = y;
            points[i * 3 + 2] = Math.sin(theta) * radius;
        }
        return points;
    }

    const normalizeVectorInPlace = (vector) => {
        if (!vector) return false;
        const length = Math.hypot(vector.x, vector.y, vector.z);
        if (!Number.isFinite(length) || length <= 1e-12) return false;
        vector.x /= length;
        vector.y /= length;
        vector.z /= length;
        return true;
    };

    const roundPercentParts = (parts) => {
        const floors = parts.map((value) => Math.floor(Math.max(0, value)));
        let sum = floors.reduce((acc, value) => acc + value, 0);
        let remaining = Math.max(0, 100 - sum);
        const remainders = parts
            .map((value, index) => ({ index, remainder: Math.max(0, value) - floors[index] }))
            .sort((a, b) => b.remainder - a.remainder);
        let cursor = 0;
        while (remaining > 0 && remainders.length > 0) {
            floors[remainders[cursor % remainders.length].index] += 1;
            remaining -= 1;
            cursor += 1;
        }
        sum = floors.reduce((acc, value) => acc + value, 0);
        if (sum !== 100 && floors.length > 0) {
            floors[0] += 100 - sum;
        }
        return floors;
    };

    const resolveMoonRenderMesh = (scene) => {
        if (!scene) return null;
        const directMoon = scene.moon;
        if (directMoon?.isMesh && directMoon.geometry) {
            return directMoon;
        }
        const container = scene.moonContainer;
        if (container?.isMesh && container.geometry) {
            return container;
        }
        let found = null;
        container?.traverse?.((node) => {
            if (found) return;
            if (node?.isMesh && node.geometry) {
                found = node;
            }
        });
        return found;
    };

    const ensureMobileMoonFarSideOverlayMesh = (scene) => {
        const existing = scene?.mobileMoonFarSideOverlayMesh;
        if (existing?.mesh && existing?.material) {
            return existing;
        }
        const THREE = scene?.THREE || window.THREE;
        if (!THREE?.ShaderMaterial || !THREE?.Mesh || !THREE?.Vector3 || !THREE?.Vector4) {
            return null;
        }

        const moonMesh = resolveMoonRenderMesh(scene);
        if (!moonMesh?.geometry || typeof moonMesh.add !== "function") {
            return null;
        }

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -2,
            uniforms: {
                uEarthDirWorld: { value: new THREE.Vector3(1, 0, 0) },
                uSunDirWorld: { value: new THREE.Vector3(1, 0, 0) },
                uOverlayColor: { value: new THREE.Vector4(0.56, 0.44, 0.98, 0.52) },
            },
            vertexShader: `
                varying vec3 vWorldNormal;
                void main() {
                    vWorldNormal = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uEarthDirWorld;
                uniform vec3 uSunDirWorld;
                uniform vec4 uOverlayColor;
                varying vec3 vWorldNormal;
                void main() {
                    vec3 n = normalize(vWorldNormal);
                    float farDot = dot(n, normalize(uEarthDirWorld));
                    if (farDot >= 0.0) {
                        discard;
                    }
                    float farMask = smoothstep(0.0, -0.035, farDot);
                    float sunDot = dot(n, normalize(uSunDirWorld));
                    float nightness = smoothstep(0.03, -0.18, sunDot);
                    vec3 rgb = mix(uOverlayColor.rgb, vec3(0.72, 0.64, 0.98), 0.2 * nightness);
                    float alpha = uOverlayColor.a * farMask * mix(0.62, 0.82, nightness);
                    gl_FragColor = vec4(rgb, alpha);
                }
            `,
        });

        const mesh = new THREE.Mesh(moonMesh.geometry, material);
        mesh.name = "mobile-moon-far-side-overlay";
        mesh.renderOrder = (moonMesh.renderOrder || 0) + 1;
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.scale.setScalar(1.0015);
        moonMesh.add(mesh);

        const handle = { mesh, material };
        scene.mobileMoonFarSideOverlayMesh = handle;
        return handle;
    };

    const hideMobileMoonFarSideOverlayForScene = (scene) => {
        const overlay = scene?.mobileMoonFarSideOverlayMesh;
        if (overlay?.mesh) {
            overlay.mesh.visible = false;
        }
    };

    const hideAllMobileMoonFarSideOverlays = () => {
        const scenes = window.animationScenes;
        if (!scenes || typeof scenes !== "object") return;
        Object.values(scenes).forEach((scene) => hideMobileMoonFarSideOverlayForScene(scene));
    };

    const resolveMoonVisibilitySunDirection = (scene, moonWorld) => {
        const fromState = scene?.stateSunDirections?.moonCentered || scene?.stateSunDirection;
        if (
            fromState &&
            Number.isFinite(fromState.x) &&
            Number.isFinite(fromState.y) &&
            Number.isFinite(fromState.z)
        ) {
            const vector = { x: fromState.x, y: fromState.y, z: fromState.z };
            if (normalizeVectorInPlace(vector)) {
                return vector;
            }
        }

        const sunObject = scene?.sun;
        if (sunObject?.getWorldPosition) {
            const sunWorld = scene.camera.position.clone();
            sunObject.getWorldPosition(sunWorld);
            sunWorld.sub(moonWorld);
            if (normalizeVectorInPlace(sunWorld)) {
                return sunWorld;
            }
        }

        return null;
    };

    const computeMobileMoonVisibilityInfo = (scene, activeCraft, earthObject, moonObject) => {
        if (!scene?.camera || !activeCraft || !earthObject || !moonObject) {
            return null;
        }

        const craftWorld = scene.camera.position.clone();
        const earthWorld = scene.camera.position.clone();
        const moonWorld = scene.camera.position.clone();
        activeCraft.getWorldPosition?.(craftWorld);
        earthObject.getWorldPosition?.(earthWorld);
        moonObject.getWorldPosition?.(moonWorld);

        const craftFromMoonDir = craftWorld.sub(moonWorld.clone());
        const earthFromMoonDir = earthWorld.sub(moonWorld.clone());
        if (!normalizeVectorInPlace(craftFromMoonDir) || !normalizeVectorInPlace(earthFromMoonDir)) {
            return null;
        }

        const sunFromMoonDir = resolveMoonVisibilitySunDirection(scene, moonWorld);
        if (!sunFromMoonDir) {
            return null;
        }

        let visibleCount = 0;
        let nearDay = 0;
        let nearNight = 0;
        let farDay = 0;
        let farNight = 0;

        for (let i = 0; i < moonVisibilitySamples.length; i += 3) {
            const nx = moonVisibilitySamples[i];
            const ny = moonVisibilitySamples[i + 1];
            const nz = moonVisibilitySamples[i + 2];
            const visibleDot = nx * craftFromMoonDir.x + ny * craftFromMoonDir.y + nz * craftFromMoonDir.z;
            if (visibleDot <= 0) continue;
            visibleCount += 1;

            const near = (nx * earthFromMoonDir.x + ny * earthFromMoonDir.y + nz * earthFromMoonDir.z) >= 0;
            const day = (nx * sunFromMoonDir.x + ny * sunFromMoonDir.y + nz * sunFromMoonDir.z) >= 0;

            if (near) {
                if (day) nearDay += 1;
                else nearNight += 1;
            } else if (day) {
                farDay += 1;
            } else {
                farNight += 1;
            }
        }

        if (visibleCount <= 0) {
            return null;
        }

        const rawParts = [
            (nearDay * 100) / visibleCount,
            (nearNight * 100) / visibleCount,
            (farDay * 100) / visibleCount,
            (farNight * 100) / visibleCount,
        ];
        const [nearDayPct, nearNightPct, farDayPct, farNightPct] = roundPercentParts(rawParts);
        const nearPct = nearDayPct + nearNightPct;
        const farPct = farDayPct + farNightPct;

        return {
            nearPct,
            farPct,
            nearDayPct,
            nearNightPct,
            farDayPct,
            farNightPct,
            earthDirectionWorld: earthFromMoonDir,
            moonWorld,
        };
    };

    const computeMobileMoonOverlayState = (scene, earthObject, moonObject) => {
        if (!scene?.camera) {
            return null;
        }
        const resolveSunDirectionWorld = () => {
            const fromState = scene?.stateSunDirections?.moonCentered || scene?.stateSunDirection;
            if (
                fromState &&
                Number.isFinite(fromState.x) &&
                Number.isFinite(fromState.y) &&
                Number.isFinite(fromState.z)
            ) {
                const sunDir = { x: fromState.x, y: fromState.y, z: fromState.z };
                if (normalizeVectorInPlace(sunDir)) {
                    return sunDir;
                }
            }
            const stateSun = scene?.latestSceneState?.sunDirections?.moonCentered || scene?.latestSceneState?.sunDirection;
            if (
                stateSun &&
                Number.isFinite(stateSun.x) &&
                Number.isFinite(stateSun.y) &&
                Number.isFinite(stateSun.z)
            ) {
                const sunDir = { x: stateSun.x, y: stateSun.y, z: stateSun.z };
                if (normalizeVectorInPlace(sunDir)) {
                    return sunDir;
                }
            }
            return null;
        };
        const sunDirectionWorld = resolveSunDirectionWorld();
        if (!sunDirectionWorld) {
            return null;
        }

        if (earthObject && moonObject) {
            const earthWorld = scene.camera.position.clone();
            const moonWorld = scene.camera.position.clone();
            earthObject.getWorldPosition?.(earthWorld);
            moonObject.getWorldPosition?.(moonWorld);

            const earthFromMoonDir = earthWorld.sub(moonWorld.clone());
            if (!normalizeVectorInPlace(earthFromMoonDir)) {
                return null;
            }

            return {
                earthDirectionWorld: earthFromMoonDir,
                sunDirectionWorld,
                moonWorld,
            };
        }

        const stateEarth = resolveBodyPositionFromSceneState(scene?.latestSceneState, scene, "EARTH");
        const stateMoon = resolveBodyPositionFromSceneState(scene?.latestSceneState, scene, "MOON");
        if (!hasFinitePositionVector(stateEarth) || !hasFinitePositionVector(stateMoon)) {
            return null;
        }
        const earthFromMoonDir = {
            x: stateEarth.x - stateMoon.x,
            y: stateEarth.y - stateMoon.y,
            z: stateEarth.z - stateMoon.z,
        };
        if (!normalizeVectorInPlace(earthFromMoonDir)) {
            return null;
        }
        const moonWorld = scene.camera.position.clone();
        (scene.moonContainer || scene.moon)?.getWorldPosition?.(moonWorld);
        return {
            earthDirectionWorld: earthFromMoonDir,
            sunDirectionWorld,
            moonWorld,
        };
    };

    const hasFinitePositionVector = (vector) =>
        !!vector &&
        Number.isFinite(vector.x) &&
        Number.isFinite(vector.y) &&
        Number.isFinite(vector.z);

    const resolveCraftPositionFromSceneState = (sceneState, preferredCraftId = null) => {
        const bodies = sceneState?.bodies;
        if (!bodies || typeof bodies !== "object") return null;

        const toPosition = (body) => {
            const pos = body?.position;
            return hasFinitePositionVector(pos)
                ? { x: pos.x, y: pos.y, z: pos.z }
                : null;
        };

        if (preferredCraftId) {
            const preferred = toPosition(bodies[preferredCraftId]);
            if (preferred) return preferred;
        }

        const fallbackSc = toPosition(bodies.SC);
        if (fallbackSc) return fallbackSc;

        for (const [bodyId, bodyState] of Object.entries(bodies)) {
            const normalizedId = String(bodyId || "").toUpperCase();
            if (normalizedId === "EARTH" || normalizedId === "MOON" || normalizedId === "SUN") {
                continue;
            }
            const pos = toPosition(bodyState);
            if (pos) return pos;
        }

        return null;
    };

    const resolveBodyPositionFromSceneState = (sceneState, scene, bodyId) => {
        const bodies = sceneState?.bodies;
        const direct = bodies?.[bodyId]?.position;
        if (hasFinitePositionVector(direct)) {
            return direct;
        }

        // Some frame representations omit the origin body entirely because it
        // is implicitly at the coordinate origin in that frame.
        const primaryBody = String(scene?.primaryBody || "").toUpperCase();
        if (primaryBody === bodyId) {
            return { x: 0, y: 0, z: 0 };
        }

        return null;
    };

    const computeMobileMoonVisibilityInfoFromSceneState = (
        sceneState,
        scene,
        preferredCraftId = null,
    ) => {
        const bodies = sceneState?.bodies;
        if (!bodies || typeof bodies !== "object") return null;

        const earthPos = resolveBodyPositionFromSceneState(sceneState, scene, "EARTH");
        const moonPos = resolveBodyPositionFromSceneState(sceneState, scene, "MOON");
        const craftPos = resolveCraftPositionFromSceneState(sceneState, preferredCraftId);
        if (!hasFinitePositionVector(earthPos) || !hasFinitePositionVector(moonPos) || !craftPos) {
            return null;
        }

        const craftFromMoonDir = {
            x: craftPos.x - moonPos.x,
            y: craftPos.y - moonPos.y,
            z: craftPos.z - moonPos.z,
        };
        const earthFromMoonDir = {
            x: earthPos.x - moonPos.x,
            y: earthPos.y - moonPos.y,
            z: earthPos.z - moonPos.z,
        };
        if (!normalizeVectorInPlace(craftFromMoonDir) || !normalizeVectorInPlace(earthFromMoonDir)) {
            return null;
        }

        const sunDirection = sceneState?.sunDirections?.moonCentered || sceneState?.sunDirection;
        if (!hasFinitePositionVector(sunDirection)) {
            return null;
        }
        const sunFromMoonDir = {
            x: sunDirection.x,
            y: sunDirection.y,
            z: sunDirection.z,
        };
        if (!normalizeVectorInPlace(sunFromMoonDir)) {
            return null;
        }

        let visibleCount = 0;
        let nearDay = 0;
        let nearNight = 0;
        let farDay = 0;
        let farNight = 0;

        for (let i = 0; i < moonVisibilitySamples.length; i += 3) {
            const nx = moonVisibilitySamples[i];
            const ny = moonVisibilitySamples[i + 1];
            const nz = moonVisibilitySamples[i + 2];
            const visibleDot = nx * craftFromMoonDir.x + ny * craftFromMoonDir.y + nz * craftFromMoonDir.z;
            if (visibleDot <= 0) continue;
            visibleCount += 1;

            const near = (nx * earthFromMoonDir.x + ny * earthFromMoonDir.y + nz * earthFromMoonDir.z) >= 0;
            const day = (nx * sunFromMoonDir.x + ny * sunFromMoonDir.y + nz * sunFromMoonDir.z) >= 0;

            if (near) {
                if (day) nearDay += 1;
                else nearNight += 1;
            } else if (day) {
                farDay += 1;
            } else {
                farNight += 1;
            }
        }

        if (visibleCount <= 0) {
            return null;
        }

        const rawParts = [
            (nearDay * 100) / visibleCount,
            (nearNight * 100) / visibleCount,
            (farDay * 100) / visibleCount,
            (farNight * 100) / visibleCount,
        ];
        const [nearDayPct, nearNightPct, farDayPct, farNightPct] = roundPercentParts(rawParts);

        return {
            nearPct: nearDayPct + nearNightPct,
            farPct: farDayPct + farNightPct,
            nearDayPct,
            nearNightPct,
            farDayPct,
            farNightPct,
        };
    };

    const estimateObjectRadius = (object, fallback = 1) => {
        if (!object) return fallback;
        if (radiusByObject.has(object)) {
            return radiusByObject.get(object);
        }
        /** @type {number | null} */
        let radius = null;
        const takeRadius = (geometry) => {
            if (!geometry) return;
            if (!geometry.boundingSphere && typeof geometry.computeBoundingSphere === "function") {
                geometry.computeBoundingSphere();
            }
            const r = geometry.boundingSphere?.radius;
            if (Number.isFinite(r) && r > 0) {
                radius = r;
            }
        };

        takeRadius(object.geometry);
        if (!Number.isFinite(radius) && typeof object.traverse === "function") {
            object.traverse((node) => {
                if (Number.isFinite(radius)) return;
                takeRadius(node?.geometry);
            });
        }
        const resolved = Number.isFinite(radius) && radius > 0 ? radius : fallback;
        radiusByObject.set(object, resolved);
        return resolved;
    };

    const resolveBodyMeshRadius = (scene, mode) => {
        if (!scene) return Number.NaN;
        const key = String(mode || "").toUpperCase();
        if (key === "EARTH") {
            const meshRadius = estimateObjectRadius(scene.earth, Number.NaN);
            if (Number.isFinite(meshRadius) && meshRadius > 0) return meshRadius;
        }
        if (key === "MOON") {
            const meshRadius = estimateObjectRadius(scene.moon, Number.NaN);
            if (Number.isFinite(meshRadius) && meshRadius > 0) return meshRadius;
        }
        return Number.NaN;
    };

    const resolveBodyRadius = (scene, targetMode, targetObject) => {
        const mode = String(targetMode || "").toUpperCase();
        if (!scene || (mode !== "EARTH" && mode !== "MOON")) {
            return estimateObjectRadius(targetObject, 1);
        }

        let sceneRadiusCache = mobileAutoFovRadiusCacheByScene.get(scene);
        if (!sceneRadiusCache) {
            sceneRadiusCache = new Map();
            mobileAutoFovRadiusCacheByScene.set(scene, sceneRadiusCache);
        }
        const cachedRadius = sceneRadiusCache.get(mode);
        if (Number.isFinite(cachedRadius) && cachedRadius > 0) {
            return cachedRadius;
        }

        const primary = String(scene?.primaryBody || "").toUpperCase();
        const secondary = String(scene?.secondaryBody || "").toUpperCase();
        if (mode === "EARTH") {
            if (primary === "EARTH" && Number.isFinite(scene?.primaryBodyRadius)) {
                sceneRadiusCache.set(mode, scene.primaryBodyRadius);
                return scene.primaryBodyRadius;
            }
            if (secondary === "EARTH" && Number.isFinite(scene?.secondaryBodyRadius)) {
                sceneRadiusCache.set(mode, scene.secondaryBodyRadius);
                return scene.secondaryBodyRadius;
            }
        }
        if (mode === "MOON") {
            if (primary === "MOON" && Number.isFinite(scene?.primaryBodyRadius)) {
                sceneRadiusCache.set(mode, scene.primaryBodyRadius);
                return scene.primaryBodyRadius;
            }
            if (secondary === "MOON" && Number.isFinite(scene?.secondaryBodyRadius)) {
                sceneRadiusCache.set(mode, scene.secondaryBodyRadius);
                return scene.secondaryBodyRadius;
            }
        }
        const bodyMeshRadius = resolveBodyMeshRadius(scene, mode);
        if (Number.isFinite(bodyMeshRadius) && bodyMeshRadius > 0) {
            sceneRadiusCache.set(mode, bodyMeshRadius);
            return bodyMeshRadius;
        }
        const estimatedRadius = estimateObjectRadius(targetObject, Number.NaN);
        if (Number.isFinite(estimatedRadius) && estimatedRadius > 0) {
            sceneRadiusCache.set(mode, estimatedRadius);
            return estimatedRadius;
        }
        return Number.isFinite(cachedRadius) && cachedRadius > 0 ? cachedRadius : 1;
    };

    const computeAutoFovDegrees = ({ distanceToTarget, targetRadius, aspect }) => {
        if (!Number.isFinite(distanceToTarget) || distanceToTarget <= 0) return null;
        const radius = Number.isFinite(targetRadius) && targetRadius > 0 ? targetRadius : 1;
        const fitRadius = radius * AUTO_FOV_MARGIN_SCALE;
        const safeDistance = Math.max(distanceToTarget, fitRadius + 1e-9);
        const ratio = Math.min(fitRadius / safeDistance, 0.999999);
        const angularRadius = Math.asin(ratio);
        const safeAspect = Math.max(Number(aspect) || 1, 1e-3);
        const verticalFromHeight = 2 * angularRadius;
        const verticalFromWidth = 2 * Math.atan(Math.tan(angularRadius) / safeAspect);
        const requiredVerticalRadians = Math.max(verticalFromHeight, verticalFromWidth);
        return (requiredVerticalRadians * 180) / Math.PI;
    };

    const ensureMobileMoonOverlayCanvasSize = () => {
        if (!mobileMoonFarSideOverlay) return null;
        const cssWidth = Math.max(1, Math.floor(window.innerWidth));
        const cssHeight = Math.max(1, Math.floor(window.innerHeight));
        const resized = (mobileMoonFarSideOverlay.width !== cssWidth) ||
            (mobileMoonFarSideOverlay.height !== cssHeight);
        if (resized) {
            mobileMoonFarSideOverlay.width = cssWidth;
            mobileMoonFarSideOverlay.height = cssHeight;
            mobileMoonFarSideOverlay.style.width = `${cssWidth}px`;
            mobileMoonFarSideOverlay.style.height = `${cssHeight}px`;
        }
        return { cssWidth, cssHeight };
    };

    const clearMobileMoonOverlay = () => {
        if (!mobileMoonFarSideOverlay) return;
        const ctx = mobileMoonOverlayCtx || mobileMoonFarSideOverlay.getContext("2d");
        if (!ctx) return;
        mobileMoonOverlayCtx = ctx;
        const size = ensureMobileMoonOverlayCanvasSize();
        if (!size) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, mobileMoonFarSideOverlay.width, mobileMoonFarSideOverlay.height);
    };

    const setMobileMoonOverlayActive = (active) => {
        if (!mobileMoonFarSideOverlay) return;
        mobileMoonFarSideOverlay.classList.toggle("is-active", !!active);
        if (!active) {
            clearMobileMoonOverlay();
        }
    };

    const renderMobileMoonFarSideOverlay = (scene, visibility) => {
        if (!scene?.camera || !visibility?.earthDirectionWorld || !visibility?.sunDirectionWorld) {
            hideMobileMoonFarSideOverlayForScene(scene);
            setMobileMoonOverlayActive(false);
            return;
        }
        const overlay = ensureMobileMoonFarSideOverlayMesh(scene);
        const dir = visibility.earthDirectionWorld;
        const sunDir = visibility.sunDirectionWorld;
        if (!overlay?.mesh || !overlay?.material || !Number.isFinite(dir.x) || !Number.isFinite(dir.y) || !Number.isFinite(dir.z)) {
            hideMobileMoonFarSideOverlayForScene(scene);
            setMobileMoonOverlayActive(false);
            return;
        }
        const uniformDir = overlay.material.uniforms?.uEarthDirWorld?.value;
        const uniformSunDir = overlay.material.uniforms?.uSunDirWorld?.value;
        if (!uniformDir?.copy || !uniformSunDir?.copy) {
            hideMobileMoonFarSideOverlayForScene(scene);
            setMobileMoonOverlayActive(false);
            return;
        }
        uniformDir.copy(dir).normalize();
        uniformSunDir.copy(sunDir).normalize();
        overlay.mesh.visible = true;
        setMobileMoonOverlayActive(true);
    };

    const setMobileMoonVisibilityInfoVisible = (visible) => {
        if (mobileViewsMoonVisibility) {
            mobileViewsMoonVisibility.hidden = !visible;
        }
        if (!visible) {
            mobileMoonVisibilitySignature = "";
            hideAllMobileMoonFarSideOverlays();
            setMobileMoonOverlayActive(false);
        }
    };

    const syncMobileMoonVisibilityInfo = ({ force = false } = {}) => {
        const shouldShow =
            isMobileViewport() &&
            activeMobileTab === "views" &&
            activeMobileViewPresetId === "moon";

        if (!shouldShow) {
            setMobileMoonVisibilityInfoVisible(false);
            return;
        }

        const scene = resolveActiveScene();
        const activeCraft = resolveActiveCraft(scene);
        const earthObject = scene?.earthContainer || scene?.earth;
        const moonObject = scene?.moonContainer || scene?.moon;
        const hasSceneGraphVisibilityInputs = !!scene?.camera;
        const sceneStateSnapshot = scene?.latestSceneState || null;
        const preferredCraftId = scene?.activeCraftId || scene?.primaryCraftId || null;

        const now = performance.now();
        if (!force && (now - mobileMoonOverlayLastUpdateMs) < MOBILE_MOON_OVERLAY_UPDATE_INTERVAL_MS) {
            return;
        }
        mobileMoonOverlayLastUpdateMs = now;
        setMobileMoonVisibilityInfoVisible(true);

        const panelVisibility = computeMobileMoonVisibilityInfoFromSceneState(
            sceneStateSnapshot,
            scene,
            preferredCraftId,
        );
        if (!panelVisibility) {
            if (mobileViewsMoonVisibilitySummary) {
                if (mobileViewsMoonVisibilityHead && mobileViewsMoonVisibilityValues) {
                    mobileViewsMoonVisibilityHead.hidden = true;
                    mobileViewsMoonVisibilityValues.innerHTML = [
                        "<span>--%</span>",
                        "<span>--%</span>",
                        "<span>--%</span>",
                        "<span>--%</span>",
                    ].join("");
                } else {
                    mobileViewsMoonVisibilitySummary.textContent = "Visible lunar surface: unavailable";
                }
            }
            mobileMoonVisibilitySignature = "";
            hideAllMobileMoonFarSideOverlays();
            setMobileMoonOverlayActive(false);
            return;
        }

        if (mobileViewsMoonVisibilitySummary) {
            if (mobileViewsMoonVisibilityHead && mobileViewsMoonVisibilityValues) {
                const nextSignature = [
                    panelVisibility.nearDayPct,
                    panelVisibility.nearNightPct,
                    panelVisibility.farDayPct,
                    panelVisibility.farNightPct,
                ].join("|");
                mobileViewsMoonVisibilityHead.hidden = false;
                if (mobileMoonVisibilitySignature !== nextSignature) {
                    mobileViewsMoonVisibilityValues.innerHTML = [
                        `<span>${panelVisibility.nearDayPct}%</span>`,
                        `<span>${panelVisibility.nearNightPct}%</span>`,
                        `<span>${panelVisibility.farDayPct}%</span>`,
                        `<span>${panelVisibility.farNightPct}%</span>`,
                    ].join("");
                    mobileMoonVisibilitySignature = nextSignature;
                }
            } else {
                mobileViewsMoonVisibilitySummary.textContent =
                    `${panelVisibility.nearPct}% near (${panelVisibility.nearDayPct}% day; ${panelVisibility.nearNightPct}% night) ` +
                    `${panelVisibility.farPct}% far (${panelVisibility.farDayPct}% day; ${panelVisibility.farNightPct}% night)`;
            }
        }

        if (mobileViewsFarSideToggle) {
            mobileViewsFarSideToggle.textContent = mobileMoonFarOverlayEnabled ? "Far Side: ON" : "Far Side: OFF";
            mobileViewsFarSideToggle.classList.toggle("is-active", mobileMoonFarOverlayEnabled);
            mobileViewsFarSideToggle.setAttribute("aria-pressed", mobileMoonFarOverlayEnabled ? "true" : "false");
        }

        if (!mobileMoonFarOverlayEnabled) {
            hideAllMobileMoonFarSideOverlays();
            setMobileMoonOverlayActive(false);
            return;
        }

        const isThreeD = !!document.getElementById("dimension-3D")?.checked;
        if (!isThreeD) {
            hideAllMobileMoonFarSideOverlays();
            setMobileMoonOverlayActive(false);
            return;
        }

        if (!hasSceneGraphVisibilityInputs) {
            hideAllMobileMoonFarSideOverlays();
            setMobileMoonOverlayActive(false);
            return;
        }

        const overlayVisibility = computeMobileMoonOverlayState(scene, earthObject, moonObject);
        if (!overlayVisibility) {
            hideAllMobileMoonFarSideOverlays();
            setMobileMoonOverlayActive(false);
            return;
        }

        renderMobileMoonFarSideOverlay(scene, overlayVisibility);
    };

    const shouldRunMobileMoonVisibilityLoop = () => (
        isMobileViewport() && activeMobileTab === "views"
    );

    const stopMobileMoonVisibilityLoop = () => {
        if (mobileMoonOverlayLoopHandle == null) return;
        window.cancelAnimationFrame?.(mobileMoonOverlayLoopHandle);
        mobileMoonOverlayLoopHandle = null;
        hideAllMobileMoonFarSideOverlays();
        setMobileMoonOverlayActive(false);
    };

    const startMobileMoonVisibilityLoop = () => {
        if (mobileMoonOverlayLoopHandle != null) return;
        if (!shouldRunMobileMoonVisibilityLoop()) return;
        const tick = () => {
            syncMobileMoonVisibilityInfo();
            if (!shouldRunMobileMoonVisibilityLoop()) {
                mobileMoonOverlayLoopHandle = null;
                return;
            }
            mobileComposeControlsSync?.syncPresentation?.();
            applyAutoFovForActivePreset();
            const scene = resolveActiveScene();
            if (
                scene?.camera?.fov &&
                (activeMobileTab === "views" || activeMobileTab === "compose")
            ) {
                updateMobileViewsFovDisplay(scene.camera.fov);
            }
            mobileMoonOverlayLoopHandle = window.requestAnimationFrame(tick);
        };
        mobileMoonOverlayLoopHandle = window.requestAnimationFrame(tick);
    };

    const applyMobileViewsFov = (fovDegrees) => {
        const scene = resolveActiveScene();
        const controller = scene?.cameraController;
        const nextFov = clampFov(fovDegrees);
        if (!controller?.setFov) {
            updateMobileViewsFovDisplay(nextFov);
            return false;
        }
        controller.setFov(nextFov);
        scene?.camera?.updateProjectionMatrix?.();
        if (!controller._freeFlyActive) {
            controller.controls?.update?.();
            controller.controls?.dispatchEvent?.({ type: "change" });
        }
        updateMobileViewsFovDisplay(nextFov);
        return true;
    };

    const applyMobileViewsAutoFov = (fovDegrees) => {
        const scene = resolveActiveScene();
        const controller = scene?.cameraController;
        const nextFov = clampFov(fovDegrees);
        if (!controller?.setFov) {
            updateMobileViewsFovDisplay(nextFov);
            return false;
        }
        controller.setFov(nextFov);
        updateMobileViewsFovDisplay(nextFov);
        return true;
    };

    const requestMobileSceneRender = () => {
        const scene = resolveActiveScene();
        const controller = scene?.cameraController;
        if (!controller) return;
        if (!controller._freeFlyActive) {
            controller.controls?.update?.();
            controller.controls?.dispatchEvent?.({ type: "change" });
        }
    };

    const resolveTouchDistance = (touchA, touchB) => {
        if (!touchA || !touchB) return null;
        const dx = Number(touchA.clientX) - Number(touchB.clientX);
        const dy = Number(touchA.clientY) - Number(touchB.clientY);
        const distance = Math.hypot(dx, dy);
        return Number.isFinite(distance) ? distance : null;
    };

    const setMobileViewsAutoFov = (enabled) => {
        mobileViewsAutoFovEnabled = !!enabled;
        if (mobileViewsFovAuto) {
            mobileViewsFovAuto.classList.toggle("is-active", mobileViewsAutoFovEnabled);
            mobileViewsFovAuto.setAttribute("aria-pressed", mobileViewsAutoFovEnabled ? "true" : "false");
            mobileViewsFovAuto.title = mobileViewsAutoFovEnabled ? "Auto FoV enabled" : "Auto FoV disabled";
        }
        if (mobileComposeFovAuto) {
            mobileComposeFovAuto.classList.toggle("is-active", mobileViewsAutoFovEnabled);
            mobileComposeFovAuto.setAttribute("aria-pressed", mobileViewsAutoFovEnabled ? "true" : "false");
            mobileComposeFovAuto.title = mobileViewsAutoFovEnabled ? "Auto FoV enabled" : "Auto FoV disabled";
        }
    };

    const applyAutoFovForActivePreset = () => {
        if (!mobileViewsAutoFovEnabled) return false;
        const isComposeTab = activeMobileTab === "compose" && composeFeatureEnabled;
        const isViewsTab = activeMobileTab === "views";
        if (!isViewsTab && !isComposeTab) return false;
        const preset = isComposeTab
            ? mobileComposePresetById.get(activeMobileComposeLockPresetId)
            : mobileViewPresetById.get(activeMobileViewPresetId);
        if (!preset) return false;

        const scene = resolveActiveScene();
        if (!scene?.camera) return false;

        const anchorObject = resolveSceneObject(scene, preset.positionMode);
        const targetObject = resolveSceneObject(scene, preset.lookMode);
        if (!anchorObject || !targetObject) return false;

        const anchorWorld = scene.camera.position.clone();
        const targetWorld = scene.camera.position.clone();
        anchorObject.getWorldPosition?.(anchorWorld);
        targetObject.getWorldPosition?.(targetWorld);
        const distanceToTarget = anchorWorld.distanceTo(targetWorld);
        if (!Number.isFinite(distanceToTarget) || distanceToTarget <= 0) return false;

        const targetRadius = resolveBodyRadius(scene, preset.lookMode, targetObject);
        const aspect = scene.camera.aspect || (window.innerWidth / Math.max(window.innerHeight, 1));
        const autoFov = computeAutoFovDegrees({
            distanceToTarget,
            targetRadius,
            aspect,
        });
        if (!Number.isFinite(autoFov)) {
            if (Number.isFinite(scene.camera.fov)) {
                updateMobileViewsFovDisplay(scene.camera.fov);
            }
            return false;
        }
        const clampedAutoFov = clampFov(autoFov);
        const currentFov = Number(scene.camera?.fov);
        if (Number.isFinite(currentFov) && Math.abs(currentFov - clampedAutoFov) < AUTO_FOV_EPSILON_DEGREES) {
            updateMobileViewsFovDisplay(currentFov);
            return false;
        }
        return applyMobileViewsAutoFov(clampedAutoFov);
    };

    const scheduleAutoFovRefresh = () => {
        if (!mobileViewsAutoFovEnabled) return;
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                if (!mobileViewsAutoFovEnabled) return;
                if (activeMobileTab !== "views" && activeMobileTab !== "compose") return;
                applyAutoFovForActivePreset();
                requestMobileSceneRender();
                syncMobileMoonVisibilityInfo({ force: true });
            });
        });
    };

    const timelineSlider = document.getElementById("timeline-slider");
    const burnButtonsHost = document.getElementById("burnbuttons");
    const mobileComposeTimelineSync = createMobileComposeTimelineSync({
        mobileComposeTimelineSlider,
        mobileComposeTimelineValue,
        mobileComposeTimelineLocal,
        timelineSlider,
        burnButtonsHost,
        composeTimelineResolution: COMPOSE_TIMELINE_RESOLUTION,
        composeTimelineWindowMs: COMPOSE_TIMELINE_WINDOW_MS,
        getActiveTab: () => activeMobileTab,
        readEventInfos: extractTimelineEventMetadataFromButtons,
        resolveFlybyWindowMs: resolveLunarFlybyWindowMs,
        resolveFlybyTimeMs: resolveLunarFlybyTimeMs,
        formatLocalDateTimeShort,
    });
    mobileComposeTimelineSync.bind();

    let mobileComposeControlsSync = null;
    const mobileComposeLockSync = createMobileComposeLockSync({
        mobileComposeLockButtons,
        mobileComposePresetById,
        desktopPosition,
        desktopLook,
        resolveActiveScene,
        getActivePresetId: () => activeMobileComposeLockPresetId,
        setActivePresetId: (presetId) => {
            activeMobileComposeLockPresetId = presetId;
        },
        onAfterApply: () => {
            mobileComposeControlsSync?.syncPresentation?.();
        },
        onAfterButtonClick: () => {
            mobileComposeTimelineSync.sync();
        },
    });
    mobileComposeLockSync.bind();

    mobileComposeControlsSync = createMobileComposeControlsSync({
        mobileComposeEarthshineSlider,
        mobileComposeEarthshineValue,
        mobileComposeRollSlider,
        mobileComposeRollValue,
        mobileComposeFovAuto,
        desktopPosition,
        desktopLook,
        mobileComposePresetById,
        mobileComposeLockSync,
        mobileComposeTimelineSync,
        resolveActiveScene,
        resolveActiveCraft,
        resolveSceneObject,
        getActiveTab: () => activeMobileTab,
        isMobileViewport,
        getComposeFeatureEnabled: () => composeFeatureEnabled,
        getActivePresetId: () => activeMobileComposeLockPresetId,
        onComposeFovAutoToggle: () => {
            setMobileViewsAutoFov(!mobileViewsAutoFovEnabled);
            applyAutoFovForActivePreset();
            syncMobileMoonVisibilityInfo({ force: true });
        },
    });
    mobileComposeControlsSync.bind();

    const syncMobileComposeControls = () => {
        mobileComposeControlsSync.syncControls();
    };

    const setCheckboxState = (id, checked) => {
        const input = document.getElementById(id);
        if (!input || input.disabled) return;
        if (input.checked === checked) return;
        const activeScene = resolveActiveScene();
        const sceneReady = !!activeScene?.initialized3D;
        if (!sceneReady) {
            input.checked = checked;
            return;
        }
        input.click();
    };

    const captureViewsState = () => {
        const snapshot = {};
        MOBILE_VIEWS_SUPPRESSED_VIEW_IDS.forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;
            snapshot[id] = !!input.checked;
        });
        return snapshot;
    };

    const applyMobileAlwaysSuppressedViews = () => {
        if (mobileAlwaysSuppressedViewState === null) {
            mobileAlwaysSuppressedViewState = {};
            MOBILE_ALWAYS_SUPPRESSED_VIEW_IDS.forEach((id) => {
                const input = document.getElementById(id);
                if (!input) return;
                mobileAlwaysSuppressedViewState[id] = !!input.checked;
            });
        }
        MOBILE_ALWAYS_SUPPRESSED_VIEW_IDS.forEach((id) => setCheckboxState(id, false));
    };

    const restoreMobileAlwaysSuppressedViews = () => {
        if (!mobileAlwaysSuppressedViewState) return;
        Object.entries(mobileAlwaysSuppressedViewState).forEach(([id, checked]) => {
            setCheckboxState(id, checked);
        });
        mobileAlwaysSuppressedViewState = null;
    };

    const applyViewsVisualSimplification = () => {
        if (mobileViewsSavedViewState === null) {
            mobileViewsSavedViewState = captureViewsState();
        }
        MOBILE_VIEWS_SUPPRESSED_VIEW_IDS.forEach((id) => setCheckboxState(id, false));
    };

    const restoreViewsVisualSimplification = () => {
        if (!mobileViewsSavedViewState) return;
        Object.entries(mobileViewsSavedViewState).forEach(([id, checked]) => {
            if (isMobileViewport() && MOBILE_ALWAYS_SUPPRESSED_VIEW_IDS.includes(id)) return;
            setCheckboxState(id, checked);
        });
        mobileViewsSavedViewState = null;
    };

    const setActiveMobileTab = (tabName) => {
        const requestedTab = (tabName === "compose" && !composeFeatureEnabled) ? "mission" : tabName;
        const nextTab = mobileTabCards[requestedTab] ? requestedTab : "mission";
        const previousTab = activeMobileTab;
        activeMobileTab = nextTab;
        if (typeof document !== "undefined" && document.body) {
            document.body.dataset.mobileActiveTab = nextTab;
        }
        const mobileViewport = isMobileViewport();
        const previousNeedsSimplification = mobileViewport && isViewsVisualSimplificationTab(previousTab);
        const nextNeedsSimplification = mobileViewport && isViewsVisualSimplificationTab(nextTab);

        navButtons.forEach((button) => {
            if (button.hidden) return;
            const isActive = button.dataset.mobileTab === nextTab;
            button.classList.toggle("is-active", isActive);
            if (isActive) {
                button.setAttribute("aria-current", "page");
            } else {
                button.removeAttribute("aria-current");
            }
        });

        Object.entries(mobileTabCards).forEach(([tabKey, card]) => {
            if (!card) return;
            if (tabKey === "compose" && !composeFeatureEnabled) {
                card.hidden = true;
                return;
            }
            card.hidden = tabKey !== nextTab;
        });

        if (nextNeedsSimplification && !previousNeedsSimplification) {
            applyViewsVisualSimplification();
            if (!mobileSavedMissionCameraModes && desktopPosition && desktopLook) {
                mobileSavedMissionCameraModes = {
                    positionMode: desktopPosition.value,
                    lookMode: desktopLook.value,
                };
            }
        } else if (!nextNeedsSimplification && previousNeedsSimplification) {
            restoreViewsVisualSimplification();
            if (mobileSavedMissionCameraModes && desktopPosition && desktopLook) {
                desktopPosition.value = mobileSavedMissionCameraModes.positionMode || "manual";
                desktopLook.value = mobileSavedMissionCameraModes.lookMode || "manual";
                desktopPosition.dispatchEvent(new Event("change", { bubbles: true }));
                mobileSavedMissionCameraModes = null;
            }
        }

        if (mobileViewport && nextTab === "mission") {
            setCheckboxState("view-body-halos", true);
        }

        if (nextTab === "views" && mobileViewport) {
            if (!mobileViewsPresetInitialized || !mobileViewPresetById.has(activeMobileViewPresetId)) {
                activeMobileViewPresetId = "moon";
                mobileViewPresetSync.applyPreset(activeMobileViewPresetId);
                mobileViewsPresetInitialized = true;
            }
            mobileViewPresetSync.syncState();
            if (mobileViewsAutoFovEnabled) {
                applyAutoFovForActivePreset();
                scheduleAutoFovRefresh();
            }
            const scene = resolveActiveScene();
            if (scene?.camera?.fov) {
                updateMobileViewsFovDisplay(scene.camera.fov);
            }
            startMobileMoonVisibilityLoop();
            syncMobileMoonVisibilityInfo({ force: true });
        } else if (nextTab === "compose" && mobileViewport && composeFeatureEnabled) {
            if (!mobileComposeDefaultFovApplied) {
                setMobileViewsAutoFov(false);
                applyMobileViewsFov(COMPOSE_DEFAULT_FOV);
                mobileComposeDefaultFovApplied = true;
            }
            syncMobileComposeControls();
            if (mobileViewsAutoFovEnabled) {
                applyAutoFovForActivePreset();
                scheduleAutoFovRefresh();
            }
            const scene = resolveActiveScene();
            if (scene?.camera?.fov) {
                updateMobileViewsFovDisplay(scene.camera.fov);
            }
            stopMobileMoonVisibilityLoop();
            syncMobileMoonVisibilityInfo({ force: true });
        } else if (previousTab === "views" && mobileViewport) {
            syncMobileMoonVisibilityInfo({ force: true });
        } else if (previousTab === "compose" && mobileViewport) {
            syncMobileMoonVisibilityInfo({ force: true });
        }
        mobileComposeControlsSync?.syncPresentation?.();
        applyMobileRenderViewportCentering();
        syncMobilePanelCollapseButton();
    };

    const mobileViewPresetSync = createMobileViewPresetSync({
        mobileViewButtons,
        mobileViewPresetById,
        desktopPosition,
        desktopLook,
        getActivePresetId: () => activeMobileViewPresetId,
        setActivePresetId: (presetId) => {
            activeMobileViewPresetId = presetId;
        },
        getEnforceInProgress: () => mobileViewPresetEnforceInProgress,
        setEnforceInProgress: (inProgress) => {
            mobileViewPresetEnforceInProgress = inProgress;
        },
        isMobileViewport,
        getActiveTab: () => activeMobileTab,
        onAfterApply: () => {
            syncMobileMoonVisibilityInfo({ force: true });
        },
        onAfterEnforcedSync: () => {
            syncMobileMoonVisibilityInfo({ force: true });
        },
        onAfterButtonClick: () => {
            applyAutoFovForActivePreset();
        },
        onAfterDesktopChange: () => {
            mobileComposeLockSync.syncState();
            mobileComposeControlsSync?.syncPresentation?.();
            applyAutoFovForActivePreset();
            if (activeMobileTab === "compose") {
                mobileComposeTimelineSync.sync();
            }
            syncMobileMoonVisibilityInfo({ force: true });
        },
    });
    mobileViewPresetSync.bind();

    if (mobileViewsFovAuto) {
        mobileViewsFovAuto.addEventListener("click", function () {
            setMobileViewsAutoFov(!mobileViewsAutoFovEnabled);
            applyAutoFovForActivePreset();
            syncMobileMoonVisibilityInfo({ force: true });
        });
    }

    if (mobileViewsFovSlider || mobileComposeFovSlider) {
        const onManualFovChange = (event) => {
            const sourceSlider = event?.currentTarget;
            setMobileViewsAutoFov(false);
            applyMobileViewsFov(Number(sourceSlider?.value));
            syncMobileMoonVisibilityInfo({ force: true });
        };
        mobileViewsFovSlider?.addEventListener("input", onManualFovChange);
        mobileViewsFovSlider?.addEventListener("change", onManualFovChange);
        mobileComposeFovSlider?.addEventListener("input", onManualFovChange);
        mobileComposeFovSlider?.addEventListener("change", onManualFovChange);
    }

    if (contentWrapper) {
        let mobileTapCandidate = null;
        const MOBILE_TAP_MAX_DURATION_MS = 280;
        const MOBILE_TAP_MAX_MOVE_PX = 12;

        const shouldHandleMobilePinchZoom = () => {
            if (!isMobileViewport()) return false;
            if (activeMobileTab === "views") {
                return !!mobileViewPresetById.get(activeMobileViewPresetId);
            }
            if (activeMobileTab === "compose") {
                return composeFeatureEnabled;
            }
            return false;
        };

        const onViewsPinchStart = (event) => {
            if (
                shouldEnableMobileTapPlaybackToggle() &&
                event.touches &&
                event.touches.length === 1
            ) {
                const touch = event.touches[0];
                mobileTapCandidate = {
                    x: touch.clientX,
                    y: touch.clientY,
                    startMs: (typeof performance !== "undefined" && performance.now)
                        ? performance.now()
                        : Date.now(),
                    moved: false,
                };
            } else if (!event.touches || event.touches.length !== 1) {
                mobileTapCandidate = null;
            }

            if (!shouldHandleMobilePinchZoom()) return;
            if (!event.touches || event.touches.length !== 2) return;
            const distance = resolveTouchDistance(event.touches[0], event.touches[1]);
            if (!Number.isFinite(distance) || distance <= 0) return;
            const scene = resolveActiveScene();
            const fovInput = activeMobileTab === "compose" ? mobileComposeFovSlider : mobileViewsFovSlider;
            const baseFov = clampFov(scene?.camera?.fov ?? Number(fovInput?.value));
            mobileViewsPinchState = {
                baseDistance: distance,
                baseFov,
            };
            setMobileViewsAutoFov(false);
            event.preventDefault();
        };

        const onViewsPinchMove = (event) => {
            if (mobileTapCandidate && event.touches && event.touches.length === 1) {
                const touch = event.touches[0];
                const dx = touch.clientX - mobileTapCandidate.x;
                const dy = touch.clientY - mobileTapCandidate.y;
                if (Math.hypot(dx, dy) > MOBILE_TAP_MAX_MOVE_PX) {
                    mobileTapCandidate.moved = true;
                }
            } else if (mobileTapCandidate && (!event.touches || event.touches.length !== 1)) {
                mobileTapCandidate = null;
            }

            if (!shouldHandleMobilePinchZoom()) {
                mobileViewsPinchState = null;
                return;
            }
            if (!mobileViewsPinchState || !event.touches || event.touches.length !== 2) return;
            const distance = resolveTouchDistance(event.touches[0], event.touches[1]);
            if (!Number.isFinite(distance) || distance <= 0 || mobileViewsPinchState.baseDistance <= 0) return;
            const scale = distance / mobileViewsPinchState.baseDistance;
            if (!Number.isFinite(scale) || scale <= 0) return;
            const nextFov = clampFov(mobileViewsPinchState.baseFov / scale);
            applyMobileViewsFov(nextFov);
            if (activeMobileTab === "compose") {
                mobileComposeControlsSync?.syncPresentation?.();
            }
            syncMobileMoonVisibilityInfo();
            event.preventDefault();
        };

        const clearViewsPinchState = (event) => {
            mobileViewsPinchState = null;
            if (
                mobileTapCandidate &&
                shouldEnableMobileTapPlaybackToggle() &&
                event?.changedTouches &&
                event.changedTouches.length === 1
            ) {
                const endTouch = event.changedTouches[0];
                const dx = endTouch.clientX - mobileTapCandidate.x;
                const dy = endTouch.clientY - mobileTapCandidate.y;
                const elapsed = ((typeof performance !== "undefined" && performance.now)
                    ? performance.now()
                    : Date.now()) - mobileTapCandidate.startMs;
                const moved = mobileTapCandidate.moved || Math.hypot(dx, dy) > MOBILE_TAP_MAX_MOVE_PX;
                const target = event.target;
                const targetElement = target instanceof Element ? target : null;
                const isRenderAreaTap = !!(
                    targetElement &&
                    (
                        targetElement === contentWrapper ||
                        targetElement.closest?.("#content-wrapper")
                    )
                );
                if (!moved && elapsed <= MOBILE_TAP_MAX_DURATION_MS && isRenderAreaTap) {
                    proxyClick("animate");
                    queueTransportSync();
                }
            }
            mobileTapCandidate = null;
        };

        contentWrapper.addEventListener("touchstart", onViewsPinchStart, { passive: false });
        contentWrapper.addEventListener("touchmove", onViewsPinchMove, { passive: false });
        contentWrapper.addEventListener("touchend", clearViewsPinchState, { passive: true });
        contentWrapper.addEventListener("touchcancel", clearViewsPinchState, { passive: true });
    }

    if (mobileViewsFarSideToggle) {
        mobileViewsFarSideToggle.addEventListener("click", function () {
            mobileMoonFarOverlayEnabled = !mobileMoonFarOverlayEnabled;
            mobileViewsFarSideToggle.textContent = mobileMoonFarOverlayEnabled ? "Far Side: ON" : "Far Side: OFF";
            mobileViewsFarSideToggle.classList.toggle("is-active", mobileMoonFarOverlayEnabled);
            mobileViewsFarSideToggle.setAttribute("aria-pressed", mobileMoonFarOverlayEnabled ? "true" : "false");
            if (!mobileMoonFarOverlayEnabled) {
                hideAllMobileMoonFarSideOverlays();
                setMobileMoonOverlayActive(false);
            }
            syncMobileMoonVisibilityInfo({ force: true });
            requestMobileSceneRender();
            window.requestAnimationFrame(() => {
                syncMobileMoonVisibilityInfo({ force: true });
                requestMobileSceneRender();
            });
        });
    }

    if (panelCollapseButton) {
        panelCollapseButton.addEventListener("click", function () {
            if (activeMobileTab === "mission") {
                const collapsed = missionCard?.classList.contains("mobile-shell__card--collapsed");
                setMissionCardCollapsed(!collapsed);
            } else if (activeMobileTab === "views") {
                const collapsed = viewsCard?.classList.contains("mobile-shell__card--collapsed");
                setViewsCardCollapsed(!collapsed);
            }
            applyMobileRenderViewportCentering();
        });
    }

    mobileComposeControlsSync.initialize();

    let initialMissionCollapsed = false;
    try {
        initialMissionCollapsed = window.localStorage?.getItem(MISSION_PANEL_COLLAPSE_STORAGE_KEY) === "true";
    } catch {
        initialMissionCollapsed = false;
    }
    setMissionCardCollapsed(initialMissionCollapsed);

    let initialViewsCollapsed = false;
    try {
        initialViewsCollapsed = window.localStorage?.getItem(VIEWS_PANEL_COLLAPSE_STORAGE_KEY) === "true";
    } catch {
        initialViewsCollapsed = false;
    }
    setViewsCardCollapsed(initialViewsCollapsed);

    setMobileViewsAutoFov(true);
    setActiveMobileTab("mission");
    syncMobilePanelCollapseButton();
    mobileViewPresetSync.syncState();
    syncMobileComposeControls();
    const initialScene = resolveActiveScene();
    if (initialScene?.camera?.fov) {
        updateMobileViewsFovDisplay(initialScene.camera.fov);
    }
    toggleMobileMode();
    startMobileMoonVisibilityLoop();
    syncMobileMoonVisibilityInfo({ force: true });
    applyMobileRenderViewportCentering();
    window.addEventListener("resize", toggleMobileMode);

    bindMobileTransportSync({
        mobileTransportSets,
        dispatchSyntheticPress,
    });

    navButtons.forEach((button) => {
        button.addEventListener("click", function () {
            if (button.disabled) {
                setMissionEventMessage(`${button.textContent.trim()} card coming next`);
                return;
            }
            setMissionEventMessage("");
            setActiveMobileTab(button.dataset.mobileTab || "mission");
        });
    });
}
