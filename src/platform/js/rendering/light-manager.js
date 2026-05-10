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
        this.earthshineLight = null;
        this.moonshineLight = null;
        this.craftLight = null;
        this.bodyAmbientLight = null;
        this.craftAmbientLight = null;

        // Ambient lights stored for disposal
        this.ambientLights = [];
    }

    /**
     * Create all scene lights
     */
    create() {
        // Primary directional light for celestial bodies
        this.primaryLight = new THREE.DirectionalLight(LT.PRIMARY_COLOR, LT.PRIMARY_INTENSITY);
        this.primaryLight.castShadow = true;
        this.primaryLight.shadow.mapSize.set(LT.SHADOW_MAP_SIZE, LT.SHADOW_MAP_SIZE);
        this.primaryLight.shadow.camera.left = -2000.0;
        this.primaryLight.shadow.camera.right = 2000.0;
        this.primaryLight.shadow.camera.top = 2000.0;
        this.primaryLight.shadow.camera.bottom = -2000.0;
        this.primaryLight.shadow.camera.near = 2000.0;
        this.primaryLight.shadow.camera.far = 7000.0;
        this.primaryLight.shadow.bias = -0.00002;
        this.primaryLight.shadow.normalBias = 0.12;
        this.primaryLight.shadow.normalBias = LT.SHADOW_NORMAL_BIAS;
        this.parentContainer.add(this.primaryLight);
        this.parentContainer.add(this.primaryLight.target);

        // Subtle Earthshine-style fill light for lunar nightside readability.
        this.earthshineLight = new THREE.DirectionalLight(
            LT.EARTHSHINE_COLOR,
            LT.EARTHSHINE_INTENSITY,
        );
        this.earthshineLight.layers.set(LT.MOON_REFLECTED_LIGHT_LAYER);
        this.parentContainer.add(this.earthshineLight);

        this.moonshineLight = new THREE.DirectionalLight(
            LT.MOONSHINE_COLOR,
            LT.MOONSHINE_INTENSITY,
        );
        this.moonshineLight.layers.set(LT.EARTH_REFLECTED_LIGHT_LAYER);
        this.parentContainer.add(this.moonshineLight);

        // Secondary directional light for spacecraft (on layer 1)
        this.craftLight = new THREE.DirectionalLight(LT.CRAFT_PRIMARY_COLOR, LT.CRAFT_PRIMARY_INTENSITY);
        this.craftLight.layers.set(1);
        this.parentContainer.add(this.craftLight);

        // Ambient light for celestial bodies
        const ambientLight = new THREE.AmbientLight(LT.AMBIENT_COLOR, LT.AMBIENT_INTENSITY);
        this.parentContainer.add(ambientLight);
        this.ambientLights.push(ambientLight);
        this.bodyAmbientLight = ambientLight;

        // Ambient light for spacecraft (on layer 1)
        const craftAmbientLight = new THREE.AmbientLight(LT.CRAFT_AMBIENT_COLOR, LT.CRAFT_AMBIENT_INTENSITY);
        craftAmbientLight.layers.set(1);
        this.parentContainer.add(craftAmbientLight);
        this.ambientLights.push(craftAmbientLight);
        this.craftAmbientLight = craftAmbientLight;
    }

    /**
     * Dispose all lights
     */
    dispose() {
        if (this.primaryLight) {
            this.parentContainer.remove(this.primaryLight.target);
            this.parentContainer.remove(this.primaryLight);
            this.primaryLight.dispose();
            this.primaryLight = null;
        }

        if (this.earthshineLight) {
            this.parentContainer.remove(this.earthshineLight);
            this.earthshineLight.dispose();
            this.earthshineLight = null;
        }

        if (this.moonshineLight) {
            this.parentContainer.remove(this.moonshineLight);
            this.moonshineLight.dispose();
            this.moonshineLight = null;
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
        this.bodyAmbientLight = null;
        this.craftAmbientLight = null;
    }
}
