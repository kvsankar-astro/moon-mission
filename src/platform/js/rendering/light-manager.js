/**
 * Light Manager - Scene lighting setup
 *
 * Manages all lighting in the 3D scene:
 * - Primary directional light for celestial bodies
 * - Secondary directional light for spacecraft (layer 1)
 * - Ambient lights for both scene and spacecraft
 */

import * as THREE from 'three';
import { LIGHT_SETTINGS as LT } from '../core/constants.js';

export class LightManager {
    /**
     * @param {THREE.Object3D} parentContainer - Container to add lights to
     */
    constructor(parentContainer) {
        this.parentContainer = parentContainer;

        // Primary lights
        this.primaryLight = null;
        this.craftLight = null;

        // Ambient lights stored for disposal
        this.ambientLights = [];
    }

    /**
     * Create all scene lights
     */
    create() {
        // Primary directional light for celestial bodies
        this.primaryLight = new THREE.DirectionalLight(LT.PRIMARY_COLOR, LT.PRIMARY_INTENSITY);
        this.parentContainer.add(this.primaryLight);

        // Secondary directional light for spacecraft (on layer 1)
        this.craftLight = new THREE.DirectionalLight(LT.CRAFT_PRIMARY_COLOR, LT.CRAFT_PRIMARY_INTENSITY);
        this.craftLight.layers.set(1);
        this.parentContainer.add(this.craftLight);

        // Ambient light for celestial bodies
        const ambientLight = new THREE.AmbientLight(LT.AMBIENT_COLOR, LT.AMBIENT_INTENSITY);
        this.parentContainer.add(ambientLight);
        this.ambientLights.push(ambientLight);

        // Ambient light for spacecraft (on layer 1)
        const craftAmbientLight = new THREE.AmbientLight(LT.CRAFT_AMBIENT_COLOR, LT.CRAFT_AMBIENT_INTENSITY);
        craftAmbientLight.layers.set(1);
        this.parentContainer.add(craftAmbientLight);
        this.ambientLights.push(craftAmbientLight);
    }

    /**
     * Dispose all lights
     */
    dispose() {
        if (this.primaryLight) {
            this.parentContainer.remove(this.primaryLight);
            this.primaryLight.dispose();
            this.primaryLight = null;
        }

        if (this.craftLight) {
            this.parentContainer.remove(this.craftLight);
            this.craftLight.dispose();
            this.craftLight = null;
        }

        // Dispose ambient lights
        for (const light of this.ambientLights) {
            this.parentContainer.remove(light);
            light.dispose();
        }
        this.ambientLights = [];
    }
}
