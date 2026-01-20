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
import { TrackballControls } from '../../../../third-party/TrackballControls.js';

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
        this._mountWorld = new THREE.Vector3();
        this._lookWorld = new THREE.Vector3();
    }

    /**
     * Create the main camera
     * @param {number} fov - Field of view (default 50)
     */
    createMainCamera(fov = 50) {
        this.camera = new THREE.PerspectiveCamera(
            fov,
            this.width / this.height,
            0.0001,
            100000
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
            0.0001,
            100000
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
            0.0001,
            100000
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

        this.controls = new TrackballControls(this.camera, domElement, callback);

        // TrackballControls settings
        this.controls.rotateSpeed = 1.0;
        this.controls.zoomSpeed = 1.0;
        this.controls.panSpeed = 1.0;
        this.controls.noZoom = false;
        this.controls.noPan = false;
        this.controls.staticMoving = true;
        this.controls.dynamicDampingFactor = 0.3;
        this.controls.keys = [65, 83, 68];  // A, S, D keys

        if (renderCallback) {
            this.controls.addEventListener('change', renderCallback, { passive: true });
        }

        return this.controls;
    }

    /**
     * Set the from-to modes without changing camera unless updateFromTo() is called.
     * @param {string} positionMode
     * @param {string} lookMode
     */
    setFromToModes(positionMode, lookMode) {
        if (Object.values(CAMERA_POSITION_MODE).includes(positionMode)) {
            this.positionMode = positionMode;
        }
        if (Object.values(CAMERA_LOOK_MODE).includes(lookMode)) {
            this.lookMode = lookMode;
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
        if (!hasPositionMount && !hasForcedLook) return;

        const resolveTargetWorld = (mode, outVec) => {
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
        };

        // If mounted to a body, move camera with a stored offset and disable TrackballControls to avoid conflicts.
        if (hasPositionMount) {
            const mountPos = resolveTargetWorld(this.positionMode, this._mountWorld);
            if (mountPos) {
                if (this.controls) this.controls.enabled = false;
                this.camera.position.copy(mountPos).add(this.mountOffset);
            }
        } else if (this.controls) {
            // When not mounted, controls may be enabled (we may still disable rotation if forcing look).
            this.controls.enabled = true;
        }

        // If forced lookAt is enabled, keep TrackballControls target in sync and disable rotation only.
        if (hasForcedLook) {
            const lookPos = resolveTargetWorld(this.lookMode, this._lookWorld);
            if (lookPos) {
                if (this.controls) {
                    this.controls.target.copy(lookPos);
                    this.controls.noRotate = true;
                } else {
                    this.camera.lookAt(lookPos);
                }
            }
        } else if (this.controls) {
            this.controls.noRotate = false;
        }
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
            this.controls.dispose();
            this.controls = null;
        }
    }
}
