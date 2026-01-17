/**
 * Spacecraft Renderer - Spacecraft and drone visualization
 *
 * Manages spacecraft visualization with two modes:
 * - Simple geometric representation (truncated pyramid with edges)
 * - GLTF model loading for detailed spacecraft models
 *
 * Also manages a drone camera target (simple cube)
 * All spacecraft objects use layer 1 for separate lighting
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LIGHT_SETTINGS as LT } from '../core/constants.js';

export class SpacecraftRenderer {
    /**
     * @param {THREE.Object3D} parentContainer - Container to add spacecraft to
     * @param {number} size - Base size for spacecraft geometry
     * @param {number} color - Spacecraft color
     */
    constructor(parentContainer, size, color) {
        this.parentContainer = parentContainer;
        this.size = size;
        this.color = color;
        this.edgeColor = 0xFF8000;

        // Main spacecraft group
        this.craft = null;
        this.craftInner = null;
        this.craftEdges = null;
        this.axesHelper = null;
        this.visible = true;

        // Drone (camera target)
        this.drone = null;

        // Model lights (for GLTF mode)
        this.modelLights = [];
    }

    /**
     * Create simple geometric spacecraft
     */
    createSimple() {
        // Truncated pyramid geometry
        const geometry = new THREE.CylinderGeometry(
            this.size * 0.8 / Math.sqrt(2),
            this.size * 1.0 / Math.sqrt(2),
            this.size * 0.8,
            4, 1
        );
        const material = new THREE.MeshPhongMaterial({
            color: this.color,
            transparent: false,
            opacity: 1.0
        });

        this.craftInner = new THREE.Mesh(geometry, material);

        // Add edge wireframe
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        this.craftEdges = new THREE.LineSegments(
            edgesGeometry,
            new THREE.LineBasicMaterial({ color: this.edgeColor })
        );
        this.craftInner.add(this.craftEdges);

        // Orient correctly
        this.craftInner.rotateX(Math.PI / 2);  // Top points to Z
        this.craftInner.rotateY(Math.PI / 4);  // Correct side orientation
        this.craftInner.layers.set(1);

        // Create craft group
        this.craft = new THREE.Group();
        this.craft.add(this.craftInner);

        // Add axes helper
        this.axesHelper = new THREE.AxesHelper(10);
        this.axesHelper.position.copy(this.craftInner.position);
        this.axesHelper.visible = false;
        this.craft.add(this.axesHelper);

        this.craft.layers.set(1);
        this.craft.visible = this.visible;

        this.parentContainer.add(this.craft);

        // Create drone
        this._createDrone();
    }

    /**
     * Create drone (simple cube for camera target)
     * @private
     */
    _createDrone() {
        const geometry = new THREE.BoxGeometry(this.size, this.size, this.size);
        const material = new THREE.MeshLambertMaterial({ color: 0xffffff });

        this.drone = new THREE.Mesh(geometry, material);
        this.drone.layers.set(1);
        this.drone.visible = false;

        this.parentContainer.add(this.drone);
    }

    /**
     * Load GLTF spacecraft model
     * @param {string} modelPath - Path to GLTF/GLB file
     * @returns {Promise} Resolves when model is loaded
     */
    async loadModel(modelPath) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();

            loader.load(
                modelPath,
                (gltf) => {
                    this.craft = new THREE.Group();
                    this.craftInner = gltf.scene;
                    this.craftInner.rotateX(Math.PI / 2);  // Top points to Z

                    // Calculate bounding box for light positioning
                    const bbox = new THREE.Box3().setFromObject(this.craftInner);
                    const maxSide = Math.max(
                        bbox.max.x - bbox.min.x,
                        bbox.max.y - bbox.min.y,
                        bbox.max.z - bbox.min.z
                    );

                    // Set all children to layer 1
                    this._setLayerRecursive(this.craftInner, 1);

                    this.craft.add(this.craftInner);

                    // Add axes helper
                    this.axesHelper = new THREE.AxesHelper(10);
                    this.axesHelper.position.copy(this.craftInner.position);
                    this.axesHelper.visible = true;
                    this.craft.add(this.axesHelper);

                    this.craft.layers.set(1);
                    this.craft.visible = this.visible;

                    // Add 6 directional lights around the model
                    this._addModelLights(maxSide);

                    this.parentContainer.add(this.craft);

                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Failed to load spacecraft model:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Recursively set layer for object and all children
     * @private
     */
    _setLayerRecursive(object, layer) {
        object.layers.set(layer);
        object.children.forEach(child => this._setLayerRecursive(child, layer));
    }

    /**
     * Add 6 directional lights around the model for illumination
     * @private
     */
    _addModelLights(bboxSize) {
        const intensity = 2;
        const scale = 0.6;
        const distance = scale * bboxSize;

        const positions = [
            [+distance, 0, 0],
            [0, +distance, 0],
            [0, 0, +distance],
            [-distance, 0, 0],
            [0, -distance, 0],
            [0, 0, -distance]
        ];

        for (const pos of positions) {
            const light = new THREE.DirectionalLight(LT.PRIMARY_COLOR, intensity);
            light.layers.set(1);
            light.position.set(pos[0], pos[1], pos[2]);
            this.craft.add(light);
            this.modelLights.push(light);
        }
    }

    /**
     * Set visibility of spacecraft
     * @param {boolean} visible
     */
    setVisible(visible) {
        this.visible = visible;
        if (this.craft) {
            this.craft.visible = visible;
        }
    }

    /**
     * Set visibility of axes helper
     * @param {boolean} visible
     */
    setAxesVisible(visible) {
        if (this.axesHelper) {
            this.axesHelper.visible = visible;
        }
    }

    /**
     * Set visibility of drone
     * @param {boolean} visible
     */
    setDroneVisible(visible) {
        if (this.drone) {
            this.drone.visible = visible;
        }
    }

    /**
     * Dispose simple spacecraft
     */
    dispose() {
        if (this.craft) {
            // Dispose craft inner geometry and material
            if (this.craftInner) {
                if (this.craftInner.geometry) {
                    this.craftInner.geometry.dispose();
                }
                if (this.craftInner.material) {
                    this.craftInner.material.dispose();
                }
            }

            // Dispose edges
            if (this.craftEdges) {
                if (this.craftEdges.geometry) {
                    this.craftEdges.geometry.dispose();
                }
                if (this.craftEdges.material) {
                    this.craftEdges.material.dispose();
                }
            }

            // Dispose axes helper
            if (this.axesHelper) {
                this.axesHelper.dispose();
            }

            this.parentContainer.remove(this.craft);
            this.craft = null;
            this.craftInner = null;
            this.craftEdges = null;
            this.axesHelper = null;
        }

        // Dispose drone
        if (this.drone) {
            if (this.drone.geometry) {
                this.drone.geometry.dispose();
            }
            if (this.drone.material) {
                this.drone.material.dispose();
            }
            this.parentContainer.remove(this.drone);
            this.drone = null;
        }

        this.visible = false;
    }

    /**
     * Dispose GLTF model spacecraft
     */
    disposeModel() {
        if (this.craft) {
            // Dispose model lights
            for (const light of this.modelLights) {
                light.dispose();
                this.craft.remove(light);
            }
            this.modelLights = [];

            // Dispose geometry and materials recursively
            this.craft.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });

            // Dispose axes helper
            if (this.axesHelper) {
                this.axesHelper.dispose();
                this.axesHelper = null;
            }

            // Remove from parent
            if (this.craft.parent) {
                this.craft.parent.remove(this.craft);
            }

            this.craft = null;
            this.craftInner = null;
        }

        this.visible = false;
    }
}
