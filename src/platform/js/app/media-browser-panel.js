import {
    registerMissionPanel,
    updateMissionPanel,
} from "./panel-registry.js";
import { showMissionPanelInfo } from "./panel-info-popover.js";
import {
    readMissionPanelState,
    writeMissionPanelState,
} from "./panel-layout-store.js";
import {
    getMissionPanelDefaultState,
    isMissionPanelEnabled,
} from "./panel-defaults.js";

const MEDIA_BROWSER_PANEL_ID = "workflow:media-browser";
const MEDIA_BROWSER_LAYOUT_PRESET_VERSION = "media-browser-v2-windowed";
const PANEL_EDGE_MARGIN_PX = 8;
const PANEL_DEFAULT_LEFT_PX = 22;
const PANEL_DEFAULT_BOTTOM_GAP_PX = 12;
const PANEL_DEFAULT_WIDTH_PX = 560;
const PANEL_DEFAULT_HEIGHT_PX = 420;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getDocumentRef() {
    return globalThis.document || null;
}

function getWindowRef() {
    return globalThis.window || null;
}

function isObjectLike(value) {
    return value !== null && typeof value === "object";
}

function isElementLike(value) {
    return isObjectLike(value) && isObjectLike(value.classList);
}

function isSelectLike(value) {
    return isElementLike(value) && typeof value.addEventListener === "function" && "value" in value;
}

function isImageLike(value) {
    return isElementLike(value) && ("src" in value || typeof value.removeAttribute === "function");
}

function createElement(tagName) {
    return getDocumentRef()?.createElement?.(tagName) || null;
}

function getViewportWidth() {
    const width = Number(getWindowRef()?.innerWidth);
    return Number.isFinite(width) && width > 0 ? width : 1440;
}

function getViewportHeight() {
    const height = Number(getWindowRef()?.innerHeight);
    return Number.isFinite(height) && height > 0 ? height : 900;
}

function getCssCustomPropertyNumber(name, fallbackValue) {
    const documentElement = getDocumentRef()?.documentElement || null;
    const getComputedStyleFn = globalThis.getComputedStyle;
    if (!documentElement || typeof getComputedStyleFn !== "function") {
        return fallbackValue;
    }
    const value = Number.parseFloat(getComputedStyleFn(documentElement).getPropertyValue(name));
    return Number.isFinite(value) ? value : fallbackValue;
}

function createMediaBrowserPanelActions({
    onIntent,
} = {}) {
    let initialized = false;
    let missionConfigData = null;
    let missionLabel = "Current mission";
    let panelAvailable = false;
    let panelTitle = "Mission Media";
    let mediaCountLabel = "--";
    let panelVisibilityState = "closed";
    let panelPosition = null;
    let dragState = null;
    let filterSignature = "";
    let nearbySignature = "";
    let restoredPanelLayout = readMissionPanelState(MEDIA_BROWSER_PANEL_ID) || null;
    if (String(restoredPanelLayout?.layoutPresetVersion || "").trim() !== MEDIA_BROWSER_LAYOUT_PRESET_VERSION) {
        restoredPanelLayout = null;
    }
    let hasRestoredPanelLayout = !!restoredPanelLayout;
    let panelExpanded = restoredPanelLayout?.maximized === true;
    let restorePanelFrame = restoredPanelLayout?.restoreFrame && typeof restoredPanelLayout.restoreFrame === "object"
        ? {
            x: Math.round(Number(restoredPanelLayout.restoreFrame.x) || 0),
            y: Math.round(Number(restoredPanelLayout.restoreFrame.y) || 0),
            width: Math.round(Number(restoredPanelLayout.restoreFrame.width) || 0),
            height: Math.round(Number(restoredPanelLayout.restoreFrame.height) || 0),
        }
        : null;
    let hasRestoredPanelVisibilityState = false;
    let defaultPanelStateApplied = false;

    function getNode(id) {
        return getDocumentRef()?.getElementById?.(id) || null;
    }

    function getPanelRegistryState() {
        if (!panelAvailable) return "unavailable";
        return panelVisibilityState;
    }

    function setText(id, value) {
        const node = getNode(id);
        if (node) node.textContent = value;
    }

    function setHidden(id, hidden) {
        const node = getNode(id);
        if (node) node.hidden = !!hidden;
    }

    function resolveCompactTimeLabel(timeLabel) {
        const text = String(timeLabel || "").trim();
        if (!text) return "--";
        return text.split(" • ")[0]?.trim() || text;
    }

    function resolveDefaultPanelPosition(panel) {
        const width = Math.max(panel.offsetWidth || PANEL_DEFAULT_WIDTH_PX, 360);
        const height = Math.max(panel.offsetHeight || PANEL_DEFAULT_HEIGHT_PX, 340);
        const timelineHeight = getCssCustomPropertyNumber("--timeline-dock-height", 88);
        const timelineOffset = getCssCustomPropertyNumber("--timeline-dock-offset", 10);
        const x = PANEL_DEFAULT_LEFT_PX;
        const y = getViewportHeight() - height - timelineHeight - timelineOffset - PANEL_DEFAULT_BOTTOM_GAP_PX;
        return clampPanelRect({ x, y, width, height });
    }

    function clampPanelRect({ x, y, width, height }) {
        const maxX = Math.max(PANEL_EDGE_MARGIN_PX, getViewportWidth() - width - PANEL_EDGE_MARGIN_PX);
        const maxY = Math.max(PANEL_EDGE_MARGIN_PX, getViewportHeight() - height - PANEL_EDGE_MARGIN_PX);
        return {
            x: clamp(Math.round(x), PANEL_EDGE_MARGIN_PX, maxX),
            y: clamp(Math.round(y), PANEL_EDGE_MARGIN_PX, maxY),
        };
    }

    function applyPanelPosition(panel, x, y) {
        if (!panel) return;
        const width = Math.max(panel.offsetWidth || PANEL_DEFAULT_WIDTH_PX, 360);
        const height = Math.max(panel.offsetHeight || PANEL_DEFAULT_HEIGHT_PX, 340);
        const clamped = clampPanelRect({ x, y, width, height });
        panelPosition = clamped;
        panel.style.left = `${clamped.x}px`;
        panel.style.top = `${clamped.y}px`;
    }

    function clampPanelPosition(panel) {
        if (!panelPosition) {
            const initial = resolveDefaultPanelPosition(panel);
            applyPanelPosition(panel, initial.x, initial.y);
            return;
        }
        applyPanelPosition(panel, panelPosition.x, panelPosition.y);
    }

    function ensurePanelPosition(panel) {
        if (!panel) return;
        if (!panelPosition) {
            const initial = resolveDefaultPanelPosition(panel);
            applyPanelPosition(panel, initial.x, initial.y);
            return;
        }
        clampPanelPosition(panel);
    }

    function capturePanelFrame(panel = getNode("media-browser-panel")) {
        if (!isElementLike(panel)) return null;
        return {
            x: Math.round(panelPosition?.x ?? panel.offsetLeft ?? 0),
            y: Math.round(panelPosition?.y ?? panel.offsetTop ?? 0),
            width: Math.round(panel.offsetWidth || 0),
            height: Math.round(panel.offsetHeight || 0),
        };
    }

    function persistPanelLayoutState(panel = getNode("media-browser-panel")) {
        if (!isElementLike(panel)) return;
        writeMissionPanelState(MEDIA_BROWSER_PANEL_ID, {
            x: Math.round(panelPosition?.x ?? panel.offsetLeft ?? 0),
            y: Math.round(panelPosition?.y ?? panel.offsetTop ?? 0),
            width: Math.round(panel.offsetWidth || 0),
            height: Math.round(panel.offsetHeight || 0),
            state: panelVisibilityState,
            maximized: panelExpanded === true,
            layoutPresetVersion: MEDIA_BROWSER_LAYOUT_PRESET_VERSION,
            restoreFrame: restorePanelFrame && typeof restorePanelFrame === "object"
                ? {
                    x: Math.round(Number(restorePanelFrame.x) || 0),
                    y: Math.round(Number(restorePanelFrame.y) || 0),
                    width: Math.round(Number(restorePanelFrame.width) || 0),
                    height: Math.round(Number(restorePanelFrame.height) || 0),
                }
                : null,
        });
    }

    function resolveExpandedPanelRect() {
        const documentRef = getDocumentRef();
        const headerRect = documentRef?.querySelector?.(".header")?.getBoundingClientRect?.() || null;
        const timelineRect = documentRef?.querySelector?.(".timeline-dock")?.getBoundingClientRect?.() || null;
        const left = PANEL_EDGE_MARGIN_PX;
        const top = Number.isFinite(headerRect?.bottom)
            ? Math.round(headerRect.bottom + PANEL_EDGE_MARGIN_PX)
            : PANEL_EDGE_MARGIN_PX;
        const right = getViewportWidth() - PANEL_EDGE_MARGIN_PX;
        const bottom = Number.isFinite(timelineRect?.top)
            ? Math.round(timelineRect.top - PANEL_EDGE_MARGIN_PX)
            : (getViewportHeight() - PANEL_EDGE_MARGIN_PX);
        return {
            x: left,
            y: top,
            width: Math.max(360, right - left),
            height: Math.max(280, bottom - top),
        };
    }

    function applyExpandedPanelRect(panel = getNode("media-browser-panel")) {
        if (!isElementLike(panel)) return;
        const rect = resolveExpandedPanelRect();
        panel.style.width = `${rect.width}px`;
        panel.style.height = `${rect.height}px`;
        applyPanelPosition(panel, rect.x, rect.y);
    }

    function syncExpandButton(button = getNode("media-browser-panel-expand")) {
        if (!isElementLike(button)) return;
        button.dataset.icon = panelExpanded === true ? "restore" : "expand";
        button.textContent = "";
        button.title = panelExpanded === true ? "Restore" : "Expand";
        button.setAttribute("aria-label", button.title);
        button.setAttribute("aria-pressed", panelExpanded === true ? "true" : "false");
    }

    function syncDrilldownFlyoutPlacement() {
        const panel = getNode("media-browser-panel");
        const drilldown = getNode("media-browser-drilldown");
        const flyout = getNode("media-browser-drilldown-body");
        if (!isElementLike(flyout)) return;
        if (
            !isElementLike(panel)
            || !isElementLike(drilldown)
            || drilldown.open !== true
            || panel.classList.contains("media-browser-panel--hidden")
        ) {
            flyout.hidden = true;
            return;
        }

        const summary = drilldown.querySelector("summary");
        const body = panel.querySelector(".media-browser-panel__body");
        const summaryRect = summary?.getBoundingClientRect?.() || null;
        const bodyRect = body?.getBoundingClientRect?.() || panel.getBoundingClientRect();
        const viewportWidth = getViewportWidth();
        const viewportHeight = getViewportHeight();
        const flyoutWidth = Math.min(320, Math.max(260, viewportWidth - (PANEL_EDGE_MARGIN_PX * 2)));
        const desiredLeft = Number.isFinite(summaryRect?.right)
            ? summaryRect.right + PANEL_EDGE_MARGIN_PX
            : bodyRect.right + PANEL_EDGE_MARGIN_PX;
        const maxLeft = Math.max(PANEL_EDGE_MARGIN_PX, viewportWidth - flyoutWidth - PANEL_EDGE_MARGIN_PX);
        const top = clamp(
            Math.round(bodyRect.top),
            PANEL_EDGE_MARGIN_PX,
            Math.max(PANEL_EDGE_MARGIN_PX, viewportHeight - 180),
        );
        const height = clamp(
            Math.round(bodyRect.height || 320),
            180,
            Math.max(180, viewportHeight - top - PANEL_EDGE_MARGIN_PX),
        );

        flyout.hidden = false;
        flyout.style.left = `${Math.round(Math.min(desiredLeft, maxLeft))}px`;
        flyout.style.top = `${Math.round(top)}px`;
        flyout.style.width = `${Math.round(flyoutWidth)}px`;
        flyout.style.height = `${Math.round(height)}px`;
    }

    function shouldStartDrag(event) {
        if (event.button !== 0) return false;
        if (!isObjectLike(event?.target)) return false;
        if (typeof event.target.closest !== "function") return true;
        return !event.target.closest("button, input, select, option, label, output, a");
    }

    function bindPanelDragging(panel, header) {
        if (!panel || !header) return;

        const onPointerDown = (event) => {
            if (panelExpanded === true) return;
            if (!shouldStartDrag(event)) return;
            const rect = panel.getBoundingClientRect();
            dragState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                panelX: rect.left,
                panelY: rect.top,
            };
            header.setPointerCapture(event.pointerId);
            event.preventDefault();
        };

        const onPointerMove = (event) => {
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            const dx = event.clientX - dragState.startX;
            const dy = event.clientY - dragState.startY;
            applyPanelPosition(panel, dragState.panelX + dx, dragState.panelY + dy);
        };

        const releaseDrag = (event) => {
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            if (header.hasPointerCapture(event.pointerId)) {
                header.releasePointerCapture(event.pointerId);
            }
            dragState = null;
            persistPanelLayoutState(panel);
        };

        header.addEventListener("pointerdown", onPointerDown);
        header.addEventListener("pointermove", onPointerMove);
        header.addEventListener("pointerup", releaseDrag);
        header.addEventListener("pointercancel", releaseDrag);
    }

    function confirmDeletePanel() {
        const confirmFn = globalThis?.confirm;
        if (typeof confirmFn === "function") {
            const accepted = confirmFn(
                'Delete "Mission Media" from this mission layout? You can add it back from the Panels menu.',
            );
            if (!accepted) return false;
        }
        setPanelState("deleted");
        return true;
    }

    function syncPanelRegistry() {
        const panelStateName = getPanelRegistryState();
        updateMissionPanel(MEDIA_BROWSER_PANEL_ID, {
            id: MEDIA_BROWSER_PANEL_ID,
            title: panelTitle,
            kind: "workflow",
            panelType: "media-browser",
            builtIn: true,
            available: panelAvailable,
            state: panelStateName,
            sortOrder: 45,
            infoItems: [
                { label: "Panel Kind", value: "Media browser workflow" },
                { label: "Mission", value: missionLabel || "Current mission" },
                { label: "Visible Items", value: mediaCountLabel },
            ],
            actions: {
                open: () => setPanelState("open"),
                restore: () => setPanelState("open"),
                focus: panelStateName === "open"
                    ? () => setPanelState("open")
                    : undefined,
                minimize: panelStateName === "open"
                    ? () => setPanelState("minimized")
                    : undefined,
                close: (panelStateName === "open" || panelStateName === "minimized")
                    ? () => setPanelState("closed")
                    : undefined,
                delete: panelStateName !== "deleted"
                    ? () => confirmDeletePanel()
                    : undefined,
            },
        });
    }

    function syncPanelAvailability() {
        const wrapper = getNode("media-browser-panel-wrapper");
        if (isElementLike(wrapper)) {
            wrapper.hidden = !panelAvailable;
        }
        const panel = getNode("media-browser-panel");
        if (!isElementLike(panel) || panelAvailable) {
            syncPanelRegistry();
            return;
        }
        panelVisibilityState = "closed";
        panel.classList.add("media-browser-panel--hidden");
        syncDrilldownFlyoutPlacement();
        syncPanelRegistry();
    }

    function applyConfiguredDefaultPanelState() {
        if (
            !missionConfigData ||
            hasRestoredPanelVisibilityState === true ||
            defaultPanelStateApplied === true
        ) {
            return;
        }
        const defaultState = getMissionPanelDefaultState(
            missionConfigData,
            MEDIA_BROWSER_PANEL_ID,
            { fallbackState: "closed" },
        );
        defaultPanelStateApplied = true;
        setPanelState(defaultState);
    }

    function setPanelExpanded(expanded, panel = getNode("media-browser-panel")) {
        if (!isElementLike(panel)) return;
        const nextExpanded = expanded === true;
        if (nextExpanded === panelExpanded) {
            syncExpandButton();
            return;
        }
        if (nextExpanded) {
            restorePanelFrame = capturePanelFrame(panel);
            panelExpanded = true;
            panel.classList.add("is-maximized");
            applyExpandedPanelRect(panel);
        } else {
            panelExpanded = false;
            panel.classList.remove("is-maximized");
            if (restorePanelFrame && restorePanelFrame.width > 0 && restorePanelFrame.height > 0) {
                panel.style.width = `${restorePanelFrame.width}px`;
                panel.style.height = `${restorePanelFrame.height}px`;
                applyPanelPosition(panel, restorePanelFrame.x, restorePanelFrame.y);
            } else {
                ensurePanelPosition(panel);
            }
        }
        syncDrilldownFlyoutPlacement();
        syncExpandButton();
        persistPanelLayoutState(panel);
    }

    function setPanelState(nextState) {
        const resolvedState = nextState === "minimized"
            ? "minimized"
            : (nextState === "deleted"
                ? "deleted"
                : (nextState === "open" ? "open" : "closed"));
        if (resolvedState === "open" && !panelAvailable) {
            syncPanelAvailability();
            return;
        }
        panelVisibilityState = resolvedState;
        const panel = getNode("media-browser-panel");
        if (!isElementLike(panel)) return;
        const isVisible = resolvedState === "open";
        panel.classList.toggle("media-browser-panel--hidden", !isVisible);
        syncPanelRegistry();
        if (!isVisible) {
            syncDrilldownFlyoutPlacement();
            persistPanelLayoutState(panel);
            return;
        }
        if (panelExpanded === true) {
            panel.classList.add("is-maximized");
            applyExpandedPanelRect(panel);
        } else {
            panel.classList.remove("is-maximized");
            ensurePanelPosition(panel);
        }
        syncDrilldownFlyoutPlacement();
        syncExpandButton();
        persistPanelLayoutState(panel);
    }

    function renderAudienceFilters(filterModel) {
        const host = getNode("media-browser-audience-filters");
        if (!host) return;
        const nextSignature = JSON.stringify(filterModel?.audienceOptions || []);
        if (nextSignature === filterSignature) {
            return;
        }
        filterSignature = nextSignature;
        if (typeof host.replaceChildren === "function") {
            host.replaceChildren();
        } else {
            host.innerHTML = "";
        }

        for (const option of filterModel?.audienceOptions || []) {
            const button = createElement("button");
            if (!button) return;
            button.type = "button";
            button.className = option.active
                ? "media-browser-panel__filter-button is-active"
                : "media-browser-panel__filter-button";
            button.textContent = `${option.label} (${option.count})`;
            button.setAttribute("aria-pressed", option.active ? "true" : "false");
            button.addEventListener("click", () => {
                onIntent?.({ type: "setAudienceFilter", value: option.id });
            });
            host.appendChild(button);
        }
    }

    function renderCameraFilter(filterModel) {
        const select = getNode("media-browser-camera-filter");
        if (!isSelectLike(select)) return;
        const optionSignature = JSON.stringify(filterModel?.cameraOptions || []);
        if (select.dataset.optionSignature !== optionSignature) {
            select.innerHTML = "";
            for (const option of filterModel?.cameraOptions || []) {
                const element = createElement("option");
                if (!element) return;
                element.value = option.id;
                element.textContent = `${option.label} (${option.count})`;
                select.appendChild(element);
            }
            select.dataset.optionSignature = optionSignature;
        }
        select.value = filterModel?.cameraId || "all";
    }

    function renderNearbyItems(nearbyItems) {
        const host = getNode("media-browser-nearby-list");
        if (!host) return;
        const nextSignature = JSON.stringify(nearbyItems || []);
        if (nextSignature === nearbySignature) {
            return;
        }
        nearbySignature = nextSignature;
        if (typeof host.replaceChildren === "function") {
            host.replaceChildren();
        } else {
            host.innerHTML = "";
        }

        for (const item of nearbyItems || []) {
            const button = createElement("button");
            const title = createElement("span");
            const meta = createElement("span");
            if (!button || !title || !meta) return;
            button.type = "button";
            button.className = item.active
                ? "media-browser-panel__nearby-item is-active"
                : "media-browser-panel__nearby-item";
            title.className = "media-browser-panel__nearby-item-title";
            title.textContent = item.title;
            meta.className = "media-browser-panel__nearby-item-meta";
            meta.textContent = item.meta;
            button.appendChild(title);
            button.appendChild(meta);
            button.addEventListener("click", () => {
                onIntent?.({ type: "selectItem", value: item.id });
            });
            host.appendChild(button);
        }
    }

    function render(viewModel = {}) {
        ensurePanelEventsBound();
        panelTitle = viewModel.panelTitle || panelTitle;
        mediaCountLabel = viewModel.mediaCountLabel || mediaCountLabel;
        setText("media-browser-status", viewModel.statusText || "Waiting for media manifest...");
        const fullTimeLabel = viewModel.activeItem?.timeLabel || "--";
        setText("media-browser-time", resolveCompactTimeLabel(fullTimeLabel));
        setText("media-browser-full-time", fullTimeLabel);
        const timeNode = getNode("media-browser-time");
        if (timeNode) {
            timeNode.title = fullTimeLabel;
        }
        setText("media-browser-item-title", viewModel.activeItem?.title || panelTitle);
        setText("media-browser-camera", viewModel.activeItem?.cameraLabel || "--");
        setText("media-browser-photographer", viewModel.activeItem?.photographer || "--");
        setText("media-browser-location", viewModel.activeItem?.location || "--");
        setText("media-browser-source", viewModel.activeItem?.sourceLabel || "--");
        setText(
            "media-browser-description",
            viewModel.activeItem?.description
                || viewModel.descriptionEmptyText
                || viewModel.emptyText
                || "--",
        );
        setText("media-browser-timing-note", viewModel.activeItem?.timingNote || "");
        setHidden("media-browser-timing-note", !viewModel.activeItem?.timingNote);
        setText("media-browser-seed-note", viewModel.seedNote || "");
        setHidden("media-browser-seed-note", !viewModel.seedNote);
        setText("media-browser-stage-badge", viewModel.activeItem?.stageBadge || "");
        setHidden("media-browser-stage-badge", !viewModel.activeItem?.stageBadge);

        const stageEmpty = getNode("media-browser-stage-empty");
        const image = getNode("media-browser-image");
        if (isImageLike(image)) {
            if (viewModel.activeItem?.assetUrl) {
                image.src = viewModel.activeItem.assetUrl;
                image.alt = viewModel.activeItem.title || "Mission media";
                image.hidden = false;
                if (stageEmpty) {
                    stageEmpty.textContent = "";
                    stageEmpty.hidden = true;
                }
            } else {
                image.removeAttribute("src");
                image.alt = "";
                image.hidden = true;
                if (stageEmpty) {
                    stageEmpty.textContent =
                        viewModel.stageEmptyText
                        || viewModel.emptyText
                        || "No media preview available.";
                    stageEmpty.hidden = false;
                }
            }
        }

        renderAudienceFilters(viewModel.filterModel || {});
        renderCameraFilter(viewModel.filterModel || {});
        renderNearbyItems(viewModel.nearbyItems || []);
        syncDrilldownFlyoutPlacement();
        syncPanelRegistry();
    }

    function ensurePanelEventsBound() {
        if (initialized) return;
        const documentRef = getDocumentRef();
        if (!documentRef?.getElementById) return;
        initialized = true;

        const panel = getNode("media-browser-panel");
        const header = panel?.querySelector(".media-browser-panel__header");
        const headerControls = panel?.querySelector(".media-browser-panel__header-controls");
        let closeButton = getNode("media-browser-panel-close");
        let minimizeButton = getNode("media-browser-panel-minimize");
        let expandButton = getNode("media-browser-panel-expand");
        let infoButton = getNode("media-browser-panel-info");
        let deleteButton = getNode("media-browser-panel-delete");

        if (isElementLike(panel)) {
            const persistedWidth = Number(restoredPanelLayout?.width);
            const persistedHeight = Number(restoredPanelLayout?.height);
            if (Number.isFinite(persistedWidth) && persistedWidth > 0) {
                panel.style.width = `${Math.round(persistedWidth)}px`;
            }
            if (Number.isFinite(persistedHeight) && persistedHeight > 0) {
                panel.style.height = `${Math.round(persistedHeight)}px`;
            }
            const persistedX = Number(restoredPanelLayout?.x);
            const persistedY = Number(restoredPanelLayout?.y);
            if (Number.isFinite(persistedX) && Number.isFinite(persistedY)) {
                panelPosition = {
                    x: Math.round(persistedX),
                    y: Math.round(persistedY),
                };
            }
            const persistedState = String(restoredPanelLayout?.state || "").trim().toLowerCase();
            if (persistedState === "open" || persistedState === "minimized" || persistedState === "closed" || persistedState === "deleted") {
                panelVisibilityState = persistedState;
                hasRestoredPanelVisibilityState = true;
                defaultPanelStateApplied = true;
            }
            panel.classList.toggle("is-maximized", panelExpanded === true);
        }

        if (!infoButton && isElementLike(headerControls) && typeof headerControls.insertBefore === "function") {
            infoButton = createElement("button");
            if (!infoButton) return;
            infoButton.id = "media-browser-panel-info";
            infoButton.className = "media-browser-panel__icon-button mission-panel-shell__button mission-panel-shell__button--icon";
            infoButton.type = "button";
            infoButton.title = "Info";
            infoButton.setAttribute("aria-label", "Show panel info");
            infoButton.dataset.icon = "info";
            infoButton.textContent = "";
            infoButton.dataset.panelInfoTrigger = "true";
            headerControls.insertBefore(infoButton, closeButton || null);
        }

        if (!minimizeButton && isElementLike(headerControls) && typeof headerControls.insertBefore === "function") {
            minimizeButton = createElement("button");
            if (!minimizeButton) return;
            minimizeButton.id = "media-browser-panel-minimize";
            minimizeButton.className = "media-browser-panel__icon-button mission-panel-shell__button mission-panel-shell__button--icon";
            minimizeButton.type = "button";
            minimizeButton.title = "Minimize";
            minimizeButton.setAttribute("aria-label", "Minimize");
            minimizeButton.dataset.icon = "minimize";
            minimizeButton.textContent = "";
            headerControls.insertBefore(minimizeButton, closeButton || null);
        }

        if (!deleteButton && isElementLike(headerControls) && typeof headerControls.appendChild === "function") {
            deleteButton = createElement("button");
            if (!deleteButton) return;
            deleteButton.id = "media-browser-panel-delete";
            deleteButton.className = "media-browser-panel__icon-button mission-panel-shell__button mission-panel-shell__button--icon mission-panel-shell__button--danger";
            deleteButton.type = "button";
            deleteButton.title = "Delete";
            deleteButton.setAttribute("aria-label", "Delete");
            deleteButton.dataset.icon = "delete";
            deleteButton.textContent = "";
            headerControls.appendChild(deleteButton);
        }

        bindPanelDragging(panel, header);
        if (panelExpanded === true) {
            applyExpandedPanelRect(panel);
        } else {
            clampPanelPosition(panel);
        }
        panel?.classList.toggle("media-browser-panel--hidden", panelVisibilityState !== "open");
        syncExpandButton(expandButton);

        documentRef.addEventListener?.("media-browser-panel-open", () => {
            setPanelState("open");
        });
        infoButton?.addEventListener("click", () => showMissionPanelInfo(MEDIA_BROWSER_PANEL_ID, infoButton));
        minimizeButton?.addEventListener("click", () => setPanelState("minimized"));
        expandButton?.addEventListener("click", () => setPanelExpanded(panelExpanded !== true, panel));
        closeButton?.addEventListener("click", () => setPanelState("closed"));
        deleteButton?.addEventListener("click", () => confirmDeletePanel());

        const cameraFilter = getNode("media-browser-camera-filter");
        if (isSelectLike(cameraFilter)) {
            cameraFilter.addEventListener("change", () => {
                onIntent?.({ type: "setCameraFilter", value: cameraFilter.value });
            });
        }

        const drilldown = getNode("media-browser-drilldown");
        drilldown?.addEventListener?.("toggle", () => {
            const windowRef = getWindowRef();
            syncDrilldownFlyoutPlacement();
            windowRef?.requestAnimationFrame?.(syncDrilldownFlyoutPlacement);
            windowRef?.setTimeout?.(syncDrilldownFlyoutPlacement, 80);
        });

        if (panel && typeof ResizeObserver !== "undefined") {
            const resizeObserver = new ResizeObserver(() => {
                if (panel.classList.contains("media-browser-panel--hidden")) return;
                if (panelExpanded === true) {
                    applyExpandedPanelRect(panel);
                } else {
                    clampPanelPosition(panel);
                }
                syncDrilldownFlyoutPlacement();
                persistPanelLayoutState(panel);
            });
            resizeObserver.observe(panel);
        }

        getWindowRef()?.addEventListener?.("resize", () => {
            if (!isElementLike(panel)) return;
            if (!panel.classList.contains("media-browser-panel--hidden")) {
                if (panelExpanded === true) {
                    applyExpandedPanelRect(panel);
                } else {
                    clampPanelPosition(panel);
                }
                syncDrilldownFlyoutPlacement();
                persistPanelLayoutState(panel);
            }
        });
    }

    function setMissionContext({
        configData,
        available,
        title,
        nextMissionLabel,
        mediaCount,
    } = {}) {
        missionConfigData = configData || missionConfigData;
        missionLabel = String(nextMissionLabel || missionLabel).trim() || "Current mission";
        panelTitle = String(title || panelTitle).trim() || "Mission Media";
        mediaCountLabel = Number.isFinite(mediaCount) ? String(mediaCount) : mediaCountLabel;
        const enabledByMission = missionConfigData
            ? isMissionPanelEnabled(missionConfigData, MEDIA_BROWSER_PANEL_ID, { fallbackEnabled: false })
            : false;
        panelAvailable = available === true && enabledByMission;
        ensurePanelEventsBound();
        applyConfiguredDefaultPanelState();
        syncPanelAvailability();
    }

    registerMissionPanel({
        id: MEDIA_BROWSER_PANEL_ID,
        title: panelTitle,
        kind: "workflow",
        panelType: "media-browser",
        builtIn: true,
        available: panelAvailable,
        state: getPanelRegistryState(),
        sortOrder: 45,
        actions: {},
    });
    syncPanelRegistry();

    return {
        render,
        setMissionContext,
        setPanelState,
    };
}

export {
    MEDIA_BROWSER_PANEL_ID,
    createMediaBrowserPanelActions,
};
