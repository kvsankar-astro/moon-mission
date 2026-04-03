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

const MOON_GEOMETRY_WIDTH_SEGMENTS = 256;
const MOON_GEOMETRY_HEIGHT_SEGMENTS = 256;
const MOON_NORMAL_MAP_MAX_WIDTH = 4096;
const MOON_NORMAL_MAP_STRENGTH = 0.72;
const MOON_LOMMEL_SEELIGER_BLEND = 0.1;
const MOON_OPPOSITION_STRENGTH = 0.004;

function buildNormalMapFromHeightTexture(heightTexture) {
    const image = heightTexture?.image;
    if (!image || typeof document === "undefined") {
        return null;
    }

    const sourceWidth = Number(image.width) || 0;
    const sourceHeight = Number(image.height) || 0;
    if (sourceWidth < 2 || sourceHeight < 2) {
        return null;
    }

    let width = sourceWidth;
    let height = sourceHeight;
    if (width > MOON_NORMAL_MAP_MAX_WIDTH) {
        const scale = MOON_NORMAL_MAP_MAX_WIDTH / width;
        width = MOON_NORMAL_MAP_MAX_WIDTH;
        height = Math.max(2, Math.round(height * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
        return null;
    }

    context.drawImage(image, 0, 0, width, height);
    const sourceData = context.getImageData(0, 0, width, height).data;
    const normalData = new Uint8Array(width * height * 4);

    const sampleHeight = (x, y) => {
        const clampedX = Math.max(0, Math.min(width - 1, x));
        const clampedY = Math.max(0, Math.min(height - 1, y));
        const index = (clampedY * width + clampedX) * 4;
        const r = sourceData[index] / 255;
        const g = sourceData[index + 1] / 255;
        const b = sourceData[index + 2] / 255;
        return 0.299 * r + 0.587 * g + 0.114 * b;
    };

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const hL = sampleHeight(x - 1, y);
            const hR = sampleHeight(x + 1, y);
            const hU = sampleHeight(x, y - 1);
            const hD = sampleHeight(x, y + 1);

            let nx = -1 * (hR - hL) * MOON_NORMAL_MAP_STRENGTH;
            let ny = -1 * (hD - hU) * MOON_NORMAL_MAP_STRENGTH;
            let nz = 1.0;
            const invLen = 1 / Math.max(1e-8, Math.hypot(nx, ny, nz));
            nx *= invLen;
            ny *= invLen;
            nz *= invLen;

            const outIndex = (y * width + x) * 4;
            normalData[outIndex] = Math.round((nx * 0.5 + 0.5) * 255);
            normalData[outIndex + 1] = Math.round((ny * 0.5 + 0.5) * 255);
            normalData[outIndex + 2] = Math.round((nz * 0.5 + 0.5) * 255);
            normalData[outIndex + 3] = 255;
        }
    }

    const normalTexture = new THREE.DataTexture(normalData, width, height, THREE.RGBAFormat);
    normalTexture.wrapS = heightTexture.wrapS;
    normalTexture.wrapT = heightTexture.wrapT;
    normalTexture.magFilter = THREE.LinearFilter;
    normalTexture.minFilter = THREE.LinearMipmapLinearFilter;
    normalTexture.generateMipmaps = true;
    normalTexture.flipY = heightTexture.flipY;
    normalTexture.needsUpdate = true;
    return normalTexture;
}

function applyMoonPhotometricShader(material) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uMoonLsBlend = { value: MOON_LOMMEL_SEELIGER_BLEND };
        shader.uniforms.uMoonOppositionStrength = { value: MOON_OPPOSITION_STRENGTH };

        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
uniform float uMoonLsBlend;
uniform float uMoonOppositionStrength;`,
            )
            .replace(
                "#include <lights_fragment_begin>",
                `#include <lights_fragment_begin>
#if NUM_DIR_LIGHTS > 0
    vec3 moonNormal = normalize( geometryNormal );
    vec3 moonViewDir = normalize( geometryViewDir );
    vec3 moonLightDir = normalize( directionalLights[0].direction );
    float moonNdotL = clamp( dot( moonNormal, moonLightDir ), 0.0, 1.0 );
    float moonNdotV = clamp( dot( moonNormal, moonViewDir ), 0.0, 1.0 );

    float moonLsScale = 1.0;
    if ( moonNdotL > 1e-4 ) {
        float moonLs = moonNdotL / max( moonNdotL + moonNdotV, 1e-4 );
        moonLsScale = moonLs / moonNdotL;
    } else {
        moonLsScale = 0.0;
    }

    moonLsScale = clamp( moonLsScale, 0.93, 1.05 );
    reflectedLight.directDiffuse *= mix( 1.0, moonLsScale, uMoonLsBlend );

    float moonPhaseAlignment = clamp( dot( moonLightDir, moonViewDir ), 0.0, 1.0 );
    float moonOpposition = pow( moonPhaseAlignment, 18.0 ) * uMoonOppositionStrength;
    diffuseColor.rgb *= ( 1.0 + moonOpposition );
#endif`,
            );
    };

    material.customProgramCacheKey = () =>
        `moon-photometric-v2-${MOON_LOMMEL_SEELIGER_BLEND}-${MOON_OPPOSITION_STRENGTH}`;
}

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
        this.normalMap = null;
        this.generatedNormalMap = null;
    }

    /**
     * Set textures before creating Moon
     * @param {THREE.Texture} texture - Moon surface texture
     * @param {THREE.Texture} displacementMap - Displacement/bump map
     * @param {THREE.Texture|null} normalMap - Optional normal map
     */
    setTextures(texture, displacementMap, normalMap = null) {
        this.texture = texture;
        this.displacementMap = displacementMap;
        this.normalMap = normalMap;
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
        if (!this.normalMap && this.displacementMap && !this.generatedNormalMap) {
            this.generatedNormalMap = buildNormalMapFromHeightTexture(this.displacementMap);
        }
        const resolvedNormalMap = this.normalMap || this.generatedNormalMap || null;

        const geometry = new THREE.SphereGeometry(
            this.radius,
            MOON_GEOMETRY_WIDTH_SEGMENTS,
            MOON_GEOMETRY_HEIGHT_SEGMENTS,
        );
        const material = new THREE.MeshStandardMaterial({
            map: this.texture,
            bumpMap: resolvedNormalMap ? null : this.displacementMap,
            bumpScale: resolvedNormalMap ? 0.0 : 0.0045,
            displacementMap: this.displacementMap,
            displacementScale: 0.0068,
            displacementBias: -0.0038,
            normalMap: resolvedNormalMap,
            normalScale: new THREE.Vector2(0.58, 0.58),
            roughness: 0.96,
            metalness: 0.0,
            emissive: 0x000000,
            emissiveIntensity: 0.0
        });
        applyMoonPhotometricShader(material);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        this.mesh.frustumCulled = false;
        this.mesh.rotateX(Math.PI / 2);
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
        const texture = this.texture;
        const displacementMap = this.displacementMap;
        const normalMap = this.normalMap;
        const generatedNormalMap = this.generatedNormalMap;
        this.texture = null;
        this.displacementMap = null;
        this.normalMap = null;
        this.generatedNormalMap = null;

        texture?.dispose?.();
        displacementMap?.dispose?.();
        if (normalMap && normalMap !== displacementMap && normalMap !== generatedNormalMap) {
            normalMap.dispose();
        }
        if (generatedNormalMap && generatedNormalMap !== normalMap) {
            generatedNormalMap.dispose();
        }
    }
}
