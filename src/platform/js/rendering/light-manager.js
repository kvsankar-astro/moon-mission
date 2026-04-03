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
        this.primaryLight.castShadow = true;
        this.primaryLight.shadow.mapSize.set(LT.SHADOW_MAP_SIZE, LT.SHADOW_MAP_SIZE);
        this.primaryLight.shadow.camera.left = -LT.SHADOW_FRUSTUM_HALF_SIZE;
        this.primaryLight.shadow.camera.right = LT.SHADOW_FRUSTUM_HALF_SIZE;
        this.primaryLight.shadow.camera.top = LT.SHADOW_FRUSTUM_HALF_SIZE;
        this.primaryLight.shadow.camera.bottom = -LT.SHADOW_FRUSTUM_HALF_SIZE;
        this.primaryLight.shadow.camera.near = LT.SHADOW_NEAR;
        this.primaryLight.shadow.camera.far = LT.SHADOW_FAR;
        this.primaryLight.shadow.bias = LT.SHADOW_BIAS;
        this.primaryLight.shadow.normalBias = LT.SHADOW_NORMAL_BIAS;
        this.parentContainer.add(this.primaryLight);
        this.parentContainer.add(this.primaryLight.target);

        // Subtle Earthshine-style fill light for lunar nightside readability.
        this.earthshineLight = new THREE.DirectionalLight(
            LT.EARTHSHINE_COLOR,
            LT.EARTHSHINE_INTENSITY,
        );
        this.parentContainer.add(this.earthshineLight);

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
