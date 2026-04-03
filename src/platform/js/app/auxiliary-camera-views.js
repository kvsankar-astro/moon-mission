const PANEL_SPECS = Object.freeze([
    {
        id: "earth",
        title: "Craft -> Earth",
        targetKey: "earth",
        defaultFov: 45,
    },
    {
        id: "moon",
        title: "Craft -> Moon",
        targetKey: "moon",
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

        this.craftWorld = new THREE.Vector3();
        this.targetWorld = new THREE.Vector3();
        this.viewDir = new THREE.Vector3();
        this.targetUp = new THREE.Vector3();
        this.targetQuat = new THREE.Quaternion();
        this.cameraOffset = new THREE.Vector3();
        this.boundingBox = new THREE.Box3();
        this.boundingSphere = new THREE.Sphere();

        if (!isDesktopViewport()) {
            return;
        }

        this.createDom();
        window.addEventListener("resize", this.handleResizeBound, { passive: true });
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
            renderer.toneMappingExposure = 1.25;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.setSize(1, 1);
            renderer.domElement.className = "aux-camera-view__canvas";
            renderer.domElement.setAttribute("aria-hidden", "true");
            viewport.appendChild(renderer.domElement);
        } catch (err) {
            panel.remove();
            return;
        }

        const camera = new this.THREE.PerspectiveCamera(spec.defaultFov, 1, 0.0001, 100000);
        camera.up.set(0, 0, 1);

        const panelState = {
            targetKey: spec.targetKey,
            panel,
            viewport,
            renderer,
            camera,
            width: 0,
            height: 0,
            onFovInput: null,
            fovSlider,
            fovValue,
            autoToggle,
            autoFovEnabled: true,
            onAutoToggleClick: null,
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
    }

    syncPanelSize(panelState) {
        const width = Math.max(120, Math.floor(panelState.viewport.clientWidth));
        const height = Math.max(80, Math.floor(panelState.viewport.clientHeight));
        const changed = width !== panelState.width || height !== panelState.height;
        if (changed) {
            panelState.width = width;
            panelState.height = height;
            panelState.renderer.setSize(width, height, true);
            panelState.camera.aspect = width / height;
            panelState.camera.updateProjectionMatrix();
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
        const craftWasVisible = activeCraft.visible;
        // Keep auxiliary craft views physically faithful: camera sits at the
        // craft origin (no artificial standoff), so body occultations such as
        // Earth-rise behind the Moon remain geometrically correct.
        const standoffDistance = 0;

        let visiblePanels = 0;
        activeCraft.visible = false;
        const suppressedLines = this.suppressLinePrimitives(scene);

        try {
            for (const panelState of this.panels) {
                const targetObject = panelState.targetKey === "earth" ? earth : moon;
                if (!targetObject) {
                    this.setPanelVisible(panelState, false);
                    continue;
                }

                targetObject.getWorldPosition(this.targetWorld);
                const distanceSq = this.craftWorld.distanceToSquared(this.targetWorld);
                if (!Number.isFinite(distanceSq) || distanceSq <= 1e-14) {
                    this.setPanelVisible(panelState, false);
                    continue;
                }

                this.setPanelVisible(panelState, true);
                visiblePanels += 1;
                this.syncPanelSize(panelState);

                if (referenceCamera) {
                    panelState.camera.near = referenceCamera.near;
                    panelState.camera.far = referenceCamera.far;
                    panelState.camera.updateProjectionMatrix();
                }

                this.viewDir.subVectors(this.targetWorld, this.craftWorld).normalize();
                panelState.camera.position.copy(this.craftWorld);
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

                if (panelState.autoFovEnabled) {
                    const radiusHint = panelState.targetKey === "earth" ? earthRadius : moonRadius;
                    const targetRadius = Number.isFinite(radiusHint) && radiusHint > 0
                        ? radiusHint
                        : this.estimateObjectRadius(targetObject, 1);
                    const distanceToTarget = panelState.camera.position.distanceTo(this.targetWorld);
                    const autoFovDegrees = this.computeAutoFovDegrees({
                        distanceToTarget,
                        targetRadius,
                        aspect: panelState.camera.aspect,
                    });
                    this.setPanelFov(panelState, autoFovDegrees);
                }
                panelState.camera.lookAt(this.targetWorld);
                this.renderLayers(panelState.renderer, scene, panelState.camera);
            }
        } finally {
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
        this.dragState = null;
        for (const panelState of this.panels) {
            panelState.fovSlider.removeEventListener("input", panelState.onFovInput);
            panelState.autoToggle.removeEventListener("click", panelState.onAutoToggleClick);
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
