const PANEL_SPECS = Object.freeze([
    {
        id: "earth",
        title: "Craft -> Earth",
        chipLabel: "Craft -> Earth",
        anchorKey: "craft",
        targetKey: "earth",
        infoMode: "none",
        defaultFov: 45,
    },
    {
        id: "moon",
        title: "Craft -> Moon",
        chipLabel: "Craft -> Moon",
        anchorKey: "craft",
        targetKey: "moon",
        infoMode: "moon-visibility",
        defaultFov: 45,
    },
    {
        id: "earth-to-moon",
        title: "Earth -> Moon",
        chipLabel: "Earth -> Moon",
        anchorKey: "earth",
        targetKey: "moon",
        infoMode: "moon-phase",
        defaultFov: 45,
    },
    {
        id: "earth-rise-composer",
        title: "Earth Rise Composer",
        chipLabel: "Earth Rise Composer",
        anchorKey: "craft",
        targetKey: "moon",
        infoMode: "none",
        mode: "composer",
        side: "left",
        defaultFov: 50,
    },
]);

const PANEL_GAP_PX = 8;
const PANEL_MARGIN_PX = 8;
const PANEL_TOP_OFFSET_PX = 38;
const PANEL_SIDE_RATIO_DEFAULT = 0.27;
const PANEL_SIDE_RATIO_COMPOSER = 0.4;
const PANEL_MIN_SIDE_DEFAULT = 160;
const PANEL_MIN_SIDE_COMPOSER = 240;
const AUTO_FOV_MARGIN_SCALE = 1.03;
const AUTO_FOV_MIN_DEGREES = 1;
const AUTO_FOV_MAX_DEGREES = 179;
const PANEL_STATE_STORAGE_KEY = "moon-mission:aux-camera-panels:v1";
const COMPOSER_DRAG_SENSITIVITY = 0.004;
const COMPOSER_MAX_PITCH_RAD = (Math.PI * 0.5) - 0.02;
const COMPOSER_TIMELINE_WINDOW_MS = 2 * 60 * 60 * 1000;
const COMPOSER_TIMELINE_RESOLUTION = 1000;
const COMPOSER_DEFAULT_AMBIENT = 0.25;
const COMPOSER_MIN_AMBIENT = 0;
const COMPOSER_MAX_AMBIENT = 2.4;
const COMPOSER_DEFAULT_ROLL_RAD = Math.PI * 1.5;

function safeParseJson(text, fallbackValue) {
    try {
        return JSON.parse(text);
    } catch {
        return fallbackValue;
    }
}

function isDesktopViewport() {
    return window.innerWidth > 600;
}

class AuxiliaryCameraViewsManager {
    constructor({ THREE, overlayHost, requestRender }) {
        this.THREE = THREE;
        this.overlayHost = overlayHost || document.body;
        this.requestRender = typeof requestRender === "function" ? requestRender : null;
        this.root = null;
        this.chipDock = null;
        this.chipDockLeft = null;
        this.chipDockRight = null;
        this.panels = [];
        this.panelsEnabled = true;
        this.zIndexCounter = 1;
        this.dragState = null;
        this.handleResizeBound = this.handleResize.bind(this);
        this.panelStateByElement = new WeakMap();
        this.pendingResizePanelStates = new Set();
        this.pendingResizeRaf = null;
        this.handlePanelResizeEntriesBound = this.handlePanelResizeEntries.bind(this);
        this.persistedPanelState = this.readPersistedPanelState();
        this.persistStateTimeout = null;
        this.composerAmbientLightByScene = new WeakMap();

        this.craftWorld = new THREE.Vector3();
        this.anchorWorld = new THREE.Vector3();
        this.targetWorld = new THREE.Vector3();
        this.earthWorld = new THREE.Vector3();
        this.moonWorld = new THREE.Vector3();
        this.sunWorld = new THREE.Vector3();
        this.sunDirectionWorld = new THREE.Vector3();
        this.sunDirectionFromEarth = new THREE.Vector3();
        this.craftFromMoonDir = new THREE.Vector3();
        this.earthFromMoonDir = new THREE.Vector3();
        this.sunFromMoonDir = new THREE.Vector3();
        this.tmpVectorA = new THREE.Vector3();
        this.tmpVectorB = new THREE.Vector3();
        this.tmpVectorC = new THREE.Vector3();
        this.tmpVectorD = new THREE.Vector3();
        this.tmpVectorE = new THREE.Vector3();
        this.tmpVectorF = new THREE.Vector3();
        this.viewDir = new THREE.Vector3();
        this.targetUp = new THREE.Vector3();
        this.composerWorldUp = new THREE.Vector3(0, 0, 1);
        this.composerBaseUp = new THREE.Vector3();
        this.composerRotatedUp = new THREE.Vector3();
        this.targetQuat = new THREE.Quaternion();
        this.tmpQuatA = new THREE.Quaternion();
        this.tmpQuatB = new THREE.Quaternion();
        this.panelCameraWorldQuat = new THREE.Quaternion();
        this.panelCameraWorldQuatInv = new THREE.Quaternion();
        this.earthDirInCamera = new THREE.Vector3();
        this.cameraOffset = new THREE.Vector3();
        this.composerLookWorld = new THREE.Vector3();
        this.composerLookAtWorld = new THREE.Vector3();
        this.boundingBox = new THREE.Box3();
        this.boundingSphere = new THREE.Sphere();
        this.originalSkyPosition = new THREE.Vector3();
        this.panelCameraWorldPosition = new THREE.Vector3();
        this.panelSkyLocalPosition = new THREE.Vector3();
        this.moonElongationPrevious = null;
        this.moonElongationTrend = 1;
        this.moonVisibilitySamples = this.createFibonacciSphereSamples(720);
        this.analyticsLastUpdateMs = -Infinity;
        this.cachedMoonPhaseInfo = null;
        this.cachedMoonVisibilityInfo = null;
        this.composerFlybyTimeMs = Number.NaN;

        if (!isDesktopViewport()) {
            return;
        }

        this.createDom();
        window.addEventListener("resize", this.handleResizeBound, { passive: true });
    }

    getPanelResizeObserver() {
        if (typeof ResizeObserver === "undefined") {
            return null;
        }
        if (!this.panelResizeObserver) {
            this.panelResizeObserver = new ResizeObserver(this.handlePanelResizeEntriesBound);
        }
        return this.panelResizeObserver;
    }

    createDom() {
        this.root = document.createElement("div");
        this.root.id = "aux-camera-views";
        this.root.className = "aux-camera-views";
        this.overlayHost.appendChild(this.root);

        this.chipDockLeft = document.createElement("div");
        this.chipDockLeft.className = "aux-camera-chip-dock aux-camera-chip-dock--left";
        this.root.appendChild(this.chipDockLeft);

        this.chipDockRight = document.createElement("div");
        this.chipDockRight.className = "aux-camera-chip-dock aux-camera-chip-dock--right";
        this.root.appendChild(this.chipDockRight);
        this.chipDock = this.chipDockRight;

        PANEL_SPECS.forEach((spec, index) => {
            this.createPanel(spec, index);
        });

        this.applyDefaultPanelLayout();
    }

    readPersistedPanelState() {
        const storage = globalThis?.localStorage;
        if (!storage) {
            return {};
        }
        let raw = null;
        try {
            raw = storage.getItem(PANEL_STATE_STORAGE_KEY);
        } catch {
            return {};
        }
        if (!raw) {
            return {};
        }
        const parsed = safeParseJson(raw, {});
        return parsed && typeof parsed === "object" ? parsed : {};
    }

    queuePersistPanelState() {
        if (this.persistStateTimeout != null) {
            clearTimeout(this.persistStateTimeout);
        }
        this.persistStateTimeout = setTimeout(() => {
            this.persistStateTimeout = null;
            this.persistPanelState();
        }, 120);
    }

    persistPanelState() {
        const storage = globalThis?.localStorage;
        if (!storage) {
            return;
        }
        const payload = {};
        for (const panelState of this.panels) {
            payload[panelState.id] = {
                fov: Number.isFinite(panelState.camera?.fov) ? Number(panelState.camera.fov) : null,
                autoFovEnabled: panelState.autoFovEnabled === true,
                farSideTintEnabled: panelState.farSideTintEnabled === true,
            };
        }
        try {
            storage.setItem(PANEL_STATE_STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // Ignore persistence failures (privacy mode/quota).
        }
    }

    readTimelineDockOffset() {
        const cssValue = getComputedStyle(document.documentElement)
            .getPropertyValue("--timeline-dock-offset")
            .trim();
        const parsed = Number.parseFloat(cssValue);
        return Number.isFinite(parsed) ? parsed : PANEL_MARGIN_PX;
    }

    clampPanelRect({ x, y, width, height }) {
        const viewportWidth = Math.max(window.innerWidth, 1);
        const viewportHeight = Math.max(window.innerHeight, 1);
        const maxX = Math.max(PANEL_MARGIN_PX, viewportWidth - width - PANEL_MARGIN_PX);
        const maxY = Math.max(PANEL_MARGIN_PX, viewportHeight - height - PANEL_MARGIN_PX);
        return {
            x: Math.min(Math.max(Math.round(x), PANEL_MARGIN_PX), maxX),
            y: Math.min(Math.max(Math.round(y), PANEL_MARGIN_PX), maxY),
        };
    }

    getDefaultPanelPosition(panel, index) {
        const width = Math.max(120, Math.round(panel.offsetWidth || 280));
        const height = Math.max(80, Math.round(panel.offsetHeight || 192));
        const dockOffset = this.readTimelineDockOffset();
        const x = window.innerWidth - width - dockOffset;
        const y = dockOffset + PANEL_TOP_OFFSET_PX + index * (height + PANEL_GAP_PX);
        return this.clampPanelRect({
            x,
            y,
            width,
            height,
        });
    }

    applyDefaultPanelLayout() {
        if (!this.panels.length) {
            return;
        }
        const headerEl = document.querySelector(".header");
        const timelineEl = document.querySelector(".timeline-dock");
        const headerRect = headerEl?.getBoundingClientRect?.() || null;
        const timelineRect = timelineEl?.getBoundingClientRect?.() || null;
        const headerSpace = Number.isFinite(headerRect?.height) ? headerRect.height : 0;
        const controlSpace = Number.isFinite(timelineRect?.height) ? timelineRect.height : 0;
        const h = Math.max(0, window.innerHeight - headerSpace - controlSpace);
        const dockOffset = this.readTimelineDockOffset();
        const topY = Number.isFinite(headerRect?.bottom)
            ? (headerRect.bottom + PANEL_GAP_PX)
            : (dockOffset + PANEL_TOP_OFFSET_PX);
        const maxSideFromWidth = Math.max(PANEL_MIN_SIDE_DEFAULT, window.innerWidth - dockOffset - PANEL_MARGIN_PX * 2);
        const panelRects = this.panels.map((panelState) => {
            const ratio = panelState.mode === "composer"
                ? PANEL_SIDE_RATIO_COMPOSER
                : PANEL_SIDE_RATIO_DEFAULT;
            const sideFromFormula = ratio * h;
            const minSideTarget = panelState.mode === "composer"
                ? PANEL_MIN_SIDE_COMPOSER
                : PANEL_MIN_SIDE_DEFAULT;
            const minSide = Math.min(minSideTarget, maxSideFromWidth);
            const side = Math.round(this.THREE.MathUtils.clamp(sideFromFormula, minSide, maxSideFromWidth));
            panelState.panel.style.width = `${side}px`;
            panelState.panel.style.height = `${side}px`;
            return { panelState, width: side, height: side };
        });

        let rightY = topY;
        let leftY = topY;
        for (const item of panelRects) {
            const onLeft = item.panelState.side === "left";
            const x = onLeft
                ? dockOffset
                : (window.innerWidth - item.width - dockOffset);
            const y = onLeft ? leftY : rightY;
            this.applyPanelPosition(item.panelState, x, y);
            if (onLeft) {
                leftY += item.height + PANEL_GAP_PX;
            } else {
                rightY += item.height + PANEL_GAP_PX;
            }
        }
    }

    applyPanelPosition(panelState, x, y) {
        const width = Math.max(120, Math.round(panelState.panel.offsetWidth || panelState.width || 280));
        const height = Math.max(80, Math.round(panelState.panel.offsetHeight || panelState.height || 192));
        const clamped = this.clampPanelRect({ x, y, width, height });
        panelState.x = clamped.x;
        panelState.y = clamped.y;
        panelState.panel.style.left = `${panelState.x}px`;
        panelState.panel.style.top = `${panelState.y}px`;
    }

    clampPanelPosition(panelState) {
        const currentX = Number.isFinite(panelState.x) ? panelState.x : panelState.panel.offsetLeft;
        const currentY = Number.isFinite(panelState.y) ? panelState.y : panelState.panel.offsetTop;
        this.applyPanelPosition(panelState, currentX, currentY);
    }

    bringPanelToFront(panelState) {
        this.zIndexCounter += 1;
        panelState.panel.style.zIndex = String(this.zIndexCounter);
    }

    setPanelMinimized(panelState, minimized, { persist = true, requestRender = true } = {}) {
        const nextMinimized = minimized === true;
        panelState.minimized = nextMinimized;
        panelState.panel.classList.toggle("is-minimized", nextMinimized);
        panelState.panel.hidden = nextMinimized;
        if (panelState.chipButton) {
            panelState.chipButton.hidden = !nextMinimized;
            panelState.chipButton.setAttribute("aria-pressed", nextMinimized ? "true" : "false");
            panelState.chipButton.title = nextMinimized
                ? `Restore ${panelState.title}`
                : `Minimize ${panelState.title}`;
        }
        if (nextMinimized) {
            this.clearPanelOverlay(panelState);
        }
        if (persist) {
            this.queuePersistPanelState();
        }
        if (requestRender) {
            this.requestRender?.();
        }
    }

    shouldStartDrag(event) {
        if (event.button !== 0) return false;
        if (!(event.target instanceof Element)) return false;
        return !event.target.closest("input, button, select, option, label, output");
    }

    bindPanelDragging(panelState, header) {
        const onPointerDown = (event) => {
            if (!this.shouldStartDrag(event)) return;
            this.bringPanelToFront(panelState);
            this.dragState = {
                panelState,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                panelX: Number.isFinite(panelState.x) ? panelState.x : panelState.panel.offsetLeft,
                panelY: Number.isFinite(panelState.y) ? panelState.y : panelState.panel.offsetTop,
            };
            header.setPointerCapture(event.pointerId);
            event.preventDefault();
        };

        const onPointerMove = (event) => {
            if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;
            const dx = event.clientX - this.dragState.startX;
            const dy = event.clientY - this.dragState.startY;
            this.applyPanelPosition(
                this.dragState.panelState,
                this.dragState.panelX + dx,
                this.dragState.panelY + dy,
            );
        };

        const releaseDrag = (event) => {
            if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;
            if (header.hasPointerCapture(event.pointerId)) {
                header.releasePointerCapture(event.pointerId);
            }
            this.dragState = null;
            this.queuePersistPanelState();
        };

        header.addEventListener("pointerdown", onPointerDown);
        header.addEventListener("pointermove", onPointerMove);
        header.addEventListener("pointerup", releaseDrag);
        header.addEventListener("pointercancel", releaseDrag);
        panelState.onPointerDown = onPointerDown;
        panelState.onPointerMove = onPointerMove;
        panelState.onPointerUp = releaseDrag;
        panelState.onPointerCancel = releaseDrag;
    }

    createPanel(spec, index) {
        const panel = document.createElement("section");
        panel.className = "aux-camera-view";
        panel.dataset.target = spec.targetKey;

        const header = document.createElement("div");
        header.className = "aux-camera-view__header";

        const title = document.createElement("div");
        title.className = "aux-camera-view__title";
        title.textContent = spec.title;
        header.appendChild(title);

        const headerControls = document.createElement("div");
        headerControls.className = "aux-camera-view__header-controls";

        const fovControls = document.createElement("div");
        fovControls.className = "aux-camera-view__fov-controls";

        const fovLabel = document.createElement("label");
        fovLabel.className = "aux-camera-view__fov-label";
        fovLabel.textContent = "FoV";
        fovControls.appendChild(fovLabel);

        const autoToggle = document.createElement("button");
        autoToggle.className = "aux-camera-view__auto-toggle";
        autoToggle.type = "button";
        autoToggle.textContent = "Auto";
        autoToggle.setAttribute("aria-label", `${spec.title} automatic field of view`);
        fovControls.appendChild(autoToggle);

        const fovSlider = document.createElement("input");
        fovSlider.className = "aux-camera-view__fov-slider";
        fovSlider.type = "range";
        fovSlider.min = String(AUTO_FOV_MIN_DEGREES);
        fovSlider.max = String(AUTO_FOV_MAX_DEGREES);
        fovSlider.step = "1";
        fovSlider.value = String(spec.defaultFov);
        fovSlider.setAttribute("aria-label", `${spec.title} field of view`);
        fovControls.appendChild(fovSlider);

        const fovValue = document.createElement("output");
        fovValue.className = "aux-camera-view__fov-value";
        fovControls.appendChild(fovValue);

        const minimizeButton = document.createElement("button");
        minimizeButton.className = "aux-camera-view__minimize-button";
        minimizeButton.type = "button";
        minimizeButton.textContent = "x";
        minimizeButton.setAttribute("aria-label", `Collapse ${spec.title}`);

        headerControls.appendChild(fovControls);
        headerControls.appendChild(minimizeButton);
        header.appendChild(headerControls);
        panel.appendChild(header);

        const panelMode = spec.mode || "target";
        const panelSide = spec.side === "left" ? "left" : "right";
        panel.dataset.mode = panelMode;
        panel.dataset.side = panelSide;
        if (panelMode === "composer") {
            panel.classList.add("aux-camera-view--composer");
        }

        let info = null;
        let infoPrimary = null;
        let infoPrimaryText = null;
        let infoPill = null;
        let infoSecondary = null;
        let composerPresetWrap = null;
        let composerLookFreeButton = null;
        let composerLookEarthButton = null;
        let composerLookMoonButton = null;
        let composerTimelineWrap = null;
        let composerTimelineSlider = null;
        let composerTimelineLabel = null;
        let composerControlsWrap = null;
        let composerAmbientSlider = null;
        let composerAmbientValue = null;
        let composerDial = null;
        let composerDialNeedle = null;
        let composerDisabledOverlay = null;
        if (panelMode === "composer") {
            composerPresetWrap = document.createElement("div");
            composerPresetWrap.className = "aux-camera-view__composer-presets";
            const presetLabel = document.createElement("span");
            presetLabel.className = "aux-camera-view__composer-label";
            presetLabel.textContent = "Lock";
            composerPresetWrap.appendChild(presetLabel);

            composerLookFreeButton = document.createElement("button");
            composerLookFreeButton.type = "button";
            composerLookFreeButton.className = "aux-camera-view__composer-button";
            composerLookFreeButton.textContent = "Free";
            composerLookFreeButton.setAttribute("aria-label", "Earth Rise Composer unlock camera");
            composerPresetWrap.appendChild(composerLookFreeButton);

            composerLookEarthButton = document.createElement("button");
            composerLookEarthButton.type = "button";
            composerLookEarthButton.className = "aux-camera-view__composer-button";
            composerLookEarthButton.textContent = "Earth";
            composerLookEarthButton.setAttribute("aria-label", "Earth Rise Composer lock to Earth");
            composerPresetWrap.appendChild(composerLookEarthButton);

            composerLookMoonButton = document.createElement("button");
            composerLookMoonButton.type = "button";
            composerLookMoonButton.className = "aux-camera-view__composer-button";
            composerLookMoonButton.textContent = "Moon";
            composerLookMoonButton.setAttribute("aria-label", "Earth Rise Composer lock to Moon");
            composerPresetWrap.appendChild(composerLookMoonButton);

            const dragHint = document.createElement("span");
            dragHint.className = "aux-camera-view__composer-hint";
            dragHint.textContent = "Drag view";
            composerPresetWrap.appendChild(dragHint);
            panel.appendChild(composerPresetWrap);

            composerTimelineWrap = document.createElement("div");
            composerTimelineWrap.className = "aux-camera-view__composer-timeline";
            composerTimelineLabel = document.createElement("span");
            composerTimelineLabel.className = "aux-camera-view__composer-label";
            composerTimelineLabel.textContent = "Lunar flyby window +/-1h";
            composerTimelineWrap.appendChild(composerTimelineLabel);
            composerTimelineSlider = document.createElement("input");
            composerTimelineSlider.type = "range";
            composerTimelineSlider.className = "aux-camera-view__composer-timeline-slider";
            composerTimelineSlider.min = "0";
            composerTimelineSlider.max = String(COMPOSER_TIMELINE_RESOLUTION);
            composerTimelineSlider.step = "1";
            composerTimelineSlider.value = String(Math.round(COMPOSER_TIMELINE_RESOLUTION * 0.5));
            composerTimelineSlider.setAttribute("aria-label", "Earth Rise Composer short timeline scrub");
            composerTimelineWrap.appendChild(composerTimelineSlider);
            panel.appendChild(composerTimelineWrap);

            composerControlsWrap = document.createElement("div");
            composerControlsWrap.className = "aux-camera-view__composer-controls";

            const composerAmbientLabel = document.createElement("span");
            composerAmbientLabel.className = "aux-camera-view__composer-label";
            composerAmbientLabel.textContent = "Ambient";
            composerControlsWrap.appendChild(composerAmbientLabel);

            composerAmbientSlider = document.createElement("input");
            composerAmbientSlider.type = "range";
            composerAmbientSlider.className = "aux-camera-view__composer-ambient-slider";
            composerAmbientSlider.min = String(COMPOSER_MIN_AMBIENT);
            composerAmbientSlider.max = String(COMPOSER_MAX_AMBIENT);
            composerAmbientSlider.step = "0.01";
            composerAmbientSlider.value = String(COMPOSER_DEFAULT_AMBIENT);
            composerAmbientSlider.setAttribute("aria-label", "Earth Rise Composer ambient fill");
            composerControlsWrap.appendChild(composerAmbientSlider);

            composerAmbientValue = document.createElement("output");
            composerAmbientValue.className = "aux-camera-view__composer-ambient-value";
            composerAmbientValue.value = `${COMPOSER_DEFAULT_AMBIENT.toFixed(2)}`;
            composerAmbientValue.textContent = composerAmbientValue.value;
            composerControlsWrap.appendChild(composerAmbientValue);

            const composerDialWrap = document.createElement("div");
            composerDialWrap.className = "aux-camera-view__composer-dial-wrap";
            const composerDialLabel = document.createElement("span");
            composerDialLabel.className = "aux-camera-view__composer-label";
            composerDialLabel.textContent = "UP";
            composerDialWrap.appendChild(composerDialLabel);
            composerDial = document.createElement("div");
            composerDial.className = "aux-camera-view__composer-dial";
            composerDial.setAttribute("role", "slider");
            composerDial.setAttribute("aria-label", "Earth Rise Composer up-direction dial");
            composerDial.setAttribute("aria-valuemin", "0");
            composerDial.setAttribute("aria-valuemax", "359");
            composerDialNeedle = document.createElement("div");
            composerDialNeedle.className = "aux-camera-view__composer-dial-needle";
            composerDial.appendChild(composerDialNeedle);
            composerDialWrap.appendChild(composerDial);
            composerControlsWrap.appendChild(composerDialWrap);
            panel.appendChild(composerControlsWrap);
        } else {
            info = document.createElement("div");
            info.className = "aux-camera-view__info";
            info.hidden = spec.infoMode === "none";
            infoPrimary = document.createElement("div");
            infoPrimary.className = "aux-camera-view__info-line aux-camera-view__info-line--primary";
            infoPrimaryText = document.createElement("span");
            infoPrimaryText.className = "aux-camera-view__info-primary-text";
            infoPill = document.createElement("button");
            infoPill.type = "button";
            infoPill.className = "aux-camera-view__pill";
            infoPill.hidden = true;
            infoPrimary.appendChild(infoPrimaryText);
            infoPrimary.appendChild(infoPill);
            infoSecondary = document.createElement("div");
            infoSecondary.className = "aux-camera-view__info-line aux-camera-view__info-line--secondary";
            info.appendChild(infoPrimary);
            info.appendChild(infoSecondary);
            panel.appendChild(info);
        }

        const viewport = document.createElement("div");
        viewport.className = "aux-camera-view__viewport";
        panel.appendChild(viewport);
        if (panelMode === "composer") {
            composerDisabledOverlay = document.createElement("div");
            composerDisabledOverlay.className = "aux-camera-view__composer-disabled-overlay";
            composerDisabledOverlay.textContent = "Outsie Flyby Window";
            composerDisabledOverlay.hidden = true;
            viewport.appendChild(composerDisabledOverlay);
        }

        let renderer = null;
        try {
            renderer = new this.THREE.WebGLRenderer({ antialias: true });
            if ("outputColorSpace" in renderer && this.THREE.SRGBColorSpace) {
                renderer.outputColorSpace = this.THREE.SRGBColorSpace;
            } else {
                renderer.outputEncoding = this.THREE.sRGBEncoding;
            }
            renderer.toneMapping = this.THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.14;
            renderer.shadowMap.enabled = true;
            if (this.THREE.PCFShadowMap) {
                renderer.shadowMap.type = this.THREE.PCFShadowMap;
            } else if (this.THREE.PCFSoftShadowMap) {
                renderer.shadowMap.type = this.THREE.PCFSoftShadowMap;
            }
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.setSize(1, 1);
            renderer.domElement.className = "aux-camera-view__canvas";
            renderer.domElement.setAttribute("aria-hidden", "true");
            viewport.appendChild(renderer.domElement);
        } catch (err) {
            panel.remove();
            return;
        }

        const overlayCanvas = document.createElement("canvas");
        overlayCanvas.className = "aux-camera-view__overlay-canvas";
        overlayCanvas.setAttribute("aria-hidden", "true");
        viewport.appendChild(overlayCanvas);
        const overlayCtx = overlayCanvas.getContext("2d");

        const chipButton = document.createElement("button");
        chipButton.className = "aux-camera-chip";
        chipButton.type = "button";
        chipButton.textContent = spec.chipLabel || spec.title;
        chipButton.setAttribute("aria-label", `Restore ${spec.title}`);
        chipButton.hidden = true;
        const chipDock = panelSide === "left" ? this.chipDockLeft : this.chipDockRight;
        chipDock?.appendChild(chipButton);

        const camera = new this.THREE.PerspectiveCamera(spec.defaultFov, 1, 0.0001, 100000);
        camera.up.set(0, 0, 1);

        const panelState = {
            id: spec.id,
            title: spec.title,
            anchorKey: spec.anchorKey || "craft",
            targetKey: spec.targetKey,
            infoMode: spec.infoMode || "none",
            mode: panelMode,
            side: panelSide,
            panel,
            viewport,
            renderer,
            camera,
            info,
            infoPrimary,
            infoPrimaryText,
            infoSecondary,
            infoPill,
            composerPresetWrap,
            composerLookFreeButton,
            composerLookEarthButton,
            composerLookMoonButton,
            composerTimelineWrap,
            composerTimelineSlider,
            composerTimelineLabel,
            composerControlsWrap,
            composerAmbientSlider,
            composerAmbientValue,
            composerDial,
            composerDialNeedle,
            composerDisabledOverlay,
            overlayCanvas,
            overlayCtx,
            farSideTintEnabled: spec.infoMode === "moon-visibility",
            overlayDirty: true,
            lastOverlayUpdateMs: -Infinity,
            width: 0,
            height: 0,
            onFovInput: null,
            fovSlider,
            fovValue,
            autoToggle,
            minimizeButton,
            chipButton,
            autoFovEnabled: true,
            onAutoToggleClick: null,
            onMinimizeClick: null,
            onChipClick: null,
            onInfoPillClick: null,
            onComposerLookFreeClick: null,
            onComposerLookEarthClick: null,
            onComposerLookMoonClick: null,
            onComposerAmbientInput: null,
            onComposerTimelineInput: null,
            onComposerTimelinePointerDown: null,
            onComposerTimelinePointerUp: null,
            onComposerDialPointerDown: null,
            onComposerDialPointerMove: null,
            onComposerDialPointerUp: null,
            onComposerViewportWheel: null,
            onComposerViewportPointerDown: null,
            onComposerViewportPointerMove: null,
            onComposerViewportPointerUp: null,
            onComposerPanelGatePointerDown: null,
            onPointerDown: null,
            onPointerMove: null,
            onPointerUp: null,
            onPointerCancel: null,
            x: 0,
            y: 0,
            onPanelPointerDown: null,
            minimized: false,
            composerLockTarget: "earth",
            composerYawRad: 0,
            composerPitchRad: 0,
            composerRollRad: COMPOSER_DEFAULT_ROLL_RAD,
            composerAmbient: panelMode === "composer" ? COMPOSER_DEFAULT_AMBIENT : 0,
            composerTimelineDragging: false,
            composerTimelineWindowMs: COMPOSER_TIMELINE_WINDOW_MS,
            composerTimelineStartMs: Number.NaN,
            composerTimelineEndMs: Number.NaN,
            composerInteractionEnabled: true,
            composerDialPointerId: null,
            composerViewportPointer: null,
        };

        const syncAutoToggleUi = () => {
            const enabled = panelState.autoFovEnabled === true;
            fovSlider.disabled = enabled;
            autoToggle.classList.toggle("is-active", enabled);
            autoToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
            autoToggle.title = enabled ? "Auto FoV enabled" : "Auto FoV disabled";
        };

        const onFovInput = () => {
            const fov = Number(fovSlider.value);
            camera.fov = fov;
            camera.updateProjectionMatrix();
            fovValue.value = `${Math.round(fov)}°`;
            fovValue.textContent = fovValue.value;
            panelState.overlayDirty = true;
            this.requestRender?.();
            this.queuePersistPanelState();
        };
        const onAutoToggleClick = () => {
            panelState.autoFovEnabled = !panelState.autoFovEnabled;
            syncAutoToggleUi();
            if (panelState.autoFovEnabled) {
                this.requestRender?.();
            } else {
                onFovInput();
            }
            this.queuePersistPanelState();
        };
        const onMinimizeClick = () => {
            this.setPanelMinimized(panelState, true);
        };
        const onChipClick = () => {
            this.setPanelMinimized(panelState, false);
        };
        fovSlider.addEventListener("input", onFovInput, { passive: true });
        autoToggle.addEventListener("click", onAutoToggleClick);
        minimizeButton.addEventListener("click", onMinimizeClick);
        chipButton.addEventListener("click", onChipClick);
        panelState.onAutoToggleClick = onAutoToggleClick;
        panelState.onFovInput = onFovInput;
        panelState.onMinimizeClick = onMinimizeClick;
        panelState.onChipClick = onChipClick;

        if (panelState.mode === "composer") {
            const syncComposerLockUi = () => {
                const lockTarget = panelState.composerLockTarget || "none";
                panelState.composerLookFreeButton?.classList.toggle("is-active", lockTarget === "none");
                panelState.composerLookEarthButton?.classList.toggle("is-active", lockTarget === "earth");
                panelState.composerLookMoonButton?.classList.toggle("is-active", lockTarget === "moon");
            };
            const syncComposerAmbientUi = () => {
                if (!panelState.composerAmbientSlider || !panelState.composerAmbientValue) {
                    return;
                }
                panelState.composerAmbientSlider.value = String(panelState.composerAmbient);
                const ambientText = panelState.composerAmbient.toFixed(2);
                panelState.composerAmbientValue.value = ambientText;
                panelState.composerAmbientValue.textContent = ambientText;
            };
            const setComposerAmbient = (nextAmbient, { persist = false } = {}) => {
                const bounded = this.THREE.MathUtils.clamp(
                    Number(nextAmbient),
                    COMPOSER_MIN_AMBIENT,
                    COMPOSER_MAX_AMBIENT,
                );
                if (!Number.isFinite(bounded)) {
                    return;
                }
                panelState.composerAmbient = bounded;
                syncComposerAmbientUi();
                if (persist) {
                    this.queuePersistPanelState();
                }
                this.requestRender?.();
            };
            const updateDialFromPoint = (clientX, clientY) => {
                const dial = panelState.composerDial;
                if (!dial) {
                    return;
                }
                const rect = dial.getBoundingClientRect();
                const centerX = rect.left + (rect.width * 0.5);
                const centerY = rect.top + (rect.height * 0.5);
                const angle = Math.atan2(clientY - centerY, clientX - centerX);
                panelState.composerRollRad = angle + (Math.PI * 0.5);
                this.updateComposerDialThumb(panelState);
                this.requestRender?.();
            };
            const onComposerLookFreeClick = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                panelState.composerLockTarget = "none";
                syncComposerLockUi();
                this.requestRender?.();
            };
            const onComposerLookEarthClick = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                panelState.composerLockTarget = "earth";
                syncComposerLockUi();
                this.requestRender?.();
            };
            const onComposerLookMoonClick = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                panelState.composerLockTarget = "moon";
                syncComposerLockUi();
                this.requestRender?.();
            };
            const onComposerAmbientInput = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                setComposerAmbient(panelState.composerAmbientSlider?.value, { persist: true });
            };
            const onComposerTimelineInput = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                if (!panelState.composerTimelineSlider) {
                    return;
                }
                const localMin = panelState.composerTimelineStartMs;
                const localMax = panelState.composerTimelineEndMs;
                if (!Number.isFinite(localMin) || !Number.isFinite(localMax) || localMax <= localMin) {
                    return;
                }
                const sliderValue = Number(panelState.composerTimelineSlider.value);
                const ratio = this.THREE.MathUtils.clamp(
                    sliderValue / COMPOSER_TIMELINE_RESOLUTION,
                    0,
                    1,
                );
                const targetMs = localMin + ((localMax - localMin) * ratio);
                this.seekMainTimelineTime(targetMs, false);
            };
            const onComposerTimelinePointerDown = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                panelState.composerTimelineDragging = true;
            };
            const onComposerTimelinePointerUp = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                panelState.composerTimelineDragging = false;
                if (!panelState.composerTimelineSlider) {
                    return;
                }
                const localMin = panelState.composerTimelineStartMs;
                const localMax = panelState.composerTimelineEndMs;
                if (!Number.isFinite(localMin) || !Number.isFinite(localMax) || localMax <= localMin) {
                    return;
                }
                const sliderValue = Number(panelState.composerTimelineSlider.value);
                const ratio = this.THREE.MathUtils.clamp(
                    sliderValue / COMPOSER_TIMELINE_RESOLUTION,
                    0,
                    1,
                );
                const targetMs = localMin + ((localMax - localMin) * ratio);
                this.seekMainTimelineTime(targetMs, true);
            };
            const onComposerViewportWheel = (event) => {
                if (!(event instanceof WheelEvent)) {
                    return;
                }
                event.preventDefault();
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                if (panelState.autoFovEnabled) {
                    panelState.autoFovEnabled = false;
                    syncAutoToggleUi();
                }
                const zoomScale = Math.exp(event.deltaY * 0.0015);
                const nextFov = this.THREE.MathUtils.clamp(
                    panelState.camera.fov * zoomScale,
                    AUTO_FOV_MIN_DEGREES,
                    AUTO_FOV_MAX_DEGREES,
                );
                panelState.fovSlider.value = String(Math.round(nextFov));
                onFovInput();
            };
            const onComposerViewportPointerDown = (event) => {
                if (event.button !== 0) {
                    return;
                }
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    event.preventDefault();
                    return;
                }
                panelState.composerViewportPointer = {
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY,
                };
                panelState.composerLockTarget = "none";
                syncComposerLockUi();
                panelState.viewport.setPointerCapture(event.pointerId);
                event.preventDefault();
            };
            const onComposerViewportPointerMove = (event) => {
                const drag = panelState.composerViewportPointer;
                if (!drag || drag.pointerId !== event.pointerId) {
                    return;
                }
                const dx = event.clientX - drag.clientX;
                const dy = event.clientY - drag.clientY;
                drag.clientX = event.clientX;
                drag.clientY = event.clientY;
                const look = this.tmpVectorE.copy(this.getComposerLookDirection(panelState));
                const up = this.tmpVectorF.copy(this.getComposerCameraUp(panelState, look));
                const yawAngle = dx * COMPOSER_DRAG_SENSITIVITY;
                this.tmpQuatA.setFromAxisAngle(up, yawAngle);
                look.applyQuaternion(this.tmpQuatA);
                up.applyQuaternion(this.tmpQuatA);

                const right = this.tmpVectorD.copy(look).cross(up);
                if (right.lengthSq() > 1e-12) {
                    right.normalize();
                    const pitchAngle = dy * COMPOSER_DRAG_SENSITIVITY;
                    this.tmpQuatB.setFromAxisAngle(right, pitchAngle);
                    look.applyQuaternion(this.tmpQuatB);
                    up.applyQuaternion(this.tmpQuatB);
                }
                this.setComposerOrientationFromLookUp(panelState, look, up);
                this.updateComposerDialThumb(panelState);
                this.requestRender?.();
                event.preventDefault();
            };
            const releaseComposerViewport = (event) => {
                const drag = panelState.composerViewportPointer;
                if (!drag || drag.pointerId !== event.pointerId) {
                    return;
                }
                if (panelState.viewport.hasPointerCapture(event.pointerId)) {
                    panelState.viewport.releasePointerCapture(event.pointerId);
                }
                panelState.composerViewportPointer = null;
            };
            const onComposerDialPointerDown = (event) => {
                if (event.button !== 0 || !panelState.composerDial) {
                    return;
                }
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    event.preventDefault();
                    return;
                }
                panelState.composerDialPointerId = event.pointerId;
                panelState.composerDial.setPointerCapture(event.pointerId);
                updateDialFromPoint(event.clientX, event.clientY);
                event.preventDefault();
            };
            const onComposerDialPointerMove = (event) => {
                if (panelState.composerDialPointerId !== event.pointerId) {
                    return;
                }
                updateDialFromPoint(event.clientX, event.clientY);
                event.preventDefault();
            };
            const onComposerDialPointerUp = (event) => {
                if (panelState.composerDialPointerId !== event.pointerId || !panelState.composerDial) {
                    return;
                }
                if (panelState.composerDial.hasPointerCapture(event.pointerId)) {
                    panelState.composerDial.releasePointerCapture(event.pointerId);
                }
                panelState.composerDialPointerId = null;
            };
            const onComposerPanelGatePointerDown = (event) => {
                if (panelState.composerInteractionEnabled) {
                    return;
                }
                if (!(event.target instanceof Element)) {
                    return;
                }
                if (event.target.closest(".aux-camera-view__header")) {
                    return;
                }
                const jumped = this.activateComposerWindow(panelState, { finalize: true });
                if (jumped) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            };

            panelState.composerLookFreeButton?.addEventListener("click", onComposerLookFreeClick);
            panelState.composerLookEarthButton?.addEventListener("click", onComposerLookEarthClick);
            panelState.composerLookMoonButton?.addEventListener("click", onComposerLookMoonClick);
            panelState.composerAmbientSlider?.addEventListener("input", onComposerAmbientInput, { passive: true });
            panelState.composerTimelineSlider?.addEventListener("input", onComposerTimelineInput, { passive: true });
            panelState.composerTimelineSlider?.addEventListener("pointerdown", onComposerTimelinePointerDown);
            panelState.composerTimelineSlider?.addEventListener("pointerup", onComposerTimelinePointerUp);
            panelState.composerTimelineSlider?.addEventListener("change", onComposerTimelinePointerUp);
            panelState.composerDial?.addEventListener("pointerdown", onComposerDialPointerDown);
            panelState.composerDial?.addEventListener("pointermove", onComposerDialPointerMove);
            panelState.composerDial?.addEventListener("pointerup", onComposerDialPointerUp);
            panelState.composerDial?.addEventListener("pointercancel", onComposerDialPointerUp);
            panelState.viewport.addEventListener("wheel", onComposerViewportWheel, { passive: false });
            panelState.viewport.addEventListener("pointerdown", onComposerViewportPointerDown);
            panelState.viewport.addEventListener("pointermove", onComposerViewportPointerMove);
            panelState.viewport.addEventListener("pointerup", releaseComposerViewport);
            panelState.viewport.addEventListener("pointercancel", releaseComposerViewport);
            panelState.panel.addEventListener("pointerdown", onComposerPanelGatePointerDown, true);

            panelState.onComposerLookFreeClick = onComposerLookFreeClick;
            panelState.onComposerLookEarthClick = onComposerLookEarthClick;
            panelState.onComposerLookMoonClick = onComposerLookMoonClick;
            panelState.onComposerAmbientInput = onComposerAmbientInput;
            panelState.onComposerTimelineInput = onComposerTimelineInput;
            panelState.onComposerTimelinePointerDown = onComposerTimelinePointerDown;
            panelState.onComposerTimelinePointerUp = onComposerTimelinePointerUp;
            panelState.onComposerDialPointerDown = onComposerDialPointerDown;
            panelState.onComposerDialPointerMove = onComposerDialPointerMove;
            panelState.onComposerDialPointerUp = onComposerDialPointerUp;
            panelState.onComposerViewportWheel = onComposerViewportWheel;
            panelState.onComposerViewportPointerDown = onComposerViewportPointerDown;
            panelState.onComposerViewportPointerMove = onComposerViewportPointerMove;
            panelState.onComposerViewportPointerUp = releaseComposerViewport;
            panelState.onComposerPanelGatePointerDown = onComposerPanelGatePointerDown;
            setComposerAmbient(panelState.composerAmbient, { persist: false });
            syncComposerLockUi();
            this.updateComposerDialThumb(panelState);
        }

        const persisted = this.persistedPanelState?.[spec.id];
        if (persisted && typeof persisted === "object") {
            if (panelState.mode !== "composer") {
                if (typeof persisted.autoFovEnabled === "boolean") {
                    panelState.autoFovEnabled = persisted.autoFovEnabled;
                }
                const persistedFov = Number(persisted.fov);
                if (Number.isFinite(persistedFov)) {
                    const boundedFov = this.THREE.MathUtils.clamp(
                        persistedFov,
                        AUTO_FOV_MIN_DEGREES,
                        AUTO_FOV_MAX_DEGREES,
                    );
                    fovSlider.value = String(Math.round(boundedFov));
                    camera.fov = boundedFov;
                    camera.updateProjectionMatrix();
                }
            }
            if (typeof persisted.farSideTintEnabled === "boolean") {
                panelState.farSideTintEnabled = persisted.farSideTintEnabled;
            }
        }
        if (panelState.mode === "composer") {
            panelState.autoFovEnabled = false;
            fovSlider.value = String(Math.round(spec.defaultFov));
            camera.fov = spec.defaultFov;
            camera.updateProjectionMatrix();
            panelState.composerAmbient = COMPOSER_DEFAULT_AMBIENT;
            if (panelState.composerAmbientSlider && panelState.composerAmbientValue) {
                panelState.composerAmbientSlider.value = String(panelState.composerAmbient);
                const ambientText = panelState.composerAmbient.toFixed(2);
                panelState.composerAmbientValue.value = ambientText;
                panelState.composerAmbientValue.textContent = ambientText;
            }
        }
        syncAutoToggleUi();
        onFovInput();

        if (panelState.infoMode === "moon-visibility" && infoPill) {
            const onInfoPillClick = () => {
                panelState.farSideTintEnabled = !panelState.farSideTintEnabled;
                panelState.overlayDirty = true;
                this.requestRender?.();
            };
            infoPill.addEventListener("click", onInfoPillClick);
            panelState.onInfoPillClick = onInfoPillClick;
        } else if (infoPill) {
            infoPill.disabled = true;
        }

        this.root.appendChild(panel);
        this.panels.push(panelState);
        this.bindPanelDragging(panelState, header);
        panelState.onPanelPointerDown = () => {
            this.bringPanelToFront(panelState);
        };
        panel.addEventListener("pointerdown", panelState.onPanelPointerDown);
        const defaultPosition = this.getDefaultPanelPosition(panel, index);
        this.applyPanelPosition(panelState, defaultPosition.x, defaultPosition.y);
        this.bringPanelToFront(panelState);

        this.panelStateByElement.set(panel, panelState);
        const resizeObserver = this.getPanelResizeObserver();
        resizeObserver?.observe(panel);
        this.syncPanelSize(panelState);
        // Default startup behavior: panels open by default on every reload.
        this.setPanelMinimized(panelState, false, {
            persist: false,
            requestRender: false,
        });
    }

    handlePanelResizeEntries(entries) {
        for (const entry of entries || []) {
            const panelState = this.panelStateByElement.get(entry.target);
            if (panelState) {
                this.pendingResizePanelStates.add(panelState);
            }
        }

        if (this.pendingResizeRaf != null) {
            return;
        }
        this.pendingResizeRaf = requestAnimationFrame(() => {
            this.pendingResizeRaf = null;
            for (const panelState of this.pendingResizePanelStates) {
                this.syncPanelSize(panelState);
            }
            this.pendingResizePanelStates.clear();
            this.queuePersistPanelState();
            this.requestRender?.();
        });
    }

    handleResize() {
        if (!this.root) {
            return;
        }
        const visible = this.panelsEnabled && isDesktopViewport();
        this.root.hidden = !visible;
        if (!visible) return;
        this.applyDefaultPanelLayout();
        for (const panelState of this.panels) {
            this.syncPanelSize(panelState);
        }
        this.queuePersistPanelState();
    }

    setPanelVisible(panelState, visible) {
        const shouldShowPanel = visible && panelState.minimized !== true;
        panelState.panel.hidden = !shouldShowPanel;
        if (panelState.chipButton) {
            panelState.chipButton.hidden = panelState.minimized !== true;
        }
        if (!shouldShowPanel) {
            this.clearPanelOverlay(panelState);
        }
    }

    setPanelInfo(panelState, primary = "", secondary = "", options = {}) {
        if (!panelState?.info || !panelState?.infoPrimaryText || !panelState?.infoSecondary || !panelState?.infoPill) {
            return;
        }
        const hasInfoMode = panelState.infoMode && panelState.infoMode !== "none";
        if (!hasInfoMode) {
            panelState.info.hidden = true;
            return;
        }
        panelState.info.hidden = false;
        panelState.infoPrimaryText.textContent = primary || "";
        panelState.infoSecondary.textContent = secondary || "";
        panelState.infoSecondary.hidden = !secondary;

        const pillText = typeof options.pillText === "string" ? options.pillText.trim() : "";
        const pillVariant = typeof options.pillVariant === "string" ? options.pillVariant.trim() : "";
        panelState.infoPill.hidden = pillText.length === 0;
        panelState.infoPill.textContent = pillText;
        panelState.infoPill.className = "aux-camera-view__pill";
        if (pillText.length > 0 && pillVariant.length > 0) {
            panelState.infoPill.classList.add(`aux-camera-view__pill--${pillVariant}`);
        }

        const pillInteractive = options.pillInteractive === true;
        panelState.infoPill.disabled = !pillInteractive;
        if (pillInteractive) {
            panelState.infoPill.classList.add("aux-camera-view__pill--button");
            const pressed = options.pillOn === true;
            panelState.infoPill.setAttribute("aria-pressed", pressed ? "true" : "false");
            panelState.infoPill.classList.toggle("is-on", pressed);
            panelState.infoPill.classList.toggle("is-off", !pressed);
            panelState.infoPill.title = pressed ? "Disable far-side overlay" : "Enable far-side overlay";
        } else {
            panelState.infoPill.removeAttribute("aria-pressed");
            panelState.infoPill.classList.remove("aux-camera-view__pill--button", "is-on", "is-off");
            panelState.infoPill.title = "";
        }
    }

    setComposerInteractionEnabled(panelState, enabled) {
        if (!panelState || panelState.mode !== "composer") {
            return;
        }
        const isEnabled = enabled === true;
        panelState.composerInteractionEnabled = isEnabled;
        panelState.panel.classList.toggle("aux-camera-view--composer-disabled", !isEnabled);

        const disableControls = !isEnabled;
        if (panelState.autoToggle) {
            panelState.autoToggle.disabled = disableControls;
        }
        if (panelState.fovSlider) {
            panelState.fovSlider.disabled = disableControls || panelState.autoFovEnabled;
        }
        panelState.composerLookFreeButton && (panelState.composerLookFreeButton.disabled = disableControls);
        panelState.composerLookEarthButton && (panelState.composerLookEarthButton.disabled = disableControls);
        panelState.composerLookMoonButton && (panelState.composerLookMoonButton.disabled = disableControls);
        panelState.composerAmbientSlider && (panelState.composerAmbientSlider.disabled = disableControls);
        if (panelState.composerTimelineSlider) {
            panelState.composerTimelineSlider.disabled = disableControls;
        }
        if (panelState.composerDial) {
            panelState.composerDial.setAttribute("aria-disabled", disableControls ? "true" : "false");
        }
        if (panelState.composerDisabledOverlay) {
            panelState.composerDisabledOverlay.hidden = isEnabled;
        }
    }

    activateComposerWindow(panelState, { finalize = true } = {}) {
        if (!panelState || panelState.mode !== "composer") {
            return false;
        }
        const startMs = panelState.composerTimelineStartMs;
        const endMs = panelState.composerTimelineEndMs;
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
            return false;
        }
        const targetMs = startMs + ((endMs - startMs) * 0.5);
        this.seekMainTimelineTime(targetMs, finalize);
        return true;
    }

    readMainTimelineState() {
        const slider = document.getElementById("timeline-slider");
        if (!(slider instanceof HTMLInputElement)) {
            return null;
        }
        const min = Number(slider.min);
        const max = Number(slider.max);
        const value = Number(slider.value);
        if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(value)) {
            return null;
        }
        return {
            slider,
            min: Math.min(min, max),
            max: Math.max(min, max),
            value: this.THREE.MathUtils.clamp(value, Math.min(min, max), Math.max(min, max)),
        };
    }

    seekMainTimelineTime(timeMs, finalize = false) {
        const timelineState = this.readMainTimelineState();
        if (!timelineState) {
            return;
        }
        const clamped = this.THREE.MathUtils.clamp(timeMs, timelineState.min, timelineState.max);
        timelineState.slider.value = String(clamped);
        timelineState.slider.dispatchEvent(new Event("input", { bubbles: true }));
        if (finalize) {
            timelineState.slider.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    formatComposerWindowLabel(windowMs) {
        const safeMs = Math.max(0, windowMs);
        const totalMinutes = Math.round(safeMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours <= 0) {
            return `+/-${Math.max(1, minutes)}m`;
        }
        if (minutes <= 0) {
            return `+/-${hours}h`;
        }
        return `+/-${hours}h ${minutes}m`;
    }

    resolveLunarFlybyTimeMs(eventInfos) {
        if (!Array.isArray(eventInfos) || eventInfos.length === 0) {
            return Number.NaN;
        }
        let best = null;
        for (const eventInfo of eventInfos) {
            const startTime = eventInfo?.startTime;
            const timeMs = startTime instanceof Date ? startTime.getTime() : Number(startTime);
            if (!Number.isFinite(timeMs)) {
                continue;
            }
            const key = eventInfo?.key || "";
            const label = eventInfo?.label || "";
            const hoverText = eventInfo?.hoverText || "";
            const infoText = eventInfo?.infoText || "";
            const burnFlag = eventInfo?.burnFlag === true;
            const keyLabelCorpus = `${key} ${label}`.toLowerCase();
            const narrativeCorpus = `${hoverText} ${infoText}`.toLowerCase();

            const hasMoonKeyLabel = /\b(moon|lunar)\b/.test(keyLabelCorpus);
            const hasFlybyKeyLabel = /\bflyby\b/.test(keyLabelCorpus);
            const hasClosestKeyLabel = /\b(closest approach|closestapproach|perilune|periselene|pericynthion)\b/.test(keyLabelCorpus);
            const explicitLunarFlybyKeyLabel = /\b(lunar flyby|moon flyby)\b/.test(keyLabelCorpus);
            const keySuggestsClosest = /\bclosest\b/.test(key.toLowerCase()) && /\b(approach|peri)\b/.test(key.toLowerCase());
            const hasMoonNarrative = /\b(moon|lunar)\b/.test(narrativeCorpus);
            const hasFlybyNarrative = /\bflyby\b/.test(narrativeCorpus);
            const hasClosestNarrative = /\b(closest approach|perilune|periselene|pericynthion)\b/.test(narrativeCorpus);
            let score = 0;
            if (keySuggestsClosest || hasClosestKeyLabel) {
                score = 220;
            } else if (explicitLunarFlybyKeyLabel) {
                score = 210;
            } else if (hasMoonKeyLabel && hasFlybyKeyLabel) {
                score = 200;
            } else if (!burnFlag && hasMoonNarrative && hasClosestNarrative) {
                score = 120;
            } else if (!burnFlag && hasMoonNarrative && hasFlybyNarrative) {
                score = 110;
            }
            if (score <= 0) {
                continue;
            }
            if (
                !best ||
                score > best.score ||
                (score === best.score && burnFlag === false && best.burnFlag === true) ||
                (score === best.score && burnFlag === best.burnFlag && timeMs < best.timeMs)
            ) {
                best = {
                    score,
                    timeMs,
                    burnFlag,
                };
            }
        }
        return best ? best.timeMs : Number.NaN;
    }

    setComposerLookFromDirection(panelState, directionVector) {
        const len = directionVector?.length?.() || 0;
        if (!Number.isFinite(len) || len <= 1e-9) {
            return false;
        }
        this.composerLookWorld.copy(directionVector).multiplyScalar(1 / len);
        const planar = Math.hypot(this.composerLookWorld.x, this.composerLookWorld.y);
        panelState.composerYawRad = Math.atan2(this.composerLookWorld.y, this.composerLookWorld.x);
        panelState.composerPitchRad = Math.atan2(this.composerLookWorld.z, Math.max(planar, 1e-9));
        panelState.composerPitchRad = this.THREE.MathUtils.clamp(
            panelState.composerPitchRad,
            -COMPOSER_MAX_PITCH_RAD,
            COMPOSER_MAX_PITCH_RAD,
        );
        return true;
    }

    applyComposerPreset(panelState, presetKey, { craftWorld, earthWorld, moonWorld }) {
        const preset = presetKey === "moon" ? "moon" : "earth";
        const source = preset === "moon" ? moonWorld : earthWorld;
        if (!source || !craftWorld) {
            return false;
        }
        this.tmpVectorA.subVectors(source, craftWorld);
        return this.setComposerLookFromDirection(panelState, this.tmpVectorA);
    }

    syncComposerTimelineUi(panelState) {
        const slider = panelState.composerTimelineSlider;
        if (!slider) {
            return;
        }
        const timelineState = this.readMainTimelineState();
        if (!timelineState) {
            panelState.composerTimelineLabel.textContent = "Timeline unavailable";
            this.setComposerInteractionEnabled(panelState, false);
            return;
        }
        const fullSpan = Math.max(0, timelineState.max - timelineState.min);
        const hasFlybyAnchor = Number.isFinite(this.composerFlybyTimeMs);
        const anchorMs = hasFlybyAnchor ? this.composerFlybyTimeMs : timelineState.value;
        const windowSpan = Math.min(fullSpan, panelState.composerTimelineWindowMs);
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

        panelState.composerTimelineStartMs = startMs;
        panelState.composerTimelineEndMs = endMs;
        const halfWindowMs = Math.max(0, (endMs - startMs) * 0.5);
        const inFlybyWindow = !hasFlybyAnchor || (timelineState.value >= startMs && timelineState.value <= endMs);
        this.setComposerInteractionEnabled(panelState, inFlybyWindow);
        panelState.composerTimelineLabel.textContent = hasFlybyAnchor
            ? "Lunar flyby window +/-1h"
            : `Occultation window ${this.formatComposerWindowLabel(halfWindowMs)}`;

        if (!panelState.composerTimelineDragging) {
            const ratio = this.THREE.MathUtils.clamp((timelineState.value - startMs) / Math.max(endMs - startMs, 1), 0, 1);
            slider.value = String(Math.round(ratio * COMPOSER_TIMELINE_RESOLUTION));
        }
    }

    getComposerLookDirection(panelState) {
        const cosPitch = Math.cos(panelState.composerPitchRad);
        this.composerLookWorld.set(
            Math.cos(panelState.composerYawRad) * cosPitch,
            Math.sin(panelState.composerYawRad) * cosPitch,
            Math.sin(panelState.composerPitchRad),
        );
        const len = this.composerLookWorld.length();
        if (len <= 1e-9) {
            this.composerLookWorld.set(1, 0, 0);
        } else {
            this.composerLookWorld.multiplyScalar(1 / len);
        }
        return this.composerLookWorld;
    }

    updateComposerDialThumb(panelState) {
        const dial = panelState?.composerDial;
        const needle = panelState?.composerDialNeedle;
        if (!dial || !needle) {
            return;
        }
        const rawRoll = Number.isFinite(panelState.composerRollRad) ? panelState.composerRollRad : 0;
        const roll = ((rawRoll % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
        panelState.composerRollRad = roll;
        const degrees = this.THREE.MathUtils.radToDeg(roll);
        needle.style.transform = `translate(-50%, -100%) rotate(${degrees}deg)`;
        dial.setAttribute("aria-valuenow", String(Math.round(degrees)));
    }

    getComposerCameraUp(panelState, lookDirWorld) {
        this.composerBaseUp.copy(this.composerWorldUp);
        this.tmpVectorD.copy(lookDirWorld).multiplyScalar(this.composerBaseUp.dot(lookDirWorld));
        this.composerBaseUp.sub(this.tmpVectorD);
        if (this.composerBaseUp.lengthSq() <= 1e-10) {
            this.composerBaseUp.set(0, 1, 0);
            this.tmpVectorD.copy(lookDirWorld).multiplyScalar(this.composerBaseUp.dot(lookDirWorld));
            this.composerBaseUp.sub(this.tmpVectorD);
        }
        if (this.composerBaseUp.lengthSq() <= 1e-10) {
            this.composerBaseUp.set(1, 0, 0);
        } else {
            this.composerBaseUp.normalize();
        }
        const roll = Number.isFinite(panelState.composerRollRad) ? panelState.composerRollRad : 0;
        this.composerRotatedUp.copy(this.composerBaseUp).applyAxisAngle(lookDirWorld, roll).normalize();
        return this.composerRotatedUp;
    }

    setComposerOrientationFromLookUp(panelState, lookDirWorld, upDirWorld) {
        const look = this.tmpVectorE.copy(lookDirWorld);
        if (!Number.isFinite(look.x) || !Number.isFinite(look.y) || !Number.isFinite(look.z) || look.lengthSq() <= 1e-12) {
            return false;
        }
        look.normalize();
        const planar = Math.hypot(look.x, look.y);
        panelState.composerYawRad = Math.atan2(look.y, look.x);
        panelState.composerPitchRad = Math.atan2(look.z, Math.max(planar, 1e-9));
        panelState.composerPitchRad = this.THREE.MathUtils.clamp(
            panelState.composerPitchRad,
            -COMPOSER_MAX_PITCH_RAD,
            COMPOSER_MAX_PITCH_RAD,
        );
        // If pitch was clamped, keep orientation stable by rebuilding look from yaw/pitch.
        const cosPitch = Math.cos(panelState.composerPitchRad);
        look.set(
            Math.cos(panelState.composerYawRad) * cosPitch,
            Math.sin(panelState.composerYawRad) * cosPitch,
            Math.sin(panelState.composerPitchRad),
        ).normalize();

        const targetUp = this.tmpVectorF.copy(upDirWorld);
        if (!Number.isFinite(targetUp.x) || !Number.isFinite(targetUp.y) || !Number.isFinite(targetUp.z) || targetUp.lengthSq() <= 1e-12) {
            targetUp.copy(this.composerWorldUp);
        }
        // Orthonormalize up against look.
        targetUp.sub(this.tmpVectorD.copy(look).multiplyScalar(targetUp.dot(look)));
        if (targetUp.lengthSq() <= 1e-12) {
            targetUp.copy(this.getComposerCameraUp(panelState, look));
        } else {
            targetUp.normalize();
        }

        this.composerBaseUp.copy(this.composerWorldUp);
        this.tmpVectorD.copy(look).multiplyScalar(this.composerBaseUp.dot(look));
        this.composerBaseUp.sub(this.tmpVectorD);
        if (this.composerBaseUp.lengthSq() <= 1e-12) {
            this.composerBaseUp.set(0, 1, 0);
            this.tmpVectorD.copy(look).multiplyScalar(this.composerBaseUp.dot(look));
            this.composerBaseUp.sub(this.tmpVectorD);
        }
        if (this.composerBaseUp.lengthSq() <= 1e-12) {
            this.composerBaseUp.set(1, 0, 0);
        } else {
            this.composerBaseUp.normalize();
        }

        const sin = look.dot(this.tmpVectorD.copy(this.composerBaseUp).cross(targetUp));
        const cos = this.composerBaseUp.dot(targetUp);
        panelState.composerRollRad = Math.atan2(sin, cos);
        if (!Number.isFinite(panelState.composerRollRad)) {
            panelState.composerRollRad = 0;
        }
        return true;
    }

    getComposerAmbientLight(scene) {
        if (!scene) {
            return null;
        }
        let light = this.composerAmbientLightByScene.get(scene);
        if (!light) {
            light = new this.THREE.AmbientLight(0xffffff, COMPOSER_DEFAULT_AMBIENT);
            light.visible = false;
            scene.add(light);
            this.composerAmbientLightByScene.set(scene, light);
        }
        return light;
    }

    computeComposerAutoFovDegrees({
        panelState,
        craftWorld,
        earthWorld,
        moonWorld,
        earthRadius,
        moonRadius,
        lockTarget = "none",
    }) {
        const allBodies = {
            earth: {
                world: earthWorld,
                radius: Number.isFinite(earthRadius) && earthRadius > 0 ? earthRadius : null,
            },
            moon: {
                world: moonWorld,
                radius: Number.isFinite(moonRadius) && moonRadius > 0 ? moonRadius : null,
            },
        };
        const bodies = lockTarget === "earth"
            ? [allBodies.earth]
            : (lockTarget === "moon" ? [allBodies.moon] : [allBodies.earth, allBodies.moon]);
        let maxHalfVertical = this.THREE.MathUtils.degToRad(4);
        let consideredBodies = 0;
        panelState.camera.updateMatrixWorld(true);
        panelState.camera.getWorldQuaternion(this.panelCameraWorldQuat);
        this.panelCameraWorldQuatInv.copy(this.panelCameraWorldQuat).invert();
        for (const body of bodies) {
            if (!body.world) {
                continue;
            }
            this.tmpVectorA.subVectors(body.world, craftWorld);
            const distance = this.tmpVectorA.length();
            if (!Number.isFinite(distance) || distance <= 1e-6) {
                continue;
            }
            this.tmpVectorA.multiplyScalar(1 / distance);
            const resolvedRadius = body.radius != null ? body.radius : 1;
            const sphereRatio = this.THREE.MathUtils.clamp(resolvedRadius / Math.max(distance, resolvedRadius + 1e-9), 0, 0.999999);
            const angularRadius = Math.asin(sphereRatio);
            const dirCam = this.tmpVectorA.applyQuaternion(this.panelCameraWorldQuatInv);
            if (dirCam.z <= 0.001) {
                continue;
            }
            consideredBodies += 1;
            const halfX = Math.atan2(Math.abs(dirCam.x), dirCam.z) + angularRadius;
            const halfY = Math.atan2(Math.abs(dirCam.y), dirCam.z) + angularRadius;
            const fromX = Math.atan(Math.tan(halfX) / Math.max(panelState.camera.aspect, 1e-3));
            maxHalfVertical = Math.max(maxHalfVertical, halfY, fromX);
        }
        if (consideredBodies <= 0) {
            return panelState.camera.fov;
        }
        return this.THREE.MathUtils.radToDeg(maxHalfVertical * 2 * AUTO_FOV_MARGIN_SCALE);
    }

    syncPanelSize(panelState) {
        // Keep the whole panel roughly square (1:1) using panel box size,
        // while always updating the internal viewport renderer dimensions.
        const panelWidth = Math.max(120, Math.floor(panelState.panel.clientWidth || 0));
        const panelHeight = Math.max(120, Math.floor(panelState.panel.clientHeight || 0));
        if (panelWidth > 0 && Math.abs(panelWidth - panelHeight) > 1) {
            panelState.panel.style.height = `${panelWidth}px`;
        }

        const width = Math.max(120, Math.floor(panelState.viewport.clientWidth));
        const height = Math.max(80, Math.floor(panelState.viewport.clientHeight));
        const changed = width !== panelState.width || height !== panelState.height;
        if (changed) {
            panelState.width = width;
            panelState.height = height;
            panelState.renderer.setSize(width, height, true);
            if (panelState.overlayCanvas) {
                panelState.overlayCanvas.width = width;
                panelState.overlayCanvas.height = height;
            }
            panelState.camera.aspect = width / height;
            panelState.camera.updateProjectionMatrix();
            panelState.overlayDirty = true;
        }
        this.clampPanelPosition(panelState);
    }

    renderLayers(renderer, scene, camera) {
        renderer.autoClear = true;
        camera.layers.set(0);
        renderer.render(scene, camera);
        renderer.autoClear = false;
        camera.layers.set(1);
        renderer.render(scene, camera);
    }

    clearPanelOverlay(panelState) {
        if (!panelState?.overlayCtx || !panelState?.overlayCanvas) {
            return;
        }
        panelState.overlayCtx.clearRect(0, 0, panelState.overlayCanvas.width, panelState.overlayCanvas.height);
    }

    renderMoonFarSideOverlay(panelState, { distanceToTarget, targetRadius, earthDirectionWorld }) {
        if (!panelState?.overlayCtx || !panelState?.overlayCanvas) {
            return;
        }
        const nowMs = performance.now();
        const shouldRefresh = panelState.overlayDirty || (nowMs - panelState.lastOverlayUpdateMs) >= 90;
        if (!shouldRefresh) {
            return;
        }
        panelState.lastOverlayUpdateMs = nowMs;
        panelState.overlayDirty = false;

        const canvas = panelState.overlayCanvas;
        const ctx = panelState.overlayCtx;
        const width = canvas.width;
        const height = canvas.height;
        if (width <= 1 || height <= 1) {
            return;
        }
        ctx.clearRect(0, 0, width, height);

        if (!panelState.farSideTintEnabled) {
            return;
        }
        if (!Number.isFinite(distanceToTarget) || !Number.isFinite(targetRadius) || targetRadius <= 0) {
            return;
        }

        const ratio = this.THREE.MathUtils.clamp(targetRadius / Math.max(distanceToTarget, targetRadius + 1e-9), 0, 0.999999);
        const angularRadius = Math.asin(ratio);
        const vFov = this.THREE.MathUtils.degToRad(panelState.camera.fov);
        const radiusPx = (Math.tan(angularRadius) / Math.max(Math.tan(vFov * 0.5), 1e-9)) * (height * 0.5);
        if (!Number.isFinite(radiusPx) || radiusPx < 2) {
            return;
        }

        panelState.camera.getWorldQuaternion(this.panelCameraWorldQuat);
        this.panelCameraWorldQuatInv.copy(this.panelCameraWorldQuat).invert();
        this.earthDirInCamera.copy(earthDirectionWorld).applyQuaternion(this.panelCameraWorldQuatInv);
        const earthDirLen = this.earthDirInCamera.length();
        if (!Number.isFinite(earthDirLen) || earthDirLen <= 1e-9) {
            return;
        }
        this.earthDirInCamera.multiplyScalar(1 / earthDirLen);

        const ex = this.earthDirInCamera.x;
        const ey = this.earthDirInCamera.y;
        const ez = this.earthDirInCamera.z;
        const cx = width * 0.5;
        const cy = height * 0.5;
        const left = Math.max(0, Math.floor(cx - radiusPx - 1));
        const top = Math.max(0, Math.floor(cy - radiusPx - 1));
        const right = Math.min(width - 1, Math.ceil(cx + radiusPx + 1));
        const bottom = Math.min(height - 1, Math.ceil(cy + radiusPx + 1));
        const w = right - left + 1;
        const h = bottom - top + 1;
        if (w <= 0 || h <= 0) {
            return;
        }

        const img = ctx.createImageData(w, h);
        const data = img.data;
        const baseR = 124;
        const baseG = 84;
        const baseB = 224;
        const baseAlpha = 184;
        const edgeR = 193;
        const edgeG = 170;
        const edgeB = 255;
        const edgeAlpha = 232;
        const terminatorBand = 0.06;
        const limbBand = 0.035;

        let idx = 0;
        for (let py = top; py <= bottom; py += 1) {
            const ny = (cy - (py + 0.5)) / radiusPx;
            for (let px = left; px <= right; px += 1) {
                const nx = ((px + 0.5) - cx) / radiusPx;
                const rr = nx * nx + ny * ny;
                if (rr <= 1) {
                    const nz = Math.sqrt(Math.max(0, 1 - rr));
                    const dot = nx * ex + ny * ey + nz * ez;
                    if (dot < 0) {
                        const intensity = Math.min(1, Math.max(0.2, -dot * 1.3));
                        const limbFade = 0.6 + nz * 0.4;
                        let r = baseR;
                        let g = baseG;
                        let b = baseB;
                        let a = Math.round(baseAlpha * intensity * limbFade);

                        // Crisp glass-like edge at the far/near divider.
                        const absDot = Math.abs(dot);
                        if (absDot < terminatorBand) {
                            const edgeMix = 1 - (absDot / terminatorBand);
                            r = Math.round(baseR * (1 - edgeMix) + edgeR * edgeMix);
                            g = Math.round(baseG * (1 - edgeMix) + edgeG * edgeMix);
                            b = Math.round(baseB * (1 - edgeMix) + edgeB * edgeMix);
                            a = Math.max(a, Math.round(edgeAlpha * edgeMix));
                        }

                        // Slight perimeter reinforcement for a clearer "panel".
                        const rim = 1 - Math.sqrt(rr);
                        if (rim < limbBand) {
                            const rimMix = 1 - (rim / limbBand);
                            r = Math.round(r * (1 - rimMix * 0.35) + edgeR * rimMix * 0.35);
                            g = Math.round(g * (1 - rimMix * 0.35) + edgeG * rimMix * 0.35);
                            b = Math.round(b * (1 - rimMix * 0.35) + edgeB * rimMix * 0.35);
                            a = Math.max(a, Math.round(170 * rimMix));
                        }

                        data[idx] = r;
                        data[idx + 1] = g;
                        data[idx + 2] = b;
                        data[idx + 3] = Math.min(255, a);
                    }
                }
                idx += 4;
            }
        }
        ctx.putImageData(img, left, top);
    }

    suppressLinePrimitives(scene) {
        const hiddenEntries = [];
        scene?.traverse?.((object) => {
            if (!object?.visible) {
                return;
            }
            if (!object.isLine && !object.isLineLoop && !object.isLineSegments) {
                return;
            }
            hiddenEntries.push({
                object,
                visible: object.visible,
            });
            object.visible = false;
        });
        return hiddenEntries;
    }

    restoreVisibility(entries) {
        for (const entry of entries || []) {
            entry.object.visible = entry.visible;
        }
    }

    estimateCraftRadius(activeCraft) {
        if (!activeCraft) {
            return 1;
        }

        this.boundingBox.setFromObject(activeCraft);
        if (this.boundingBox.isEmpty()) {
            return 1;
        }

        this.boundingBox.getBoundingSphere(this.boundingSphere);
        const radius = this.boundingSphere.radius;
        return Number.isFinite(radius) && radius > 0 ? radius : 1;
    }

    estimateObjectRadius(object, fallbackRadius = 1) {
        if (!object) {
            return fallbackRadius;
        }
        this.boundingBox.setFromObject(object);
        if (this.boundingBox.isEmpty()) {
            return fallbackRadius;
        }
        this.boundingBox.getBoundingSphere(this.boundingSphere);
        const radius = this.boundingSphere.radius;
        return Number.isFinite(radius) && radius > 0 ? radius : fallbackRadius;
    }

    computeAutoFovDegrees({ distanceToTarget, targetRadius, aspect }) {
        if (!Number.isFinite(distanceToTarget) || distanceToTarget <= 0) {
            return null;
        }

        const radius = Number.isFinite(targetRadius) && targetRadius > 0 ? targetRadius : 1;
        const fitRadius = radius * AUTO_FOV_MARGIN_SCALE;
        const safeDistance = Math.max(distanceToTarget, fitRadius + 1e-9);
        const ratio = Math.min(fitRadius / safeDistance, 0.999999);
        const angularRadius = Math.asin(ratio);
        const safeAspect = Math.max(aspect || 1, 1e-3);
        const verticalFromHeight = 2 * angularRadius;
        const verticalFromWidth = 2 * Math.atan(Math.tan(angularRadius) / safeAspect);
        const requiredVerticalRadians = Math.max(verticalFromHeight, verticalFromWidth);
        return this.THREE.MathUtils.radToDeg(requiredVerticalRadians);
    }

    createFibonacciSphereSamples(count = 720) {
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

    getObjectWorldPosition(object, outVector) {
        if (!object || !outVector) return false;
        object.getWorldPosition(outVector);
        return Number.isFinite(outVector.x) && Number.isFinite(outVector.y) && Number.isFinite(outVector.z);
    }

    resolvePositionForKey(key, context, outVector) {
        if (!outVector) return false;
        if (key === "craft") {
            return this.getObjectWorldPosition(context.activeCraft, outVector);
        }
        if (key === "earth") {
            return this.getObjectWorldPosition(context.earth, outVector);
        }
        if (key === "moon") {
            return this.getObjectWorldPosition(context.moon, outVector);
        }
        if (key === "sun") {
            return this.getObjectWorldPosition(context.sun, outVector);
        }
        return false;
    }

    vectorFromSunDirection(outVector) {
        if (
            Number.isFinite(this.sunDirectionWorld.x) &&
            Number.isFinite(this.sunDirectionWorld.y) &&
            Number.isFinite(this.sunDirectionWorld.z)
        ) {
            const len = this.sunDirectionWorld.length();
            if (len > 1e-12) {
                outVector.copy(this.sunDirectionWorld).multiplyScalar(1 / len);
                return true;
            }
        }
        return false;
    }

    computeMoonPhaseInfo({ earth, moon, sun }) {
        if (!earth || !moon) {
            return null;
        }
        if (!this.getObjectWorldPosition(earth, this.earthWorld)) {
            return null;
        }
        if (!this.getObjectWorldPosition(moon, this.moonWorld)) {
            return null;
        }

        this.tmpVectorA.subVectors(this.moonWorld, this.earthWorld);
        const moonDistance = this.tmpVectorA.length();
        if (!Number.isFinite(moonDistance) || moonDistance <= 1e-12) {
            return null;
        }
        this.tmpVectorA.multiplyScalar(1 / moonDistance);

        let sunAvailable = false;
        if (sun && this.getObjectWorldPosition(sun, this.sunWorld)) {
            this.tmpVectorB.subVectors(this.sunWorld, this.earthWorld);
            const sunDistance = this.tmpVectorB.length();
            if (Number.isFinite(sunDistance) && sunDistance > 1e-12) {
                this.tmpVectorB.multiplyScalar(1 / sunDistance);
                sunAvailable = true;
            }
        }
        if (!sunAvailable) {
            sunAvailable = this.vectorFromSunDirection(this.tmpVectorB);
        }
        if (!sunAvailable) {
            return null;
        }

        const dot = this.THREE.MathUtils.clamp(this.tmpVectorA.dot(this.tmpVectorB), -1, 1);
        const elongationDeg = this.THREE.MathUtils.radToDeg(Math.acos(dot));

        if (Number.isFinite(this.moonElongationPrevious)) {
            const delta = elongationDeg - this.moonElongationPrevious;
            if (Math.abs(delta) > 0.03) {
                this.moonElongationTrend = delta >= 0 ? 1 : -1;
            }
        }
        this.moonElongationPrevious = elongationDeg;

        const phaseName = this.resolveMoonPhaseName(elongationDeg, this.moonElongationTrend);
        return {
            phaseName,
            elongationDeg,
        };
    }

    resolveMoonPhaseName(elongationDeg, trend) {
        const waxing = trend >= 0;
        if (elongationDeg < 10) {
            return "New Moon";
        }
        if (elongationDeg < 84) {
            return waxing ? "Waxing Crescent" : "Waning Crescent";
        }
        if (elongationDeg <= 96) {
            return waxing ? "First Quarter" : "Last Quarter";
        }
        if (elongationDeg < 170) {
            return waxing ? "Waxing Gibbous" : "Waning Gibbous";
        }
        return "Full Moon";
    }

    roundPercentParts(parts) {
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
    }

    computeCraftMoonVisibilityInfo({ activeCraft, earth, moon, sun }) {
        if (!activeCraft || !earth || !moon) {
            return null;
        }
        if (!this.getObjectWorldPosition(activeCraft, this.craftWorld)) {
            return null;
        }
        if (!this.getObjectWorldPosition(earth, this.earthWorld)) {
            return null;
        }
        if (!this.getObjectWorldPosition(moon, this.moonWorld)) {
            return null;
        }

        this.craftFromMoonDir.subVectors(this.craftWorld, this.moonWorld);
        this.earthFromMoonDir.subVectors(this.earthWorld, this.moonWorld);
        let craftLen = this.craftFromMoonDir.length();
        let earthLen = this.earthFromMoonDir.length();
        if (craftLen <= 1e-12 || earthLen <= 1e-12) {
            return null;
        }
        this.craftFromMoonDir.multiplyScalar(1 / craftLen);
        this.earthFromMoonDir.multiplyScalar(1 / earthLen);

        let sunAvailable = false;
        if (sun && this.getObjectWorldPosition(sun, this.sunWorld)) {
            this.sunFromMoonDir.subVectors(this.sunWorld, this.moonWorld);
            const sunLen = this.sunFromMoonDir.length();
            if (sunLen > 1e-12) {
                this.sunFromMoonDir.multiplyScalar(1 / sunLen);
                sunAvailable = true;
            }
        }
        if (!sunAvailable) {
            sunAvailable = this.vectorFromSunDirection(this.sunFromMoonDir);
        }
        if (!sunAvailable) {
            return null;
        }

        let visibleCount = 0;
        let nearDay = 0;
        let nearNight = 0;
        let farDay = 0;
        let farNight = 0;
        const samples = this.moonVisibilitySamples;
        for (let i = 0; i < samples.length; i += 3) {
            const nx = samples[i];
            const ny = samples[i + 1];
            const nz = samples[i + 2];
            const visibleDot = nx * this.craftFromMoonDir.x + ny * this.craftFromMoonDir.y + nz * this.craftFromMoonDir.z;
            if (visibleDot <= 0) continue;
            visibleCount += 1;

            const near = (nx * this.earthFromMoonDir.x + ny * this.earthFromMoonDir.y + nz * this.earthFromMoonDir.z) >= 0;
            const day = (nx * this.sunFromMoonDir.x + ny * this.sunFromMoonDir.y + nz * this.sunFromMoonDir.z) >= 0;

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
        const [nearDayPct, nearNightPct, farDayPct, farNightPct] = this.roundPercentParts(rawParts);
        const nearPct = nearDayPct + nearNightPct;
        const farPct = farDayPct + farNightPct;

        return {
            nearPct,
            farPct,
            nearDayPct,
            nearNightPct,
            farDayPct,
            farNightPct,
        };
    }

    setPanelFov(panelState, requestedDegrees) {
        if (!Number.isFinite(requestedDegrees)) {
            return;
        }

        const sliderMin = Number(panelState.fovSlider.min);
        const sliderMax = Number(panelState.fovSlider.max);
        const minDegrees = Number.isFinite(sliderMin) ? sliderMin : AUTO_FOV_MIN_DEGREES;
        const maxDegrees = Number.isFinite(sliderMax) ? sliderMax : AUTO_FOV_MAX_DEGREES;
        const fovDegrees = this.THREE.MathUtils.clamp(requestedDegrees, minDegrees, maxDegrees);

        if (Math.abs(panelState.camera.fov - fovDegrees) > 1e-4) {
            panelState.camera.fov = fovDegrees;
            panelState.camera.updateProjectionMatrix();
            panelState.overlayDirty = true;
        }

        const rounded = Math.round(fovDegrees);
        panelState.fovSlider.value = String(rounded);
        panelState.fovValue.value = `${rounded}°`;
        panelState.fovValue.textContent = panelState.fovValue.value;
    }

    renderComposerPanel(panelState, {
        scene,
        activeCraft,
        earth,
        moon,
        earthRadius,
        moonRadius,
        referenceCamera,
        hasSkyContainer,
        skyContainer,
    }) {
        if (!activeCraft || !earth || !moon) {
            this.setPanelVisible(panelState, false);
            return false;
        }
        if (!this.getObjectWorldPosition(activeCraft, this.craftWorld)) {
            this.setPanelVisible(panelState, false);
            return false;
        }
        if (!this.getObjectWorldPosition(earth, this.earthWorld) || !this.getObjectWorldPosition(moon, this.moonWorld)) {
            this.setPanelVisible(panelState, false);
            return false;
        }

        this.setPanelVisible(panelState, true);
        this.syncPanelSize(panelState);
        this.syncComposerTimelineUi(panelState);

        if (referenceCamera) {
            if (
                Math.abs(panelState.camera.near - referenceCamera.near) > 1e-9 ||
                Math.abs(panelState.camera.far - referenceCamera.far) > 1e-9
            ) {
                panelState.camera.near = referenceCamera.near;
                panelState.camera.far = referenceCamera.far;
                panelState.camera.updateProjectionMatrix();
            }
        }

        const lockTarget = panelState.composerLockTarget || "none";
        if (lockTarget === "earth" || lockTarget === "moon") {
            this.applyComposerPreset(panelState, lockTarget, {
                craftWorld: this.craftWorld,
                earthWorld: this.earthWorld,
                moonWorld: this.moonWorld,
            });
        } else if (!Number.isFinite(panelState.composerYawRad) || !Number.isFinite(panelState.composerPitchRad)) {
            this.applyComposerPreset(panelState, "earth", {
                craftWorld: this.craftWorld,
                earthWorld: this.earthWorld,
                moonWorld: this.moonWorld,
            });
        }
        this.updateComposerDialThumb(panelState);

        panelState.camera.position.copy(this.craftWorld);
        let distanceForFov = Number.NaN;
        let radiusForFov = Number.NaN;
        const disabledAsCraftToEarth = panelState.composerInteractionEnabled !== true;
        if (disabledAsCraftToEarth) {
            this.composerLookAtWorld.copy(this.earthWorld);
            this.viewDir.subVectors(this.earthWorld, this.craftWorld).normalize();
            this.targetUp.set(0, 0, 1);
            earth.getWorldQuaternion(this.targetQuat);
            this.targetUp.applyQuaternion(this.targetQuat).normalize();
            if (Math.abs(this.targetUp.dot(this.viewDir)) > 0.98) {
                panelState.camera.up.set(0, 0, 1);
            } else {
                panelState.camera.up.copy(this.targetUp);
            }
            panelState.camera.lookAt(this.composerLookAtWorld);
            distanceForFov = panelState.camera.position.distanceTo(this.earthWorld);
            radiusForFov = (Number.isFinite(earthRadius) && earthRadius > 0)
                ? earthRadius
                : this.estimateObjectRadius(earth, 1);
        } else {
            const lookDir = this.getComposerLookDirection(panelState);
            panelState.camera.up.copy(this.getComposerCameraUp(panelState, lookDir));
            this.composerLookAtWorld.copy(this.craftWorld).add(lookDir);
            panelState.camera.lookAt(this.composerLookAtWorld);
            // Keep previous auto-FoV behavior when enabled.
            if (lockTarget === "earth") {
                distanceForFov = panelState.camera.position.distanceTo(this.earthWorld);
                radiusForFov = (Number.isFinite(earthRadius) && earthRadius > 0)
                    ? earthRadius
                    : this.estimateObjectRadius(earth, 1);
            } else if (lockTarget === "moon") {
                distanceForFov = panelState.camera.position.distanceTo(this.moonWorld);
                radiusForFov = (Number.isFinite(moonRadius) && moonRadius > 0)
                    ? moonRadius
                    : this.estimateObjectRadius(moon, 1);
            }
        }

        if (!disabledAsCraftToEarth && panelState.autoFovEnabled) {
            const autoFov = this.computeComposerAutoFovDegrees({
                panelState,
                craftWorld: this.craftWorld,
                earthWorld: this.earthWorld,
                moonWorld: this.moonWorld,
                earthRadius,
                moonRadius,
                lockTarget,
            });
            this.setPanelFov(panelState, autoFov);
        }

        if (hasSkyContainer) {
            panelState.camera.getWorldPosition(this.panelCameraWorldPosition);
            if (skyContainer.parent?.worldToLocal) {
                this.panelSkyLocalPosition.copy(this.panelCameraWorldPosition);
                skyContainer.parent.worldToLocal(this.panelSkyLocalPosition);
                skyContainer.position.copy(this.panelSkyLocalPosition);
            } else {
                skyContainer.position.copy(this.panelCameraWorldPosition);
            }
        }
        const ambientLight = this.getComposerAmbientLight(scene);
        if (ambientLight) {
            ambientLight.intensity = this.THREE.MathUtils.clamp(
                panelState.composerAmbient,
                COMPOSER_MIN_AMBIENT,
                COMPOSER_MAX_AMBIENT,
            );
            ambientLight.visible = ambientLight.intensity > 1e-6;
        }
        try {
            this.renderLayers(panelState.renderer, scene, panelState.camera);
        } finally {
            if (ambientLight) {
                ambientLight.visible = false;
            }
        }
        this.clearPanelOverlay(panelState);
        return true;
    }

    render({
        scene,
        activeCraft,
        earth,
        moon,
        sun = null,
        sunDirection = null,
        skyContainer = null,
        earthRadius = null,
        moonRadius = null,
        timelineEventInfos = null,
        referenceCamera,
        panelsVisible = true,
    }) {
        if (!this.root) {
            return;
        }

        this.panelsEnabled = panelsVisible !== false;
        if (!this.panelsEnabled || !isDesktopViewport()) {
            this.root.hidden = true;
            return;
        }

        if (!scene || !activeCraft) {
            this.root.hidden = true;
            return;
        }

        this.root.hidden = false;
        this.composerFlybyTimeMs = this.resolveLunarFlybyTimeMs(timelineEventInfos);
        activeCraft.getWorldPosition(this.craftWorld);
        if (
            sunDirection &&
            Number.isFinite(sunDirection.x) &&
            Number.isFinite(sunDirection.y) &&
            Number.isFinite(sunDirection.z)
        ) {
            this.sunDirectionWorld.set(sunDirection.x, sunDirection.y, sunDirection.z);
        } else {
            this.sunDirectionWorld.set(1, 0, 0);
        }
        const craftWasVisible = activeCraft.visible;
        const nowMs = performance.now();
        const refreshAnalytics = !Number.isFinite(this.analyticsLastUpdateMs) || (nowMs - this.analyticsLastUpdateMs) >= 120;
        if (refreshAnalytics) {
            this.cachedMoonPhaseInfo = this.computeMoonPhaseInfo({ earth, moon, sun });
            this.cachedMoonVisibilityInfo = this.computeCraftMoonVisibilityInfo({ activeCraft, earth, moon, sun });
            this.analyticsLastUpdateMs = nowMs;
        }
        // Keep auxiliary craft views physically faithful: camera sits at the
        // craft origin (no artificial standoff), so body occultations such as
        // Earth-rise behind the Moon remain geometrically correct.
        const standoffDistance = 0;

        let visiblePanels = 0;
        activeCraft.visible = false;
        const suppressedLines = this.suppressLinePrimitives(scene);
        const hasSkyContainer = !!skyContainer?.position;
        if (hasSkyContainer) {
            this.originalSkyPosition.copy(skyContainer.position);
        }

        try {
            for (const panelState of this.panels) {
                const context = { activeCraft, earth, moon, sun };
                if (panelState.mode === "composer") {
                    if (panelState.minimized === true) {
                        this.setPanelVisible(panelState, false);
                        visiblePanels += 1;
                        continue;
                    }
                    const rendered = this.renderComposerPanel(panelState, {
                        scene,
                        activeCraft,
                        earth,
                        moon,
                        earthRadius,
                        moonRadius,
                        referenceCamera,
                        hasSkyContainer,
                        skyContainer,
                    });
                    if (rendered) {
                        visiblePanels += 1;
                    }
                    continue;
                }
                const hasAnchor = this.resolvePositionForKey(panelState.anchorKey, context, this.anchorWorld);
                const targetObject = panelState.targetKey === "earth"
                    ? earth
                    : (panelState.targetKey === "moon" ? moon : null);
                const hasTarget = this.resolvePositionForKey(panelState.targetKey, context, this.targetWorld);
                if (!hasAnchor || !targetObject || !hasTarget) {
                    this.setPanelVisible(panelState, false);
                    continue;
                }
                if (panelState.minimized === true) {
                    this.setPanelVisible(panelState, false);
                    visiblePanels += 1; // keep root visible while minimized chips are shown
                    continue;
                }

                const distanceSq = this.anchorWorld.distanceToSquared(this.targetWorld);
                if (!Number.isFinite(distanceSq) || distanceSq <= 1e-14) {
                    this.setPanelVisible(panelState, false);
                    continue;
                }

                this.setPanelVisible(panelState, true);
                visiblePanels += 1;
                this.syncPanelSize(panelState);

                if (referenceCamera) {
                    if (
                        Math.abs(panelState.camera.near - referenceCamera.near) > 1e-9 ||
                        Math.abs(panelState.camera.far - referenceCamera.far) > 1e-9
                    ) {
                        panelState.camera.near = referenceCamera.near;
                        panelState.camera.far = referenceCamera.far;
                        panelState.camera.updateProjectionMatrix();
                    }
                }

                this.viewDir.subVectors(this.targetWorld, this.anchorWorld).normalize();
                panelState.camera.position.copy(this.anchorWorld);
                if (standoffDistance > 0) {
                    this.cameraOffset.copy(this.viewDir).multiplyScalar(-standoffDistance);
                    panelState.camera.position.add(this.cameraOffset);
                }

                this.targetUp.set(0, 0, 1);
                targetObject.getWorldQuaternion(this.targetQuat);
                this.targetUp.applyQuaternion(this.targetQuat).normalize();
                if (Math.abs(this.targetUp.dot(this.viewDir)) > 0.98) {
                    panelState.camera.up.set(0, 0, 1);
                } else {
                    panelState.camera.up.copy(this.targetUp);
                }

                const radiusHint = panelState.targetKey === "earth" ? earthRadius : moonRadius;
                const targetRadius = Number.isFinite(radiusHint) && radiusHint > 0
                    ? radiusHint
                    : this.estimateObjectRadius(targetObject, 1);
                const distanceToTarget = panelState.camera.position.distanceTo(this.targetWorld);

                if (panelState.autoFovEnabled) {
                    const autoFovDegrees = this.computeAutoFovDegrees({
                        distanceToTarget,
                        targetRadius,
                        aspect: panelState.camera.aspect,
                    });
                    this.setPanelFov(panelState, autoFovDegrees);
                }
                panelState.camera.lookAt(this.targetWorld);

                if (hasSkyContainer) {
                    panelState.camera.getWorldPosition(this.panelCameraWorldPosition);
                    if (skyContainer.parent?.worldToLocal) {
                        this.panelSkyLocalPosition.copy(this.panelCameraWorldPosition);
                        skyContainer.parent.worldToLocal(this.panelSkyLocalPosition);
                        skyContainer.position.copy(this.panelSkyLocalPosition);
                    } else {
                        skyContainer.position.copy(this.panelCameraWorldPosition);
                    }
                }

                this.renderLayers(panelState.renderer, scene, panelState.camera);

                if (panelState.infoMode === "moon-phase") {
                    const phase = this.cachedMoonPhaseInfo;
                    if (phase) {
                        this.setPanelInfo(
                            panelState,
                            `Phase: ${phase.phaseName}`,
                            `Sun separation: ${phase.elongationDeg.toFixed(1)}°`,
                        );
                    } else {
                        this.setPanelInfo(panelState, "Phase: --", "Sun separation: --");
                    }
                } else if (panelState.infoMode === "moon-visibility") {
                    const visibility = this.cachedMoonVisibilityInfo;
                    if (visibility) {
                        const hasEarthWorld = this.getObjectWorldPosition(earth, this.earthWorld);
                        if (!hasEarthWorld) {
                            this.clearPanelOverlay(panelState);
                        }
                        if (hasEarthWorld) {
                            this.tmpVectorC.subVectors(this.earthWorld, this.targetWorld);
                            if (this.tmpVectorC.lengthSq() > 1e-18) {
                                this.tmpVectorC.normalize();
                            } else {
                                this.tmpVectorC.set(1, 0, 0);
                            }
                        } else {
                            this.tmpVectorC.set(1, 0, 0);
                        }
                        this.renderMoonFarSideOverlay(panelState, {
                            distanceToTarget,
                            targetRadius,
                            earthDirectionWorld: this.tmpVectorC,
                        });
                        this.setPanelInfo(
                            panelState,
                            "Visible lunar surface",
                            `${visibility.nearPct}% near (${visibility.nearDayPct}% day; ${visibility.nearNightPct}% night) ${visibility.farPct}% far (${visibility.farDayPct}% day; ${visibility.farNightPct}% night)`,
                            {
                                pillText: panelState.farSideTintEnabled ? "Far Side: ON" : "Far Side: OFF",
                                pillVariant: "far",
                                pillInteractive: true,
                                pillOn: panelState.farSideTintEnabled === true,
                            },
                        );
                    } else {
                        this.clearPanelOverlay(panelState);
                        this.setPanelInfo(panelState, "Visible lunar surface", "No visibility data");
                    }
                } else {
                    this.clearPanelOverlay(panelState);
                    this.setPanelInfo(panelState, "", "");
                }
            }
        } finally {
            if (hasSkyContainer) {
                skyContainer.position.copy(this.originalSkyPosition);
            }
            this.restoreVisibility(suppressedLines);
            activeCraft.visible = craftWasVisible;
        }

        const hasMinimizedPanels = this.panels.some((panelState) => panelState.minimized === true);
        this.root.hidden = visiblePanels === 0 && !hasMinimizedPanels;
    }

    dispose() {
        if (!this.root) {
            return;
        }

        window.removeEventListener("resize", this.handleResizeBound);
        if (this.panelResizeObserver) {
            this.panelResizeObserver.disconnect();
            this.panelResizeObserver = null;
        }
        if (this.pendingResizeRaf != null) {
            cancelAnimationFrame(this.pendingResizeRaf);
            this.pendingResizeRaf = null;
        }
        if (this.persistStateTimeout != null) {
            clearTimeout(this.persistStateTimeout);
            this.persistStateTimeout = null;
        }
        this.pendingResizePanelStates.clear();
        this.dragState = null;
        for (const panelState of this.panels) {
            panelState.fovSlider.removeEventListener("input", panelState.onFovInput);
            panelState.autoToggle.removeEventListener("click", panelState.onAutoToggleClick);
            panelState.minimizeButton.removeEventListener("click", panelState.onMinimizeClick);
            panelState.chipButton.removeEventListener("click", panelState.onChipClick);
            if (panelState.onInfoPillClick) {
                panelState.infoPill.removeEventListener("click", panelState.onInfoPillClick);
            }
            if (panelState.onComposerLookFreeClick) {
                panelState.composerLookFreeButton?.removeEventListener("click", panelState.onComposerLookFreeClick);
            }
            if (panelState.onComposerLookEarthClick) {
                panelState.composerLookEarthButton?.removeEventListener("click", panelState.onComposerLookEarthClick);
            }
            if (panelState.onComposerLookMoonClick) {
                panelState.composerLookMoonButton?.removeEventListener("click", panelState.onComposerLookMoonClick);
            }
            if (panelState.onComposerTimelineInput) {
                panelState.composerTimelineSlider?.removeEventListener("input", panelState.onComposerTimelineInput);
            }
            if (panelState.onComposerAmbientInput) {
                panelState.composerAmbientSlider?.removeEventListener("input", panelState.onComposerAmbientInput);
            }
            if (panelState.onComposerTimelinePointerDown) {
                panelState.composerTimelineSlider?.removeEventListener("pointerdown", panelState.onComposerTimelinePointerDown);
            }
            if (panelState.onComposerTimelinePointerUp) {
                panelState.composerTimelineSlider?.removeEventListener("pointerup", panelState.onComposerTimelinePointerUp);
                panelState.composerTimelineSlider?.removeEventListener("change", panelState.onComposerTimelinePointerUp);
            }
            if (panelState.onComposerDialPointerDown) {
                panelState.composerDial?.removeEventListener("pointerdown", panelState.onComposerDialPointerDown);
            }
            if (panelState.onComposerDialPointerMove) {
                panelState.composerDial?.removeEventListener("pointermove", panelState.onComposerDialPointerMove);
            }
            if (panelState.onComposerDialPointerUp) {
                panelState.composerDial?.removeEventListener("pointerup", panelState.onComposerDialPointerUp);
                panelState.composerDial?.removeEventListener("pointercancel", panelState.onComposerDialPointerUp);
            }
            if (panelState.onComposerViewportPointerDown) {
                panelState.viewport.removeEventListener("pointerdown", panelState.onComposerViewportPointerDown);
            }
            if (panelState.onComposerViewportPointerMove) {
                panelState.viewport.removeEventListener("pointermove", panelState.onComposerViewportPointerMove);
            }
            if (panelState.onComposerViewportPointerUp) {
                panelState.viewport.removeEventListener("pointerup", panelState.onComposerViewportPointerUp);
                panelState.viewport.removeEventListener("pointercancel", panelState.onComposerViewportPointerUp);
            }
            if (panelState.onComposerViewportWheel) {
                panelState.viewport.removeEventListener("wheel", panelState.onComposerViewportWheel);
            }
            if (panelState.onComposerPanelGatePointerDown) {
                panelState.panel.removeEventListener("pointerdown", panelState.onComposerPanelGatePointerDown, true);
            }
            const header = panelState.panel.querySelector(".aux-camera-view__header");
            if (header) {
                if (panelState.onPointerDown) {
                    header.removeEventListener("pointerdown", panelState.onPointerDown);
                }
                if (panelState.onPointerMove) {
                    header.removeEventListener("pointermove", panelState.onPointerMove);
                }
                if (panelState.onPointerUp) {
                    header.removeEventListener("pointerup", panelState.onPointerUp);
                }
                if (panelState.onPointerCancel) {
                    header.removeEventListener("pointercancel", panelState.onPointerCancel);
                }
            }
            if (panelState.onPanelPointerDown) {
                panelState.panel.removeEventListener("pointerdown", panelState.onPanelPointerDown);
            }
            panelState.renderer.dispose();
            panelState.chipButton.remove();
        }
        this.panels.length = 0;
        this.root.remove();
        this.root = null;
        this.chipDock = null;
        this.chipDockLeft = null;
        this.chipDockRight = null;
    }
}

export { AuxiliaryCameraViewsManager };
