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

function isDesktopViewport() {
    return window.innerWidth > 600;
}

class AuxiliaryCameraViewsManager {
    constructor({ THREE, overlayHost }) {
        this.THREE = THREE;
        this.overlayHost = overlayHost || document.body;
        this.root = null;
        this.panels = [];
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

        for (const spec of PANEL_SPECS) {
            this.createPanel(spec);
        }
    }

    createPanel(spec) {
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

        const fovSlider = document.createElement("input");
        fovSlider.className = "aux-camera-view__fov-slider";
        fovSlider.type = "range";
        fovSlider.min = "1";
        fovSlider.max = "120";
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
            renderer.outputEncoding = this.THREE.sRGBEncoding;
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

        const onFovInput = () => {
            const fov = Number(fovSlider.value);
            camera.fov = fov;
            camera.updateProjectionMatrix();
            fovValue.value = `${Math.round(fov)}°`;
            fovValue.textContent = fovValue.value;
        };
        fovSlider.addEventListener("input", onFovInput, { passive: true });
        onFovInput();

        this.root.appendChild(panel);
        this.panels.push({
            targetKey: spec.targetKey,
            panel,
            viewport,
            renderer,
            camera,
            width: 0,
            height: 0,
            onFovInput,
            fovSlider,
        });
    }

    handleResize() {
        if (!this.root) {
            return;
        }
        this.root.hidden = !isDesktopViewport();
    }

    setPanelVisible(panelState, visible) {
        panelState.panel.hidden = !visible;
    }

    syncPanelSize(panelState) {
        const width = Math.max(120, Math.floor(panelState.viewport.clientWidth));
        const height = Math.max(80, Math.floor(panelState.viewport.clientHeight));
        if (width === panelState.width && height === panelState.height) {
            return;
        }
        panelState.width = width;
        panelState.height = height;
        panelState.renderer.setSize(width, height, true);
        panelState.camera.aspect = width / height;
        panelState.camera.updateProjectionMatrix();
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

    render({ scene, activeCraft, earth, moon, referenceCamera }) {
        if (!this.root) {
            return;
        }

        if (!isDesktopViewport()) {
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
        const craftRadius = this.estimateCraftRadius(activeCraft);
        const standoffDistance = Math.max(craftRadius * 2.5, 0.02);

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
                this.cameraOffset.copy(this.viewDir).multiplyScalar(-standoffDistance);
                panelState.camera.position.copy(this.craftWorld).add(this.cameraOffset);

                this.targetUp.set(0, 0, 1);
                targetObject.getWorldQuaternion(this.targetQuat);
                this.targetUp.applyQuaternion(this.targetQuat).normalize();
                if (Math.abs(this.targetUp.dot(this.viewDir)) > 0.98) {
                    panelState.camera.up.set(0, 0, 1);
                } else {
                    panelState.camera.up.copy(this.targetUp);
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
        for (const panelState of this.panels) {
            panelState.fovSlider.removeEventListener("input", panelState.onFovInput);
            panelState.renderer.dispose();
        }
        this.panels.length = 0;
        this.root.remove();
        this.root = null;
    }
}

export { AuxiliaryCameraViewsManager };
