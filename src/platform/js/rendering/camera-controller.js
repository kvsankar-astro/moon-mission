/**
 * Camera Controller - Camera and controls management
 *
 * Manages all camera-related functionality:
 * - Main perspective camera
 * - Spacecraft-attached camera (craftCamera)
 * - Drone camera
 * - TrackballControls for user interaction
 */

import * as THREE from 'three';
import { TrackballControls } from "./trackball-controls-adapter.js";
import { MountedFreeFlyControls } from "./mounted-freefly-controls.js";

export const CAMERA_POSITION_MODE = Object.freeze({
    MANUAL: 'manual',
    EARTH: 'earth',
    MOON: 'moon',
    SPACECRAFT: 'spacecraft',
});

export const CAMERA_LOOK_MODE = Object.freeze({
    MANUAL: 'manual',
    EARTH: 'earth',
    MOON: 'moon',
    SPACECRAFT: 'spacecraft',
});

export class CameraController {
    /**
     * @param {number} width - Viewport width
     * @param {number} height - Viewport height
     * @param {number} defaultDistance - Default camera distance
     */
    constructor(width, height, defaultDistance) {
        this.width = width;
        this.height = height;
        this.defaultDistance = defaultDistance;
        this.defaultNear = 0.0001;
        this.defaultFar = 100000;

        // Cameras
        this.camera = null;
        this.craftCamera = null;
        this.droneCamera = null;

        // Controls
        this.controls = null;
        this.controlsEnabled = true;

        // From-to camera system (Iteration 17)
        this.positionMode = CAMERA_POSITION_MODE.MANUAL;
        this.lookMode = CAMERA_LOOK_MODE.MANUAL;
        this.mountOffset = new THREE.Vector3();
        this.mountTargetOffset = new THREE.Vector3();
        this._mountWorld = new THREE.Vector3();
        this._lookWorld = new THREE.Vector3();
        this._targets = { earth: null, moon: null, spacecraft: null };
        this._pendingMountOffsetInit = false;
        this._fromToChangeHandler = null;

        this._tmpQuat = new THREE.Quaternion();
        this._tmpUp = new THREE.Vector3();
        this._tmpViewDir = new THREE.Vector3();
        this._tmpTargetWorld = new THREE.Vector3();

        this._rendererDomElement = null;
        this.freeFlyControls = null;
        this._freeFlyActive = false;
        this._mountedWheelFovEnabled = true;
        this._mountedWheelHandler = null;
    }

    /**
     * Create the main camera
     * @param {number} fov - Field of view (default 50)
     */
    createMainCamera(fov = 50) {
        this.camera = new THREE.PerspectiveCamera(
            fov,
            this.width / this.height,
            this.defaultNear,
            this.defaultFar,
        );
        this.camera.up.set(0, 0, 1);
        return this.camera;
    }

    /**
     * Create camera attached to spacecraft
     * @param {THREE.Object3D} craft - Spacecraft object to attach camera to
     * @param {number} fov - Field of view (default 50)
     */
    createCraftCamera(craft, fov = 50) {
        this.craftCamera = new THREE.PerspectiveCamera(
            fov,
            this.width / this.height,
            this.defaultNear,
            this.defaultFar,
        );
        this.craftCamera.up.set(0, 0, 1);
        craft.add(this.craftCamera);
        return this.craftCamera;
    }

    /**
     * Create camera attached to drone
     * @param {THREE.Object3D} drone - Drone object to attach camera to
     * @param {number} fov - Field of view (default 100)
     */
    createDroneCamera(drone, fov = 100) {
        this.droneCamera = new THREE.PerspectiveCamera(
            fov,
            this.width / this.height,
            this.defaultNear,
            this.defaultFar,
        );
        drone.add(this.droneCamera);
        return this.droneCamera;
    }

    /**
     * Create TrackballControls for camera interaction
     * @param {HTMLElement} domElement - DOM element for controls
     * @param {Function} callback - Callback on control changes
     * @param {Function} renderCallback - Callback for render updates
     */
    createControls(domElement, callback, renderCallback) {
        if (!this.controlsEnabled || !this.camera) {
            return null;
        }

        this._rendererDomElement = domElement;
        this.controls = new TrackballControls(this.camera, domElement);

        // TrackballControls settings
        this.controls.rotateSpeed = 1.0;
        this.controls.zoomSpeed = 1.0;
        this.controls.panSpeed = 1.0;
        this.controls.noZoom = false;
        this.controls.noPan = false;
        this.controls.staticMoving = true;
        this.controls.dynamicDampingFactor = 0.3;
        this.controls.keys = ["KeyA", "KeyS", "KeyD"];

        // Proposal 2: "from-to" camera system support. We capture mountOffset from user interactions
        // before triggering any render so mounted modes retain user-rotated/zoomed offsets.
        this._fromToChangeHandler = () => {
            if (!this.camera || !this.controls) return;
            if (this._freeFlyActive) return;
            if (this.positionMode === CAMERA_POSITION_MODE.MANUAL) return;
            const mountPos = this._resolveTargetWorld(this.positionMode, this._mountWorld);
            if (!mountPos) return;
            this.mountOffset.copy(this.camera.position).sub(mountPos);

            // When aim is manual, allow panning by persisting the target offset relative to the mount.
            // (TrackballControls pan moves both camera and target; we keep that delta stable.)
            if (this.lookMode === CAMERA_LOOK_MODE.MANUAL) {
                this.mountTargetOffset.copy(this.controls.target).sub(mountPos);
            }
        };
        this.controls.addEventListener('change', this._fromToChangeHandler, { passive: true });

        if (renderCallback) {
            this.controls.addEventListener('change', renderCallback, { passive: true });
        }

        if (!this.freeFlyControls) {
            this.freeFlyControls = new MountedFreeFlyControls({
                domElement,
                controller: this,
                onChange: () => {
                    callback?.();
                    renderCallback?.();
                },
            });
        }

        if (!this._mountedWheelHandler) {
            this._mountedWheelHandler = (event) => {
                this._handleMountedWheelAsFov(event);
            };
            domElement.addEventListener("wheel", this._mountedWheelHandler, { passive: false });
        }

        return this.controls;
    }

    setMountedWheelFovEnabled(enabled) {
        this._mountedWheelFovEnabled = !!enabled;
    }

    _isMountedModeActive() {
        return this.positionMode !== CAMERA_POSITION_MODE.MANUAL;
    }

    _handleMountedWheelAsFov(event) {
        if (!this._mountedWheelFovEnabled) return;
        if (!this._isMountedModeActive()) return;
        if (!this.camera || !this.controls) return;
        if (this._freeFlyActive) return;

        // In mounted-origin mode, wheel should act as lens zoom (FoV change), not dolly.
        event.preventDefault();

        const direction = Math.sign(event.deltaY);
        if (direction === 0) return;

        const normalizedStep = Math.max(0.25, Math.min(Math.abs(event.deltaY) / 120, 3));
        const currentFov = this.camera.fov;
        const nextFov = THREE.MathUtils.clamp(currentFov + direction * normalizedStep, 1, 179);
        if (!Number.isFinite(nextFov) || Math.abs(nextFov - currentFov) < 1e-6) return;

        this.camera.fov = nextFov;
        this.camera.updateProjectionMatrix();
        this.controls.dispatchEvent?.({ type: "change" });
    }

    _setMainCameraClippingForMountedView(focusDistance) {
        if (!this.camera) return;

        const candidateDistances = [];
        if (Number.isFinite(focusDistance) && focusDistance > 0) {
            candidateDistances.push(focusDistance);
        }

        for (const mode of [
            CAMERA_POSITION_MODE.EARTH,
            CAMERA_POSITION_MODE.MOON,
            CAMERA_POSITION_MODE.SPACECRAFT,
        ]) {
            const targetPos = this._resolveTargetWorld(mode, this._tmpTargetWorld);
            if (!targetPos) continue;
            const distance = this.camera.position.distanceTo(targetPos);
            if (Number.isFinite(distance) && distance > 0) {
                candidateDistances.push(distance);
            }
        }

        if (candidateDistances.length === 0) {
            if (this.camera.near !== this.defaultNear || this.camera.far !== this.defaultFar) {
                this.camera.near = this.defaultNear;
                this.camera.far = this.defaultFar;
                this.camera.updateProjectionMatrix();
            }
            return;
        }

        const maxDistance = Math.max(...candidateDistances);

        // Keep near clipping fixed at the global default. In mounted/body-origin
        // views, increasing near dynamically can clip the sky sphere and produce
        // a large black polygon while zooming/FoV-changing.
        const near = this.defaultNear;
        const far = THREE.MathUtils.clamp(
            Math.max(maxDistance * 3.5, near + 128),
            128,
            this.defaultFar,
        );
        if (Math.abs(this.camera.near - near) > 1e-6 || Math.abs(this.camera.far - far) > 1e-6) {
            this.camera.near = near;
            this.camera.far = far;
            this.camera.updateProjectionMatrix();
        }
    }

    /**
     * Set the from-to modes without changing camera unless updateFromTo() is called.
     * @param {string} positionMode
     * @param {string} lookMode
     */
    setFromToModes(positionMode, lookMode) {
        const previousPositionMode = this.positionMode;
        if (Object.values(CAMERA_POSITION_MODE).includes(positionMode)) {
            this.positionMode = positionMode;
        }
        if (Object.values(CAMERA_LOOK_MODE).includes(lookMode)) {
            this.lookMode = lookMode;
        }

        if (previousPositionMode !== this.positionMode && this.positionMode !== CAMERA_POSITION_MODE.MANUAL) {
            // Initialize mountOffset lazily on the next updateFromTo() once targets are available,
            // keeping the camera in its current world position when switching mounts.
            this._pendingMountOffsetInit = true;
        }
    }

    /**
     * Explicitly set mount offset (clears pending initialization).
     * @param {THREE.Vector3|{x:number,y:number,z:number}} offset
     */
    setMountOffset(offset) {
        if (!offset) return;
        if (offset instanceof THREE.Vector3) {
            this.mountOffset.copy(offset);
        } else {
            this.mountOffset.set(offset.x ?? 0, offset.y ?? 0, offset.z ?? 0);
        }
        this._pendingMountOffsetInit = false;
    }

    /**
     * Explicitly set mount target offset (relative to the mount). Used to persist pan.
     * @param {THREE.Vector3|{x:number,y:number,z:number}} offset
     */
    setMountTargetOffset(offset) {
        if (!offset) return;
        if (offset instanceof THREE.Vector3) {
            this.mountTargetOffset.copy(offset);
        } else {
            this.mountTargetOffset.set(offset.x ?? 0, offset.y ?? 0, offset.z ?? 0);
        }
    }

    /**
     * Apply the from-to camera system for the current frame.
     * This is opt-in and has no effect while both modes are MANUAL.
     *
     * @param {Object} targets
     * @param {THREE.Object3D} [targets.earth]
     * @param {THREE.Object3D} [targets.moon]
     * @param {THREE.Object3D} [targets.spacecraft]
     */
    updateFromTo({ earth, moon, spacecraft } = {}) {
        if (!this.camera) return;

        const hasPositionMount = this.positionMode !== CAMERA_POSITION_MODE.MANUAL;
        const hasForcedLook = this.lookMode !== CAMERA_LOOK_MODE.MANUAL;
        // Use TrackballControls even in mounted+manual-aim modes to retain intuitive zoom/pan.
        const wantsFreeFly = false;
        this._targets = { earth: earth ?? null, moon: moon ?? null, spacecraft: spacecraft ?? null };

        if (!hasPositionMount && !hasForcedLook) {
            this._setMainCameraClippingForMountedView(null);
            this._setFreeFlyEnabled(false);
            if (this.controls) {
                this.controls.enabled = true;
                this.controls.noRotate = false;
                this.controls.noPan = false;
                this.controls.noZoom = false;
            }
            return;
        }

        // If mounted, keep camera translated with the mount while preserving user-controlled rotation/zoom.
        if (hasPositionMount) {
            const mountPos = this._resolveTargetWorld(this.positionMode, this._mountWorld);
            if (mountPos) {
                if (this._pendingMountOffsetInit) {
                    this.mountOffset.copy(this.camera.position).sub(mountPos);
                    this._pendingMountOffsetInit = false;
                }

                if (this.controls) {
                    // Mounted camera is lens-zoom-only: wheel maps to FoV, not dolly.
                    this.controls.enabled = !wantsFreeFly;
                    this.controls.noPan = true;
                    this.controls.noRotate = true;
                    this.controls.noZoom = true;
                }

                // Follow the mount.
                this.camera.position.copy(mountPos).add(this.mountOffset);

                if (wantsFreeFly) {
                    this._setFreeFlyEnabled(true);
                    // Manual aim in free-fly: keep global up and preserve camera orientation.
                    this.camera.up.set(0, 0, 1);
                } else {
                    this._setFreeFlyEnabled(false);
                }
            }
        } else if (this.controls) {
            // When not mounted, allow normal controls (we may still disable rotation if forcing look).
            this.controls.enabled = true;
            this.controls.noPan = false;
            this.controls.noZoom = false;
            this._setFreeFlyEnabled(false);
        }

        // If forced lookAt is enabled, keep TrackballControls target in sync.
        // For manual-position cameras we still allow orbiting around the fixed target so users can inspect it.
        if (hasForcedLook) {
            const lookPos = this._resolveTargetWorld(this.lookMode, this._lookWorld);
            if (lookPos) {
                const allowOrbitAroundTarget =
                    (this.positionMode === CAMERA_POSITION_MODE.MANUAL);
                const isMountedCrossBodyView =
                    hasPositionMount &&
                    this.lookMode !== CAMERA_LOOK_MODE.MANUAL &&
                    this.positionMode !== this.lookMode;
                const shouldUseGlobalUp = allowOrbitAroundTarget || isMountedCrossBodyView;

                // Keep a stable horizon for manual orbiting and mounted cross-body views.
                // For mounted same-body views, align with target up to avoid ambiguous roll.
                if (shouldUseGlobalUp) {
                    this.camera.up.set(0, 0, 1);
                } else {
                    this._updateCameraUpForLookTarget(this.lookMode, lookPos);
                }
                if (this.controls) {
                    this.controls.target.copy(lookPos);
                    if (hasPositionMount) {
                        this.controls.noRotate = true;
                        this.controls.noPan = true;
                    } else {
                        this.controls.noRotate = !allowOrbitAroundTarget;
                        this.controls.noPan = !allowOrbitAroundTarget;
                    }
                    // Force immediate alignment without relying on TrackballControls.update().
                    this.camera.lookAt(lookPos);
                } else {
                    this.camera.lookAt(lookPos);
                }
                this._setMainCameraClippingForMountedView(
                    hasPositionMount
                        ? this.camera.position.distanceTo(lookPos)
                        : null,
                );
            }
        } else if (this.controls) {
            if (hasPositionMount) {
                // Mounted + manual aim remains zoom-only.
                this.controls.noRotate = true;
                this.controls.noPan = true;
                this._setMainCameraClippingForMountedView(
                    this.camera.position.distanceTo(this.controls.target),
                );
            } else {
                this.controls.noRotate = wantsFreeFly ? true : false;
                this.controls.noPan = false;
                // Returning to manual aim: reset up to global to avoid unexpected roll.
                this.camera.up.set(0, 0, 1);
                this._setMainCameraClippingForMountedView(null);
            }
        }
    }

    _setFreeFlyEnabled(enabled) {
        const next = !!enabled;
        if (next === this._freeFlyActive) return;
        this._freeFlyActive = next;
        this.freeFlyControls?.setEnabled(next);
    }

    _resolveTargetObject(mode) {
        const { earth, moon, spacecraft } = this._targets || {};
        if (mode === CAMERA_POSITION_MODE.EARTH || mode === CAMERA_LOOK_MODE.EARTH) return earth;
        if (mode === CAMERA_POSITION_MODE.MOON || mode === CAMERA_LOOK_MODE.MOON) return moon;
        if (mode === CAMERA_POSITION_MODE.SPACECRAFT || mode === CAMERA_LOOK_MODE.SPACECRAFT) return spacecraft;
        return null;
    }

    _updateCameraUpForLookTarget(mode, lookPos) {
        const target = this._resolveTargetObject(mode);
        if (!target) return;

        // Use the target's local +Z axis as "north" in world space (Earth/Moon containers are oriented accordingly).
        const up = this._tmpUp.set(0, 0, 1).applyQuaternion(target.getWorldQuaternion(this._tmpQuat)).normalize();

        // Avoid degenerate cases where "up" is nearly parallel to the view direction.
        this._tmpViewDir.copy(lookPos).sub(this.camera.position).normalize();
        if (Math.abs(up.dot(this._tmpViewDir)) > 0.98) {
            this.camera.up.set(0, 0, 1);
            return;
        }

        this.camera.up.copy(up);
    }

    _resolveTargetWorld(mode, outVec) {
        const { earth, moon, spacecraft } = this._targets || {};
        if (mode === CAMERA_POSITION_MODE.EARTH || mode === CAMERA_LOOK_MODE.EARTH) {
            if (earth) return earth.getWorldPosition(outVec);
        }
        if (mode === CAMERA_POSITION_MODE.MOON || mode === CAMERA_LOOK_MODE.MOON) {
            if (moon) return moon.getWorldPosition(outVec);
        }
        if (mode === CAMERA_POSITION_MODE.SPACECRAFT || mode === CAMERA_LOOK_MODE.SPACECRAFT) {
            if (spacecraft) return spacecraft.getWorldPosition(outVec);
        }
        return null;
    }

    /**
     * Set camera position
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setPosition(x, y, z) {
        if (this.camera) {
            this.camera.position.set(x, y, z);
            this.camera.updateProjectionMatrix();
        }
    }

    /**
     * Set camera field of view
     * @param {number} fov
     */
    setFov(fov) {
        if (this.camera) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
    }

    /**
     * Set camera up vector
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setUp(x, y, z) {
        if (this.camera) {
            this.camera.up.set(x, y, z);
        }
    }

    /**
     * Get current camera distance from origin
     * @returns {number} Distance from origin
     */
    getDistanceFromOrigin() {
        if (this.controls) {
            const origin = new THREE.Vector3(0, 0, 0);
            return this.controls.getPos().distanceTo(origin);
        }
        return this.defaultDistance;
    }

    /**
     * Update controls (call in animation loop)
     */
    update() {
        if (this.controls) {
            this.controls.update();
        }
    }

    /**
     * Update camera aspect ratio on resize
     * @param {number} width
     * @param {number} height
     */
    updateAspect(width, height) {
        this.width = width;
        this.height = height;

        if (this.camera) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
        if (this.craftCamera) {
            this.craftCamera.aspect = width / height;
            this.craftCamera.updateProjectionMatrix();
        }
        if (this.droneCamera) {
            this.droneCamera.aspect = width / height;
            this.droneCamera.updateProjectionMatrix();
        }
    }

    /**
     * Dispose all cameras and controls
     * @param {THREE.Object3D} craft - Spacecraft object (to remove craftCamera)
     * @param {THREE.Object3D} drone - Drone object (to remove droneCamera)
     */
    dispose(craft, drone) {
        if (this.camera) {
            this.camera.remove(...this.camera.children);
            this.camera = null;
        }

        if (this.craftCamera) {
            this.craftCamera.remove(...this.craftCamera.children);
            if (craft) {
                craft.remove(this.craftCamera);
            }
            this.craftCamera = null;
        }

        if (this.droneCamera) {
            this.droneCamera.remove(...this.droneCamera.children);
            if (drone) {
                drone.remove(this.droneCamera);
            }
            this.droneCamera = null;
        }

        if (this.controls) {
            if (this._fromToChangeHandler) {
                this.controls.removeEventListener('change', this._fromToChangeHandler);
                this._fromToChangeHandler = null;
            }
            this.controls.dispose();
            this.controls = null;
        }

        if (this._rendererDomElement && this._mountedWheelHandler) {
            this._rendererDomElement.removeEventListener("wheel", this._mountedWheelHandler);
            this._mountedWheelHandler = null;
        }

        if (this.freeFlyControls) {
            this.freeFlyControls.dispose();
            this.freeFlyControls = null;
        }
    }
}
