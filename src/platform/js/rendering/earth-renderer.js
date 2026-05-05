/**
 * Earth Renderer - Earth sphere with texture, axis, and poles
 *
 * Manages Earth visualization:
 * - Textured sphere with specular map
 * - Polar axis line
 * - North/South pole markers
 * - Tilted to match Earth's axial inclination
 */

import * as THREE from 'three';
import { COLORS as COL, PHYSICS_CONSTANTS as PC } from '../core/constants.js';

const EARTH_NIGHTSIDE_LIFT = 0.0;
const EARTH_NIGHTSIDE_EXPONENT = 1.45;
const EARTH_DAY_GAIN = 1.0;
const EARTH_DAY_SATURATION = 1.0;
const EARTH_ATMOSPHERE_RIM_STRENGTH = 0.0;
const EARTH_NIGHT_MAP_INTENSITY = 0.08;
const EARTH_NIGHT_MAP_EXPONENT = 2.25;

function applyEarthNightsideLiftShader(material) {
    material.userData = material.userData || {};
    if (!Number.isFinite(material.userData.earthNightsideLift)) {
        material.userData.earthNightsideLift = EARTH_NIGHTSIDE_LIFT;
    }
    if (!Number.isFinite(material.userData.earthNightsideExponent)) {
        material.userData.earthNightsideExponent = EARTH_NIGHTSIDE_EXPONENT;
    }
    if (!Number.isFinite(material.userData.earthDayGain)) {
        material.userData.earthDayGain = EARTH_DAY_GAIN;
    }
    if (!Number.isFinite(material.userData.earthDaySaturation)) {
        material.userData.earthDaySaturation = EARTH_DAY_SATURATION;
    }
    if (!Number.isFinite(material.userData.earthAtmosphereRimStrength)) {
        material.userData.earthAtmosphereRimStrength = EARTH_ATMOSPHERE_RIM_STRENGTH;
    }
    if (!Number.isFinite(material.userData.earthNightMapIntensity)) {
        material.userData.earthNightMapIntensity = EARTH_NIGHT_MAP_INTENSITY;
    }
    if (!Number.isFinite(material.userData.earthNightMapExponent)) {
        material.userData.earthNightMapExponent = EARTH_NIGHT_MAP_EXPONENT;
    }
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uEarthNightsideLift = { value: material.userData.earthNightsideLift };
        shader.uniforms.uEarthNightsideExponent = { value: material.userData.earthNightsideExponent };
        shader.uniforms.uEarthDayGain = { value: material.userData.earthDayGain };
        shader.uniforms.uEarthDaySaturation = { value: material.userData.earthDaySaturation };
        shader.uniforms.uEarthAtmosphereRimStrength = { value: material.userData.earthAtmosphereRimStrength };
        shader.uniforms.uEarthNightMapIntensity = { value: material.userData.earthNightMapIntensity };
        shader.uniforms.uEarthNightMapExponent = { value: material.userData.earthNightMapExponent };
        material.userData.earthNightsideShader = shader;

        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
uniform float uEarthNightsideLift;
uniform float uEarthNightsideExponent;
uniform float uEarthDayGain;
uniform float uEarthDaySaturation;
uniform float uEarthAtmosphereRimStrength;
uniform float uEarthNightMapIntensity;
uniform float uEarthNightMapExponent;`,
            )
            .replace(
                "#include <lights_fragment_begin>",
                `#include <lights_fragment_begin>
#if NUM_DIR_LIGHTS > 0
    float earthLuma = dot( diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722) );
    diffuseColor.rgb = mix( vec3(earthLuma), diffuseColor.rgb, clamp(uEarthDaySaturation, 0.0, 1.0) );
    reflectedLight.directDiffuse *= uEarthDayGain;
    vec3 earthNormal = normalize( geometryNormal );
    vec3 earthViewDir = normalize( vViewPosition );
    vec3 earthLightDir = normalize( directionalLights[0].direction );
    float earthNdotL = clamp( dot( earthNormal, earthLightDir ), 0.0, 1.0 );
    float earthRimWeight = pow( clamp( 1.0 - max( dot( earthNormal, earthViewDir ), 0.0 ), 0.0, 1.0 ), 2.2 );
    float earthSunlitRim = earthRimWeight * pow( max( earthNdotL, 0.0 ), 0.35 );
    reflectedLight.directDiffuse += vec3(0.62, 0.78, 1.0) * (uEarthAtmosphereRimStrength * earthSunlitRim);
    float earthNightWeight = pow( 1.0 - earthNdotL, max(0.2, uEarthNightsideExponent) );
    float earthNightMapWeight = pow( clamp( 1.0 - earthNdotL, 0.0, 1.0 ), max(0.2, uEarthNightMapExponent) );
    totalEmissiveRadiance *= (uEarthNightMapIntensity * earthNightMapWeight);
    reflectedLight.indirectDiffuse += diffuseColor.rgb * (uEarthNightsideLift * earthNightWeight);
#endif`,
            );
    };
    material.onBeforeRender = () => {
        const shader = material.userData?.earthNightsideShader;
        if (!shader?.uniforms) {
            return;
        }
        const lift = Number(material.userData.earthNightsideLift);
        const exponent = Number(material.userData.earthNightsideExponent);
        const dayGain = Number(material.userData.earthDayGain);
        const daySaturation = Number(material.userData.earthDaySaturation);
        const atmosphereRimStrength = Number(material.userData.earthAtmosphereRimStrength);
        const nightMapIntensity = Number(material.userData.earthNightMapIntensity);
        const nightMapExponent = Number(material.userData.earthNightMapExponent);
        if (Number.isFinite(lift) && shader.uniforms.uEarthNightsideLift) {
            shader.uniforms.uEarthNightsideLift.value = lift;
        }
        if (Number.isFinite(exponent) && shader.uniforms.uEarthNightsideExponent) {
            shader.uniforms.uEarthNightsideExponent.value = exponent;
        }
        if (Number.isFinite(dayGain) && shader.uniforms.uEarthDayGain) {
            shader.uniforms.uEarthDayGain.value = dayGain;
        }
        if (Number.isFinite(daySaturation) && shader.uniforms.uEarthDaySaturation) {
            shader.uniforms.uEarthDaySaturation.value = daySaturation;
        }
        if (Number.isFinite(atmosphereRimStrength) && shader.uniforms.uEarthAtmosphereRimStrength) {
            shader.uniforms.uEarthAtmosphereRimStrength.value = atmosphereRimStrength;
        }
        if (Number.isFinite(nightMapIntensity) && shader.uniforms.uEarthNightMapIntensity) {
            shader.uniforms.uEarthNightMapIntensity.value = nightMapIntensity;
        }
        if (Number.isFinite(nightMapExponent) && shader.uniforms.uEarthNightMapExponent) {
            shader.uniforms.uEarthNightMapExponent.value = nightMapExponent;
        }
    };
    material.customProgramCacheKey = () =>
        `earth-day-night-v4-${EARTH_NIGHTSIDE_LIFT}-${EARTH_NIGHTSIDE_EXPONENT}-${EARTH_DAY_GAIN}-${EARTH_DAY_SATURATION}-${EARTH_ATMOSPHERE_RIM_STRENGTH}-${EARTH_NIGHT_MAP_INTENSITY}-${EARTH_NIGHT_MAP_EXPONENT}`;
}

export class EarthRenderer {
    /**
     * @param {number} radius - Earth radius in scene units
     */
    constructor(radius) {
        this.radius = radius;

        // Container and meshes
        this.container = null;
        this.mesh = null;
        this.axis = null;
        this.northPoleSphere = null;
        this.southPoleSphere = null;

        // Textures (set externally before create())
        this.texture = null;
        this.specularTexture = null;
        this.nightTexture = null;
    }

    /**
     * Set textures before creating Earth
     * @param {THREE.Texture} texture - Earth surface texture
     * @param {THREE.Texture} specularTexture - Specular map for oceans
     * @param {THREE.Texture} nightTexture - Night lights map
     */
    setTextures(texture, specularTexture, nightTexture = null) {
        this.texture = texture;
        this.specularTexture = specularTexture;
        this.nightTexture = nightTexture;
    }

    /**
     * Update Earth textures after creation.
     * @param {THREE.Texture} texture
     * @param {THREE.Texture} specularTexture
     * @param {THREE.Texture} nightTexture
     * @param {{ disposePrevious?: boolean }} options
     */
    updateTextures(texture, specularTexture, nightTexture, { disposePrevious = true } = {}) {
        const previousTexture = this.texture;
        const previousSpecularTexture = this.specularTexture;
        const previousNightTexture = this.nightTexture;
        this.texture = texture;
        this.specularTexture = specularTexture;
        this.nightTexture = nightTexture;

        const material = this.mesh?.material;
        if (material) {
            material.map = this.texture || null;
            material.specularMap = this.specularTexture || null;
            material.emissiveMap = this.nightTexture || null;
            material.emissiveIntensity = this.nightTexture ? 1.0 : 0.0;
            material.needsUpdate = true;
        }

        if (disposePrevious) {
            if (previousTexture && previousTexture !== this.texture) {
                previousTexture.dispose?.();
            }
            if (
                previousSpecularTexture &&
                previousSpecularTexture !== this.specularTexture &&
                previousSpecularTexture !== this.texture
            ) {
                previousSpecularTexture.dispose?.();
            }
            if (
                previousNightTexture &&
                previousNightTexture !== this.nightTexture &&
                previousNightTexture !== this.texture &&
                previousNightTexture !== this.specularTexture
            ) {
                previousNightTexture.dispose?.();
            }
        }
    }

    /**
     * Create Earth with axis and poles
     * @param {boolean} axisVisible - Initial visibility of polar axis
     * @param {boolean} polesVisible - Initial visibility of pole markers
     */
    create(axisVisible = false, polesVisible = false) {
        // Create container tilted to Earth's axis
        this.container = new THREE.Group();
        this.container.lookAt(
            0,
            Math.sin(PC.EARTH_AXIS_INCLINATION_RADS),
            Math.cos(PC.EARTH_AXIS_INCLINATION_RADS)
        );

        // Earth sphere
        const geometry = new THREE.SphereGeometry(this.radius, 100, 100);
        const material = new THREE.MeshPhongMaterial({
            map: this.texture,
            specularMap: this.specularTexture,
            emissiveMap: this.nightTexture,
            emissive: 0xffffff,
            emissiveIntensity: this.nightTexture ? 1.0 : 0.0,
            specular: 0x101010
        });
        applyEarthNightsideLiftShader(material);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = false;
        this.mesh.castShadow = false;
        this.mesh.frustumCulled = false;
        this.mesh.rotateX(Math.PI / 2);  // Orient texture correctly
        this.container.add(this.mesh);

        // Avoid culling the container to prevent pop-in at extreme viewpoints
        this.container.frustumCulled = false;

        // Create axis and poles (not added to container yet - done by parent)
        this._createAxis(axisVisible);
        this._createPoles(polesVisible);
    }

    /**
     * Create polar axis line
     * @private
     */
    _createAxis(visible) {
        const poleScaleOuter = 1.2;
        const poleScaleInner = 1.02; // leave a gap inside the sphere

        const northOuter = new THREE.Vector3(0, 0, this.radius * poleScaleOuter);
        const northInner = new THREE.Vector3(0, 0, this.radius * poleScaleInner);
        const southInner = new THREE.Vector3(0, 0, -this.radius * poleScaleInner);
        const southOuter = new THREE.Vector3(0, 0, -this.radius * poleScaleOuter);

        const geometry = new THREE.BufferGeometry();
        const vertices = [
            northOuter.x, northOuter.y, northOuter.z, northInner.x, northInner.y, northInner.z,
            southInner.x, southInner.y, southInner.z, southOuter.x, southOuter.y, southOuter.z
        ];
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        const material = new THREE.LineBasicMaterial({ color: COL.EARTH_AXIS, depthTest: true, depthWrite: false });
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
     * Set rotation around Z axis (for Earth rotation animation)
     * @param {number} angle - Rotation angle in radians
     */
    setRotation(angle) {
        if (this.container) {
            this.container.rotation.z = angle;
        }
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
     * Dispose all Earth resources
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
        if (this.specularTexture) {
            this.specularTexture.dispose();
            this.specularTexture = null;
        }
        if (this.nightTexture) {
            this.nightTexture.dispose();
            this.nightTexture = null;
        }
    }
}
