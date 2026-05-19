const SETTINGS_PANEL_FILTERED_CLASS = "settings-panel__filtered-hidden";
const SETTINGS_PANEL_MODE_FULL = "full";
const SETTINGS_PANEL_MODE_ADVANCED = "advanced";
const SETTINGS_SECTION_ADVANCED_COLLAPSIBLE_CLASS = "settings-section--advanced-collapsible";

function defaultOnClick(documentRef, id, handler) {
    const element = documentRef?.getElementById?.(id);
    if (!element) return;
    element.addEventListener?.("click", handler);
}

function createSettingsPanelController(deps = {}) {
    const {
        documentRef = globalThis?.document,
        windowRef = globalThis?.window || globalThis,
        onClick = (id, handler) => defaultOnClick(documentRef, id, handler),
        getMissionDialogApi = () => windowRef?.MissionDialog || windowRef?.CY3Dialog || null,
        isMobileViewport = () => (windowRef?.innerWidth || 0) <= 600,
        isElementLayoutVisible = (element) => !!element,
        setControlPanelCollapsedState = () => {},
        requestAnimationFrameImpl = (callback) => {
            if (typeof windowRef?.requestAnimationFrame === "function") {
                return windowRef.requestAnimationFrame(callback);
            }
            return callback();
        },
    } = deps;

    let bound = false;
    let settingsPanelResizeBound = false;
    let settingsOutsideClickBound = false;
    let settingsAutoCollapsedControls = false;
    let settingsPanelLauncherId = null;
    const mobileSettingsSectionState = new Map();
    const advancedSettingsSectionState = new Map();

    function adjustSettingsPanelBodyOverflow() {
        const panel = documentRef?.getElementById?.("settings-panel");
        const body = documentRef?.getElementById?.("settings-panel-body");
        if (!panel || !body) return;
        body.style.maxHeight = "none";
        body.style.overflowY = "visible";

        const panelRect = panel.getBoundingClientRect?.() || { top: 0 };
        const bottomGapPx = 14;
        const minBodyHeightPx = isMobileViewport() ? 140 : 220;
        let availableHeight = Math.max(
            minBodyHeightPx,
            Math.floor((windowRef?.innerHeight || 0) - panelRect.top - bottomGapPx),
        );

        const dialogApi = getMissionDialogApi();
        const wrapper = dialogApi?.widgetElement?.("#settings-panel");
        if (wrapper) {
            const wrapperRect = wrapper.getBoundingClientRect?.() || { bottom: Number.NaN };
            const bodyRect = body.getBoundingClientRect?.() || { top: Number.NaN };
            const wrapperAvailable = Math.floor(wrapperRect.bottom - bodyRect.top - 8);
            if (Number.isFinite(wrapperAvailable) && wrapperAvailable > 0) {
                availableHeight = Math.max(minBodyHeightPx, Math.min(availableHeight, wrapperAvailable));
            }
        }

        const needsScroll = (body.scrollHeight || 0) > availableHeight + 1;
        body.style.maxHeight = `${availableHeight}px`;
        body.style.overflowY = needsScroll ? "auto" : "hidden";
    }

    function applyMobileSettingsPanelLayout(wrapper) {
        if (!wrapper || (windowRef?.innerWidth || 0) > 600) return;
        const header = documentRef?.getElementById?.("header");
        const headerBottom = header?.getBoundingClientRect?.()?.bottom ?? 0;
        const panelTop = Math.round(headerBottom + 5);
        const panelLeft = 6;
        const bottomInset = 10;
        const viewportLimitedHeight = Math.floor((windowRef?.innerHeight || 0) - panelTop - bottomInset);
        const targetHeight = Math.floor((windowRef?.innerHeight || 0) * 0.64);
        const maxHeight = Math.max(240, Math.min(viewportLimitedHeight, targetHeight));
        const maxWidth = Math.min(320, Math.floor((windowRef?.innerWidth || 0) - panelLeft * 2));

        wrapper.style.top = `${panelTop}px`;
        wrapper.style.left = `${panelLeft}px`;
        wrapper.style.width = `${maxWidth}px`;
        wrapper.style.maxWidth = `${maxWidth}px`;
        wrapper.style.maxHeight = `${maxHeight}px`;
    }

    function isSettingsPanelOpen() {
        const dialogApi = getMissionDialogApi();
        const wrapper = dialogApi?.widgetElement?.("#settings-panel");
        if (wrapper) {
            return isElementLayoutVisible(wrapper);
        }
        const panel = documentRef?.getElementById?.("settings-panel");
        return isElementLayoutVisible(panel);
    }

    function setSettingsPanelLauncherState(buttonId, isOpen) {
        const button = buttonId ? documentRef?.getElementById?.(buttonId) : null;
        if (!button) return;
        button.setAttribute?.("aria-expanded", String(!!isOpen));
        button.classList?.toggle?.("is-open", !!isOpen);
    }

    function syncSettingsPanelLauncherStates(openLauncherId = null) {
        ["settings-panel-button", "advanced-controls-pill"].forEach((buttonId) => {
            setSettingsPanelLauncherState(buttonId, buttonId === openLauncherId);
        });
    }

    function setSettingsPanelFilteredHidden(element, hidden) {
        element?.classList?.toggle?.(SETTINGS_PANEL_FILTERED_CLASS, !!hidden);
    }

    function resolveSettingsPanelAdvancedViewItems() {
        const items = [];
        const addClosestOption = (controlId) => {
            const control = documentRef?.getElementById?.(controlId);
            const option = control?.closest?.(".settings-option");
            if (option) {
                items.push(option);
            }
        };

        addClosestOption("view-additional-crafts");
        addClosestOption("view-fps");

        const activeCraftRow = documentRef?.getElementById?.("active-craft-row");
        if (activeCraftRow) {
            items.push(activeCraftRow);
        }

        const orbitStyleOption = documentRef?.querySelector?.(".settings-option--orbit-style");
        if (orbitStyleOption) {
            items.push(orbitStyleOption);
        }

        const trailControls = documentRef?.querySelector?.(".settings-row--trail-controls");
        if (trailControls) {
            items.push(trailControls);
        }

        return items;
    }

    function applySettingsPanelPresentation(mode = SETTINGS_PANEL_MODE_FULL) {
        const panel = documentRef?.getElementById?.("settings-panel");
        if (!panel) return;

        const normalizedMode = mode === SETTINGS_PANEL_MODE_ADVANCED
            ? SETTINGS_PANEL_MODE_ADVANCED
            : SETTINGS_PANEL_MODE_FULL;

        panel.classList?.toggle?.("settings-panel--advanced", normalizedMode === SETTINGS_PANEL_MODE_ADVANCED);

        const title = panel.querySelector?.(".settings-panel__title");
        if (title) {
            title.textContent = normalizedMode === SETTINGS_PANEL_MODE_ADVANCED ? "Advanced" : "Settings";
        }

        const sections = Array.from(panel.querySelectorAll?.(".settings-section") || []);
        sections.forEach((section) => setSettingsPanelFilteredHidden(section, false));
        const panelManagerSection = panel.querySelector?.(".settings-section--panel-manager");

        const viewSection = panel.querySelector?.(".settings-section--view");
        const viewSectionTitle = viewSection?.querySelector?.(".settings-section__title");
        if (viewSectionTitle) {
            if (!viewSectionTitle.dataset.fullTitle) {
                viewSectionTitle.dataset.fullTitle = viewSectionTitle.textContent || "View";
            }
            viewSectionTitle.textContent = normalizedMode === SETTINGS_PANEL_MODE_ADVANCED
                ? "Craft / Display"
                : viewSectionTitle.dataset.fullTitle;
        }

        const viewOptions = viewSection?.querySelector?.(".settings-options");
        if (viewOptions) {
            Array.from(viewOptions.children || []).forEach((child) => setSettingsPanelFilteredHidden(child, false));
        }

        if (normalizedMode !== SETTINGS_PANEL_MODE_ADVANCED) {
            setSettingsPanelFilteredHidden(panelManagerSection, true);
            return;
        }

        sections.forEach((section) => {
            const keepSection = section.classList?.contains?.("settings-section--camera") ||
                section.classList?.contains?.("settings-section--view") ||
                section.classList?.contains?.("settings-section--media-advanced");
            setSettingsPanelFilteredHidden(section, !keepSection);
        });

        if (viewOptions) {
            Array.from(viewOptions.children || []).forEach((child) => setSettingsPanelFilteredHidden(child, true));
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

        const sourceLine = documentRef?.querySelector?.("#blurb .desktoponly");
        const sourceLineVisible = !!(sourceLine && sourceLine.getClientRects?.().length);
        if (sourceLineVisible && (windowRef?.innerWidth || 0) > 600) {
            return "#blurb .desktoponly";
        }
        return "#settings-panel-button";
    }

    function resolveDefaultMobileSectionCollapsed(sectionKey) {
        return sectionKey === "camera" || sectionKey === "plane" || sectionKey === "view";
    }

    function setSettingsSectionCollapsed(section, collapsed) {
        section?.classList?.toggle?.("settings-section--collapsed", collapsed);
        const legend = section?.querySelector?.(".settings-section__title");
        if (!legend) return;
        legend.setAttribute?.("aria-expanded", String(!collapsed));
    }

    function bindAdvancedSettingsSectionToggle(section, legend) {
        if (!section || !legend || legend.dataset?.advancedBound) return;
        legend.dataset.advancedBound = "true";
        const toggle = function (event) {
            const panel = documentRef?.getElementById?.("settings-panel");
            if (!panel?.classList?.contains?.("settings-panel--advanced")) return;
            if (!section.classList?.contains?.(SETTINGS_SECTION_ADVANCED_COLLAPSIBLE_CLASS)) return;
            if (event?.key && event.key !== "Enter" && event.key !== " ") return;
            event?.preventDefault?.();
            const sectionKey = section.dataset?.sectionKey || "";
            const nextCollapsed = !section.classList?.contains?.("settings-section--collapsed");
            setSettingsSectionCollapsed(section, nextCollapsed);
            advancedSettingsSectionState.set(sectionKey, nextCollapsed);
            adjustSettingsPanelBodyOverflow();
            requestAnimationFrameImpl(adjustSettingsPanelBodyOverflow);
        };
        legend.addEventListener?.("click", toggle);
        legend.addEventListener?.("keydown", toggle);
    }

    function applyAdvancedSettingsSections() {
        const panel = documentRef?.getElementById?.("settings-panel");
        if (!panel) return;
        const sections = Array.from(panel.querySelectorAll?.(".settings-section") || []);
        const advanced = panel.classList?.contains?.("settings-panel--advanced");

        sections.forEach((section) => {
            section.classList?.remove?.(SETTINGS_SECTION_ADVANCED_COLLAPSIBLE_CLASS);
            if (!advanced && !isMobileViewport()) {
                section.classList?.remove?.("settings-section--collapsed");
                const legend = section.querySelector?.(".settings-section__title");
                legend?.removeAttribute?.("aria-expanded");
            }
        });

        if (!advanced) return;

        const visibleSections = sections.filter((section) => (
            !section.classList?.contains?.(SETTINGS_PANEL_FILTERED_CLASS)
        ));

        visibleSections.forEach((section, index) => {
            const legend = section.querySelector?.(".settings-section__title");
            if (!legend) return;
            section.classList?.add?.(SETTINGS_SECTION_ADVANCED_COLLAPSIBLE_CLASS);
            legend.setAttribute?.("role", "button");
            legend.setAttribute?.("tabindex", "0");

            const sectionKey = section.dataset?.sectionKey || "";
            const shouldCollapse = advancedSettingsSectionState.has(sectionKey)
                ? advancedSettingsSectionState.get(sectionKey)
                : index > 0;
            setSettingsSectionCollapsed(section, shouldCollapse);
            bindAdvancedSettingsSectionToggle(section, legend);
        });
    }

    function applyMobileSettingsSections() {
        const sections = Array.from(documentRef?.querySelectorAll?.("#settings-panel .settings-section") || []);
        if (!sections.length) return;

        const mobile = isMobileViewport();
        sections.forEach((section) => {
            const legend = section.querySelector?.(".settings-section__title");
            if (!legend) return;

            section.classList?.toggle?.("settings-section--mobile-collapsible", mobile);
            if (!mobile) {
                section.classList?.remove?.("settings-section--collapsed");
                if (!section.classList?.contains?.(SETTINGS_SECTION_ADVANCED_COLLAPSIBLE_CLASS)) {
                    legend.removeAttribute?.("role");
                    legend.removeAttribute?.("tabindex");
                    legend.removeAttribute?.("aria-expanded");
                }
                return;
            }

            const sectionKey = section.dataset?.sectionKey || "";
            const shouldCollapse = mobileSettingsSectionState.has(sectionKey)
                ? mobileSettingsSectionState.get(sectionKey)
                : resolveDefaultMobileSectionCollapsed(sectionKey);
            setSettingsSectionCollapsed(section, shouldCollapse);

            legend.setAttribute?.("role", "button");
            legend.setAttribute?.("tabindex", "0");

            if (!legend.dataset?.mobileBound) {
                legend.dataset.mobileBound = "true";
                legend.addEventListener?.("click", function () {
                    if (!isMobileViewport()) return;
                    const nextCollapsed = !section.classList?.contains?.("settings-section--collapsed");
                    setSettingsSectionCollapsed(section, nextCollapsed);
                    mobileSettingsSectionState.set(sectionKey, nextCollapsed);
                    adjustSettingsPanelBodyOverflow();
                    requestAnimationFrameImpl(adjustSettingsPanelBodyOverflow);
                });

                legend.addEventListener?.("keydown", function (event) {
                    if (!isMobileViewport()) return;
                    if (event?.key !== "Enter" && event?.key !== " ") return;
                    event.preventDefault?.();
                    const nextCollapsed = !section.classList?.contains?.("settings-section--collapsed");
                    setSettingsSectionCollapsed(section, nextCollapsed);
                    mobileSettingsSectionState.set(sectionKey, nextCollapsed);
                    adjustSettingsPanelBodyOverflow();
                    requestAnimationFrameImpl(adjustSettingsPanelBodyOverflow);
                });
            }
        });
    }

    function closeSettingsPanel(dialogApi = getMissionDialogApi()) {
        dialogApi?.close?.("#settings-panel");
        settingsPanelLauncherId = null;
        applySettingsPanelPresentation(SETTINGS_PANEL_MODE_FULL);
        syncSettingsPanelLauncherStates(null);
        if (settingsAutoCollapsedControls) {
            setControlPanelCollapsedState(false);
            settingsAutoCollapsedControls = false;
        }
    }

    function resetForMobileMode() {
        const dialogApi = getMissionDialogApi();
        dialogApi?.close?.("#settings-panel");
        const settingsPanel = documentRef?.getElementById?.("settings-panel");
        if (settingsPanel?.style) {
            settingsPanel.style.display = "none";
        }
        settingsPanelLauncherId = null;
        applySettingsPanelPresentation(SETTINGS_PANEL_MODE_FULL);
        syncSettingsPanelLauncherStates(null);
    }

    function bind() {
        if (bound) return;
        bound = true;

        const settingsButton = documentRef?.getElementById?.("settings-panel-button");
        const advancedButton = documentRef?.getElementById?.("advanced-controls-pill");

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
                    collision: "fit flip",
                },
                title: mode === SETTINGS_PANEL_MODE_ADVANCED ? "Advanced" : "Settings",
                closeOnEscape: false,
            };

            dialogApi?.init?.("#settings-panel", options);
            dialogApi?.open?.("#settings-panel");

            const wrapper = dialogApi?.widgetElement?.("#settings-panel");
            if (wrapper) {
                wrapper.style.backgroundImage = "none";
                wrapper.style.border = "0";
                wrapper.style.maxWidth = (windowRef?.innerWidth || 0) <= 600
                    ? "92vw"
                    : mode === SETTINGS_PANEL_MODE_ADVANCED
                        ? "380px"
                        : "80%";
                wrapper.style.zIndex = "18";
                const titleBar = wrapper.querySelector?.(".ui-dialog-titlebar");
                if (titleBar) titleBar.style.display = "none";
                applyMobileSettingsPanelLayout(wrapper);
            }

            applyMobileSettingsSections();
            applyAdvancedSettingsSections();
            adjustSettingsPanelBodyOverflow();
            requestAnimationFrameImpl(adjustSettingsPanelBodyOverflow);

            if (isMobileViewport()) {
                const controlsPanel = documentRef?.getElementById?.("control-panel");
                const controlsCollapsed = !!controlsPanel?.classList?.contains?.("control-panel--collapsed");
                settingsAutoCollapsedControls = !controlsCollapsed;
                if (!controlsCollapsed) {
                    setControlPanelCollapsedState(true);
                }
            } else {
                settingsAutoCollapsedControls = false;
            }

            if (!settingsPanelResizeBound) {
                settingsPanelResizeBound = true;
                windowRef?.addEventListener?.("resize", function () {
                    if (!isSettingsPanelOpen()) return;
                    adjustSettingsPanelBodyOverflow();
                    const currentDialogApi = getMissionDialogApi();
                    const currentWrapper = currentDialogApi?.widgetElement?.("#settings-panel");
                    if (currentWrapper) applyMobileSettingsPanelLayout(currentWrapper);
                    applyMobileSettingsSections();
                    applyAdvancedSettingsSections();
                });
            }

            if (!settingsOutsideClickBound) {
                settingsOutsideClickBound = true;
                documentRef?.addEventListener?.("pointerdown", function (event) {
                    if (!isSettingsPanelOpen()) return;
                    if (!event?.target) return;
                    const currentDialogApi = getMissionDialogApi();
                    const dialogWrapper = currentDialogApi?.widgetElement?.("#settings-panel");
                    if (dialogWrapper?.contains?.(event.target)) return;
                    if (settingsButton?.contains?.(event.target)) return;
                    if (advancedButton?.contains?.(event.target)) return;
                    closeSettingsPanel(currentDialogApi);
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

    return {
        bind,
        closeSettingsPanel,
        isSettingsPanelOpen,
        resetForMobileMode,
    };
}

export { createSettingsPanelController };
