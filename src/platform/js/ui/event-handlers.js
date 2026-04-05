import { AUXILIARY_VIEW_CAMERA_PRESETS } from "../app/auxiliary-camera-views.js";

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
let settingsPanelResizeBound = false;
let settingsOutsideClickBound = false;
let shortcutPanelGlobalBound = false;
let controlPanelResizeBound = false;
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
                of: "#settings-panel-button",
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
    onClick("view-moon-highlight", setView);
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
    setControlPanelCollapsedState(false);
    setTimelineEventCarouselExpandedState(true, { focusUpcoming: false, wiggleCue: false });
    requestAnimationFrame(() => syncControlPanelInfoOffset(panel));
    button.addEventListener("click", function () {
        const shouldExpand = timelineDock.classList.contains("timeline-dock--events-collapsed");
        setTimelineEventCarouselExpandedState(shouldExpand);
    });

    if (!controlPanelResizeBound) {
        controlPanelResizeBound = true;
        window.addEventListener("resize", function () {
            syncControlPanelInfoOffset();
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
    const mobileTransportSets = [missionControls, viewsControls];

    const mobileViewButtons = document.querySelectorAll(".mobile-shell__view-btn");
    const mobileViewsFovSlider = document.getElementById("mobile-views-fov-slider");
    const mobileViewsFovValue = document.getElementById("mobile-views-fov-value");
    const mobileViewsFovAuto = document.getElementById("mobile-views-fov-auto");
    const missionEvent = document.getElementById("mobile-mission-event");
    const navButtons = document.querySelectorAll(".mobile-shell__nav-btn");
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
    const mobileTabCards = {
        mission: missionCard,
        views: viewsCard,
    };
    const MISSION_PANEL_COLLAPSE_STORAGE_KEY = "moon-mission:mobile-mission-panel-collapsed:v1";
    let activeMobileTab = "mission";
    let activeMobileViewPresetId = "moon";
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
    const MOBILE_ALWAYS_SUPPRESSED_VIEW_IDS = [
        "view-aux-camera-panels",
    ];
    const MOBILE_VIEWS_SUPPRESSED_VIEW_IDS = [
        "view-orbit",
        "view-orbit-descent",
        "view-additional-crafts",
        "view-aux-camera-panels",
        "view-craters",
        "view-xyz-axes",
        "view-poles",
        "view-polar-axes",
        "view-sky",
        "view-constellation-lines",
        "view-moonsoi",
        "view-moon-highlight",
        "view-moon-osculating-orbit",
        "view-eclipticplane",
        "view-equatorialplane",
    ];

    const toggleMobileMode = () => {
        const mobile = isMobileViewport();
        document.body.classList.toggle("mobile-shell-enabled", mobile);
        if (mobile) {
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
            if (activeMobileTab === "views") {
                applyViewsVisualSimplification();
            }
        } else {
            if (activeMobileTab === "views") {
                restoreViewsVisualSimplification();
                if (mobileSavedMissionCameraModes && desktopPosition && desktopLook) {
                    desktopPosition.value = mobileSavedMissionCameraModes.positionMode || "manual";
                    desktopLook.value = mobileSavedMissionCameraModes.lookMode || "manual";
                    desktopPosition.dispatchEvent(new Event("change", { bubbles: true }));
                    mobileSavedMissionCameraModes = null;
                }
            }
            restoreMobileAlwaysSuppressedViews();
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
        if (!Number.isFinite(numeric)) return 50;
        return Math.min(MAX_FOV, Math.max(MIN_FOV, numeric));
    };

    const updateMobileViewsFovDisplay = (fovDegrees) => {
        const nextFov = clampFov(fovDegrees);
        const rounded = Math.round(nextFov);
        if (mobileViewsFovSlider) {
            mobileViewsFovSlider.value = String(rounded);
        }
        if (mobileViewsFovValue) {
            mobileViewsFovValue.textContent = `${rounded}°`;
            mobileViewsFovValue.value = `${rounded}°`;
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

    const setMobileViewsAutoFov = (enabled) => {
        mobileViewsAutoFovEnabled = !!enabled;
        if (mobileViewsFovAuto) {
            mobileViewsFovAuto.classList.toggle("is-active", mobileViewsAutoFovEnabled);
            mobileViewsFovAuto.setAttribute("aria-pressed", mobileViewsAutoFovEnabled ? "true" : "false");
            mobileViewsFovAuto.title = mobileViewsAutoFovEnabled ? "Auto FoV enabled" : "Auto FoV disabled";
        }
    };

    const applyAutoFovForActivePreset = () => {
        if (!mobileViewsAutoFovEnabled) return false;
        const preset = mobileViewPresetById.get(activeMobileViewPresetId);
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
        const nextTab = mobileTabCards[tabName] ? tabName : "mission";
        const previousTab = activeMobileTab;
        activeMobileTab = nextTab;

        navButtons.forEach((button) => {
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
            card.hidden = tabKey !== nextTab;
        });

        if (nextTab === "views" && isMobileViewport()) {
            applyViewsVisualSimplification();
            if (!mobileSavedMissionCameraModes && desktopPosition && desktopLook) {
                mobileSavedMissionCameraModes = {
                    positionMode: desktopPosition.value,
                    lookMode: desktopLook.value,
                };
            }
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
        } else if (previousTab === "views" && isMobileViewport()) {
            restoreViewsVisualSimplification();
            if (mobileSavedMissionCameraModes && desktopPosition && desktopLook) {
                desktopPosition.value = mobileSavedMissionCameraModes.positionMode || "manual";
                desktopLook.value = mobileSavedMissionCameraModes.lookMode || "manual";
                desktopPosition.dispatchEvent(new Event("change", { bubbles: true }));
                mobileSavedMissionCameraModes = null;
            }
        }
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
    };

    const applyMobileViewPreset = (presetId) => {
        if (!desktopPosition || !desktopLook) return;
        const preset = mobileViewPresetById.get(presetId);
        if (!preset) return;

        activeMobileViewPresetId = presetId;
        desktopPosition.value = preset.positionMode;
        desktopLook.value = preset.lookMode;
        desktopPosition.dispatchEvent(new Event("change", { bubbles: true }));
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

    if (desktopPosition) {
        desktopPosition.addEventListener("change", () => {
            syncMobileViewPresetState();
            if (mobileViewsAutoFovEnabled && activeMobileTab === "views") {
                scheduleAutoFovApply();
            }
        });
    }
    if (desktopLook) {
        desktopLook.addEventListener("change", () => {
            syncMobileViewPresetState();
            if (mobileViewsAutoFovEnabled && activeMobileTab === "views") {
                scheduleAutoFovApply();
            }
        });
    }

    if (mobileViewsFovAuto) {
        mobileViewsFovAuto.addEventListener("click", function () {
            setMobileViewsAutoFov(!mobileViewsAutoFovEnabled);
            if (mobileViewsAutoFovEnabled) {
                scheduleAutoFovApply();
            }
        });
    }

    if (mobileViewsFovSlider) {
        const onManualFovChange = () => {
            setMobileViewsAutoFov(false);
            applyMobileViewsFov(Number(mobileViewsFovSlider.value));
        };
        mobileViewsFovSlider.addEventListener("input", onManualFovChange);
        mobileViewsFovSlider.addEventListener("change", onManualFovChange);
    }

    if (missionCollapseButton) {
        missionCollapseButton.addEventListener("click", function () {
            const collapsed = missionCard?.classList.contains("mobile-shell__card--collapsed");
            setMissionCardCollapsed(!collapsed);
        });
    }

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
    const initialScene = resolveActiveScene();
    if (initialScene?.camera?.fov) {
        updateMobileViewsFovDisplay(initialScene.camera.fov);
    }
    toggleMobileMode();
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
