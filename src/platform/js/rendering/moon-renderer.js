// @ts-nocheck

/**
 * Moon Renderer - Moon sphere with texture, displacement, axis, and poles
 */

import * as THREE from 'three';
import { COLORS as COL, PHYSICS_CONSTANTS as PC } from '../core/constants.js';
import { lunar_pole } from '../astro.js';
import { buildMoonNormalMapFromHeightTexture } from "./moon-normal-map.js";

const MOON_GEOMETRY_WIDTH_SEGMENTS = 512;
const MOON_GEOMETRY_HEIGHT_SEGMENTS = 512;
const DEFAULT_MOON_RENDER_SETTINGS = Object.freeze({
    normalMapMaxWidth: 5760,
    normalMapStrength: 2.4,
    normalDetailBoost: 2.0,
    normalDetailRadius: 4,
    normalScale: 2.2,
    displacementScale: 0.013,
    displacementBias: -0.0048,
    roughness: 0.955,
    metalness: 0.0,
    lommelSeeligerBlend: 0.15,
    lsClampMin: 0.74,
    lsClampMax: 1.0,
    oppositionStrength: 0.002,
    shadowLift: 0.0,
    highlightBoost: 1.15,
    shadowWeightExponent: 2.0,
    highlightWeightExponent: 1.2,
    terminatorContrast: 1.5,
    terminatorReliefStrength: 5.0,
    terminatorShadowFloor: 0.0,
    terminatorIndirectOcclusion: 1.0,
    terrainShadowStrength: 2.5,
    terrainShadowTexelStride: 6.0,
    terrainShadowSlopeBias: 0.0008,
    shadowNormalBias: 0.004,
    shadowBias: -0.00002,
});

function normalizeMoonRenderSettings(renderSettings = null) {
    if (!renderSettings || typeof renderSettings !== "object") {
        return { ...DEFAULT_MOON_RENDER_SETTINGS };
    }

    const normalized = {};
    Object.entries(DEFAULT_MOON_RENDER_SETTINGS).forEach(([key, fallbackValue]) => {
        const candidateValue = Number(renderSettings[key]);
        normalized[key] = Number.isFinite(candidateValue) ? candidateValue : fallbackValue;
    });
    return normalized;
}

function applyMoonRenderSettingsToMaterial(material, renderSettings = DEFAULT_MOON_RENDER_SETTINGS) {
    const normalized = normalizeMoonRenderSettings(renderSettings);
    const displacementImage = material.displacementMap?.image;
    const heightTexelSize = new THREE.Vector2(
        1 / Math.max(1, displacementImage?.width || normalized.normalMapMaxWidth),
        1 / Math.max(1, displacementImage?.height || Math.round(normalized.normalMapMaxWidth / 2)),
    );
    material.userData = material.userData || {};
    material.userData.moonLsBlend = normalized.lommelSeeligerBlend;
    material.userData.moonOppositionStrength = normalized.oppositionStrength;
    material.userData.moonLsClampMin = normalized.lsClampMin;
    material.userData.moonLsClampMax = normalized.lsClampMax;
    material.userData.moonShadowLift = normalized.shadowLift;
    material.userData.moonHighlightBoost = normalized.highlightBoost;
    material.userData.moonShadowWeightExponent = normalized.shadowWeightExponent;
    material.userData.moonHighlightWeightExponent = normalized.highlightWeightExponent;
    material.userData.moonTerminatorContrast = normalized.terminatorContrast;
    material.userData.moonTerminatorReliefStrength = normalized.terminatorReliefStrength;
    material.userData.moonTerminatorShadowFloor = normalized.terminatorShadowFloor;
    material.userData.moonTerminatorIndirectOcclusion = normalized.terminatorIndirectOcclusion;
    material.userData.moonTerrainShadowStrength = material.displacementMap ? normalized.terrainShadowStrength : 0.0;
    material.userData.moonTerrainShadowTexelStride = normalized.terrainShadowTexelStride;
    material.userData.moonTerrainShadowSlopeBias = normalized.terrainShadowSlopeBias;
    material.userData.moonHeightTexelSize = heightTexelSize;

    material.displacementScale = normalized.displacementScale;
    material.displacementBias = normalized.displacementBias;
    material.roughness = normalized.roughness;
    material.metalness = normalized.metalness;
    material.normalScale?.set?.(normalized.normalScale, normalized.normalScale);
}

function applyMoonPhotometricShader(material) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uMoonLsBlend = { value: material.userData.moonLsBlend };
        shader.uniforms.uMoonOppositionStrength = { value: material.userData.moonOppositionStrength };
        shader.uniforms.uMoonLsClampMin = { value: material.userData.moonLsClampMin };
        shader.uniforms.uMoonLsClampMax = { value: material.userData.moonLsClampMax };
        shader.uniforms.uMoonShadowLift = { value: material.userData.moonShadowLift };
        shader.uniforms.uMoonHighlightBoost = { value: material.userData.moonHighlightBoost };
        shader.uniforms.uMoonShadowWeightExponent = { value: material.userData.moonShadowWeightExponent };
        shader.uniforms.uMoonHighlightWeightExponent = { value: material.userData.moonHighlightWeightExponent };
        shader.uniforms.uMoonTerminatorContrast = { value: material.userData.moonTerminatorContrast };
        shader.uniforms.uMoonTerminatorReliefStrength = { value: material.userData.moonTerminatorReliefStrength };
        shader.uniforms.uMoonTerminatorShadowFloor = { value: material.userData.moonTerminatorShadowFloor };
        shader.uniforms.uMoonTerminatorIndirectOcclusion = { value: material.userData.moonTerminatorIndirectOcclusion };
        shader.uniforms.uMoonHeightMap = { value: material.displacementMap || null };
        shader.uniforms.uMoonHeightTexelSize = { value: material.userData.moonHeightTexelSize };
        shader.uniforms.uMoonTerrainShadowStrength = { value: material.userData.moonTerrainShadowStrength };
        shader.uniforms.uMoonTerrainShadowTexelStride = { value: material.userData.moonTerrainShadowTexelStride };
        shader.uniforms.uMoonTerrainShadowSlopeBias = { value: material.userData.moonTerrainShadowSlopeBias };
        material.userData.moonPhotometricShader = shader;

        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
uniform float uMoonLsBlend;
uniform float uMoonOppositionStrength;
uniform float uMoonLsClampMin;
uniform float uMoonLsClampMax;
uniform float uMoonShadowLift;
uniform float uMoonHighlightBoost;
uniform float uMoonShadowWeightExponent;
uniform float uMoonHighlightWeightExponent;
uniform float uMoonTerminatorContrast;
uniform float uMoonTerminatorReliefStrength;
uniform float uMoonTerminatorShadowFloor;
uniform float uMoonTerminatorIndirectOcclusion;
uniform sampler2D uMoonHeightMap;
uniform vec2 uMoonHeightTexelSize;
uniform float uMoonTerrainShadowStrength;
uniform float uMoonTerrainShadowTexelStride;
uniform float uMoonTerrainShadowSlopeBias;

const float MOON_SUN_SIN_ALPHA = 0.00466;
const float MOON_INV_PI        = 0.31830988618;

float moonSunDiskVisibleFraction(float rawNdotL) {
    float h = rawNdotL / MOON_SUN_SIN_ALPHA;
    if (h >=  1.0) return 1.0;
    if (h <= -1.0) return 0.0;
    return MOON_INV_PI * (acos(-h) + h * sqrt(max(1.0 - h * h, 0.0)));
}`,
            )
            .replace(
                "#include <lights_fragment_begin>",
                `#include <lights_fragment_begin>
float moonFinalCavityDarken = 0.0;
vec3 moonEarthshineDirectKept = vec3( 0.0 );
#if NUM_DIR_LIGHTS > 0
    vec3 moonNormal = normalize( geometryNormal );
    vec3 moonViewDir = normalize( geometryViewDir );
    vec3 moonLightDir = normalize( directionalLights[0].direction );
    float moonNdotL = clamp( dot( moonNormal, moonLightDir ), 0.0, 1.0 );
    float moonNdotV = clamp( dot( moonNormal, moonViewDir ), 0.0, 1.0 );

    float moonSunShadowFactor = 1.0;
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
        moonSunShadowFactor = receiveShadow ? getShadow(
            directionalShadowMap[ 0 ],
            directionalLightShadows[ 0 ].shadowMapSize,
            directionalLightShadows[ 0 ].shadowIntensity,
            directionalLightShadows[ 0 ].shadowBias,
            directionalLightShadows[ 0 ].shadowRadius,
            vDirectionalShadowCoord[ 0 ]
        ) : 1.0;
    #endif

    float moonSmoothRawNdotL = dot( normalize( nonPerturbedNormal ), moonLightDir );
    float moonTerrainHorizonLift = 0.0;
#if defined( USE_DISPLACEMENTMAP ) || defined( USE_NORMALMAP )
    #if defined( USE_DISPLACEMENTMAP )
        vec2 moonHeightUv = vDisplacementMapUv;
    #else
        vec2 moonHeightUv = vNormalMapUv;
    #endif
    float moonCenterHeight = texture2D( uMoonHeightMap, moonHeightUv ).r;
    moonTerrainHorizonLift = clamp( moonCenterHeight * 0.15, 0.0, 0.15 );
#endif

    // Soft physical visibility based on smooth normal + altitude.
    float moonEffectiveRawNdotL = moonSmoothRawNdotL + moonTerrainHorizonLift;
    float moonSunVisibility = moonSunDiskVisibleFraction( moonEffectiveRawNdotL );
    
    // Decouple limb-glow from point-source shadow map for well-lit specks.
    float moonLimbGlowFactor = smoothstep( -MOON_SUN_SIN_ALPHA, MOON_SUN_SIN_ALPHA, moonEffectiveRawNdotL );
    float moonSoftShadowFactor = mix( moonSunShadowFactor, 1.0, moonLimbGlowFactor * 0.45 );

    // Isolate Earthshine and apply soft shadows to Sun light.
    vec3 moonNaiveSunBase = moonNdotL * directionalLights[0].color * moonSunShadowFactor * RECIPROCAL_PI * material.diffuseColor;
    moonEarthshineDirectKept = max( reflectedLight.directDiffuse - moonNaiveSunBase, vec3(0.0) );
    
    reflectedLight.directDiffuse = (reflectedLight.directDiffuse - moonEarthshineDirectKept) * moonSunVisibility * moonSoftShadowFactor;

    float moonLsScale = 1.0;
    if ( moonNdotL > 1e-4 ) {
        float moonLs = moonNdotL / max( moonNdotL + moonNdotV, 1e-4 );
        moonLsScale = moonLs / moonNdotL;
    } else {
        moonLsScale = 0.0;
    }
    moonLsScale = clamp( moonLsScale, min(uMoonLsClampMin, uMoonLsClampMax), max(uMoonLsClampMin, uMoonLsClampMax) );
    reflectedLight.directDiffuse *= mix( 1.0, moonLsScale, uMoonLsBlend );

    float moonPhaseAlignment = clamp( dot( moonLightDir, moonViewDir ), 0.0, 1.0 );
    float moonOpposition = pow( moonPhaseAlignment, 18.0 ) * uMoonOppositionStrength;
    diffuseColor.rgb *= ( 1.0 + moonOpposition );

#if defined( USE_NORMALMAP_TANGENTSPACE )
    vec3 moonLightTangent = vec3(
        dot( moonLightDir, tbn[0] ),
        dot( moonLightDir, tbn[1] ),
        dot( moonLightDir, tbn[2] )
    );
    float moonLightTangentPlanarLength = length( moonLightTangent.xy );
    float moonTerrainSelfShadow = 0.0;
    if ( uMoonTerrainShadowStrength > 0.0 && moonLightTangentPlanarLength > 1e-4 && moonLightTangent.z > 0.0 ) {
        vec2 moonLightUvStep = ( moonLightTangent.xy / moonLightTangentPlanarLength )
            * uMoonHeightTexelSize
            * max( 0.5, uMoonTerrainShadowTexelStride );
        float moonBaseHeight = texture2D( uMoonHeightMap, moonHeightUv ).r;
        float moonSunSlope = max( moonLightTangent.z, 0.0 ) / max( moonLightTangentPlanarLength, 1e-4 );
        float moonSlopeScale = max( 0.0001, uMoonTerrainShadowSlopeBias );
        float moonHorizonShadow = 0.0;
        for ( int moonSampleIndex = 1; moonSampleIndex <= 24; moonSampleIndex += 1 ) {
            float moonT = float( moonSampleIndex ) / 24.0;
            float moonSampleDistance = moonT * moonT * 32.0 + moonT * 2.0;
            float moonSampleHeight = texture2D( uMoonHeightMap, moonHeightUv + moonLightUvStep * moonSampleDistance ).r;
            float moonRequiredRise = moonSunSlope * moonSlopeScale * moonSampleDistance * 8.0;
            float moonBlockerRise = moonSampleHeight - moonBaseHeight - moonRequiredRise;
            float moonSampleShadow = smoothstep( 0.0006, 0.0035, moonBlockerRise );
            moonHorizonShadow = max( moonHorizonShadow, moonSampleShadow );
        }
        moonTerrainSelfShadow = moonHorizonShadow;
    }
    float moonTerrainShadowBand = ( 1.0 - smoothstep( 0.025, 0.42, moonSmoothRawNdotL ) )
        * pow( 1.0 - moonSmoothRawNdotL, 1.4 );
    float moonTerrainShadow = clamp(
        moonTerrainSelfShadow * moonTerrainShadowBand * uMoonTerrainShadowStrength,
        0.0,
        0.78
    );
    reflectedLight.directDiffuse *= 1.0 - moonTerrainShadow;
#endif
#endif`,
            )
            .replace(
                "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
                `vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
#if NUM_DIR_LIGHTS > 0
    float moonFinalShadowCrush = smoothstep( -MOON_SUN_SIN_ALPHA, 0.025, moonSmoothRawNdotL + moonTerrainHorizonLift );
    outgoingLight *= moonFinalShadowCrush;
    outgoingLight += moonEarthshineDirectKept;
#endif`,
            )
            .replace(
                "#include <lights_fragment_end>",
                `#if NUM_DIR_LIGHTS > 0
    vec3 moonOcclusionNormal = normalize( geometryNormal );
    vec3 moonOcclusionLightDir = normalize( directionalLights[0].direction );
    float moonOcclusionNdotL = clamp( dot( moonOcclusionNormal, moonOcclusionLightDir ), 0.0, 1.0 );
    float moonOcclusionBand = 1.0 - smoothstep( 0.08, 0.42, moonOcclusionNdotL );
    float moonOcclusionWeight = pow( 1.0 - moonOcclusionNdotL, 2.0 ) * moonOcclusionBand;
    float moonIndirectOcclusion = 1.0 - clamp( uMoonTerminatorIndirectOcclusion, 0.0, 1.0 ) * moonOcclusionWeight;
    reflectedLight.indirectDiffuse *= moonIndirectOcclusion;
#endif
#include <lights_fragment_end>`,
            );
    };

    material.customProgramCacheKey = () => {
        const data = material.userData || {};
        return [
            "moon-photometric-v34-precision-final",
            data.moonLsBlend,
            data.moonOppositionStrength,
            data.moonLsClampMin,
            data.moonLsClampMax,
            data.moonShadowLift,
            data.moonHighlightBoost,
            data.moonShadowWeightExponent,
            data.moonHighlightWeightExponent,
            data.moonTerminatorContrast,
            data.moonTerminatorReliefStrength,
            data.moonTerminatorShadowFloor,
            data.moonTerminatorIndirectOcclusion,
            data.moonTerrainShadowStrength,
            data.moonTerrainShadowTexelStride,
            data.moonTerrainShadowSlopeBias,
        ].join("-");
    };

    material.userData.refreshMoonShaderUniforms = () => {
        const shader = material.userData?.moonPhotometricShader;
        if (!shader?.uniforms) return;
        shader.uniforms.uMoonLsBlend.value = material.userData.moonLsBlend;
        shader.uniforms.uMoonOppositionStrength.value = material.userData.moonOppositionStrength;
        shader.uniforms.uMoonLsClampMin.value = material.userData.moonLsClampMin;
        shader.uniforms.uMoonLsClampMax.value = material.userData.moonLsClampMax;
        shader.uniforms.uMoonShadowLift.value = material.userData.moonShadowLift;
        shader.uniforms.uMoonHighlightBoost.value = material.userData.moonHighlightBoost;
        shader.uniforms.uMoonShadowWeightExponent.value = material.userData.moonShadowWeightExponent;
        shader.uniforms.uMoonHighlightWeightExponent.value = material.userData.moonHighlightWeightExponent;
        shader.uniforms.uMoonTerminatorContrast.value = material.userData.moonTerminatorContrast;
        shader.uniforms.uMoonTerminatorReliefStrength.value = material.userData.moonTerminatorReliefStrength;
        shader.uniforms.uMoonTerminatorShadowFloor.value = material.userData.moonTerminatorShadowFloor;
        shader.uniforms.uMoonTerminatorIndirectOcclusion.value = material.userData.moonTerminatorIndirectOcclusion;
        if (shader.uniforms.uMoonHeightMap) shader.uniforms.uMoonHeightMap.value = material.displacementMap || null;
        if (shader.uniforms.uMoonHeightTexelSize && material.userData.moonHeightTexelSize) {
            shader.uniforms.uMoonHeightTexelSize.value.copy(material.userData.moonHeightTexelSize);
        }
        shader.uniforms.uMoonTerrainShadowStrength.value = material.userData.moonTerrainShadowStrength;
        shader.uniforms.uMoonTerrainShadowTexelStride.value = material.userData.moonTerrainShadowTexelStride;
        shader.uniforms.uMoonTerrainShadowSlopeBias.value = material.userData.moonTerrainShadowSlopeBias;
    };
}

export class MoonRenderer {
    constructor(radius) {
        this.radius = radius;
        this.container = null;
        this.mesh = null;
        this.axis = null;
        this.axisVector = null;
        this.northPoleSphere = null;
        this.southPoleSphere = null;
        this.texture = null;
        this.displacementMap = null;
        this.normalMap = null;
        this.generatedNormalMap = null;
        this.renderSettings = { ...DEFAULT_MOON_RENDER_SETTINGS };
    }

    _buildGeneratedNormalMap() {
        return (!this.normalMap && this.displacementMap)
            ? buildMoonNormalMapFromHeightTexture(this.displacementMap, this.renderSettings)
            : null;
    }

    _refreshGeneratedNormalMap({ disposePrevious = true } = {}) {
        const previousGeneratedNormalMap = this.generatedNormalMap;
        this.generatedNormalMap = this._buildGeneratedNormalMap();

        if (disposePrevious && previousGeneratedNormalMap && previousGeneratedNormalMap !== this.generatedNormalMap) {
            previousGeneratedNormalMap.dispose?.();
        }

        return this.normalMap || this.generatedNormalMap || null;
    }

    _applyRenderSettingsToMaterial() {
        const material = this.mesh?.material;
        if (!material) return;
        applyMoonRenderSettingsToMaterial(material, this.renderSettings);
        material.needsUpdate = true;
    }

    setTextures(texture, displacementMap, normalMap = null) {
        this.texture = texture;
        this.displacementMap = displacementMap;
        this.normalMap = normalMap;
    }

    setRenderSettings(renderSettings = null) {
        this.renderSettings = normalizeMoonRenderSettings(renderSettings);
        const material = this.mesh?.material;
        if (!material) return;
        const resolvedNormalMap = this._refreshGeneratedNormalMap({ disposePrevious: true });
        material.normalMap = resolvedNormalMap;
        this._applyRenderSettingsToMaterial();
    }

    updateTextures(texture, displacementMap, normalMap = null, { disposePrevious = true, renderSettings = null } = {}) {
        if (renderSettings) this.renderSettings = normalizeMoonRenderSettings(renderSettings);
        const prevT = this.texture;
        const prevD = this.displacementMap;
        const prevN = this.normalMap;
        const prevG = this.generatedNormalMap;

        this.texture = texture;
        this.displacementMap = displacementMap;
        this.normalMap = normalMap;
        const resolvedN = this._refreshGeneratedNormalMap({ disposePrevious: false });

        const material = this.mesh?.material;
        if (material) {
            material.map = this.texture;
            material.displacementMap = this.displacementMap;
            material.normalMap = resolvedN;
            this._applyRenderSettingsToMaterial();
        }

        if (disposePrevious) {
            if (prevT && prevT !== this.texture) prevT.dispose?.();
            if (prevD && prevD !== this.displacementMap) prevD.dispose?.();
            if (prevN && prevN !== this.normalMap) prevN.dispose?.();
            if (prevG && prevG !== this.generatedNormalMap) prevG.dispose?.();
        }
    }

    refreshGeneratedNormalMap({ disposePrevious = true } = {}) {
        const resolved = this._refreshGeneratedNormalMap({ disposePrevious });
        if (this.mesh?.material) {
            this.mesh.material.normalMap = resolved;
            this._applyRenderSettingsToMaterial();
        }
        return resolved;
    }

    create(axisVisible = false, polesVisible = false, { deferGeneratedNormalMap = false } = {}) {
        this.container = new THREE.Group();
        if (!deferGeneratedNormalMap && !this.normalMap && this.displacementMap) {
            this.generatedNormalMap = buildMoonNormalMapFromHeightTexture(this.displacementMap, this.renderSettings);
        }
        const resolvedNormalMap = this.normalMap || this.generatedNormalMap || null;

        const geometry = new THREE.SphereGeometry(this.radius, MOON_GEOMETRY_WIDTH_SEGMENTS, MOON_GEOMETRY_HEIGHT_SEGMENTS);
        const material = new THREE.MeshStandardMaterial({
            map: this.texture,
            displacementMap: this.displacementMap,
            displacementScale: this.renderSettings.displacementScale,
            displacementBias: this.renderSettings.displacementBias,
            normalMap: resolvedNormalMap,
            normalScale: new THREE.Vector2(this.renderSettings.normalScale, this.renderSettings.normalScale),
            roughness: this.renderSettings.roughness,
            metalness: this.renderSettings.metalness,
        });
        applyMoonRenderSettingsToMaterial(material, this.renderSettings);
        applyMoonPhotometricShader(material);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.onBeforeRender = () => material.userData?.refreshMoonShaderUniforms?.();
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        this.mesh.rotateX(Math.PI / 2);
        this.container.add(this.mesh);

        this._createAxis(axisVisible);
        this._createPoles(polesVisible);
    }

    _createAxis(visible) {
        const geometry = new THREE.BufferGeometry();
        const r = this.radius;
        const vertices = [0, 0, r * 1.5, 0, 0, r * 1.02, 0, 0, -r * 1.02, 0, 0, -r * 1.5];
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this.axis = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: COL.MOON_AXIS, depthWrite: false }));
        this.axis.visible = visible;
        this.axisVector = new THREE.Vector3(0, 0, 1);
    }

    _createPoles(visible) {
        const poleGeometry = new THREE.SphereGeometry(this.radius / 50, 64, 64);
        this.northPoleSphere = new THREE.Mesh(poleGeometry, new THREE.MeshPhysicalMaterial({ color: COL.BLACK, emissive: COL.NORTH_POLE }));
        this.northPoleSphere.position.set(0, 0, 0.985 * this.radius);
        this.northPoleSphere.visible = visible;

        this.southPoleSphere = new THREE.Mesh(poleGeometry, new THREE.MeshPhysicalMaterial({ color: COL.BLACK, emissive: COL.SOUTH_POLE }));
        this.southPoleSphere.position.set(0, 0, -0.985 * this.radius);
        this.southPoleSphere.visible = visible;
    }

    addAxisAndPolesToContainer() {
        if (this.axis) this.container.add(this.axis);
        if (this.northPoleSphere) this.container.add(this.northPoleSphere);
        if (this.southPoleSphere) this.container.add(this.southPoleSphere);
    }

    updateRotation(time) {
        if (!this.container) return;
        const lp = lunar_pole(new Date(time));
        this.container.rotation.set(0, 0, 0);
        this.container.rotateX(-1 * PC.EARTH_AXIS_INCLINATION_RADS);
        this.container.rotateZ(Math.PI / 2 + lp.alpha);
        this.container.rotateX(Math.PI / 2 - lp.delta);
        this.container.rotateZ(lp.W);
    }

    setAxisVisible(v) { if (this.axis) this.axis.visible = v; }
    setPolesVisible(visible) {
        if (this.northPoleSphere) this.northPoleSphere.visible = visible;
        if (this.southPoleSphere) this.southPoleSphere.visible = visible;
    }

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.container.remove(this.mesh);
        }
        if (this.axis) {
            this.axis.geometry.dispose();
            this.axis.material.dispose();
        }
        this.texture?.dispose?.();
        this.displacementMap?.dispose?.();
        this.normalMap?.dispose?.();
        this.generatedNormalMap?.dispose?.();
        this.container?.parent?.remove(this.container);
    }
}
