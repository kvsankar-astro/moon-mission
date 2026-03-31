/**
 * Scene Helpers - Axes, reference planes, and sphere of influence visualization
 *
 * Manages visual helper objects that aid in understanding the 3D scene:
 * - XYZ axes helper
 * - Ecliptic plane (grid + plane helper)
 * - Equatorial plane (grid + plane helper, tilted by Earth's axial inclination)
 * - Moon's Sphere of Influence (SOI) wireframe
 */

import * as THREE from 'three';
import { COLORS as COL, PHYSICS_CONSTANTS as PC } from '../core/constants.js';
import { sampleOsculatingOrbitPoints } from '../core/domain/orbital-elements.js';

const MOON_ORBIT_SAMPLE_COUNT = 192;
const MOON_ORBIT_REFRESH_MS = 15 * 60 * 1000;
const MOON_HIGHLIGHT_SHOW_THRESHOLD_PX = 260;
const MOON_HIGHLIGHT_MIN_DIAMETER_PX = 72;
const MOON_HIGHLIGHT_MAX_DIAMETER_PX = 164;
const MOON_HIGHLIGHT_MIN_WORLD_SCALE = 4.4;

export class SceneHelpers {
    /**
     * @param {THREE.Object3D} parentContainer - Container to add helpers to
     */
    constructor(parentContainer) {
        this.parentContainer = parentContainer;

        // Axes
        this.axesHelper = null;

        // Ecliptic plane
        this.eclipticPolarGridHelper = null;
        this.eclipticPlaneHelper = null;

        // Equatorial plane
        this.equatorialPlaneContainer = null;
        this.equatorialPolarGridHelper = null;
        this.equatorialPlaneHelper = null;

        // Moon SOI
        this.moonSOISphere = null;
        this.moonContainer = null;  // Reference to moon container for SOI attachment
        this.moonHighlightSprite = null;
        this.moonHighlightTexture = null;
        this.moonHighlightMaterial = null;
        this.moonHighlightOverlay = null;
        this.moonHighlightMoonRadius = 0;
        this.moonOsculatingOrbitLine = null;
        this.moonOsculatingOrbitLastUpdateTimeMs = null;
        this._moonWorldPosition = new THREE.Vector3();
        this._cameraWorldPosition = new THREE.Vector3();
        this._projectedMoonPosition = new THREE.Vector3();
    }

    /**
     * Create XYZ axes helper
     * @param {number} size - Length of axes
     * @param {boolean} visible - Initial visibility
     */
    createAxesHelper(size, visible = false) {
        this.axesHelper = new THREE.AxesHelper(size);
        this.axesHelper.visible = visible;
        this.parentContainer.add(this.axesHelper);
    }

    /**
     * Create ecliptic plane visualization (grid + plane helper)
     * @param {number} gridRadius - Radius of the polar grid
     * @param {number} planeSize - Size of the plane helper
     * @param {boolean} visible - Initial visibility
     */
    createEclipticPlane(gridRadius, planeSize, visible = false) {
        const sectors = 18;   // 20° increments
        const rings = 6;
        const divisions = 64;

        // Polar grid on ecliptic
        this.eclipticPolarGridHelper = new THREE.PolarGridHelper(
            gridRadius, sectors, rings, divisions,
            COL.ECLIPTIC_PLANE, COL.ECLIPTIC_PLANE
        );
        this.eclipticPolarGridHelper.rotation.x = Math.PI / 2;
        this.eclipticPolarGridHelper.visible = visible;
        this.parentContainer.add(this.eclipticPolarGridHelper);

        // Plane helper for ecliptic
        const eclipticPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        this.eclipticPlaneHelper = new THREE.PlaneHelper(eclipticPlane, planeSize, COL.ECLIPTIC_PLANE);
        this.eclipticPlaneHelper.visible = visible;
        this.parentContainer.add(this.eclipticPlaneHelper);
    }

    /**
     * Create equatorial plane visualization (tilted by Earth's axial inclination)
     * @param {number} gridRadius - Radius of the polar grid
     * @param {number} planeSize - Size of the plane helper
     * @param {boolean} visible - Initial visibility
     */
    createEquatorialPlane(gridRadius, planeSize, visible = false) {
        const sectors = 18;
        const rings = 6;
        const divisions = 64;

        // Container tilted to equatorial plane
        this.equatorialPlaneContainer = new THREE.Group();
        this.equatorialPlaneContainer.lookAt(
            0,
            Math.sin(PC.EARTH_AXIS_INCLINATION_RADS),
            Math.cos(PC.EARTH_AXIS_INCLINATION_RADS)
        );

        // Polar grid on equatorial plane
        this.equatorialPolarGridHelper = new THREE.PolarGridHelper(
            gridRadius, sectors, rings, divisions,
            COL.EQUATORIAL_PLANE, COL.EQUATORIAL_PLANE
        );
        this.equatorialPolarGridHelper.rotation.x = Math.PI / 2;
        this.equatorialPolarGridHelper.visible = visible;
        this.equatorialPlaneContainer.add(this.equatorialPolarGridHelper);

        // Plane helper for equatorial plane
        const direction = new THREE.Vector3();
        this.equatorialPlaneContainer.getWorldDirection(direction);
        const equatorialPlane = new THREE.Plane(direction, 0);
        this.equatorialPlaneHelper = new THREE.PlaneHelper(equatorialPlane, planeSize, COL.EQUATORIAL_PLANE);
        this.equatorialPlaneHelper.visible = visible;
        this.equatorialPlaneContainer.add(this.equatorialPlaneHelper);

        this.parentContainer.add(this.equatorialPlaneContainer);
    }

    /**
     * Create Moon's Sphere of Influence wireframe
     * @param {THREE.Object3D} moonContainer - Moon container to attach SOI to
     * @param {number} moonRadius - Visual radius of the moon
     * @param {boolean} visible - Initial visibility
     */
    createMoonSOI(moonContainer, moonRadius, visible = false) {
        this.moonContainer = moonContainer;

        const soiRadius = moonRadius * (PC.MOON_SOI_RADIUS_KM / PC.MOON_RADIUS_KM);
        const latSegments = 18;   // 10° increments
        const longSegments = 36;  // 10° increments

        const geometry = new THREE.SphereGeometry(soiRadius, longSegments, latSegments);
        const material = new THREE.MeshBasicMaterial({
            color: COL.MOON_SOI,
            wireframe: true
        });

        this.moonSOISphere = new THREE.Mesh(geometry, material);
        this.moonSOISphere.visible = visible;
        this.moonContainer.add(this.moonSOISphere);
    }

    createMoonHighlight(moonContainer, moonRadius, visible = false) {
        this.moonContainer = moonContainer;
        this.moonHighlightMoonRadius = moonRadius;
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) {
            return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.beginPath();
        context.arc(128, 128, 98, 0, 2 * Math.PI);
        context.strokeStyle = "rgba(228, 238, 255, 0.96)";
        context.lineWidth = 10;
        context.stroke();

        context.beginPath();
        context.arc(128, 128, 108, 0, 2 * Math.PI);
        context.strokeStyle = "rgba(228, 238, 255, 0.36)";
        context.lineWidth = 4;
        context.stroke();

        this.moonHighlightTexture = new THREE.CanvasTexture(canvas);
        this.moonHighlightTexture.needsUpdate = true;
        this.moonHighlightMaterial = new THREE.SpriteMaterial({
            map: this.moonHighlightTexture,
            color: COL.MOON_FOCUS_RING,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
        this.moonHighlightSprite = new THREE.Sprite(this.moonHighlightMaterial);
        const spriteDiameter = moonRadius * MOON_HIGHLIGHT_MIN_WORLD_SCALE;
        this.moonHighlightSprite.scale.set(spriteDiameter, spriteDiameter, 1);
        this.moonHighlightSprite.visible = false;
        this.moonHighlightSprite.frustumCulled = false;
        this.moonHighlightSprite.renderOrder = 18;
        this.moonContainer.add(this.moonHighlightSprite);

        if (!this.moonHighlightOverlay && typeof document !== "undefined") {
            const overlayHost = document.getElementById("canvas-wrapper");
            if (overlayHost) {
                const overlay = document.createElement("div");
                overlay.setAttribute("aria-hidden", "true");
                overlay.style.position = "fixed";
                overlay.style.left = "0";
                overlay.style.top = "0";
                overlay.style.width = "0";
                overlay.style.height = "0";
                overlay.style.borderRadius = "999px";
                overlay.style.pointerEvents = "none";
                overlay.style.transform = "translate(-50%, -50%)";
                overlay.style.border = "2px solid rgba(228, 238, 255, 0.94)";
                overlay.style.boxShadow = "0 0 0 3px rgba(228, 238, 255, 0.14)";
                overlay.style.display = visible ? "block" : "none";
                overlay.style.zIndex = "4";
                overlayHost.appendChild(overlay);
                this.moonHighlightOverlay = overlay;
            }
        }
    }

    updateMoonHighlight({
        camera,
        renderer,
        rendererDomElement,
        visible = true,
    }) {
        if (!this.moonHighlightSprite || !this.moonContainer) {
            return;
        }

        const viewportSource = rendererDomElement || renderer?.domElement || null;
        if (!visible || !camera || !viewportSource) {
            this.moonHighlightSprite.visible = false;
            if (this.moonHighlightOverlay) {
                this.moonHighlightOverlay.style.display = "none";
            }
            return;
        }

        const viewportWidth = viewportSource.clientWidth || window.innerWidth || 0;
        const viewportHeight = viewportSource.clientHeight || window.innerHeight || 0;
        if (!viewportWidth || !viewportHeight || !camera.isPerspectiveCamera) {
            this.moonHighlightSprite.visible = false;
            if (this.moonHighlightOverlay) {
                this.moonHighlightOverlay.style.display = "none";
            }
            return;
        }

        this.moonContainer.getWorldPosition(this._moonWorldPosition);
        camera.getWorldPosition(this._cameraWorldPosition);
        const moonDistance = this._moonWorldPosition.distanceTo(this._cameraWorldPosition);
        if (!Number.isFinite(moonDistance) || moonDistance <= 0) {
            this.moonHighlightSprite.visible = false;
            return;
        }

        const moonDiameterWorld = Math.max(this.moonHighlightMoonRadius * 2, 0);
        const pixelsPerWorldUnit =
            viewportHeight / (2 * moonDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
        const apparentMoonDiameterPx = moonDiameterWorld * pixelsPerWorldUnit;
        if (
            !Number.isFinite(apparentMoonDiameterPx) ||
            apparentMoonDiameterPx <= 0 ||
            apparentMoonDiameterPx > MOON_HIGHLIGHT_SHOW_THRESHOLD_PX
        ) {
            this.moonHighlightSprite.visible = false;
            if (this.moonHighlightOverlay) {
                this.moonHighlightOverlay.style.display = "none";
            }
            return;
        }

        this._projectedMoonPosition.copy(this._moonWorldPosition).project(camera);
        if (this._projectedMoonPosition.z < -1 || this._projectedMoonPosition.z > 1) {
            this.moonHighlightSprite.visible = false;
            if (this.moonHighlightOverlay) {
                this.moonHighlightOverlay.style.display = "none";
            }
            return;
        }

        const targetHighlightDiameterPx = THREE.MathUtils.clamp(
            Math.max(apparentMoonDiameterPx * 1.75, MOON_HIGHLIGHT_MIN_DIAMETER_PX),
            MOON_HIGHLIGHT_MIN_DIAMETER_PX,
            MOON_HIGHLIGHT_MAX_DIAMETER_PX,
        );
        const targetHighlightDiameterWorld = targetHighlightDiameterPx / pixelsPerWorldUnit;
        const minimumWorldDiameter = this.moonHighlightMoonRadius * MOON_HIGHLIGHT_MIN_WORLD_SCALE;
        const spriteDiameter = Math.max(targetHighlightDiameterWorld, minimumWorldDiameter);
        this.moonHighlightSprite.scale.set(spriteDiameter, spriteDiameter, 1);
        this.moonHighlightSprite.visible = false;

        if (this.moonHighlightOverlay) {
            const screenX = (this._projectedMoonPosition.x * 0.5 + 0.5) * viewportWidth;
            const screenY = (-this._projectedMoonPosition.y * 0.5 + 0.5) * viewportHeight;
            const borderWidthPx = targetHighlightDiameterPx >= 100 ? 3 : 2;
            this.moonHighlightOverlay.style.display = "block";
            this.moonHighlightOverlay.style.left = `${screenX}px`;
            this.moonHighlightOverlay.style.top = `${screenY}px`;
            this.moonHighlightOverlay.style.width = `${targetHighlightDiameterPx}px`;
            this.moonHighlightOverlay.style.height = `${targetHighlightDiameterPx}px`;
            this.moonHighlightOverlay.style.borderWidth = `${borderWidthPx}px`;
        }
    }

    createMoonOsculatingOrbit(visible = false) {
        const geometry = new THREE.BufferGeometry();
        const attribute = new THREE.Float32BufferAttribute(
            new Float32Array(MOON_ORBIT_SAMPLE_COUNT * 3),
            3,
        );
        geometry.setAttribute("position", attribute);
        geometry.setDrawRange(0, MOON_ORBIT_SAMPLE_COUNT);

        const material = new THREE.LineBasicMaterial({
            color: COL.MOON_OSCULATING_ORBIT,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
        });
        this.moonOsculatingOrbitLine = new THREE.LineLoop(geometry, material);
        this.moonOsculatingOrbitLine.visible = visible;
        this.parentContainer.add(this.moonOsculatingOrbitLine);
    }

    updateMoonOsculatingOrbit({
        position,
        velocity,
        pixelsPerAU,
        timeMs,
        visible = true,
    }) {
        if (!this.moonOsculatingOrbitLine) {
            return;
        }

        const shouldRefreshOrbit =
            !Number.isFinite(this.moonOsculatingOrbitLastUpdateTimeMs) ||
            !Number.isFinite(timeMs) ||
            Math.abs(timeMs - this.moonOsculatingOrbitLastUpdateTimeMs) >= MOON_ORBIT_REFRESH_MS;

        if (!shouldRefreshOrbit) {
            this.moonOsculatingOrbitLine.visible = visible;
            return;
        }

        const sampledOrbit = sampleOsculatingOrbitPoints({
            position,
            velocity: {
                x: velocity.vx,
                y: velocity.vy,
                z: velocity.vz,
            },
            gravitationalParameter: PC.EARTH_GM_KM3_S2,
            sampleCount: MOON_ORBIT_SAMPLE_COUNT,
        });
        if (!sampledOrbit?.points?.length) {
            this.moonOsculatingOrbitLine.visible = false;
            return;
        }

        const scale = pixelsPerAU / PC.KM_PER_AU;
        const positions = this.moonOsculatingOrbitLine.geometry.getAttribute("position");
        let offset = 0;
        for (const point of sampledOrbit.points) {
            positions.array[offset++] = point.x * scale;
            positions.array[offset++] = point.y * scale;
            positions.array[offset++] = point.z * scale;
        }
        positions.needsUpdate = true;
        this.moonOsculatingOrbitLine.geometry.computeBoundingSphere?.();
        this.moonOsculatingOrbitLine.visible = visible;
        this.moonOsculatingOrbitLastUpdateTimeMs = Number.isFinite(timeMs)
            ? timeMs
            : this.moonOsculatingOrbitLastUpdateTimeMs;
    }

    // ===== Visibility Controls =====

    setAxesVisible(visible) {
        if (this.axesHelper) this.axesHelper.visible = visible;
    }

    setEclipticPlaneVisible(visible) {
        if (this.eclipticPolarGridHelper) this.eclipticPolarGridHelper.visible = visible;
        if (this.eclipticPlaneHelper) this.eclipticPlaneHelper.visible = visible;
    }

    setEquatorialPlaneVisible(visible) {
        if (this.equatorialPolarGridHelper) this.equatorialPolarGridHelper.visible = visible;
        if (this.equatorialPlaneHelper) this.equatorialPlaneHelper.visible = visible;
    }

    setMoonSOIVisible(visible) {
        if (this.moonSOISphere) this.moonSOISphere.visible = visible;
    }

    setMoonHighlightVisible(visible) {
        if (this.moonHighlightSprite) this.moonHighlightSprite.visible = false;
        if (this.moonHighlightOverlay) {
            this.moonHighlightOverlay.style.display = visible ? "block" : "none";
        }
    }

    setMoonOsculatingOrbitVisible(visible) {
        if (this.moonOsculatingOrbitLine) this.moonOsculatingOrbitLine.visible = visible;
    }

    // ===== Disposal =====

    disposeAxesHelper() {
        if (this.axesHelper) {
            this.parentContainer.remove(this.axesHelper);
            this.axesHelper.dispose();
            this.axesHelper = null;
        }
    }

    disposeEclipticPlane() {
        if (this.eclipticPolarGridHelper) {
            this.parentContainer.remove(this.eclipticPolarGridHelper);
            this.eclipticPolarGridHelper.dispose();
            this.eclipticPolarGridHelper = null;
        }
        if (this.eclipticPlaneHelper) {
            this.parentContainer.remove(this.eclipticPlaneHelper);
            this.eclipticPlaneHelper.dispose();
            this.eclipticPlaneHelper = null;
        }
    }

    disposeEquatorialPlane() {
        if (this.equatorialPolarGridHelper) {
            this.equatorialPolarGridHelper.dispose();
            this.equatorialPolarGridHelper = null;
        }
        if (this.equatorialPlaneHelper) {
            this.equatorialPlaneHelper.dispose();
            this.equatorialPlaneHelper = null;
        }
        if (this.equatorialPlaneContainer) {
            this.parentContainer.remove(this.equatorialPlaneContainer);
            this.equatorialPlaneContainer.clear();
            this.equatorialPlaneContainer = null;
        }
    }

    disposeMoonSOI() {
        if (this.moonSOISphere && this.moonContainer) {
            this.moonContainer.remove(this.moonSOISphere);
            this.moonSOISphere.geometry.dispose();
            this.moonSOISphere.material.dispose();
            this.moonSOISphere = null;
        }
    }

    disposeMoonHighlight() {
        if (this.moonHighlightOverlay?.parentNode) {
            this.moonHighlightOverlay.parentNode.removeChild(this.moonHighlightOverlay);
            this.moonHighlightOverlay = null;
        }
        if (this.moonHighlightSprite && this.moonContainer) {
            this.moonContainer.remove(this.moonHighlightSprite);
            this.moonHighlightMaterial?.dispose?.();
            this.moonHighlightTexture?.dispose?.();
            this.moonHighlightSprite = null;
            this.moonHighlightMaterial = null;
            this.moonHighlightTexture = null;
        }
    }

    disposeMoonOsculatingOrbit() {
        if (this.moonOsculatingOrbitLine) {
            this.parentContainer.remove(this.moonOsculatingOrbitLine);
            this.moonOsculatingOrbitLine.geometry?.dispose?.();
            this.moonOsculatingOrbitLine.material?.dispose?.();
            this.moonOsculatingOrbitLine = null;
            this.moonOsculatingOrbitLastUpdateTimeMs = null;
        }
    }

    /**
     * Dispose all helpers
     */
    dispose() {
        this.disposeAxesHelper();
        this.disposeEclipticPlane();
        this.disposeEquatorialPlane();
        this.disposeMoonSOI();
        this.disposeMoonHighlight();
        this.disposeMoonOsculatingOrbit();
    }
}
