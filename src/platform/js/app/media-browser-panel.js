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
const PANEL_DEFAULT_HEIGHT_PX = 500;
const THUMBNAIL_STRIP_DEFAULT_HEIGHT_PX = 148;
const THUMBNAIL_STRIP_MIN_HEIGHT_PX = 86;
const THUMBNAIL_STRIP_MAX_HEIGHT_PX = 240;
const THUMBNAIL_STRIP_MIN_STAGE_HEIGHT_PX = 140;
const THUMBNAIL_STRIP_KEYBOARD_STEP_PX = 12;
const THUMBNAIL_STRIP_KEYBOARD_LARGE_STEP_PX = 36;
const THUMBNAIL_SCROLLER_DRAG_THRESHOLD_PX = 5;
const MEDIA_IMAGE_MIN_ZOOM = 1;
const MEDIA_IMAGE_MAX_ZOOM = 6;
const MEDIA_IMAGE_ZOOM_STEP = 1.25;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function createDefaultMediaImageViewState() {
    return {
        zoom: MEDIA_IMAGE_MIN_ZOOM,
        panX: 0,
        panY: 0,
    };
}

function normalizeMediaImageViewState(state = {}) {
    const zoom = clamp(
        Number.isFinite(Number(state.zoom)) ? Number(state.zoom) : MEDIA_IMAGE_MIN_ZOOM,
        MEDIA_IMAGE_MIN_ZOOM,
        MEDIA_IMAGE_MAX_ZOOM,
    );
    return {
        zoom,
        panX: Number.isFinite(Number(state.panX)) ? Number(state.panX) : 0,
        panY: Number.isFinite(Number(state.panY)) ? Number(state.panY) : 0,
    };
}

function clampMediaImagePan(state = {}, stageSize = {}) {
    const normalized = normalizeMediaImageViewState(state);
    if (normalized.zoom <= MEDIA_IMAGE_MIN_ZOOM) {
        return createDefaultMediaImageViewState();
    }

    const width = Number(stageSize.width);
    const height = Number(stageSize.height);
    const maxPanX = Number.isFinite(width) && width > 0
        ? (width * (normalized.zoom - 1)) / 2
        : 0;
    const maxPanY = Number.isFinite(height) && height > 0
        ? (height * (normalized.zoom - 1)) / 2
        : 0;
    return {
        zoom: normalized.zoom,
        panX: clamp(normalized.panX, -maxPanX, maxPanX),
        panY: clamp(normalized.panY, -maxPanY, maxPanY),
    };
}

function zoomMediaImageViewState(state = {}, zoomMultiplier = 1, stageSize = {}) {
    const normalized = normalizeMediaImageViewState(state);
    const multiplier = Number.isFinite(Number(zoomMultiplier)) && Number(zoomMultiplier) > 0
        ? Number(zoomMultiplier)
        : 1;
    return clampMediaImagePan({
        ...normalized,
        zoom: normalized.zoom * multiplier,
    }, stageSize);
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

function isImageLike(value) {
    return isElementLike(value) && ("src" in value || typeof value.removeAttribute === "function");
}

function isVideoLike(value) {
    return isElementLike(value) && ("src" in value || typeof value.removeAttribute === "function");
}

function callMediaMethod(mediaElement, methodName) {
    try {
        mediaElement?.[methodName]?.();
    } catch {
        // jsdom and some browsers can reject media operations before metadata is available.
    }
}

function createElement(tagName) {
    return getDocumentRef()?.createElement?.(tagName) || null;
}

function createSvgElement(tagName) {
    return getDocumentRef()?.createElementNS?.("http://www.w3.org/2000/svg", tagName) || null;
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
    let thumbnailResizeDragState = null;
    let thumbnailScrollerDragState = null;
    let suppressThumbnailClick = false;
    let imageViewState = createDefaultMediaImageViewState();
    let imagePanDragState = null;
    let imageViewAssetUrl = "";
    let videoViewAssetUrl = "";
    let filterSignature = "";
    let thumbnailSignature = "";
    let restoredPanelLayout = readMissionPanelState(MEDIA_BROWSER_PANEL_ID) || null;
    if (String(restoredPanelLayout?.layoutPresetVersion || "").trim() !== MEDIA_BROWSER_LAYOUT_PRESET_VERSION) {
        restoredPanelLayout = null;
    }
    let hasRestoredPanelLayout = !!restoredPanelLayout;
    let thumbnailStripHeight = Number.isFinite(Number(restoredPanelLayout?.thumbnailStripHeight))
        && Number(restoredPanelLayout.thumbnailStripHeight) > 0
        ? Math.round(Number(restoredPanelLayout.thumbnailStripHeight))
        : THUMBNAIL_STRIP_DEFAULT_HEIGHT_PX;
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

    function getImageStageSize() {
        const stage = getNode("media-browser-stage");
        const rect = stage?.getBoundingClientRect?.() || null;
        return {
            width: Number(rect?.width) || stage?.clientWidth || 0,
            height: Number(rect?.height) || stage?.clientHeight || 0,
        };
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

    function formatCountLabel(count, singular, plural = `${singular}s`) {
        const normalizedCount = Number(count);
        if (!Number.isFinite(normalizedCount)) return "";
        return `${normalizedCount} ${normalizedCount === 1 ? singular : plural}`;
    }

    function formatMediaFilterSummary(filterModel = {}) {
        const matchCount = Number(filterModel.matchCount);
        const totalCount = Number(filterModel.totalCount);
        if (!Number.isFinite(matchCount) || !Number.isFinite(totalCount)) {
            return "";
        }
        const kindCounts = filterModel.matchKindCounts || {};
        const breakdown = [
            formatCountLabel(kindCounts.image, "image"),
            formatCountLabel(kindCounts.audioClip, "audio", "audio"),
            formatCountLabel(kindCounts.videoClip, "video"),
        ].filter((part) => part && !part.startsWith("0 "));
        const base = `${matchCount} of ${formatCountLabel(totalCount, "media file")} filtered in`;
        return breakdown.length > 0 ? `${base} (${breakdown.join(", ")}).` : `${base}.`;
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
            thumbnailStripHeight: Math.round(thumbnailStripHeight),
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

    function getElementHeight(node) {
        const rect = node?.getBoundingClientRect?.() || null;
        const rectHeight = Number(rect?.height);
        if (Number.isFinite(rectHeight) && rectHeight > 0) return rectHeight;
        const offsetHeight = Number(node?.offsetHeight);
        return Number.isFinite(offsetHeight) ? offsetHeight : 0;
    }

    function resolveThumbnailStripConstraints(panel = getNode("media-browser-panel")) {
        const panelHeight = getElementHeight(panel);
        if (!panelHeight) {
            return {
                min: THUMBNAIL_STRIP_MIN_HEIGHT_PX,
                max: THUMBNAIL_STRIP_MAX_HEIGHT_PX,
            };
        }

        const headerHeight = getElementHeight(panel?.querySelector?.(".media-browser-panel__header"));
        const toolbarHeight = getElementHeight(panel?.querySelector?.(".media-browser-panel__toolbar"));
        const statusHeight = getElementHeight(getNode("media-browser-status"));
        const resizerHeight = getElementHeight(getNode("media-browser-thumbnail-resizer")) || 8;
        const availableHeight = panelHeight
            - headerHeight
            - toolbarHeight
            - statusHeight
            - resizerHeight
            - THUMBNAIL_STRIP_MIN_STAGE_HEIGHT_PX;
        return {
            min: THUMBNAIL_STRIP_MIN_HEIGHT_PX,
            max: Math.max(
                THUMBNAIL_STRIP_MIN_HEIGHT_PX,
                Math.min(THUMBNAIL_STRIP_MAX_HEIGHT_PX, Math.round(availableHeight)),
            ),
        };
    }

    function applyThumbnailStripHeight(nextHeight = thumbnailStripHeight, {
        persist = false,
    } = {}) {
        const panel = getNode("media-browser-panel");
        if (!isElementLike(panel)) return;
        const constraints = resolveThumbnailStripConstraints(panel);
        const normalizedHeight = Number(nextHeight);
        thumbnailStripHeight = clamp(
            Math.round(Number.isFinite(normalizedHeight) ? normalizedHeight : THUMBNAIL_STRIP_DEFAULT_HEIGHT_PX),
            constraints.min,
            constraints.max,
        );
        const cssValue = `${thumbnailStripHeight}px`;
        if (panel.style.getPropertyValue("--media-browser-thumbnail-strip-height") !== cssValue) {
            panel.style.setProperty("--media-browser-thumbnail-strip-height", cssValue);
        }

        const strip = panel.querySelector?.(".media-browser-panel__thumbnail-strip");
        strip?.classList?.toggle("is-compact", thumbnailStripHeight <= 118);
        strip?.classList?.toggle("is-minimal", thumbnailStripHeight <= 96);

        const resizer = getNode("media-browser-thumbnail-resizer");
        if (resizer?.setAttribute) {
            resizer.setAttribute("aria-valuemin", String(Math.round(constraints.min)));
            resizer.setAttribute("aria-valuemax", String(Math.round(constraints.max)));
            resizer.setAttribute("aria-valuenow", String(Math.round(thumbnailStripHeight)));
        }
        if (persist) {
            persistPanelLayoutState(panel);
        }
    }

    function stopThumbnailStripResize(event, panel, resizer) {
        if (
            !thumbnailResizeDragState
            || (event?.pointerId != null && thumbnailResizeDragState.pointerId !== event.pointerId)
        ) {
            return;
        }
        const pointerId = thumbnailResizeDragState.pointerId;
        thumbnailResizeDragState = null;
        panel?.classList?.remove("is-resizing-thumbnails");
        if (typeof resizer?.hasPointerCapture !== "function" || resizer.hasPointerCapture(pointerId)) {
            resizer?.releasePointerCapture?.(pointerId);
        }
        applyThumbnailStripHeight(thumbnailStripHeight, { persist: true });
    }

    function bindThumbnailStripResizer() {
        const panel = getNode("media-browser-panel");
        const resizer = getNode("media-browser-thumbnail-resizer");
        if (!isElementLike(panel) || !isElementLike(resizer)) return;

        resizer.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            thumbnailResizeDragState = {
                pointerId: event.pointerId,
                startY: event.clientY,
                startHeight: thumbnailStripHeight,
            };
            panel.classList.add("is-resizing-thumbnails");
            resizer.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });

        resizer.addEventListener("pointermove", (event) => {
            if (!thumbnailResizeDragState || thumbnailResizeDragState.pointerId !== event.pointerId) return;
            applyThumbnailStripHeight(
                thumbnailResizeDragState.startHeight - (event.clientY - thumbnailResizeDragState.startY),
                { persist: false },
            );
        });

        resizer.addEventListener("pointerup", (event) => stopThumbnailStripResize(event, panel, resizer));
        resizer.addEventListener("pointercancel", (event) => stopThumbnailStripResize(event, panel, resizer));

        resizer.addEventListener("keydown", (event) => {
            const constraints = resolveThumbnailStripConstraints(panel);
            const step = event.shiftKey ? THUMBNAIL_STRIP_KEYBOARD_LARGE_STEP_PX : THUMBNAIL_STRIP_KEYBOARD_STEP_PX;
            let nextHeight = null;
            if (event.key === "ArrowDown") {
                nextHeight = thumbnailStripHeight - step;
            } else if (event.key === "ArrowUp") {
                nextHeight = thumbnailStripHeight + step;
            } else if (event.key === "PageDown") {
                nextHeight = thumbnailStripHeight - THUMBNAIL_STRIP_KEYBOARD_LARGE_STEP_PX;
            } else if (event.key === "PageUp") {
                nextHeight = thumbnailStripHeight + THUMBNAIL_STRIP_KEYBOARD_LARGE_STEP_PX;
            } else if (event.key === "Home") {
                nextHeight = constraints.min;
            } else if (event.key === "End") {
                nextHeight = constraints.max;
            }
            if (nextHeight == null) return;
            event.preventDefault();
            applyThumbnailStripHeight(nextHeight, { persist: true });
        });

        applyThumbnailStripHeight(thumbnailStripHeight);
    }

    function stopThumbnailScrollerDrag(event, host) {
        if (
            !thumbnailScrollerDragState
            || (event?.pointerId != null && thumbnailScrollerDragState.pointerId !== event.pointerId)
        ) {
            return;
        }
        const didDrag = thumbnailScrollerDragState.didDrag === true;
        const pointerId = thumbnailScrollerDragState.pointerId;
        thumbnailScrollerDragState = null;
        host?.classList?.remove("is-drag-ready", "is-dragging");
        if (typeof host?.hasPointerCapture !== "function" || host.hasPointerCapture(pointerId)) {
            host?.releasePointerCapture?.(pointerId);
        }
        if (didDrag) {
            suppressThumbnailClick = true;
            event?.preventDefault?.();
            getWindowRef()?.setTimeout?.(() => {
                suppressThumbnailClick = false;
            }, 120);
        }
    }

    function bindThumbnailStripDragging() {
        const host = getNode("media-browser-thumbnail-list");
        if (!isElementLike(host)) return;
        const documentRef = getDocumentRef();

        host.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            if (Number(host.scrollWidth) <= Number(host.clientWidth)) return;
            thumbnailScrollerDragState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                scrollLeft: Number(host.scrollLeft) || 0,
                didDrag: false,
            };
            host.classList.add("is-drag-ready");
        });

        const handlePointerMove = (event) => {
            if (!thumbnailScrollerDragState || thumbnailScrollerDragState.pointerId !== event.pointerId) return;
            const deltaX = event.clientX - thumbnailScrollerDragState.startX;
            const deltaY = event.clientY - thumbnailScrollerDragState.startY;
            if (
                thumbnailScrollerDragState.didDrag !== true
                && Math.hypot(deltaX, deltaY) < THUMBNAIL_SCROLLER_DRAG_THRESHOLD_PX
            ) {
                return;
            }
            if (thumbnailScrollerDragState.didDrag !== true) {
                thumbnailScrollerDragState.didDrag = true;
                host.classList.add("is-dragging");
                host.setPointerCapture?.(event.pointerId);
            }
            host.scrollLeft = thumbnailScrollerDragState.scrollLeft - deltaX;
            event.preventDefault();
        };

        documentRef?.addEventListener?.("pointermove", handlePointerMove, true);
        documentRef?.addEventListener?.("pointerup", (event) => stopThumbnailScrollerDrag(event, host), true);
        documentRef?.addEventListener?.("pointercancel", (event) => stopThumbnailScrollerDrag(event, host), true);
        host.addEventListener("lostpointercapture", (event) => stopThumbnailScrollerDrag(event, host));
        host.addEventListener("click", (event) => {
            if (suppressThumbnailClick !== true) return;
            suppressThumbnailClick = false;
            event.preventDefault();
            event.stopPropagation();
        }, true);
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

    function isImageViewAvailable() {
        const image = getNode("media-browser-image");
        return isImageLike(image) && image.hidden !== true && !!imageViewAssetUrl;
    }

    function syncImageViewControls() {
        const stage = getNode("media-browser-stage");
        const controls = getNode("media-browser-image-controls");
        const zoomOutButton = getNode("media-browser-image-zoom-out");
        const zoomInButton = getNode("media-browser-image-zoom-in");
        const resetButton = getNode("media-browser-image-reset");
        const zoomLabel = getNode("media-browser-image-zoom-label");
        const available = isImageViewAvailable();
        const isZoomed = imageViewState.zoom > MEDIA_IMAGE_MIN_ZOOM;

        if (controls) {
            controls.hidden = !available;
        }
        if (zoomLabel) {
            zoomLabel.textContent = `${Math.round(imageViewState.zoom * 100)}%`;
        }
        if (zoomOutButton) {
            zoomOutButton.disabled = !available || imageViewState.zoom <= MEDIA_IMAGE_MIN_ZOOM;
        }
        if (zoomInButton) {
            zoomInButton.disabled = !available || imageViewState.zoom >= MEDIA_IMAGE_MAX_ZOOM;
        }
        if (resetButton) {
            resetButton.disabled = !available || (
                !isZoomed
                && imageViewState.panX === 0
                && imageViewState.panY === 0
            );
        }
        if (isElementLike(stage)) {
            stage.classList.toggle("is-pan-enabled", available && isZoomed);
            stage.classList.toggle("is-panning", imagePanDragState != null);
        }
    }

    function applyImageViewState(nextState, {
        animate = true,
    } = {}) {
        imageViewState = clampMediaImagePan(nextState, getImageStageSize());
        const image = getNode("media-browser-image");
        if (isImageLike(image)) {
            image.style.transition = animate ? "" : "none";
            image.style.transform = `translate3d(${imageViewState.panX}px, ${imageViewState.panY}px, 0) scale(${imageViewState.zoom})`;
            if (!animate && imagePanDragState == null) {
                getWindowRef()?.requestAnimationFrame?.(() => {
                    image.style.transition = "";
                });
            }
        }
        syncImageViewControls();
    }

    function resetImageView(options = {}) {
        imagePanDragState = null;
        applyImageViewState(createDefaultMediaImageViewState(), options);
    }

    function zoomImageView(zoomMultiplier) {
        if (!isImageViewAvailable()) return;
        applyImageViewState(zoomMediaImageViewState(
            imageViewState,
            zoomMultiplier,
            getImageStageSize(),
        ));
    }

    function shouldIgnoreImageGesture(event) {
        if (!isObjectLike(event?.target)) return false;
        if (typeof event.target.closest !== "function") return false;
        return !!event.target.closest("button, input, select, option, label, output, a, summary, details");
    }

    function bindImageViewControls() {
        const stage = getNode("media-browser-stage");
        const zoomOutButton = getNode("media-browser-image-zoom-out");
        const zoomInButton = getNode("media-browser-image-zoom-in");
        const resetButton = getNode("media-browser-image-reset");

        zoomOutButton?.addEventListener?.("click", () => zoomImageView(1 / MEDIA_IMAGE_ZOOM_STEP));
        zoomInButton?.addEventListener?.("click", () => zoomImageView(MEDIA_IMAGE_ZOOM_STEP));
        resetButton?.addEventListener?.("click", () => resetImageView());

        stage?.addEventListener?.("wheel", (event) => {
            if (!isImageViewAvailable()) return;
            const deltaY = Number(event.deltaY);
            if (!Number.isFinite(deltaY) || deltaY === 0) return;
            event.preventDefault();
            zoomImageView(deltaY < 0 ? MEDIA_IMAGE_ZOOM_STEP : 1 / MEDIA_IMAGE_ZOOM_STEP);
        }, { passive: false });

        stage?.addEventListener?.("pointerdown", (event) => {
            if (!isImageViewAvailable() || imageViewState.zoom <= MEDIA_IMAGE_MIN_ZOOM) return;
            if (event.button !== 0 || shouldIgnoreImageGesture(event)) return;
            imagePanDragState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                panX: imageViewState.panX,
                panY: imageViewState.panY,
            };
            stage.setPointerCapture?.(event.pointerId);
            syncImageViewControls();
            event.preventDefault();
        });

        stage?.addEventListener?.("pointermove", (event) => {
            if (!imagePanDragState || imagePanDragState.pointerId !== event.pointerId) return;
            applyImageViewState({
                zoom: imageViewState.zoom,
                panX: imagePanDragState.panX + (event.clientX - imagePanDragState.startX),
                panY: imagePanDragState.panY + (event.clientY - imagePanDragState.startY),
            }, { animate: false });
        });

        const releasePan = (event) => {
            if (!imagePanDragState || imagePanDragState.pointerId !== event.pointerId) return;
            stage.releasePointerCapture?.(event.pointerId);
            imagePanDragState = null;
            applyImageViewState(imageViewState, { animate: false });
        };

        stage?.addEventListener?.("pointerup", releasePan);
        stage?.addEventListener?.("pointercancel", releasePan);
        syncImageViewControls();
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
        applyThumbnailStripHeight(thumbnailStripHeight);
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
        applyThumbnailStripHeight(thumbnailStripHeight);
        persistPanelLayoutState(panel);
    }

    function appendFilterButton(host, option, intentType, variant = "") {
        const button = createElement("button");
        if (!button) return;
        const count = Number(option?.count);
        button.type = "button";
        button.className = [
            "media-browser-panel__filter-button",
            variant ? `media-browser-panel__filter-button--${variant}` : "",
            option?.active ? "is-active" : "",
        ].filter(Boolean).join(" ");
        if (button.dataset) {
            button.dataset.filterId = option?.id || "";
        }
        button.textContent = option?.label || option?.id || "Filter";
        button.disabled = Number.isFinite(count) && count <= 0 && option?.active !== true && option?.id !== "all";
        button.setAttribute("aria-pressed", option?.active ? "true" : "false");
        button.title = [
            option?.title,
            Number.isFinite(count) ? `${count} matching items` : "",
        ].filter(Boolean).join(" - ");
        button.addEventListener("click", () => {
            onIntent?.({ type: intentType, value: option?.id });
        });
        host.appendChild(button);
    }

    function appendFilterFacetGroup(host, label, options, intentType, variant = "") {
        const filteredOptions = (Array.isArray(options) ? options : []).filter(Boolean);
        if (!filteredOptions.length) return;
        const group = createElement("div");
        const groupLabel = createElement("span");
        const buttons = createElement("div");
        if (!group || !groupLabel || !buttons) return;
        group.className = [
            "media-browser-panel__filter-facet",
            variant ? `media-browser-panel__filter-facet--${variant}` : "",
        ].filter(Boolean).join(" ");
        group.setAttribute("role", "group");
        group.setAttribute("aria-label", label);
        groupLabel.className = "media-browser-panel__filter-facet-label";
        groupLabel.textContent = label;
        buttons.className = "media-browser-panel__filter-facet-buttons";
        group.appendChild(groupLabel);
        group.appendChild(buttons);
        filteredOptions.forEach((option) => appendFilterButton(buttons, option, intentType, variant));
        host.appendChild(group);
    }

    function renderMediaFilterControls(filterModel) {
        const host = getNode("media-browser-filter-bar");
        if (!host) return;
        const nextSignature = JSON.stringify({
            kindPillOptions: filterModel?.kindPillOptions || [],
            subjectOptions: filterModel?.subjectOptions || filterModel?.quickOptions || [],
            cameraButtonOptions: filterModel?.cameraButtonOptions || [],
        });
        if (nextSignature === filterSignature) {
            return;
        }
        filterSignature = nextSignature;
        if (typeof host.replaceChildren === "function") {
            host.replaceChildren();
        } else {
            host.innerHTML = "";
        }

        const kindPillOptions = filterModel?.kindPillOptions || [];
        appendFilterFacetGroup(host, "Type", kindPillOptions, "toggleMediaKind", "kind-pill");

        const subjectOptions = filterModel?.subjectOptions || filterModel?.quickOptions || [];
        appendFilterFacetGroup(host, "Subject", subjectOptions, "toggleSubject", "subject");

        const cameraOptions = filterModel?.cameraButtonOptions || [];
        appendFilterFacetGroup(host, "Camera", cameraOptions, "toggleCameraFilter", "camera");
    }

    function syncAudioControls(audioModel = {}) {
        const button = getNode("media-browser-audio-toggle");
        const now = getNode("media-browser-audio-now");
        const available = audioModel.available === true;
        const enabled = available && audioModel.enabled === true;
        if (isElementLike(button)) {
            button.disabled = !available;
            button.classList.toggle("is-active", enabled);
            button.setAttribute("aria-pressed", enabled ? "true" : "false");
            button.title = available
                ? (enabled ? "Pause mission audio" : "Play mission audio")
                : "No mission audio clips are available";
        }
        if (now) {
            now.textContent = enabled ? String(audioModel.nowLabel || "") : "";
            now.title = now.textContent;
        }
    }

    function syncPlaybackActions(playbackModel = {}) {
        const actions = getNode("media-browser-playback-actions");
        const startButton = getNode("media-browser-playback-start");
        const restartButton = getNode("media-browser-playback-restart");
        const show = playbackModel.showStartOptions === true;
        if (actions) {
            actions.hidden = !show;
        }
        if (startButton) {
            startButton.disabled = !show;
            startButton.title = playbackModel.startTitle || "Start media from the current mission time";
        }
        if (restartButton) {
            restartButton.disabled = !show;
            restartButton.title = playbackModel.restartTitle || "Start media from its beginning";
        }
    }

    function syncFilterNavigation(navigationModel = {}) {
        const scroller = getNode("media-browser-filter-scroller");
        const previousButton = getNode("media-browser-filter-prev");
        const nextButton = getNode("media-browser-filter-next");
        const position = getNode("media-browser-filter-position");
        const available = navigationModel.available === true;
        if (scroller) {
            scroller.hidden = !available;
        }
        if (previousButton) {
            previousButton.disabled = !available || navigationModel.previousEnabled !== true;
            previousButton.title = navigationModel.previousTitle || "Previous filtered media";
            previousButton.setAttribute(
                "aria-label",
                navigationModel.previousTitle || "Previous filtered media",
            );
        }
        if (nextButton) {
            nextButton.disabled = !available || navigationModel.nextEnabled !== true;
            nextButton.title = navigationModel.nextTitle || "Next filtered media";
            nextButton.setAttribute(
                "aria-label",
                navigationModel.nextTitle || "Next filtered media",
            );
        }
        if (position) {
            position.textContent = navigationModel.positionLabel || "No media selected";
            position.title = position.textContent;
        }
    }

    function createAudioWaveformThumbnail() {
        const svg = createSvgElement("svg");
        const glow = createSvgElement("path");
        const line = createSvgElement("path");
        if (!svg || !glow || !line) return null;
        const path = "M12 36 C24 18 38 18 52 36 S78 54 92 36 S118 12 134 36 S166 60 182 36 S210 20 226 36 S252 52 268 36";
        svg.classList.add("media-browser-panel__thumbnail-waveform");
        svg.setAttribute("viewBox", "0 0 280 72");
        svg.setAttribute("focusable", "false");
        svg.setAttribute("aria-hidden", "true");
        svg.addEventListener("dragstart", (event) => event.preventDefault());
        glow.classList.add("media-browser-panel__thumbnail-waveform-glow");
        glow.setAttribute("d", path);
        line.classList.add("media-browser-panel__thumbnail-waveform-line");
        line.setAttribute("d", path);
        svg.appendChild(glow);
        svg.appendChild(line);
        return svg;
    }

    function createThumbnailFallback(kind) {
        if (kind === "audioClip") {
            return createAudioWaveformThumbnail();
        }
        const fallback = createElement("span");
        if (!fallback) return null;
        fallback.className = "media-browser-panel__thumbnail-fallback";
        fallback.textContent = kind === "videoClip" ? "Video" : "Image";
        fallback.addEventListener("dragstart", (event) => event.preventDefault());
        return fallback;
    }

    function renderThumbnailItems(thumbnailItems) {
        const host = getNode("media-browser-thumbnail-list");
        if (!host) return;
        const nextSignature = JSON.stringify(thumbnailItems || []);
        if (nextSignature === thumbnailSignature) {
            return;
        }
        thumbnailSignature = nextSignature;
        if (typeof host.replaceChildren === "function") {
            host.replaceChildren();
        } else {
            host.innerHTML = "";
        }

        for (const item of thumbnailItems || []) {
            const button = createElement("button");
            const media = createElement("span");
            const image = createElement("img");
            const fallback = createThumbnailFallback(item.kind);
            const badge = createElement("span");
            const title = createElement("span");
            const meta = createElement("span");
            if (!button || !media || !badge || !title || !meta) return;
            button.type = "button";
            button.className = [
                "media-browser-panel__thumbnail-card",
                item.kind ? `media-browser-panel__thumbnail-card--${item.kind}` : "",
                item.active ? "is-active" : "",
            ].filter(Boolean).join(" ");
            if (item.active) {
                button.setAttribute("aria-current", "true");
            }
            button.draggable = false;
            button.title = [item.title, item.meta].filter(Boolean).join(" - ");
            media.className = "media-browser-panel__thumbnail-media";
            media.addEventListener("dragstart", (event) => event.preventDefault());
            if (image && item.thumbnailAssetUrl) {
                image.alt = "";
                image.loading = "lazy";
                image.decoding = "async";
                image.draggable = false;
                image.src = item.thumbnailAssetUrl;
                image.addEventListener("dragstart", (event) => event.preventDefault());
                if (item.fallbackAssetUrl && item.fallbackAssetUrl !== item.thumbnailAssetUrl) {
                    image.dataset.fallbackSrc = item.fallbackAssetUrl;
                }
                image.addEventListener("error", () => {
                    const fallbackSrc = image.dataset?.fallbackSrc || "";
                    if (fallbackSrc && image.src !== fallbackSrc) {
                        image.removeAttribute("data-fallback-src");
                        image.src = fallbackSrc;
                        return;
                    }
                    image.hidden = true;
                    fallback?.removeAttribute?.("hidden");
                });
                media.appendChild(image);
                if (fallback) {
                    fallback.setAttribute("hidden", "");
                    media.appendChild(fallback);
                }
            } else if (fallback) {
                media.appendChild(fallback);
            }
            badge.className = "media-browser-panel__thumbnail-kind";
            badge.textContent = item.badge || "Media";
            media.appendChild(badge);
            title.className = "media-browser-panel__thumbnail-title";
            title.textContent = item.title;
            meta.className = "media-browser-panel__thumbnail-meta";
            meta.textContent = item.meta;
            button.appendChild(media);
            button.appendChild(title);
            button.appendChild(meta);
            button.addEventListener("click", () => {
                onIntent?.({ type: "previewItem", value: item.id });
            });
            host.appendChild(button);
        }

        const activeButton = host.querySelector?.(".media-browser-panel__thumbnail-card.is-active");
        if (!activeButton || typeof activeButton.getBoundingClientRect !== "function") return;
        if (typeof host.getBoundingClientRect !== "function") return;
        const hostRect = host.getBoundingClientRect();
        const activeRect = activeButton.getBoundingClientRect();
        const edgePadding = Math.min(120, Math.max(48, hostRect.width * 0.18));
        const isNearEdge = activeRect.left < (hostRect.left + edgePadding)
            || activeRect.right > (hostRect.right - edgePadding);
        if (!isNearEdge) return;
        const prefersReducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
        try {
            activeButton.scrollIntoView?.({
                block: "nearest",
                inline: "center",
                behavior: prefersReducedMotion ? "auto" : "smooth",
            });
        } catch {
            activeButton.scrollIntoView?.();
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
        setHidden("media-browser-camera", !viewModel.activeItem?.cameraLabel);
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
        const video = getNode("media-browser-video");
        const image = getNode("media-browser-image");
        const audioPlaceholder = getNode("media-browser-audio-placeholder");
        const activeItem = viewModel.activeItem || null;
        const hasVideo = activeItem?.kind === "videoClip" && !!activeItem.videoAssetUrl;
        const hasAudio = activeItem?.kind === "audioClip";
        const hasImage = !hasVideo && !hasAudio && !!activeItem?.assetUrl;

        if (isVideoLike(video)) {
            if (hasVideo) {
                const nextVideoUrl = activeItem.videoAssetUrl;
                if (videoViewAssetUrl !== nextVideoUrl || video.getAttribute?.("src") !== nextVideoUrl) {
                    videoViewAssetUrl = nextVideoUrl;
                    video.src = nextVideoUrl;
                    callMediaMethod(video, "load");
                }
                if (activeItem.posterAssetUrl) {
                    video.poster = activeItem.posterAssetUrl;
                } else {
                    video.removeAttribute?.("poster");
                }
                if (video.dataset) {
                    video.dataset.mediaItemId = activeItem.id || "";
                }
                video.hidden = false;
            } else {
                if (videoViewAssetUrl) {
                    callMediaMethod(video, "pause");
                    video.removeAttribute?.("src");
                    video.removeAttribute?.("poster");
                    callMediaMethod(video, "load");
                }
                videoViewAssetUrl = "";
                if (video.dataset) {
                    video.dataset.mediaItemId = "";
                }
                video.hidden = true;
            }
        }

        if (isImageLike(image)) {
            if (hasImage) {
                const nextAssetUrl = activeItem.assetUrl;
                if (image.getAttribute?.("src") !== nextAssetUrl) {
                    image.src = nextAssetUrl;
                }
                image.alt = activeItem.title || "Mission media";
                image.hidden = false;
                if (imageViewAssetUrl !== nextAssetUrl) {
                    imageViewAssetUrl = nextAssetUrl;
                    resetImageView({ animate: false });
                } else {
                    applyImageViewState(imageViewState, { animate: false });
                }
            } else {
                imageViewAssetUrl = "";
                image.removeAttribute("src");
                image.alt = "";
                image.hidden = true;
                resetImageView({ animate: false });
            }
        }

        if (audioPlaceholder) {
            audioPlaceholder.hidden = !hasAudio;
        }

        if (stageEmpty) {
            if (hasVideo || hasImage || hasAudio) {
                stageEmpty.textContent = "";
                stageEmpty.hidden = true;
            } else {
                stageEmpty.textContent =
                    viewModel.stageEmptyText
                    || viewModel.emptyText
                    || "No media preview available.";
                stageEmpty.hidden = false;
            }
        }

        renderMediaFilterControls(viewModel.filterModel || {});
        setText("media-browser-filter-summary", viewModel.filterSummaryLabel || formatMediaFilterSummary(viewModel.filterModel || {}));
        syncAudioControls(viewModel.audioModel || {});
        syncPlaybackActions(viewModel.playbackModel || {});
        syncFilterNavigation(viewModel.navigationModel || {});
        renderThumbnailItems(viewModel.thumbnailItems || []);
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
        bindImageViewControls();
        bindThumbnailStripResizer();
        bindThumbnailStripDragging();
        if (panelExpanded === true) {
            applyExpandedPanelRect(panel);
        } else {
            clampPanelPosition(panel);
        }
        applyThumbnailStripHeight(thumbnailStripHeight);
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

        getNode("media-browser-audio-toggle")?.addEventListener?.("click", () => {
            onIntent?.({ type: "toggleAudio" });
        });

        getNode("media-browser-filter-prev")?.addEventListener?.("click", () => {
            onIntent?.({ type: "selectAdjacentItem", value: "previous" });
        });

        getNode("media-browser-filter-next")?.addEventListener?.("click", () => {
            onIntent?.({ type: "selectAdjacentItem", value: "next" });
        });

        getNode("media-browser-playback-start")?.addEventListener?.("click", () => {
            onIntent?.({ type: "startActiveMedia" });
        });

        getNode("media-browser-playback-restart")?.addEventListener?.("click", () => {
            onIntent?.({ type: "startActiveMediaFromBeginning" });
        });

        const video = getNode("media-browser-video");
        const getVideoItemId = () => String(video?.dataset?.mediaItemId || "").trim();
        video?.addEventListener?.("play", () => {
            onIntent?.({ type: "mediaPlaybackStarted", value: getVideoItemId(), mediaKind: "videoClip" });
        });
        video?.addEventListener?.("pause", () => {
            if (video?.ended === true) return;
            onIntent?.({ type: "mediaPlaybackPaused", value: getVideoItemId(), mediaKind: "videoClip" });
        });
        video?.addEventListener?.("ended", () => {
            onIntent?.({ type: "mediaPlaybackEnded", value: getVideoItemId(), mediaKind: "videoClip" });
        });
        video?.addEventListener?.("timeupdate", () => {
            onIntent?.({
                type: "mediaPlaybackTimeUpdate",
                value: getVideoItemId(),
                mediaKind: "videoClip",
                currentTime: Number(video?.currentTime),
            });
        });

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
                applyThumbnailStripHeight(thumbnailStripHeight);
                applyImageViewState(imageViewState, { animate: false });
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
                applyThumbnailStripHeight(thumbnailStripHeight);
                applyImageViewState(imageViewState, { animate: false });
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
    clampMediaImagePan,
    createDefaultMediaImageViewState,
    zoomMediaImageViewState,
};
