function createCameraOverlayActions(deps) {
    const {
        THREE,
        isTestMode,
        getAnimationScenes,
        getConfig,
        readCameraPositionMode,
        readCameraLookMode,
        getPixelsPerAU,
        getKmPerAu,
        recenterMountedCamera,
    } = deps;

    let cameraOverlayState = null;
    let lastCameraOverlayUpdateMs = 0;

    function initCameraOverlay() {
        if (isTestMode) return;

        const wrapper = document.getElementById("camera-overlay-wrapper");
        const toggle = document.getElementById("camera-overlay-toggle");
        const panel = document.getElementById("camera-overlay");
        const close = document.getElementById("camera-overlay-close");
        const recenter = document.getElementById("camera-overlay-recenter");

        if (!wrapper || !toggle || !panel || !close || !recenter) return;

        wrapper.hidden = false;

        const openPanel = () => { panel.hidden = false; };
        const closePanel = () => { panel.hidden = true; };

        toggle.addEventListener("click", () => {
            panel.hidden ? openPanel() : closePanel();
            updateCameraOverlay(true);
        });
        close.addEventListener("click", closePanel);
        recenter.addEventListener("click", () => {
            recenterMountedCamera();
            updateCameraOverlay(true);
        });

        cameraOverlayState = {
            panel,
            mode: document.getElementById("camera-overlay-mode"),
            look: document.getElementById("camera-overlay-look"),
            posUnits: document.getElementById("camera-overlay-pos-units"),
            posKm: document.getElementById("camera-overlay-pos-km"),
            mountDist: document.getElementById("camera-overlay-mount-dist"),
            tmp: new THREE.Vector3(),
        };
    }

    function estimateBodyRadius(scene, mode) {
        const mesh = mode === "earth"
            ? scene?.earth
            : mode === "moon"
                ? scene?.moon
                : null;
        const geometry = mesh?.geometry;
        if (!geometry) return null;
        if (!geometry.boundingSphere) geometry.computeBoundingSphere?.();
        const r = geometry.boundingSphere?.radius;
        return Number.isFinite(r) && r > 0 ? r : null;
    }

    function updateCameraOverlay(force = false) {
        if (!cameraOverlayState?.panel || cameraOverlayState.panel.hidden) return;

        const now = performance.now();
        if (!force && now - lastCameraOverlayUpdateMs < 200) return;
        lastCameraOverlayUpdateMs = now;

        const config = getConfig();
        const scene = getAnimationScenes()[config];
        const camera = scene?.camera;
        if (!scene?.initialized3D || !camera) return;

        const positionMode = readCameraPositionMode();
        const lookMode = readCameraLookMode();
        const pixelsPerAu = getPixelsPerAU();
        const kmPerUnit = Number.isFinite(pixelsPerAu) && pixelsPerAu > 0
            ? (getKmPerAu() / pixelsPerAu)
            : null;

        camera.getWorldPosition(cameraOverlayState.tmp);
        const { x, y, z } = cameraOverlayState.tmp;

        if (cameraOverlayState.mode) cameraOverlayState.mode.textContent = positionMode;
        if (cameraOverlayState.look) cameraOverlayState.look.textContent = lookMode;
        if (cameraOverlayState.posUnits) cameraOverlayState.posUnits.textContent = `${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`;
        if (cameraOverlayState.posKm && kmPerUnit) {
            cameraOverlayState.posKm.textContent = `${(x * kmPerUnit).toFixed(0)}, ${(y * kmPerUnit).toFixed(0)}, ${(z * kmPerUnit).toFixed(0)}`;
        } else if (cameraOverlayState.posKm) {
            cameraOverlayState.posKm.textContent = "-";
        }

        if (cameraOverlayState.mountDist) {
            if (positionMode === "earth" || positionMode === "moon") {
                const controller = scene.cameraController;
                const distance = controller?.mountOffset?.length?.();
                const radius = estimateBodyRadius(scene, positionMode);
                const inside = Number.isFinite(distance) && Number.isFinite(radius) ? (distance < radius) : null;
                const distKm = kmPerUnit && Number.isFinite(distance) ? (distance * kmPerUnit).toFixed(0) : "-";
                const insideLabel = inside === null ? "?" : (inside ? "inside" : "outside");
                cameraOverlayState.mountDist.textContent = `${Number.isFinite(distance) ? distance.toFixed(2) : "-"} u (${distKm} km) • ${insideLabel}`;
            } else if (positionMode === "spacecraft") {
                const controller = scene.cameraController;
                const distance = controller?.mountOffset?.length?.();
                const distKm = kmPerUnit && Number.isFinite(distance) ? (distance * kmPerUnit).toFixed(0) : "-";
                cameraOverlayState.mountDist.textContent = `${Number.isFinite(distance) ? distance.toFixed(2) : "-"} u (${distKm} km)`;
            } else {
                cameraOverlayState.mountDist.textContent = "-";
            }
        }
    }

    return {
        initCameraOverlay,
        updateCameraOverlay,
    };
}

export { createCameraOverlayActions };
