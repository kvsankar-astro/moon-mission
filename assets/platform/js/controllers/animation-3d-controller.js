/**
 * Animation3DController - Renders 3D scene from computed state
 *
 * Part of the pull-based renderer architecture:
 * - Animation loop pulls state from SceneStateController
 * - Passes state to this controller
 * - Controller updates THREE.js objects and renders
 *
 * One instance per config (geo, lunar).
 */

import { PHYSICS_CONSTANTS as PC } from "../core/constants.js";
import { toScreenCoordinates } from "../scene-state.js";

// PIXELS_PER_AU is passed as a render option since it varies by config

export class Animation3DController {
    /**
     * Create a 3D animation controller.
     * @param {string} config - Configuration name: "geo" or "lunar"
     * @param {Object} animationScene - The AnimationScene instance for this config
     */
    constructor(config, animationScene) {
        this.config = config;
        this.scene = animationScene;
    }

    /**
     * Render the 3D scene based on computed state.
     * @param {Object} state - Scene state from computeSceneState()
     * @param {Object} options - Additional render options
     * @param {string} options.craftId - Spacecraft ID (e.g., "SC")
     * @param {number} options.pixelsPerAU - Scale factor for coordinate conversion
     * @param {Function} options.updateCraftScale - Callback to update craft scale
     */
    render(state, options = {}) {
        if (!this.scene || !this.scene.initialized3D) {
            return;
        }

        const { craftId = "SC", pixelsPerAU = 250, updateCraftScale } = options;
        this.pixelsPerAU = pixelsPerAU;

        // 1. Update lighting from sun position
        this.updateLighting(state.sunLongitude);

        // 2. Rotate Earth and Moon based on time
        this.scene.rotateEarth(state.time);
        this.scene.rotateMoon(state.time);

        // 3. Update body positions
        this.updateBodyPositions(state.bodies, craftId);

        // 4. Update spacecraft scale (depends on camera distance)
        if (updateCraftScale) {
            updateCraftScale();
        }

        // 5. Render the scene
        // Note: render() is called separately by the animation loop
    }

    /**
     * Update light positions based on sun longitude.
     * @param {number} sunLongitude - Sun longitude in radians
     */
    updateLighting(sunLongitude) {
        if (!this.scene.light || !this.scene.light2) {
            return;
        }

        const x = Math.cos(sunLongitude);
        const y = Math.sin(sunLongitude);

        this.scene.light.position.set(x, y, 0).normalize();
        this.scene.light2.position.set(x, y, 0).normalize();
    }

    /**
     * Update 3D object positions from body states.
     * @param {Object} bodies - Body states keyed by ID
     * @param {string} craftId - Spacecraft ID
     */
    updateBodyPositions(bodies, craftId) {
        for (const [bodyId, bodyState] of Object.entries(bodies)) {
            if (!bodyState || !bodyState.available) {
                continue;
            }

            const screenPos = toScreenCoordinates(bodyState.position, this.pixelsPerAU);

            if (bodyId === this.scene.secondaryBody) {
                // Secondary body (Moon in geo, Earth in lunar)
                this.updateSecondaryBodyPosition(screenPos);
            } else if (bodyId === craftId) {
                // Spacecraft
                this.updateSpacecraftPosition(bodyState, screenPos, bodies);
            }
        }
    }

    /**
     * Update secondary body (Moon/Earth) position.
     * @param {Object} screenPos - Screen coordinates {x, y, z}
     */
    updateSecondaryBodyPosition(screenPos) {
        if (this.scene.secondaryBody3D) {
            this.scene.secondaryBody3D.position.set(
                screenPos.x,
                screenPos.y,
                screenPos.z
            );
        }
    }

    /**
     * Update spacecraft position and orientation.
     * @param {Object} bodyState - Spacecraft body state
     * @param {Object} screenPos - Current screen position
     * @param {Object} allBodies - All body states (for next position calculation)
     */
    updateSpacecraftPosition(bodyState, screenPos, allBodies) {
        if (!this.scene.craft) {
            return;
        }

        // Set spacecraft position
        this.scene.craft.position.set(screenPos.x, screenPos.y, screenPos.z);

        // Calculate next position for orientation (prefer Chebyshev-derived next position from state)
        const nextPos = bodyState.nextPosition || this.calculateNextPosition(bodyState);
        const nextScreenPos = toScreenCoordinates(nextPos, this.pixelsPerAU);

        // Update drone position (follows spacecraft at offset)
        if (this.scene.drone) {
            const droneScale = 1.05;
            const delta = {
                x: nextScreenPos.x - screenPos.x,
                y: nextScreenPos.y - screenPos.y,
                z: nextScreenPos.z - screenPos.z
            };
            this.scene.drone.position.set(
                droneScale * (screenPos.x - delta.x),
                droneScale * (screenPos.y - delta.y),
                droneScale * (screenPos.z - delta.z)
            );
        }

        // Orient spacecraft to face direction of travel
        this.scene.craft.lookAt(nextScreenPos.x, nextScreenPos.y, nextScreenPos.z);
        this.scene.craft.up.set(0, 0, 1);

        // Orient drone to look back at spacecraft
        if (this.scene.drone) {
            this.scene.drone.lookAt(screenPos.x, screenPos.y, screenPos.z);
        }
    }

    /**
     * Calculate approximate next position for orientation.
     * Uses velocity to extrapolate position.
     * @param {Object} bodyState - Current body state with position and velocity
     * @returns {Object} Approximate next position {x, y, z}
     */
    calculateNextPosition(bodyState) {
        // Use velocity to estimate next position (1 minute ahead)
        const dt = 60; // seconds
        return {
            x: bodyState.position.x + bodyState.velocity.vx * dt,
            y: bodyState.position.y + bodyState.velocity.vy * dt,
            z: bodyState.position.z + bodyState.velocity.vz * dt
        };
    }

    /**
     * Update camera projection and sky position.
     * Called when camera controls are enabled.
     */
    updateCameraAndSky() {
        if (!this.scene.cameraControlsEnabled) {
            return;
        }

        this.scene.camera.updateProjectionMatrix();

        if (this.scene.skyContainer) {
            this.scene.skyContainer.position.setFromMatrixPosition(
                this.scene.camera.matrixWorld
            );
        }

        if (this.scene.cameraControls) {
            this.scene.cameraControls.update();
        }
    }
}
