/**
 * Moon Renderer - Moon sphere with texture, displacement, axis, and poles
 *
 * Manages Moon visualization:
 * - Textured sphere with bump and displacement maps
 * - Polar axis line
 * - North/South pole markers
 * - Rotation based on lunar pole orientation
 */

import * as THREE from 'three';
import { COLORS as COL, PHYSICS_CONSTANTS as PC } from '../core/constants.js';
import { lunar_pole } from '../astro.js';

export class MoonRenderer {
    /**
     * @param {number} radius - Moon radius in scene units
     */
    constructor(radius) {
        this.radius = radius;

        // Container and meshes
        this.container = null;
        this.mesh = null;
        this.axis = null;
        this.axisVector = null;  // Normalized axis direction
        this.northPoleSphere = null;
        this.southPoleSphere = null;

        // Textures (set externally before create())
        this.texture = null;
        this.displacementMap = null;
    }

    /**
     * Set textures before creating Moon
     * @param {THREE.Texture} texture - Moon surface texture
     * @param {THREE.Texture} displacementMap - Displacement/bump map
     */
    setTextures(texture, displacementMap) {
        this.texture = texture;
        this.displacementMap = displacementMap;
    }

    /**
     * Create Moon with axis and poles
     * @param {boolean} axisVisible - Initial visibility of polar axis
     * @param {boolean} polesVisible - Initial visibility of pole markers
     */
    create(axisVisible = false, polesVisible = false) {
        // Create container (rotation handled separately by rotateMoon)
        this.container = new THREE.Group();

        // Moon sphere with displacement mapping
        const geometry = new THREE.SphereGeometry(this.radius, 100, 100);
        const material = new THREE.MeshStandardMaterial({
            map: this.texture,
            bumpMap: this.displacementMap,
            bumpScale: 0.003,
            displacementMap: this.displacementMap,
            displacementScale: 0.008,
            displacementBias: -0.004,
            roughness: 0.9,
            metalness: 0.0,
            emissive: 0x000000,
            emissiveIntensity: 0.0
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        this.mesh.rotateX(Math.PI / 2);
        this.container.add(this.mesh);

        // Create axis and poles (not added to container yet - done by parent)
        this._createAxis(axisVisible);
        this._createPoles(polesVisible);
    }

    /**
     * Create polar axis line
     * @private
     */
    _createAxis(visible) {
        const poleScaleOuter = 1.5;
        const poleScaleInner = 1.02; // leave a gap inside the sphere
        const northOuter = new THREE.Vector3(0, 0, this.radius * poleScaleOuter);
        const northInner = new THREE.Vector3(0, 0, this.radius * poleScaleInner);
        const southInner = new THREE.Vector3(0, 0, -this.radius * poleScaleInner);
        const southOuter = new THREE.Vector3(0, 0, -this.radius * poleScaleOuter);

        // Store normalized axis vector for reference
        this.axisVector = northOuter.clone().normalize();

        const geometry = new THREE.BufferGeometry();
        const vertices = [
            northOuter.x, northOuter.y, northOuter.z, northInner.x, northInner.y, northInner.z,
            southInner.x, southInner.y, southInner.z, southOuter.x, southOuter.y, southOuter.z
        ];
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        const material = new THREE.LineBasicMaterial({ color: COL.MOON_AXIS, depthTest: true, depthWrite: false });
        this.axis = new THREE.LineSegments(geometry, material);
        this.axis.visible = visible;
    }

    /**
     * Create north and south pole markers
     * @private
     */
    _createPoles(visible) {
        const poleRadius = this.radius / 50;
        const poleGeometry = new THREE.SphereGeometry(poleRadius, 100, 100);

        // North pole
        const northMaterial = new THREE.MeshPhysicalMaterial({
            color: COL.BLACK,
            emissive: COL.NORTH_POLE,
            reflectivity: 0.0
        });
        this.northPoleSphere = new THREE.Mesh(poleGeometry, northMaterial);
        this.northPoleSphere.castShadow = false;
        this.northPoleSphere.receiveShadow = false;
        this.northPoleSphere.position.set(0, 0, 0.985 * this.radius);
        this.northPoleSphere.visible = visible;

        // South pole
        const southMaterial = new THREE.MeshPhysicalMaterial({
            color: COL.BLACK,
            emissive: COL.SOUTH_POLE,
            reflectivity: 0.0
        });
        this.southPoleSphere = new THREE.Mesh(poleGeometry, southMaterial);
        this.southPoleSphere.castShadow = false;
        this.southPoleSphere.receiveShadow = false;
        this.southPoleSphere.position.set(0, 0, -0.985 * this.radius);
        this.southPoleSphere.visible = visible;
    }

    /**
     * Add axis and poles to container
     * Called by parent after configuration is known
     */
    addAxisAndPolesToContainer() {
        if (this.container && this.axis) {
            this.container.add(this.axis);
        }
        if (this.container && this.northPoleSphere) {
            this.container.add(this.northPoleSphere);
        }
        if (this.container && this.southPoleSphere) {
            this.container.add(this.southPoleSphere);
        }
    }

    /**
     * Update Moon rotation based on current time
     * Uses IAU lunar pole model
     * @param {Date|number} time - Current animation time
     */
    updateRotation(time) {
        if (!this.container) return;

        const date = new Date(time);
        const lp = lunar_pole(date);
        const alpha = lp["alpha"];
        const delta = lp["delta"];
        const W = lp["W"];

        this.container.rotation.set(0, 0, 0);
        this.container.rotateX(-1 * PC.EARTH_AXIS_INCLINATION_RADS);
        this.container.rotateZ(+1 * (Math.PI / 2 + alpha));
        this.container.rotateX(+1 * (Math.PI / 2 - delta));
        this.container.rotateZ(+1 * W);
    }

    /**
     * Set visibility of polar axis
     * @param {boolean} visible
     */
    setAxisVisible(visible) {
        if (this.axis) {
            this.axis.visible = visible;
        }
    }

    /**
     * Set visibility of pole markers
     * @param {boolean} visible
     */
    setPolesVisible(visible) {
        if (this.northPoleSphere) {
            this.northPoleSphere.visible = visible;
        }
        if (this.southPoleSphere) {
            this.southPoleSphere.visible = visible;
        }
    }

    /**
     * Dispose all Moon resources
     */
    dispose() {
        if (this.container) {
            // Dispose mesh
            if (this.mesh) {
                if (this.mesh.geometry) this.mesh.geometry.dispose();
                if (this.mesh.material) this.mesh.material.dispose();
                this.container.remove(this.mesh);
                this.mesh = null;
            }

            // Dispose axis
            if (this.axis) {
                if (this.axis.geometry) this.axis.geometry.dispose();
                if (this.axis.material) this.axis.material.dispose();
                this.container.remove(this.axis);
                this.axis = null;
            }
            this.axisVector = null;

            // Dispose poles
            if (this.northPoleSphere) {
                if (this.northPoleSphere.geometry) this.northPoleSphere.geometry.dispose();
                if (this.northPoleSphere.material) this.northPoleSphere.material.dispose();
                this.container.remove(this.northPoleSphere);
                this.northPoleSphere = null;
            }
            if (this.southPoleSphere) {
                if (this.southPoleSphere.geometry) this.southPoleSphere.geometry.dispose();
                if (this.southPoleSphere.material) this.southPoleSphere.material.dispose();
                this.container.remove(this.southPoleSphere);
                this.southPoleSphere = null;
            }

            // Remove container from parent
            if (this.container.parent) {
                this.container.parent.remove(this.container);
            }
            this.container = null;
        }

        // Dispose textures
        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }
        if (this.displacementMap) {
            this.displacementMap.dispose();
            this.displacementMap = null;
        }
    }
}
