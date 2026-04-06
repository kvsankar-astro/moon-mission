import {
    AUXILIARY_VIEW_CAMERA_PRESETS,
    resolveLunarFlybyTimeMs,
    resolveLunarFlybyWindowMs,
} from "../app/auxiliary-camera-views.js";
import { LIGHT_SETTINGS as LT } from "../core/constants.js";

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
        const className = button.className || "";
        const burnFlag = /\bburn\b/i.test(key) || /\bburn\b/i.test(label) || /\bburn\b/i.test(className);
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
let settingsPanelResizeBound = false;
let settingsOutsideClickBound = false;
let shortcutPanelGlobalBound = false;
let controlPanelResizeBound = false;
let timelineDockHeightSyncBound = false;
let timelineCarouselDragBound = false;
let timelineDockResizeObserver = null;
let timelineDockMutationObserver = null;
let settingsAutoCollapsedControls = false;
let timelineCarouselWiggleTimeoutId = null;
const mobileSettingsSectionState = new Map();
const TIMELINE_CAROUSEL_WIGGLE_CLASS = "timeline-dock__event-carousel--wiggle";
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

function resolveSettingsPanelAnchorSelector() {
    const sourceLine = document.querySelector("#blurb .desktoponly");
    const sourceLineVisible = !!(sourceLine && sourceLine.getClientRects().length);
    if (sourceLineVisible && window.innerWidth > 600) {
        return "#blurb .desktoponly";
    }
    return "#settings-panel-button";
}

function isMobileViewport() {
    return window.innerWidth <= 600;
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
    panel.classList.toggle("control-panel--collapsed", collapsed);
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
    const readSettingsPanelOpen = () => {
        const dialogApi = getMissionDialogApi();
        const wrapper = dialogApi?.widgetElement?.("#settings-panel");
        if (wrapper) return getComputedStyle(wrapper).display !== "none";
        const panel = document.getElementById("settings-panel");
        return panel ? getComputedStyle(panel).display !== "none" : false;
    };
    const updateSettingsButtonState = (isOpen) => {
        if (!settingsButton) return;
        settingsButton.setAttribute("aria-expanded", String(isOpen));
        settingsButton.classList.toggle("is-open", isOpen);
    };
    const closeSettingsPanel = (dialogApi) => {
        dialogApi?.close?.("#settings-panel");
        updateSettingsButtonState(false);
        if (settingsAutoCollapsedControls) {
            setControlPanelCollapsedState(false);
            settingsAutoCollapsedControls = false;
        }
    };

    onClick("settings-panel-button", function () {
        const dialogApi = getMissionDialogApi();
        const isOpen = readSettingsPanelOpen();
        if (isOpen) {
            closeSettingsPanel(dialogApi);
            return;
        }

        const options = {
            dialogClass: "dialog settings-dialog",
            modal: false,
            position: {
                my: "left top",
                at: "left bottom",
                of: resolveSettingsPanelAnchorSelector(),
                collision: "fit flip"
            },
            title: "Settings",
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
            wrapper.style.maxWidth = window.innerWidth <= 600 ? "92vw" : "80%";
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
                if (!readSettingsPanelOpen()) return;
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
                if (!readSettingsPanelOpen()) return;
                const dialogWrapper = dialogApi?.widgetElement?.("#settings-panel");
                if (dialogWrapper && dialogWrapper.contains(event.target)) return;
                if (settingsButton && settingsButton.contains(event.target)) return;
                closeSettingsPanel(dialogApi);
            });
        }

        updateSettingsButtonState(true);
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
        togglePlane,
        setView,
        setDimensionTop,
        toggleAnimation,
        // Legacy compatibility while callers migrate.
        cy3Animate,
        toggleJoyRide,
        toggleLanding,
        toggleInfo
    } = handlers;
    const bodyHaloToggle = typeof document !== "undefined"
        ? document.getElementById("view-body-halos")
        : null;
    const locatorsPill = typeof document !== "undefined"
        ? document.getElementById("locators-pill")
        : null;

    const syncLocatorsPillState = () => {
        if (!locatorsPill || !bodyHaloToggle) return;
        locatorsPill.setAttribute("aria-pressed", bodyHaloToggle.checked ? "true" : "false");
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
    const setViewAndSyncLocators = (event) => {
        enforceMobileLocatorTabPolicy();
        setView(event);
        syncLocatorsPillState();
    };

    onClick("reset", reset);

    onClick("origin-earth", toggleMode);
    onClick("origin-moon", toggleMode);
    onClick("origin-relative", toggleRelativeMode);
    onChange("camera-position", changeCameraFromTo);
    onChange("camera-look", changeCameraFromTo);
    onChangeAll('input[name="camera-position-pill"]', changeCameraFromTo);
    onChangeAll('input[name="camera-look-pill"]', changeCameraFromTo);
    onChange("camera-fov-one-degree", changeCameraFromTo);

    onClick("checkbox-lock-default", togglePlane);
    onClick("checkbox-lock-xy", togglePlane);
    onClick("checkbox-lock-zx", togglePlane);
    onClick("checkbox-lock-yz", togglePlane);

    onClick("checkbox-lock-xy-minus", togglePlane);
    onClick("checkbox-lock-zx-minus", togglePlane);
    onClick("checkbox-lock-yz-minus", togglePlane);

    onClick("view-orbit", setView);
    onClick("view-orbit-descent", setView);
    onClick("view-additional-crafts", setView);
    onClick("view-aux-camera-panels", setView);
    onChange("active-craft-select", setView);
    onClick("view-craters", setView);
    onClick("view-xyz-axes", setView);
    onClick("view-poles", setView);
    onClick("view-polar-axes", setView);
    onClick("view-sky", setView);
    onClick("view-constellation-lines", setView);
    onClick("view-moonsoi", setView);
    onClick("view-body-halos", setViewAndSyncLocators);
    onClick("view-moon-osculating-orbit", setView);
    onClick("view-eclipticplane", setView);
    onClick("view-equatorialplane", setView);
    onClick("view-fps", setView);
    onChange("orbit-style-classic", setView);
    onChange("orbit-style-trail", setView);
    onInput("trail-track-brightness-2d", setView);
    onInput("trail-track-brightness-3d", setView);
    onInput("trail-tail-brightness-2d", setView);
    onInput("trail-tail-brightness-3d", setView);

    onClick("dimension-2D", setDimensionTop);
    onClick("dimension-3D", setDimensionTop);

    const animateHandler = typeof toggleAnimation === "function" ? toggleAnimation : cy3Animate;
    if (typeof animateHandler === "function") {
        onClick("animate", animateHandler);
    }
    onClick("joyride", toggleJoyRide);
    onClick("joyridebutton", toggleJoyRide);
    onClick("landing", toggleLanding);
    onClick("landingbutton", toggleLanding);

    onClick("info-button", toggleInfo);
    onClick("locators-pill", function () {
        if (!bodyHaloToggle) return;
        bodyHaloToggle.checked = !bodyHaloToggle.checked;
        setViewAndSyncLocators();
    });
    syncLocatorsPillState();
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
    const missionCollapseButton = document.getElementById("mobile-mission-collapse");
    const viewsCard = document.getElementById("mobile-card-views");
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
    const mobileShellNav = shell.querySelector(".mobile-shell__nav");
    const navButtons = document.querySelectorAll(".mobile-shell__nav-btn");
    const composeNavButton = shell.querySelector('.mobile-shell__nav-btn[data-mobile-tab="compose"]');
    const desktopPosition = document.getElementById("camera-position");
    const desktopLook = document.getElementById("camera-look");
    const desktopPlay = document.getElementById("animate");
    const desktopNow = document.getElementById("missionnow");
    const desktopSlower = document.getElementById("slower");
    const desktopFaster = document.getElementById("faster");
    const desktopSpeed = document.getElementById("realtime");
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
    const EARTHSHINE_GAIN_STORAGE_KEY = "moon-mission:mobile-earthshine-gain:v1";
    const COMPOSE_TIMELINE_RESOLUTION = 1000;
    const COMPOSE_TIMELINE_WINDOW_MS = 2 * 60 * 60 * 1000;
    const EARTHSHINE_GAIN_MIN = 0;
    const EARTHSHINE_GAIN_MAX = 2.4;
    const EARTHSHINE_BASE_INTENSITY = Number.isFinite(LT.EARTHSHINE_INTENSITY)
        ? LT.EARTHSHINE_INTENSITY
        : 0.08;
    const EARTHSHINE_BASE_MIN = Number.isFinite(LT.EARTHSHINE_MIN_INTENSITY)
        ? LT.EARTHSHINE_MIN_INTENSITY
        : 0.015;
    const EARTHSHINE_BASE_MAX = Number.isFinite(LT.EARTHSHINE_MAX_INTENSITY)
        ? LT.EARTHSHINE_MAX_INTENSITY
        : 0.08;
    const COMPOSE_DEFAULT_FOV = 110;
    let activeMobileTab = "mission";
    let activeMobileViewPresetId = "moon";
    let activeMobileComposeLockPresetId = "free";
    let mobileViewsAutoFovEnabled = true;
    const radiusByObject = new WeakMap();
    const AUTO_FOV_MARGIN_SCALE = 1.03;
    const MIN_FOV = 1;
    const MAX_FOV = 179;
    let mobileViewsPresetInitialized = false;
    let mobileViewsSavedViewState = null;
    let mobileAlwaysSuppressedViewState = null;
    let mobileSavedMissionCameraModes = null;
    let mobileAutoFovScheduleToken = 0;
    let mobileViewPresetEnforceInProgress = false;
    let mobileMoonFarOverlayEnabled = true;
    let mobileMoonOverlayLastUpdateMs = -Infinity;
    let mobileMoonOverlayLoopHandle = null;
    let mobileMoonOverlayCtx = null;
    let mobileViewsPinchState = null;
    let mobileMoonVisibilitySignature = "";
    let composeTimelineWindowStartMs = Number.NaN;
    let composeTimelineWindowEndMs = Number.NaN;
    let composeTimelineDragging = false;
    let mobileEarthshineGain = 1;
    let mobileComposeHiddenCraftState = null;
    let mobileComposeRollRad = (250 * Math.PI) / 180;
    let mobileComposeFreeStartupAligned = false;
    let mobileComposeDefaultFovApplied = false;
    let mobileMissionLocatorBaseline = null;
    const MOBILE_MOON_OVERLAY_UPDATE_INTERVAL_MS = 180;
    const moonVisibilitySamples = createFibonacciSphereSamples(240);
    const MOBILE_ALWAYS_SUPPRESSED_VIEW_IDS = [
        "view-aux-camera-panels",
    ];
    const MOBILE_VIEWS_SUPPRESSED_VIEW_IDS = [
        "view-orbit",
        "view-orbit-descent",
        "view-additional-crafts",
        "view-aux-camera-panels",
        "view-body-halos",
        "view-craters",
        "view-xyz-axes",
        "view-poles",
        "view-polar-axes",
        "view-sky",
        "view-constellation-lines",
        "view-moonsoi",
        "view-moon-osculating-orbit",
        "view-eclipticplane",
        "view-equatorialplane",
    ];
    // Hotfix gate: keep mobile Earthrise UI disabled in production until feature completion.
    const MOBILE_EARTHRISE_ENABLED = false;
    const composeFeatureEnabled = (() => {
        if (!MOBILE_EARTHRISE_ENABLED) return false;
        const dataPath = String(window?.missionConfig?.dataPath || "").toLowerCase();
        return dataPath.includes("/artemis2/") || dataPath.includes("\\artemis2\\");
    })();
    const isViewsVisualSimplificationTab = (tabName) => tabName === "views" || tabName === "compose";

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
            const settingsButton = document.getElementById("settings-panel-button");
            if (settingsButton) {
                settingsButton.setAttribute("aria-expanded", "false");
                settingsButton.classList.remove("is-open");
            }
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
            syncMobileComposePresentation();
        }
    };

    const setMissionCardCollapsed = (collapsed) => {
        if (!missionCard || !missionCardBody || !missionCollapseButton) return;
        missionCard.classList.toggle("mobile-shell__card--collapsed", !!collapsed);
        missionCollapseButton.textContent = collapsed ? "▾" : "▴";
        missionCollapseButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
        missionCollapseButton.setAttribute(
            "aria-label",
            collapsed ? "Expand mission panel" : "Collapse mission panel",
        );
        missionCollapseButton.title = collapsed ? "Expand mission panel" : "Collapse mission panel";
        try {
            window.localStorage?.setItem(MISSION_PANEL_COLLAPSE_STORAGE_KEY, collapsed ? "true" : "false");
        } catch {
            // Ignore localStorage failures.
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
        const bodyMeshRadius = resolveBodyMeshRadius(scene, mode);
        if (Number.isFinite(bodyMeshRadius) && bodyMeshRadius > 0) {
            return bodyMeshRadius;
        }
        const primary = String(scene?.primaryBody || "").toUpperCase();
        const secondary = String(scene?.secondaryBody || "").toUpperCase();
        if (mode === "EARTH") {
            if (primary === "EARTH" && Number.isFinite(scene?.primaryBodyRadius)) return scene.primaryBodyRadius;
            if (secondary === "EARTH" && Number.isFinite(scene?.secondaryBodyRadius)) return scene.secondaryBodyRadius;
        }
        if (mode === "MOON") {
            if (primary === "MOON" && Number.isFinite(scene?.primaryBodyRadius)) return scene.primaryBodyRadius;
            if (secondary === "MOON" && Number.isFinite(scene?.secondaryBodyRadius)) return scene.secondaryBodyRadius;
        }
        return estimateObjectRadius(targetObject, 1);
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
            syncMobileComposePresentation();
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
        if (Math.abs((scene.camera.fov || 0) - autoFov) < 0.15) {
            updateMobileViewsFovDisplay(scene.camera.fov);
            return false;
        }
        return applyMobileViewsFov(autoFov);
    };

    const scheduleAutoFovApply = () => {
        if (!mobileViewsAutoFovEnabled) return;
        const token = ++mobileAutoFovScheduleToken;
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                if (token !== mobileAutoFovScheduleToken) return;
                applyAutoFovForActivePreset();
            });
        });
    };

    const clampEarthshineGain = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 1;
        return Math.min(EARTHSHINE_GAIN_MAX, Math.max(EARTHSHINE_GAIN_MIN, numeric));
    };

    const updateMobileComposeEarthshineDisplay = (value) => {
        const gain = clampEarthshineGain(value);
        if (mobileComposeEarthshineSlider) {
            mobileComposeEarthshineSlider.value = String(gain.toFixed(2));
        }
        if (mobileComposeEarthshineValue) {
            const text = `${gain.toFixed(2)}`;
            mobileComposeEarthshineValue.value = text;
            mobileComposeEarthshineValue.textContent = text;
        }
    };

    const applyMobileComposeEarthshineGain = (value, { persist = true } = {}) => {
        const gain = clampEarthshineGain(value);
        mobileEarthshineGain = gain;
        LT.EARTHSHINE_INTENSITY = EARTHSHINE_BASE_INTENSITY * gain;
        LT.EARTHSHINE_MIN_INTENSITY = EARTHSHINE_BASE_MIN * gain;
        LT.EARTHSHINE_MAX_INTENSITY = EARTHSHINE_BASE_MAX * gain;
        updateMobileComposeEarthshineDisplay(gain);
        if (persist) {
            try {
                window.localStorage?.setItem(EARTHSHINE_GAIN_STORAGE_KEY, String(gain));
            } catch {
                // Ignore localStorage write failures.
            }
        }
    };

    const readMainTimelineState = () => {
        const slider = document.getElementById("timeline-slider");
        if (!(slider instanceof HTMLInputElement)) return null;
        const min = Number(slider.min);
        const max = Number(slider.max);
        const value = Number(slider.value);
        if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(value)) return null;
        return {
            slider,
            min: Math.min(min, max),
            max: Math.max(min, max),
            value: Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max)),
        };
    };

    const seekMainTimelineTime = (timeMs, finalize = false) => {
        const timelineState = readMainTimelineState();
        if (!timelineState) return;
        const clamped = Math.min(Math.max(timeMs, timelineState.min), timelineState.max);
        timelineState.slider.value = String(clamped);
        timelineState.slider.dispatchEvent(new Event("input", { bubbles: true }));
        if (finalize) {
            timelineState.slider.dispatchEvent(new Event("change", { bubbles: true }));
        }
    };

    const resolveComposeTimelineRangeMs = (timelineState) => {
        const eventInfos = extractTimelineEventMetadataFromButtons();
        const flybyWindow = resolveLunarFlybyWindowMs(eventInfos);
        if (
            Number.isFinite(flybyWindow.startMs) &&
            Number.isFinite(flybyWindow.endMs) &&
            flybyWindow.endMs > flybyWindow.startMs
        ) {
            let startMs = Math.min(Math.max(flybyWindow.startMs, timelineState.min), timelineState.max);
            let endMs = Math.min(Math.max(flybyWindow.endMs, timelineState.min), timelineState.max);
            if (endMs <= startMs) {
                endMs = Math.min(timelineState.max, startMs + 1);
            }
            return { startMs, endMs };
        }

        const flybyTimeMs = resolveLunarFlybyTimeMs(eventInfos);
        const anchorMs = Number.isFinite(flybyTimeMs) ? flybyTimeMs : timelineState.value;
        const fullSpan = Math.max(0, timelineState.max - timelineState.min);
        const windowSpan = Math.min(fullSpan, COMPOSE_TIMELINE_WINDOW_MS);
        const halfSpan = windowSpan * 0.5;
        let startMs = anchorMs - halfSpan;
        let endMs = anchorMs + halfSpan;
        if (startMs < timelineState.min) {
            endMs += timelineState.min - startMs;
            startMs = timelineState.min;
        }
        if (endMs > timelineState.max) {
            startMs -= endMs - timelineState.max;
            endMs = timelineState.max;
        }
        startMs = Math.max(timelineState.min, startMs);
        endMs = Math.min(timelineState.max, endMs);
        if (endMs <= startMs) {
            endMs = Math.min(timelineState.max, startMs + 1);
        }
        return { startMs, endMs };
    };

    const normalizeComposeRoll = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        const twoPi = Math.PI * 2;
        return ((numeric % twoPi) + twoPi) % twoPi;
    };

    const formatComposeRollLabel = (degrees) => {
        const normalized = ((Math.round(degrees) % 360) + 360) % 360;
        if (normalized === 0) return `N ${normalized}\u00b0`;
        if (normalized === 90) return `E ${normalized}\u00b0`;
        if (normalized === 180) return `S ${normalized}\u00b0`;
        if (normalized === 270) return `W ${normalized}\u00b0`;
        return `${normalized}\u00b0`;
    };

    const syncMobileComposeRollSliderUi = () => {
        if (!mobileComposeRollSlider) return;
        mobileComposeRollRad = normalizeComposeRoll(mobileComposeRollRad);
        const degreesNormalized = (((mobileComposeRollRad * 180) / Math.PI) % 360 + 360) % 360;
        const rounded = Math.round(degreesNormalized) % 360;
        mobileComposeRollSlider.value = String(rounded);
        if (mobileComposeRollValue) {
            const label = formatComposeRollLabel(rounded);
            mobileComposeRollValue.value = label;
            mobileComposeRollValue.textContent = label;
        }
    };

    const resolveComposeLookTarget = (scene, controller) => {
        const camera = scene?.camera;
        if (!camera?.position?.clone) return null;
        const lookMode = (controller?.lookMode || desktopLook?.value || "manual").trim();
        if (lookMode === "earth" || lookMode === "moon" || lookMode === "spacecraft") {
            const targetObject = resolveSceneObject(scene, lookMode);
            if (targetObject?.getWorldPosition) {
                const target = camera.position.clone();
                targetObject.getWorldPosition(target);
                return target;
            }
        }
        if (controller?.controls?.target?.clone) {
            return controller.controls.target.clone();
        }
        if (camera.getWorldDirection) {
            const target = camera.position.clone();
            const viewDir = camera.position.clone();
            camera.getWorldDirection(viewDir);
            return target.add(viewDir);
        }
        return null;
    };

    const applyMobileComposeRoll = () => {
        if (!shouldUseEarthrisePresentation()) return;
        const scene = resolveActiveScene();
        const controller = scene?.cameraController;
        controller?.setMountedManualRollRad?.(mobileComposeRollRad);
        const camera = scene?.camera;
        if (!camera?.position?.clone) return;

        const lookTarget = resolveComposeLookTarget(scene, controller);
        if (!lookTarget?.clone) return;

        const viewDir = lookTarget.clone().sub(camera.position);
        if (viewDir.lengthSq?.() <= 1e-12) return;
        viewDir.normalize();

        const baseUp = camera.position.clone().set(0, 0, 1);
        baseUp.sub(viewDir.clone().multiplyScalar(baseUp.dot(viewDir)));
        if (baseUp.lengthSq() <= 1e-10) {
            baseUp.set(0, 1, 0);
            baseUp.sub(viewDir.clone().multiplyScalar(baseUp.dot(viewDir)));
        }
        if (baseUp.lengthSq() <= 1e-10) {
            baseUp.set(1, 0, 0);
            baseUp.sub(viewDir.clone().multiplyScalar(baseUp.dot(viewDir)));
        }
        if (baseUp.lengthSq() <= 1e-10) return;

        const rolledUp = baseUp.normalize().applyAxisAngle(viewDir, mobileComposeRollRad).normalize();
        camera.up.copy(rolledUp);
        camera.lookAt(lookTarget);
        if (controller?.controls?.target?.copy) {
            controller.controls.target.copy(lookTarget);
        }
    };

    const shouldUseEarthrisePresentation = () => (
        composeFeatureEnabled &&
        isMobileViewport() &&
        activeMobileTab === "compose"
    );

    const restoreComposeCraftVisibility = () => {
        if (!mobileComposeHiddenCraftState?.craft) return;
        try {
            mobileComposeHiddenCraftState.craft.visible = mobileComposeHiddenCraftState.wasVisible;
        } catch {
            // Ignore stale object graph state.
        }
        mobileComposeHiddenCraftState = null;
    };

    const hideComposeCraft = () => {
        const scene = resolveActiveScene();
        const craft = resolveActiveCraft(scene);
        if (!craft) {
            restoreComposeCraftVisibility();
            return;
        }
        const existingCraft = mobileComposeHiddenCraftState?.craft || null;
        if (existingCraft && existingCraft !== craft) {
            restoreComposeCraftVisibility();
        }
        if (!mobileComposeHiddenCraftState || mobileComposeHiddenCraftState.craft !== craft) {
            mobileComposeHiddenCraftState = {
                craft,
                wasVisible: craft.visible !== false,
            };
        }
        craft.visible = false;
    };

    const enforceComposeCameraAtCraftCenter = () => {
        if (!shouldUseEarthrisePresentation()) return;
        const scene = resolveActiveScene();
        const controller = scene?.cameraController;
        if (!controller?.mountOffset?.set) return;
        if (controller.positionMode !== "spacecraft") return;
        controller.mountOffset.set(0, 0, 0);
    };

    const alignMobileComposeFreeLookToEarth = () => {
        if (!shouldUseEarthrisePresentation()) return false;
        const scene = resolveActiveScene();
        const controller = scene?.cameraController;
        const camera = scene?.camera;
        const earthObject = resolveSceneObject(scene, "earth");
        if (!camera?.position?.clone || !camera.lookAt || !earthObject?.getWorldPosition) {
            return false;
        }
        const target = camera.position.clone();
        earthObject.getWorldPosition(target);
        const view = target.clone().sub(camera.position);
        if (view.lengthSq?.() <= 1e-12) {
            return false;
        }
        camera.lookAt(target);
        if (controller?.controls?.target?.copy) {
            controller.controls.target.copy(target);
        }
        if (!controller?._freeFlyActive) {
            controller?.controls?.update?.();
            controller?.controls?.dispatchEvent?.({ type: "change" });
        }
        return true;
    };

    const syncMobileComposePresentation = () => {
        if (!shouldUseEarthrisePresentation()) {
            restoreComposeCraftVisibility();
            return;
        }
        hideComposeCraft();
        enforceComposeCameraAtCraftCenter();
        applyMobileComposeRoll();
        syncMobileComposeRollSliderUi();
    };

    const syncMobileComposeLockPresetState = () => {
        if (!desktopPosition || !desktopLook || !mobileComposeLockButtons.length) return;
        const positionMode = (desktopPosition.value || "").trim();
        const lookMode = (desktopLook.value || "").trim();
        let matchedPresetId = null;

        mobileComposeLockButtons.forEach((button) => {
            const presetId = button.dataset.mobileComposeLock || "";
            const preset = mobileComposePresetById.get(presetId);
            const isActive = !!preset &&
                preset.positionMode === positionMode &&
                preset.lookMode === lookMode;
            if (isActive) matchedPresetId = presetId;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        if (!matchedPresetId) {
            matchedPresetId = mobileComposePresetById.has(activeMobileComposeLockPresetId)
                ? activeMobileComposeLockPresetId
                : "free";
            mobileComposeLockButtons.forEach((button) => {
                const isActive = (button.dataset.mobileComposeLock || "") === matchedPresetId;
                button.classList.toggle("is-active", isActive);
                button.setAttribute("aria-selected", isActive ? "true" : "false");
            });
        }

        activeMobileComposeLockPresetId = matchedPresetId;
    };

    const applyMobileComposeLockPreset = (presetId) => {
        if (!desktopPosition || !desktopLook) return;
        const preset = mobileComposePresetById.get(presetId);
        if (!preset) return;
        const scene = resolveActiveScene();
        scene?.cameraController?.mountOffset?.set?.(0, 0, 0);
        activeMobileComposeLockPresetId = presetId;
        desktopPosition.value = preset.positionMode;
        desktopLook.value = preset.lookMode;
        desktopPosition.dispatchEvent(new Event("change", { bubbles: true }));
        syncMobileComposeLockPresetState();
        syncMobileComposePresentation();
    };

    const syncMobileComposeTimelineWindow = ({ finalize = false } = {}) => {
        const timelineState = readMainTimelineState();
        if (!timelineState || !mobileComposeTimelineSlider) {
            if (mobileComposeTimelineValue) {
                mobileComposeTimelineValue.textContent = "--";
                mobileComposeTimelineValue.value = "--";
            }
            if (mobileComposeTimelineLocal) {
                mobileComposeTimelineLocal.textContent = "Local: --";
            }
            return;
        }

        const { startMs, endMs } = resolveComposeTimelineRangeMs(timelineState);
        composeTimelineWindowStartMs = startMs;
        composeTimelineWindowEndMs = endMs;

        if (!composeTimelineDragging) {
            const ratio = Math.min(
                1,
                Math.max(0, (timelineState.value - startMs) / Math.max(endMs - startMs, 1)),
            );
            mobileComposeTimelineSlider.value = String(Math.round(ratio * COMPOSE_TIMELINE_RESOLUTION));
        }

        if (mobileComposeTimelineValue) {
            const utcText = new Date(timelineState.value).toUTCString();
            mobileComposeTimelineValue.value = utcText;
            mobileComposeTimelineValue.textContent = utcText;
        }
        if (mobileComposeTimelineLocal) {
            mobileComposeTimelineLocal.textContent = `Local: ${formatLocalDateTimeShort(timelineState.value)}`;
        }

        if (finalize) {
            seekMainTimelineTime(timelineState.value, true);
        }
    };

    const syncMobileComposeControls = () => {
        if (shouldUseEarthrisePresentation() && desktopPosition && desktopLook) {
            const desiredPreset = mobileComposePresetById.get(activeMobileComposeLockPresetId) || mobileComposePresetById.get("free");
            if (
                desiredPreset &&
                (desktopPosition.value !== desiredPreset.positionMode || desktopLook.value !== desiredPreset.lookMode)
            ) {
                desktopPosition.value = desiredPreset.positionMode;
                desktopLook.value = desiredPreset.lookMode;
                desktopPosition.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }
        syncMobileComposeLockPresetState();
        if (
            shouldUseEarthrisePresentation() &&
            !mobileComposeFreeStartupAligned &&
            activeMobileComposeLockPresetId === "free"
        ) {
            mobileComposeFreeStartupAligned = alignMobileComposeFreeLookToEarth();
        }
        syncMobileComposeTimelineWindow();
        updateMobileComposeEarthshineDisplay(mobileEarthshineGain);
        syncMobileComposeRollSliderUi();
        syncMobileComposePresentation();
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
                applyMobileViewPreset(activeMobileViewPresetId);
                mobileViewsPresetInitialized = true;
            }
            syncMobileViewPresetState();
            if (mobileViewsAutoFovEnabled) {
                scheduleAutoFovApply();
            } else {
                const scene = resolveActiveScene();
                if (scene?.camera?.fov) {
                    updateMobileViewsFovDisplay(scene.camera.fov);
                }
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
                scheduleAutoFovApply();
            } else {
                const scene = resolveActiveScene();
                if (scene?.camera?.fov) {
                    updateMobileViewsFovDisplay(scene.camera.fov);
                }
            }
            stopMobileMoonVisibilityLoop();
            syncMobileMoonVisibilityInfo({ force: true });
        } else if (previousTab === "views" && mobileViewport) {
            syncMobileMoonVisibilityInfo({ force: true });
        } else if (previousTab === "compose" && mobileViewport) {
            syncMobileMoonVisibilityInfo({ force: true });
        }
        syncMobileComposePresentation();
    };

    const syncMobileViewPresetState = () => {
        if (!desktopPosition || !desktopLook || !mobileViewButtons.length) return;
        const positionMode = (desktopPosition.value || "").trim();
        const lookMode = (desktopLook.value || "").trim();
        let matchedPresetId = null;

        mobileViewButtons.forEach((button) => {
            const presetId = button.dataset.mobileViewPreset || "";
            const preset = mobileViewPresetById.get(presetId);
            const isActive = !!preset &&
                preset.positionMode === positionMode &&
                preset.lookMode === lookMode;
            if (isActive) {
                matchedPresetId = presetId;
            }
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        if (matchedPresetId) {
            activeMobileViewPresetId = matchedPresetId;
            return;
        }

        const fallbackPresetId = mobileViewPresetById.has(activeMobileViewPresetId)
            ? activeMobileViewPresetId
            : (mobileViewButtons[0]?.dataset.mobileViewPreset || "");
        if (!fallbackPresetId) return;

        activeMobileViewPresetId = fallbackPresetId;

        // Keep exactly one mobile Views preset selected at all times.
        mobileViewButtons.forEach((button) => {
            const isActive = (button.dataset.mobileViewPreset || "") === fallbackPresetId;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        const fallbackPreset = mobileViewPresetById.get(fallbackPresetId);
        const shouldApplyFallback = (
            !mobileViewPresetEnforceInProgress &&
            isMobileViewport() &&
            activeMobileTab === "views" &&
            !!fallbackPreset &&
            (desktopPosition.value !== fallbackPreset.positionMode || desktopLook.value !== fallbackPreset.lookMode)
        );

        if (!shouldApplyFallback) return;

        mobileViewPresetEnforceInProgress = true;
        try {
            applyMobileViewPreset(fallbackPresetId);
        } finally {
            mobileViewPresetEnforceInProgress = false;
        }
        syncMobileMoonVisibilityInfo({ force: true });
    };

    const applyMobileViewPreset = (presetId) => {
        if (!desktopPosition || !desktopLook) return;
        const preset = mobileViewPresetById.get(presetId);
        if (!preset) return;

        activeMobileViewPresetId = presetId;
        desktopPosition.value = preset.positionMode;
        desktopLook.value = preset.lookMode;
        desktopPosition.dispatchEvent(new Event("change", { bubbles: true }));
        syncMobileMoonVisibilityInfo({ force: true });
    };

    if (mobileViewButtons.length) {
        mobileViewButtons.forEach((button) => {
            button.addEventListener("click", function () {
                const presetId = button.dataset.mobileViewPreset || "";
                applyMobileViewPreset(presetId);
                syncMobileViewPresetState();
                if (mobileViewsAutoFovEnabled) {
                    scheduleAutoFovApply();
                }
            });
        });
    }

    if (mobileComposeLockButtons.length) {
        mobileComposeLockButtons.forEach((button) => {
            button.addEventListener("click", function () {
                const presetId = button.dataset.mobileComposeLock || "free";
                applyMobileComposeLockPreset(presetId);
                syncMobileComposeTimelineWindow();
            });
        });
    }

    if (desktopPosition) {
        desktopPosition.addEventListener("change", () => {
            syncMobileViewPresetState();
            syncMobileComposeLockPresetState();
            syncMobileComposePresentation();
            if (mobileViewsAutoFovEnabled && (activeMobileTab === "views" || activeMobileTab === "compose")) {
                scheduleAutoFovApply();
            }
            if (activeMobileTab === "compose") {
                syncMobileComposeTimelineWindow();
            }
            syncMobileMoonVisibilityInfo({ force: true });
        });
    }
    if (desktopLook) {
        desktopLook.addEventListener("change", () => {
            syncMobileViewPresetState();
            syncMobileComposeLockPresetState();
            syncMobileComposePresentation();
            if (mobileViewsAutoFovEnabled && (activeMobileTab === "views" || activeMobileTab === "compose")) {
                scheduleAutoFovApply();
            }
            if (activeMobileTab === "compose") {
                syncMobileComposeTimelineWindow();
            }
            syncMobileMoonVisibilityInfo({ force: true });
        });
    }

    if (mobileViewsFovAuto) {
        mobileViewsFovAuto.addEventListener("click", function () {
            setMobileViewsAutoFov(!mobileViewsAutoFovEnabled);
            if (mobileViewsAutoFovEnabled) {
                scheduleAutoFovApply();
            }
            syncMobileMoonVisibilityInfo({ force: true });
        });
    }
    if (mobileComposeFovAuto) {
        mobileComposeFovAuto.addEventListener("click", function () {
            setMobileViewsAutoFov(!mobileViewsAutoFovEnabled);
            if (mobileViewsAutoFovEnabled) {
                scheduleAutoFovApply();
            }
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

    if (mobileComposeTimelineSlider) {
        const onComposeTimelineInput = () => {
            const startMs = composeTimelineWindowStartMs;
            const endMs = composeTimelineWindowEndMs;
            if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
                return;
            }
            composeTimelineDragging = true;
            const sliderValue = Number(mobileComposeTimelineSlider.value);
            const ratio = Math.min(
                1,
                Math.max(0, sliderValue / COMPOSE_TIMELINE_RESOLUTION),
            );
            const nextTimeMs = startMs + (endMs - startMs) * ratio;
            seekMainTimelineTime(nextTimeMs, false);
            syncMobileComposeTimelineWindow();
        };
        const onComposeTimelineFinalize = () => {
            composeTimelineDragging = false;
            const startMs = composeTimelineWindowStartMs;
            const endMs = composeTimelineWindowEndMs;
            if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
                return;
            }
            const sliderValue = Number(mobileComposeTimelineSlider.value);
            const ratio = Math.min(
                1,
                Math.max(0, sliderValue / COMPOSE_TIMELINE_RESOLUTION),
            );
            const nextTimeMs = startMs + (endMs - startMs) * ratio;
            seekMainTimelineTime(nextTimeMs, true);
            syncMobileComposeTimelineWindow();
        };
        mobileComposeTimelineSlider.addEventListener("input", onComposeTimelineInput, { passive: true });
        mobileComposeTimelineSlider.addEventListener("pointerdown", () => {
            composeTimelineDragging = true;
        });
        mobileComposeTimelineSlider.addEventListener("pointerup", onComposeTimelineFinalize);
        mobileComposeTimelineSlider.addEventListener("change", onComposeTimelineFinalize);
    }

    if (mobileComposeEarthshineSlider) {
        const onComposeEarthshineInput = () => {
            applyMobileComposeEarthshineGain(mobileComposeEarthshineSlider.value, { persist: true });
        };
        mobileComposeEarthshineSlider.addEventListener("input", onComposeEarthshineInput, { passive: true });
        mobileComposeEarthshineSlider.addEventListener("change", onComposeEarthshineInput);
    }

    if (mobileComposeRollSlider) {
        const onComposeRollInput = () => {
            const degrees = Number(mobileComposeRollSlider.value);
            if (!Number.isFinite(degrees)) return;
            mobileComposeRollRad = normalizeComposeRoll((degrees * Math.PI) / 180);
            syncMobileComposeRollSliderUi();
            applyMobileComposeRoll();
        };
        mobileComposeRollSlider.addEventListener("input", onComposeRollInput, { passive: true });
        mobileComposeRollSlider.addEventListener("change", onComposeRollInput);
    }

    const timelineSlider = document.getElementById("timeline-slider");
    if (timelineSlider) {
        const syncComposeFromTimeline = () => {
            if (activeMobileTab === "compose") {
                syncMobileComposeTimelineWindow();
            }
        };
        timelineSlider.addEventListener("input", syncComposeFromTimeline);
        timelineSlider.addEventListener("change", syncComposeFromTimeline);
    }

    const burnButtonsHost = document.getElementById("burnbuttons");
    if (burnButtonsHost) {
        const burnButtonsObserver = new MutationObserver(() => {
            if (activeMobileTab === "compose") {
                syncMobileComposeTimelineWindow();
            }
        });
        burnButtonsObserver.observe(burnButtonsHost, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["data-event-time-ms", "data-event-key", "title"],
        });
    }

    if (contentWrapper) {
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
                syncMobileComposePresentation();
            }
            syncMobileMoonVisibilityInfo();
            event.preventDefault();
        };

        const clearViewsPinchState = () => {
            mobileViewsPinchState = null;
        };

        contentWrapper.addEventListener("touchstart", onViewsPinchStart, { passive: false });
        contentWrapper.addEventListener("touchmove", onViewsPinchMove, { passive: false });
        contentWrapper.addEventListener("touchend", clearViewsPinchState, { passive: true });
        contentWrapper.addEventListener("touchcancel", clearViewsPinchState, { passive: true });
    }

    if (mobileViewsFarSideToggle) {
        mobileViewsFarSideToggle.addEventListener("click", function () {
            mobileMoonFarOverlayEnabled = !mobileMoonFarOverlayEnabled;
            syncMobileMoonVisibilityInfo({ force: true });
        });
    }

    if (missionCollapseButton) {
        missionCollapseButton.addEventListener("click", function () {
            const collapsed = missionCard?.classList.contains("mobile-shell__card--collapsed");
            setMissionCardCollapsed(!collapsed);
        });
    }

    let initialEarthshineGain = 1;
    try {
        const storedGain = Number(window.localStorage?.getItem(EARTHSHINE_GAIN_STORAGE_KEY));
        if (Number.isFinite(storedGain)) {
            initialEarthshineGain = storedGain;
        }
    } catch {
        initialEarthshineGain = 1;
    }
    applyMobileComposeEarthshineGain(initialEarthshineGain, { persist: false });

    let initialMissionCollapsed = false;
    try {
        initialMissionCollapsed = window.localStorage?.getItem(MISSION_PANEL_COLLAPSE_STORAGE_KEY) === "true";
    } catch {
        initialMissionCollapsed = false;
    }
    setMissionCardCollapsed(initialMissionCollapsed);

    setMobileViewsAutoFov(true);
    setActiveMobileTab("mission");
    syncMobileViewPresetState();
    syncMobileComposeControls();
    const initialScene = resolveActiveScene();
    if (initialScene?.camera?.fov) {
        updateMobileViewsFovDisplay(initialScene.camera.fov);
    }
    toggleMobileMode();
    startMobileMoonVisibilityLoop();
    syncMobileMoonVisibilityInfo({ force: true });
    window.addEventListener("resize", toggleMobileMode);

    const proxyClick = (desktopId) => {
        const target = document.getElementById(desktopId);
        if (!target || target.disabled) return;
        target.click();
    };

    const proxyPress = (desktopId) => {
        const target = document.getElementById(desktopId);
        if (!target || target.disabled) return;
        dispatchSyntheticPress(target, "touch");
    };

    const queueTransportSync = () => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                syncTransportState();
            });
        });
    };

    mobileTransportSets.forEach((set) => {
        if (set.play) {
            set.play.addEventListener("click", function () {
                proxyClick("animate");
                queueTransportSync();
            });
        }
        if (set.now) {
            set.now.addEventListener("click", function () {
                proxyClick("missionnow");
                queueTransportSync();
            });
        }
        if (set.slower) {
            set.slower.addEventListener("click", function () {
                proxyPress("slower");
                queueTransportSync();
            });
        }
        if (set.faster) {
            set.faster.addEventListener("click", function () {
                proxyPress("faster");
                queueTransportSync();
            });
        }
        if (set.speed) {
            set.speed.addEventListener("click", function () {
                proxyPress("realtime");
                queueTransportSync();
            });
        }
    });

    const syncTransportState = () => {
        mobileTransportSets.forEach((set) => {
            if (set.play && desktopPlay) {
                const isPlaying = (desktopPlay.textContent || "").trim().toLowerCase() === "pause";
                set.play.textContent = isPlaying ? "Pause" : "Play";
                set.play.classList.toggle("is-active", isPlaying);
            }
            if (set.now && desktopNow) {
                set.now.textContent = (desktopNow.textContent || "").trim() || "Now";
                set.now.title = desktopNow.title || "Jump to current time";
                set.now.setAttribute(
                    "aria-label",
                    desktopNow.getAttribute("aria-label") || "Jump to current time",
                );
                set.now.disabled = !!desktopNow.disabled;
                set.now.setAttribute("aria-disabled", desktopNow.disabled ? "true" : "false");
            }
            if (set.slower && desktopSlower) {
                set.slower.disabled = !!desktopSlower.disabled;
                set.slower.setAttribute("aria-disabled", desktopSlower.disabled ? "true" : "false");
            }
            if (set.faster && desktopFaster) {
                set.faster.disabled = !!desktopFaster.disabled;
                set.faster.setAttribute("aria-disabled", desktopFaster.disabled ? "true" : "false");
            }
            if (set.speed && desktopSpeed) {
                set.speed.textContent = (desktopSpeed.textContent || "").trim() || "1x";
                set.speed.setAttribute(
                    "aria-label",
                    desktopSpeed.getAttribute("aria-label") || "Current speed. Click to set realtime (1 sec/sec).",
                );
                set.speed.title = desktopSpeed.title || "Set speed to realtime (1 sec/sec)";
                const isRealtime = desktopSpeed.classList.contains("down");
                set.speed.classList.toggle("is-active", isRealtime);
                set.speed.disabled = !!desktopSpeed.disabled;
                set.speed.setAttribute("aria-disabled", desktopSpeed.disabled ? "true" : "false");
            }
        });
    };

    syncTransportState();

    if (desktopPlay) {
        const playObserver = new MutationObserver(syncTransportState);
        playObserver.observe(desktopPlay, {
            childList: true,
            characterData: true,
            subtree: true,
            attributes: true,
        });
    }

    if (desktopNow) {
        const nowObserver = new MutationObserver(syncTransportState);
        nowObserver.observe(desktopNow, {
            attributes: true,
            attributeFilter: ["class", "aria-pressed", "aria-label", "title", "disabled"],
            childList: true,
            characterData: true,
            subtree: true,
        });
    }
    if (desktopSlower) {
        const slowerObserver = new MutationObserver(syncTransportState);
        slowerObserver.observe(desktopSlower, {
            attributes: true,
            attributeFilter: ["class", "aria-pressed", "disabled", "aria-disabled"],
        });
    }
    if (desktopFaster) {
        const fasterObserver = new MutationObserver(syncTransportState);
        fasterObserver.observe(desktopFaster, {
            attributes: true,
            attributeFilter: ["class", "aria-pressed", "disabled", "aria-disabled"],
        });
    }
    if (desktopSpeed) {
        const speedObserver = new MutationObserver(syncTransportState);
        speedObserver.observe(desktopSpeed, {
            childList: true,
            characterData: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["title", "aria-label", "class", "aria-pressed", "disabled"],
        });
    }

    navButtons.forEach((button) => {
        button.addEventListener("click", function () {
            if (button.disabled) {
                if (missionEvent) {
                    missionEvent.textContent = `${button.textContent.trim()} card coming next`;
                }
                return;
            }
            setActiveMobileTab(button.dataset.mobileTab || "mission");
        });
    });
}

