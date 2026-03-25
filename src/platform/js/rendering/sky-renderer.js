/**
 * Sky Renderer - Starfield and constellation background
 *
 * Manages the celestial sphere background:
 * - Starmap texture on a large sphere
 * - Constellation overlay with additive blending
 * - Orientation aligned to Earth's axis
 * - Position tracking with camera for infinite sky effect
 */

import * as THREE from 'three';
import { PHYSICS_CONSTANTS as PC } from '../core/constants.js';

const SKY_STARMAP_OPACITY = 0.4;
const SKY_CONSTELLATION_OPACITY = 0.06;

export class SkyRenderer {
    /**
     * @param {THREE.Object3D} parentContainer - Container to add sky to
     * @param {number} baseRadius - Base radius for calculating sky sphere size
     */
    constructor(parentContainer, baseRadius) {
        this.parentContainer = parentContainer;
        this.baseRadius = baseRadius;

        // Container and meshes
        this.container = null;
        this.skyMesh = null;
        this.constellationMesh = null;

        // Textures (set externally before create())
        this.skyTexture = null;
        this.constellationTexture = null;

        // Calculated radius
        this.radius = 200 * baseRadius;
    }

    /**
     * Set textures before creating the sky
     * @param {THREE.Texture} skyTexture - Starmap texture
     * @param {THREE.Texture} constellationTexture - Constellation overlay texture
     */
    setTextures(skyTexture, constellationTexture) {
        this.skyTexture = skyTexture;
        this.constellationTexture = constellationTexture;
    }

    /**
     * Create the sky sphere with starmap and constellation overlay
     * @param {boolean} visible - Initial visibility
     */
    create(visible = true) {
        // Create container tilted to Earth's axis
        this.container = new THREE.Group();
        this.container.lookAt(
            0,
            Math.sin(PC.EARTH_AXIS_INCLINATION_RADS),
            Math.cos(PC.EARTH_AXIS_INCLINATION_RADS)
        );

        const geometry = new THREE.SphereGeometry(this.radius);

        // Starmap sphere
        const skyMaterial = new THREE.MeshBasicMaterial({
            blending: THREE.AdditiveBlending,
            map: this.skyTexture,
            opacity: SKY_STARMAP_OPACITY
        });
        skyMaterial.side = THREE.BackSide;

        this.skyMesh = new THREE.Mesh(geometry, skyMaterial);
        this.skyMesh.receiveShadow = false;
        this.skyMesh.castShadow = false;
        this.skyMesh.rotateX(Math.PI / 2);  // Orient texture correctly
        this.container.add(this.skyMesh);

        // Constellation overlay sphere
        const constellationMaterial = new THREE.MeshBasicMaterial({
            blending: THREE.AdditiveBlending,
            map: this.constellationTexture,
            opacity: SKY_CONSTELLATION_OPACITY
        });
        constellationMaterial.side = THREE.BackSide;

        this.constellationMesh = new THREE.Mesh(geometry, constellationMaterial);
        this.constellationMesh.receiveShadow = false;
        this.constellationMesh.castShadow = false;
        this.constellationMesh.rotateX(Math.PI / 2);  // Orient texture correctly
        this.container.add(this.constellationMesh);

        // Mirror and rotate for correct orientation
        this.container.scale.set(-1, 1, 1);
        this.container.rotateZ(Math.PI);

        this.container.visible = visible;
        this.parentContainer.add(this.container);
    }

    /**
     * Update sky position to follow camera (creates infinite sky effect)
     * @param {THREE.Camera} camera - Camera to follow
     */
    updatePosition(camera) {
        if (this.container) {
            this.container.position.setFromMatrixPosition(camera.matrixWorld);
        }
    }

    /**
     * Set visibility of the sky
     * @param {boolean} visible - Whether sky should be visible
     */
    setVisible(visible) {
        if (this.container) {
            this.container.visible = visible;
        }
    }

    /**
     * Get visibility state
     * @returns {boolean} Current visibility
     */
    isVisible() {
        return this.container ? this.container.visible : false;
    }

    /**
     * Dispose all sky resources
     */
    dispose() {
        if (this.container) {
            // Dispose sky mesh
            if (this.skyMesh) {
                if (this.skyMesh.geometry) {
                    this.skyMesh.geometry.dispose();
                }
                if (this.skyMesh.material) {
                    this.skyMesh.material.dispose();
                }
                this.container.remove(this.skyMesh);
                this.skyMesh = null;
            }

            // Dispose constellation mesh
            if (this.constellationMesh) {
                if (this.constellationMesh.geometry) {
                    this.constellationMesh.geometry.dispose();
                }
                if (this.constellationMesh.material) {
                    this.constellationMesh.material.dispose();
                }
                this.container.remove(this.constellationMesh);
                this.constellationMesh = null;
            }

            // Remove container
            this.parentContainer.remove(this.container);
            this.container = null;
        }

        // Dispose textures
        if (this.skyTexture) {
            this.skyTexture.dispose();
            this.skyTexture = null;
        }
        if (this.constellationTexture) {
            this.constellationTexture.dispose();
            this.constellationTexture = null;
        }
    }
}
