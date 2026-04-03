const PANEL_SPECS = Object.freeze([
    {
        id: "earth",
        title: "Craft -> Earth",
        anchorKey: "craft",
        targetKey: "earth",
        infoMode: "none",
        defaultFov: 45,
    },
    {
        id: "moon",
        title: "Craft -> Moon",
        anchorKey: "craft",
        targetKey: "moon",
        infoMode: "moon-visibility",
        defaultFov: 45,
    },
    {
        id: "earth-to-moon",
        title: "Earth -> Moon",
        anchorKey: "earth",
        targetKey: "moon",
        infoMode: "moon-phase",
        defaultFov: 45,
    },
]);

const PANEL_GAP_PX = 8;
const PANEL_MARGIN_PX = 8;
const PANEL_TOP_OFFSET_PX = 38;
const AUTO_FOV_MARGIN_SCALE = 1.03;
const AUTO_FOV_MIN_DEGREES = 1;
const AUTO_FOV_MAX_DEGREES = 179;

function isDesktopViewport() {
    return window.innerWidth > 600;
}

class AuxiliaryCameraViewsManager {
    constructor({ THREE, overlayHost, requestRender }) {
        this.THREE = THREE;
        this.overlayHost = overlayHost || document.body;
        this.requestRender = typeof requestRender === "function" ? requestRender : null;
        this.root = null;
        this.panels = [];
        this.panelsEnabled = true;
        this.zIndexCounter = 1;
        this.dragState = null;
        this.handleResizeBound = this.handleResize.bind(this);
        this.panelStateByElement = new WeakMap();
        this.pendingResizePanelStates = new Set();
        this.pendingResizeRaf = null;
        this.handlePanelResizeEntriesBound = this.handlePanelResizeEntries.bind(this);

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
        this.viewDir = new THREE.Vector3();
        this.targetUp = new THREE.Vector3();
        this.targetQuat = new THREE.Quaternion();
        this.panelCameraWorldQuat = new THREE.Quaternion();
        this.panelCameraWorldQuatInv = new THREE.Quaternion();
        this.earthDirInCamera = new THREE.Vector3();
        this.cameraOffset = new THREE.Vector3();
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

        PANEL_SPECS.forEach((spec, index) => {
            this.createPanel(spec, index);
        });
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

        header.appendChild(fovControls);
        panel.appendChild(header);

        const info = document.createElement("div");
        info.className = "aux-camera-view__info";
        info.hidden = spec.infoMode === "none";
        const infoPrimary = document.createElement("div");
        infoPrimary.className = "aux-camera-view__info-line aux-camera-view__info-line--primary";
        const infoPrimaryText = document.createElement("span");
        infoPrimaryText.className = "aux-camera-view__info-primary-text";
        const infoPill = document.createElement("button");
        infoPill.type = "button";
        infoPill.className = "aux-camera-view__pill";
        infoPill.hidden = true;
        infoPrimary.appendChild(infoPrimaryText);
        infoPrimary.appendChild(infoPill);
        const infoSecondary = document.createElement("div");
        infoSecondary.className = "aux-camera-view__info-line aux-camera-view__info-line--secondary";
        info.appendChild(infoPrimary);
        info.appendChild(infoSecondary);
        panel.appendChild(info);

        const viewport = document.createElement("div");
        viewport.className = "aux-camera-view__viewport";
        panel.appendChild(viewport);

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

        const camera = new this.THREE.PerspectiveCamera(spec.defaultFov, 1, 0.0001, 100000);
        camera.up.set(0, 0, 1);

        const panelState = {
            id: spec.id,
            anchorKey: spec.anchorKey || "craft",
            targetKey: spec.targetKey,
            infoMode: spec.infoMode || "none",
            panel,
            viewport,
            renderer,
            camera,
            info,
            infoPrimary,
            infoPrimaryText,
            infoSecondary,
            infoPill,
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
            autoFovEnabled: true,
            onAutoToggleClick: null,
            onInfoPillClick: null,
            onPointerDown: null,
            onPointerMove: null,
            onPointerUp: null,
            onPointerCancel: null,
            x: 0,
            y: 0,
            onPanelPointerDown: null,
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
        };
        const onAutoToggleClick = () => {
            panelState.autoFovEnabled = !panelState.autoFovEnabled;
            syncAutoToggleUi();
            if (panelState.autoFovEnabled) {
                this.requestRender?.();
            } else {
                onFovInput();
            }
        };
        fovSlider.addEventListener("input", onFovInput, { passive: true });
        autoToggle.addEventListener("click", onAutoToggleClick);
        panelState.onAutoToggleClick = onAutoToggleClick;
        panelState.onFovInput = onFovInput;
        syncAutoToggleUi();
        onFovInput();

        if (panelState.infoMode === "moon-visibility") {
            const onInfoPillClick = () => {
                panelState.farSideTintEnabled = !panelState.farSideTintEnabled;
                panelState.overlayDirty = true;
                this.requestRender?.();
            };
            infoPill.addEventListener("click", onInfoPillClick);
            panelState.onInfoPillClick = onInfoPillClick;
        } else {
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
        for (const panelState of this.panels) {
            this.clampPanelPosition(panelState);
        }
    }

    setPanelVisible(panelState, visible) {
        panelState.panel.hidden = !visible;
        if (!visible) {
            this.clearPanelOverlay(panelState);
        }
    }

    setPanelInfo(panelState, primary = "", secondary = "", options = {}) {
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

    syncPanelSize(panelState) {
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
                const hasAnchor = this.resolvePositionForKey(panelState.anchorKey, context, this.anchorWorld);
                const targetObject = panelState.targetKey === "earth"
                    ? earth
                    : (panelState.targetKey === "moon" ? moon : null);
                const hasTarget = this.resolvePositionForKey(panelState.targetKey, context, this.targetWorld);
                if (!hasAnchor || !targetObject || !hasTarget) {
                    this.setPanelVisible(panelState, false);
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

        this.root.hidden = visiblePanels === 0;
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
        this.pendingResizePanelStates.clear();
        this.dragState = null;
        for (const panelState of this.panels) {
            panelState.fovSlider.removeEventListener("input", panelState.onFovInput);
            panelState.autoToggle.removeEventListener("click", panelState.onAutoToggleClick);
            if (panelState.onInfoPillClick) {
                panelState.infoPill.removeEventListener("click", panelState.onInfoPillClick);
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
        }
        this.panels.length = 0;
        this.root.remove();
        this.root = null;
    }
}

export { AuxiliaryCameraViewsManager };
