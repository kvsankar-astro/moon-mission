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
        this.bodyHighlightTarget = null;
        this.bodyHighlightSprite = null;
        this.bodyHighlightTexture = null;
        this.bodyHighlightMaterial = null;
        this.bodyHighlightOverlay = null;
        this.bodyHighlightBodyRadius = 0;
        this.bodyHighlightEnabled = false;
        this._bodyHighlightWorldPosition = new THREE.Vector3();
        this._cameraWorldPosition = new THREE.Vector3();
        this._projectedBodyHighlightPosition = new THREE.Vector3();
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

    createBodyHighlight(bodyContainer, bodyRadius, visible = false) {
        this.bodyHighlightTarget = bodyContainer;
        this.bodyHighlightBodyRadius = bodyRadius;
        this.bodyHighlightEnabled = Boolean(visible);

        if (typeof document === "undefined") {
            return;
        }

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

        this.bodyHighlightTexture = new THREE.CanvasTexture(canvas);
        this.bodyHighlightTexture.needsUpdate = true;
        this.bodyHighlightMaterial = new THREE.SpriteMaterial({
            map: this.bodyHighlightTexture,
            color: COL.MOON_FOCUS_RING,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
        this.bodyHighlightSprite = new THREE.Sprite(this.bodyHighlightMaterial);
        const spriteDiameter = bodyRadius * MOON_HIGHLIGHT_MIN_WORLD_SCALE;
        this.bodyHighlightSprite.scale.set(spriteDiameter, spriteDiameter, 1);
        this.bodyHighlightSprite.visible = false;
        this.bodyHighlightSprite.frustumCulled = false;
        this.bodyHighlightSprite.renderOrder = 18;
        this.bodyHighlightTarget.add(this.bodyHighlightSprite);

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
            overlay.style.border = "1.5px solid rgba(214, 224, 244, 0.78)";
            overlay.style.boxShadow = "0 0 0 2px rgba(214, 224, 244, 0.08)";
            overlay.style.display = "none";
            overlay.style.zIndex = "4";
            overlayHost.appendChild(overlay);
            this.bodyHighlightOverlay = overlay;
        }
    }

    updateBodyHighlight({
        camera,
        renderer,
        rendererDomElement,
        visible = true,
    }) {
        if (!this.bodyHighlightSprite || !this.bodyHighlightTarget) {
            return;
        }

        const viewportSource = rendererDomElement || renderer?.domElement || null;
        if (!visible || !this.bodyHighlightEnabled || !camera || !viewportSource) {
            this.bodyHighlightSprite.visible = false;
            if (this.bodyHighlightOverlay) {
                this.bodyHighlightOverlay.style.display = "none";
            }
            return;
        }

        const viewportWidth = viewportSource.clientWidth || window.innerWidth || 0;
        const viewportHeight = viewportSource.clientHeight || window.innerHeight || 0;
        if (!viewportWidth || !viewportHeight || !camera.isPerspectiveCamera) {
            this.bodyHighlightSprite.visible = false;
            if (this.bodyHighlightOverlay) {
                this.bodyHighlightOverlay.style.display = "none";
            }
            return;
        }

        this.bodyHighlightTarget.updateWorldMatrix(true, false);
        camera.updateMatrixWorld();

        this.bodyHighlightTarget.getWorldPosition(this._bodyHighlightWorldPosition);
        camera.getWorldPosition(this._cameraWorldPosition);
        const bodyDistance = this._bodyHighlightWorldPosition.distanceTo(this._cameraWorldPosition);
        if (!Number.isFinite(bodyDistance) || bodyDistance <= 0) {
            this.bodyHighlightSprite.visible = false;
            if (this.bodyHighlightOverlay) {
                this.bodyHighlightOverlay.style.display = "none";
            }
            return;
        }

        const bodyDiameterWorld = Math.max(this.bodyHighlightBodyRadius * 2, 0);
        const pixelsPerWorldUnit =
            viewportHeight / (2 * bodyDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
        const apparentBodyDiameterPx = bodyDiameterWorld * pixelsPerWorldUnit;
        if (
            !Number.isFinite(apparentBodyDiameterPx) ||
            apparentBodyDiameterPx <= 0 ||
            apparentBodyDiameterPx > MOON_HIGHLIGHT_SHOW_THRESHOLD_PX
        ) {
            this.bodyHighlightSprite.visible = false;
            if (this.bodyHighlightOverlay) {
                this.bodyHighlightOverlay.style.display = "none";
            }
            return;
        }

        this._projectedBodyHighlightPosition.copy(this._bodyHighlightWorldPosition).project(camera);
        if (this._projectedBodyHighlightPosition.z < -1 || this._projectedBodyHighlightPosition.z > 1) {
            this.bodyHighlightSprite.visible = false;
            if (this.bodyHighlightOverlay) {
                this.bodyHighlightOverlay.style.display = "none";
            }
            return;
        }

        const targetHighlightDiameterPx = THREE.MathUtils.clamp(
            Math.max(apparentBodyDiameterPx * 1.75, MOON_HIGHLIGHT_MIN_DIAMETER_PX),
            MOON_HIGHLIGHT_MIN_DIAMETER_PX,
            MOON_HIGHLIGHT_MAX_DIAMETER_PX,
        );
        const targetHighlightDiameterWorld = targetHighlightDiameterPx / pixelsPerWorldUnit;
        const minimumWorldDiameter = this.bodyHighlightBodyRadius * MOON_HIGHLIGHT_MIN_WORLD_SCALE;
        const spriteDiameter = Math.max(targetHighlightDiameterWorld, minimumWorldDiameter);
        this.bodyHighlightSprite.scale.set(spriteDiameter, spriteDiameter, 1);
        this.bodyHighlightSprite.visible = false;

        if (this.bodyHighlightOverlay) {
            const screenX = (this._projectedBodyHighlightPosition.x * 0.5 + 0.5) * viewportWidth;
            const screenY = (-this._projectedBodyHighlightPosition.y * 0.5 + 0.5) * viewportHeight;
            const borderWidthPx = targetHighlightDiameterPx >= 100 ? 2 : 1.5;
            this.bodyHighlightOverlay.style.display = "block";
            this.bodyHighlightOverlay.style.left = `${screenX}px`;
            this.bodyHighlightOverlay.style.top = `${screenY}px`;
            this.bodyHighlightOverlay.style.width = `${targetHighlightDiameterPx}px`;
            this.bodyHighlightOverlay.style.height = `${targetHighlightDiameterPx}px`;
            this.bodyHighlightOverlay.style.borderWidth = `${borderWidthPx}px`;
        }
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

    setBodyHighlightVisible(visible) {
        this.bodyHighlightEnabled = Boolean(visible);
        if (this.bodyHighlightSprite) this.bodyHighlightSprite.visible = false;
        if (!visible && this.bodyHighlightOverlay) {
            this.bodyHighlightOverlay.style.display = "none";
        }
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

    disposeBodyHighlight() {
        if (this.bodyHighlightOverlay?.parentNode) {
            this.bodyHighlightOverlay.parentNode.removeChild(this.bodyHighlightOverlay);
        }
        this.bodyHighlightOverlay = null;
        if (this.bodyHighlightSprite && this.bodyHighlightTarget) {
            this.bodyHighlightTarget.remove(this.bodyHighlightSprite);
        }
        this.bodyHighlightMaterial?.dispose?.();
        this.bodyHighlightTexture?.dispose?.();
        this.bodyHighlightSprite = null;
        this.bodyHighlightMaterial = null;
        this.bodyHighlightTexture = null;
        this.bodyHighlightTarget = null;
        this.bodyHighlightBodyRadius = 0;
        this.bodyHighlightEnabled = false;
    }

    /**
     * Dispose all helpers
     */
    dispose() {
        this.disposeAxesHelper();
        this.disposeEclipticPlane();
        this.disposeEquatorialPlane();
        this.disposeMoonSOI();
        this.disposeBodyHighlight();
    }
}
