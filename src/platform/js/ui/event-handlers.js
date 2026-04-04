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
const mobileSettingsSectionState = new Map();

function isInteractiveInputTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return target.isContentEditable === true;
}

function clickControlButton(id) {
    const button = document.getElementById(id);
    if (!button || button.disabled) return false;
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

function isArtemis2MissionContext() {
    const dataPath = String(window?.missionConfig?.dataPath || "").toLowerCase();
    return dataPath.includes("/artemis2/") || dataPath.includes("\\artemis2\\");
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
    const button = document.getElementById("control-panel-toggle");
    if (!panel || !button) return;
    panel.classList.toggle("control-panel--collapsed", collapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
    button.textContent = collapsed ? "+" : "−";
    button.setAttribute(
        "aria-label",
        collapsed ? "Show controls" : "Hide controls",
    );
    button.title = collapsed ? "Show controls" : "Hide controls";
    requestAnimationFrame(() => syncControlPanelInfoOffset(panel));
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
    const button = document.getElementById("control-panel-toggle");
    if (!panel || !button) return;
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    setControlPanelCollapsedState(false);
    requestAnimationFrame(() => syncControlPanelInfoOffset(panel));
    button.addEventListener("click", function () {
        const collapsed = !panel.classList.contains("control-panel--collapsed");
        setControlPanelCollapsedState(collapsed);
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

    const mobilePlay = document.getElementById("mobile-control-play");
    const mobileSlower = document.getElementById("mobile-control-slower");
    const mobileFaster = document.getElementById("mobile-control-faster");
    const mobileSpeed = document.getElementById("mobile-control-speed");
    const mobileNow = document.getElementById("mobile-control-realtime");
    const missionEvent = document.getElementById("mobile-mission-event");
    const navButtons = document.querySelectorAll(".mobile-shell__nav-btn");
    const desktopPlay = document.getElementById("animate");
    const desktopNow = document.getElementById("missionnow");
    const desktopSlower = document.getElementById("slower");
    const desktopFaster = document.getElementById("faster");
    const desktopSpeed = document.getElementById("realtime");
    let artemis2XyLockTimer = null;

    const clearArtemis2XyLockTimer = () => {
        if (artemis2XyLockTimer !== null) {
            clearTimeout(artemis2XyLockTimer);
            artemis2XyLockTimer = null;
        }
    };

    const requestArtemis2MobileXyLock = (attempt = 0) => {
        clearArtemis2XyLockTimer();
        if (!isMobileViewport() || !isArtemis2MissionContext()) return;

        const xyRadio = document.getElementById("checkbox-lock-xy");
        if (!xyRadio || xyRadio.checked) return;

        const sceneReady = !!(
            document.getElementById("EARTH") ||
            document.querySelector("#svg-wrapper svg") ||
            document.querySelector("#canvas-wrapper canvas")
        );
        if (!sceneReady) {
            if (attempt >= 80) return;
            artemis2XyLockTimer = setTimeout(() => {
                requestArtemis2MobileXyLock(attempt + 1);
            }, 150);
            return;
        }

        xyRadio.click();
    };

    const toggleMobileMode = () => {
        const mobile = isMobileViewport();
        document.body.classList.toggle("mobile-shell-enabled", mobile);
        if (mobile) {
            requestArtemis2MobileXyLock();
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
        } else {
            clearArtemis2XyLockTimer();
        }
    };
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

        // Desktop transport speed buttons are wired to mousedown repeat handlers.
        target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    };

    if (mobilePlay) {
        mobilePlay.addEventListener("click", function () {
            proxyClick("animate");
        });
    }
    if (mobileNow) {
        mobileNow.addEventListener("click", function () {
            proxyClick("missionnow");
        });
    }
    if (mobileSlower) {
        mobileSlower.addEventListener("click", function () {
            proxyPress("slower");
        });
    }
    if (mobileFaster) {
        mobileFaster.addEventListener("click", function () {
            proxyPress("faster");
        });
    }
    if (mobileSpeed) {
        mobileSpeed.addEventListener("click", function () {
            proxyPress("realtime");
        });
    }

    const syncTransportState = () => {
        if (mobilePlay && desktopPlay) {
            const isPlaying = (desktopPlay.textContent || "").trim().toLowerCase() === "pause";
            mobilePlay.textContent = isPlaying ? "Pause" : "Play";
            mobilePlay.classList.toggle("is-active", isPlaying);
        }
        if (mobileNow && desktopNow) {
            mobileNow.textContent = (desktopNow.textContent || "").trim() || "Now";
            mobileNow.title = desktopNow.title || "Jump to current time";
            mobileNow.setAttribute(
                "aria-label",
                desktopNow.getAttribute("aria-label") || "Jump to current time",
            );
            mobileNow.disabled = !!desktopNow.disabled;
            mobileNow.setAttribute("aria-disabled", desktopNow.disabled ? "true" : "false");
        }
        if (mobileSlower && desktopSlower) {
            mobileSlower.disabled = !!desktopSlower.disabled;
            mobileSlower.setAttribute("aria-disabled", desktopSlower.disabled ? "true" : "false");
        }
        if (mobileFaster && desktopFaster) {
            mobileFaster.disabled = !!desktopFaster.disabled;
            mobileFaster.setAttribute("aria-disabled", desktopFaster.disabled ? "true" : "false");
        }
        if (mobileSpeed && desktopSpeed) {
            mobileSpeed.textContent = (desktopSpeed.textContent || "").trim() || "1x";
            mobileSpeed.setAttribute(
                "aria-label",
                desktopSpeed.getAttribute("aria-label") || "Current speed. Click to set realtime (1 sec/sec).",
            );
            mobileSpeed.title = desktopSpeed.title || "Set speed to realtime (1 sec/sec)";
            const isRealtime = desktopSpeed.classList.contains("down");
            mobileSpeed.classList.toggle("is-active", isRealtime);
            mobileSpeed.disabled = !!desktopSpeed.disabled;
            mobileSpeed.setAttribute("aria-disabled", desktopSpeed.disabled ? "true" : "false");
        }
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
            navButtons.forEach((node) => node.classList.remove("is-active"));
            button.classList.add("is-active");
        });
    });
}
