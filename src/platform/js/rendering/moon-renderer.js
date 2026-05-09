// @ts-nocheck

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
import { buildMoonNormalMapFromHeightTexture } from "./moon-normal-map.js";

const MOON_GEOMETRY_WIDTH_SEGMENTS = 512;
const MOON_GEOMETRY_HEIGHT_SEGMENTS = 512;
const DEFAULT_MOON_RENDER_SETTINGS = Object.freeze({
    normalMapMaxWidth: 5760,
    normalMapStrength: 2.4,
    normalDetailBoost: 2.5,
    normalDetailRadius: 3,
    normalScale: 1.55,
    displacementScale: 0.0128,
    displacementBias: -0.0048,
    roughness: 0.955,
    metalness: 0.0,
    lommelSeeligerBlend: 0.20,
    lsClampMin: 0.74,
    lsClampMax: 1.14,
    oppositionStrength: 0.0023,
    shadowLift: 0.0,
    highlightBoost: 1.6,
    shadowWeightExponent: 1.92,
    highlightWeightExponent: 0.7,
    terminatorContrast: 2.1,
    terminatorReliefStrength: 7.5,
    terminatorShadowFloor: 0.0,
    terminatorIndirectOcclusion: 1.0,
    terrainShadowStrength: 2.2,
    terrainShadowTexelStride: 7.0,
    terrainShadowSlopeBias: 0.0014,
    shadowNormalBias: 0.00018,
    shadowBias: -0.000003,
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
    const displacementWidth = Number(displacementImage?.width);
    const displacementHeight = Number(displacementImage?.height);
    const heightTexelSize = new THREE.Vector2(
        1 / Math.max(1, Number.isFinite(displacementWidth) ? displacementWidth : normalized.normalMapMaxWidth),
        1 / Math.max(1, Number.isFinite(displacementHeight) ? displacementHeight : Math.round(normalized.normalMapMaxWidth / 2)),
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
    material.userData.moonTerrainShadowStrength = material.displacementMap
        ? normalized.terrainShadowStrength
        : 0.0;
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
    material.userData = material.userData || {};
    if (!Number.isFinite(material.userData.moonLsBlend)) {
        material.userData.moonLsBlend = DEFAULT_MOON_RENDER_SETTINGS.lommelSeeligerBlend;
    }
    if (!Number.isFinite(material.userData.moonOppositionStrength)) {
        material.userData.moonOppositionStrength = DEFAULT_MOON_RENDER_SETTINGS.oppositionStrength;
    }
    if (!Number.isFinite(material.userData.moonLsClampMin)) {
        material.userData.moonLsClampMin = DEFAULT_MOON_RENDER_SETTINGS.lsClampMin;
    }
    if (!Number.isFinite(material.userData.moonLsClampMax)) {
        material.userData.moonLsClampMax = DEFAULT_MOON_RENDER_SETTINGS.lsClampMax;
    }
    if (!Number.isFinite(material.userData.moonShadowLift)) {
        material.userData.moonShadowLift = DEFAULT_MOON_RENDER_SETTINGS.shadowLift;
    }
    if (!Number.isFinite(material.userData.moonHighlightBoost)) {
        material.userData.moonHighlightBoost = DEFAULT_MOON_RENDER_SETTINGS.highlightBoost;
    }
    if (!Number.isFinite(material.userData.moonShadowWeightExponent)) {
        material.userData.moonShadowWeightExponent = DEFAULT_MOON_RENDER_SETTINGS.shadowWeightExponent;
    }
    if (!Number.isFinite(material.userData.moonHighlightWeightExponent)) {
        material.userData.moonHighlightWeightExponent = DEFAULT_MOON_RENDER_SETTINGS.highlightWeightExponent;
    }
    if (!Number.isFinite(material.userData.moonTerminatorContrast)) {
        material.userData.moonTerminatorContrast = DEFAULT_MOON_RENDER_SETTINGS.terminatorContrast;
    }
    if (!Number.isFinite(material.userData.moonTerminatorReliefStrength)) {
        material.userData.moonTerminatorReliefStrength = DEFAULT_MOON_RENDER_SETTINGS.terminatorReliefStrength;
    }
    if (!Number.isFinite(material.userData.moonTerminatorShadowFloor)) {
        material.userData.moonTerminatorShadowFloor = DEFAULT_MOON_RENDER_SETTINGS.terminatorShadowFloor;
    }
    if (!Number.isFinite(material.userData.moonTerminatorIndirectOcclusion)) {
        material.userData.moonTerminatorIndirectOcclusion = DEFAULT_MOON_RENDER_SETTINGS.terminatorIndirectOcclusion;
    }
    if (!Number.isFinite(material.userData.moonTerrainShadowStrength)) {
        material.userData.moonTerrainShadowStrength = DEFAULT_MOON_RENDER_SETTINGS.terrainShadowStrength;
    }
    if (!Number.isFinite(material.userData.moonTerrainShadowTexelStride)) {
        material.userData.moonTerrainShadowTexelStride = DEFAULT_MOON_RENDER_SETTINGS.terrainShadowTexelStride;
    }
    if (!Number.isFinite(material.userData.moonTerrainShadowSlopeBias)) {
        material.userData.moonTerrainShadowSlopeBias = DEFAULT_MOON_RENDER_SETTINGS.terrainShadowSlopeBias;
    }
    if (!material.userData.moonHeightTexelSize) {
        material.userData.moonHeightTexelSize = new THREE.Vector2(
            1 / DEFAULT_MOON_RENDER_SETTINGS.normalMapMaxWidth,
            2 / DEFAULT_MOON_RENDER_SETTINGS.normalMapMaxWidth,
        );
    }

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
uniform float uMoonTerrainShadowSlopeBias;`,
            )
            .replace(
                "#include <lights_fragment_begin>",
                `#include <lights_fragment_begin>
float moonShadowWeight = 1.0;
float moonFinalCavityDarken = 0.0;
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
    moonLsScale = clamp( moonLsScale, min(uMoonLsClampMin, uMoonLsClampMax), max(uMoonLsClampMin, uMoonLsClampMax) );
    reflectedLight.directDiffuse *= mix( 1.0, moonLsScale, uMoonLsBlend );

    float moonPhaseAlignment = clamp( dot( moonLightDir, moonViewDir ), 0.0, 1.0 );
    float moonOpposition = pow( moonPhaseAlignment, 18.0 ) * uMoonOppositionStrength;
    diffuseColor.rgb *= ( 1.0 + moonOpposition );

    // Sharpen the grazing-light transition so terminator relief reads from the
    // perturbed lunar normals rather than looking softly airbrushed.
    float moonTerminatorScale = pow( max( moonNdotL, 1e-4 ), max( 1.0, uMoonTerminatorContrast ) - 1.0 );
    reflectedLight.directDiffuse *= moonTerminatorScale;

    float moonSmoothNdotL = clamp( dot( normalize( nonPerturbedNormal ), moonLightDir ), 0.0, 1.0 );
    float moonTerminatorReliefBoost = max( 0.0, uMoonTerminatorContrast - 1.0 ) * max( 0.0, uMoonTerminatorReliefStrength );
    float moonReliefBandT = clamp( ( uMoonTerminatorReliefStrength - 1.0 ) / 6.5, 0.0, 1.0 );
    float moonTerminatorOuter = mix( 0.42, 0.28, moonReliefBandT );
    float moonTerminatorBand = 1.0 - smoothstep( 0.06, moonTerminatorOuter, moonNdotL );
    float moonTerrainReliefBand = 1.0 - smoothstep( 0.025, max( moonTerminatorOuter, 0.20 ), moonSmoothNdotL );
    moonShadowWeight = pow( 1.0 - moonNdotL, max(0.2, uMoonShadowWeightExponent) );
    float moonHighlightWeight = pow( moonNdotL, max(0.2, uMoonHighlightWeightExponent) );
    float moonShadowCrush = mix( 0.18, 0.24, moonReliefBandT ) * moonTerminatorReliefBoost * moonTerminatorBand;
    float moonHighlightLift = mix( 0.04, 0.055, moonReliefBandT ) * moonTerminatorReliefBoost * moonTerminatorBand;
    float moonShadowTarget = max( clamp( uMoonTerminatorShadowFloor, 0.0, 1.0 ), 1.0 + uMoonShadowLift - moonShadowCrush );
    float moonHighlightTarget = uMoonHighlightBoost + moonHighlightLift;
    float moonShadowTone = mix( 1.0, moonShadowTarget, moonShadowWeight );
    float moonHighlightTone = mix( 1.0, moonHighlightTarget, moonHighlightWeight );
    vec3 moonToneMultiplier = vec3( moonShadowTone * moonHighlightTone );
    reflectedLight.directDiffuse *= moonToneMultiplier;

    float moonLocalReliefDelta = moonNdotL - moonSmoothNdotL;
    float moonLocalReliefTone = 1.0 + moonTerrainReliefBand
        * uMoonTerrainShadowStrength
        * clamp( moonLocalReliefDelta * 3.6, -0.34, 0.0 );
    reflectedLight.directDiffuse *= clamp( moonLocalReliefTone, 0.48, 1.0 );

#if defined( USE_DISPLACEMENTMAP ) || defined( USE_NORMALMAP )
    #if defined( USE_DISPLACEMENTMAP )
        vec2 moonHeightUv = vDisplacementMapUv;
    #else
        vec2 moonHeightUv = vNormalMapUv;
    #endif
    vec2 moonCavityStep = uMoonHeightTexelSize * max( 1.0, uMoonTerrainShadowTexelStride * 1.6 );
    float moonCenterHeight = texture2D( uMoonHeightMap, moonHeightUv ).r;
    float moonAxisHeightAverage = (
        texture2D( uMoonHeightMap, moonHeightUv + vec2( moonCavityStep.x, 0.0 ) ).r +
        texture2D( uMoonHeightMap, moonHeightUv - vec2( moonCavityStep.x, 0.0 ) ).r +
        texture2D( uMoonHeightMap, moonHeightUv + vec2( 0.0, moonCavityStep.y ) ).r +
        texture2D( uMoonHeightMap, moonHeightUv - vec2( 0.0, moonCavityStep.y ) ).r
    ) * 0.25;
    float moonDiagonalHeightAverage = (
        texture2D( uMoonHeightMap, moonHeightUv + moonCavityStep ).r +
        texture2D( uMoonHeightMap, moonHeightUv - moonCavityStep ).r +
        texture2D( uMoonHeightMap, moonHeightUv + vec2( moonCavityStep.x, -moonCavityStep.y ) ).r +
        texture2D( uMoonHeightMap, moonHeightUv + vec2( -moonCavityStep.x, moonCavityStep.y ) ).r
    ) * 0.25;
    float moonNeighborHeightAverage = mix( moonAxisHeightAverage, moonDiagonalHeightAverage, 0.45 );
    float moonCavityBand = smoothstep( 0.018, 0.10, moonSmoothNdotL )
        * ( 1.0 - smoothstep( 0.24, 0.42, moonSmoothNdotL ) );
    float moonTerrainCavity = max( 0.0, moonNeighborHeightAverage - moonCenterHeight );
    // Threshold above the LDEM noise floor (~0.0005 normalized) so micro-bumps
    // don't read as shadows. Real crater bowls show up above 0.0015.
    float moonCavityOcclusion = smoothstep( 0.0015, 0.0085, moonTerrainCavity )
        * moonCavityBand
        * uMoonTerrainShadowStrength;
    // Soft basin shading only — the sun-direction-aware march carries the drama.
    float moonCavityDarken = clamp( moonCavityOcclusion * 0.10, 0.0, 0.18 );
    moonFinalCavityDarken = moonCavityDarken;
    reflectedLight.directDiffuse *= 1.0 - moonCavityDarken;
    reflectedLight.indirectDiffuse *= 1.0 - moonCavityDarken * 0.50;
#endif

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
        float moonSlopeAllowance = max( moonLightTangent.z, 0.025 ) * max( 0.0, uMoonTerrainShadowSlopeBias );
        float moonHorizonRise = 0.0;
        for ( int moonSampleIndex = 1; moonSampleIndex <= 8; moonSampleIndex += 1 ) {
            float moonSampleDistance = float( moonSampleIndex );
            float moonSampleHeight = texture2D( uMoonHeightMap, moonHeightUv + moonLightUvStep * moonSampleDistance ).r;
            moonHorizonRise = max(
                moonHorizonRise,
                moonSampleHeight - moonBaseHeight - moonSlopeAllowance * moonSampleDistance
            );
        }
        // Catch small crater rims (down to ~0.5 km on the 1737 km moon, ~0.0003
        // normalized) — but the terminator-only band below kills any false
        // triggering by surface noise on the lit side.
        moonTerrainSelfShadow = smoothstep( 0.00015, 0.0014, moonHorizonRise );
    }
    // Confine the self-shadow strictly to the terminator-adjacent band:
    // moonTerrainReliefBand = 1 at terminator, 0 by NdotL > 0.20, so noise on
    // the lit side cannot produce phantom shadows. Inside the band, give it more
    // headroom (pow 1.4 vs 2.0) so cast-shadow plumes extend visibly inward.
    float moonTerrainShadowBand = moonTerrainReliefBand
        * pow( 1.0 - moonSmoothNdotL, 1.4 );
    float moonTerrainShadow = clamp(
        moonTerrainSelfShadow * moonTerrainShadowBand * uMoonTerrainShadowStrength,
        0.0,
        0.78
    );
    reflectedLight.directDiffuse *= 1.0 - moonTerrainShadow;
#endif
#endif
    reflectedLight.indirectDiffuse += diffuseColor.rgb * ( uMoonShadowLift * moonShadowWeight * 0.72 );`,
            )
            .replace(
                "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
                `vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
#if NUM_DIR_LIGHTS > 0
    float moonFinalTerrainTone = clamp( 1.0 - moonFinalCavityDarken * 0.40, 0.55, 1.0 );
    // Dial the bottom of the dark-side crush WAY back from 0.035 to 0.55 so the
    // Moon Ambient lift (uMoonShadowLift / indirectDiffuse) can fill the dark side
    // as a true ambient instead of getting slammed to ~black; the previous value
    // also crushed the terminator-aware ambient so it read as a directional band.
    float moonFinalShadowCrush = mix( 0.55, 1.0, smoothstep( 0.045, 0.48, moonSmoothNdotL ) );
    outgoingLight *= moonFinalTerrainTone * moonFinalShadowCrush;
#endif`,
            )
            .replace(
                "#include <lights_fragment_end>",
                `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
    vec3 moonOcclusionNormal = normalize( geometryNormal );
    vec3 moonOcclusionLightDir = normalize( directionalLights[0].direction );
    float moonOcclusionNdotL = clamp( dot( moonOcclusionNormal, moonOcclusionLightDir ), 0.0, 1.0 );
    float moonOcclusionBand = 1.0 - smoothstep( 0.08, 0.42, moonOcclusionNdotL );
    float moonOcclusionWeight = pow( 1.0 - moonOcclusionNdotL, max(0.2, uMoonShadowWeightExponent) ) * moonOcclusionBand;
    float moonIndirectOcclusion = 1.0 - clamp( uMoonTerminatorIndirectOcclusion, 0.0, 1.0 ) * moonOcclusionWeight;
    reflectedLight.indirectDiffuse *= moonIndirectOcclusion;
#endif`,
            );
    };

    material.customProgramCacheKey = () => {
        const data = material.userData || {};
        return [
            "moon-photometric-v14",
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
        if (!shader?.uniforms) {
            return;
        }
        const lsBlend = Number(material.userData.moonLsBlend);
        const opposition = Number(material.userData.moonOppositionStrength);
        const lsClampMin = Number(material.userData.moonLsClampMin);
        const lsClampMax = Number(material.userData.moonLsClampMax);
        const shadowLift = Number(material.userData.moonShadowLift);
        const highlightBoost = Number(material.userData.moonHighlightBoost);
        const shadowWeightExponent = Number(material.userData.moonShadowWeightExponent);
        const highlightWeightExponent = Number(material.userData.moonHighlightWeightExponent);
        const terminatorContrast = Number(material.userData.moonTerminatorContrast);
        const terminatorReliefStrength = Number(material.userData.moonTerminatorReliefStrength);
        const terminatorShadowFloor = Number(material.userData.moonTerminatorShadowFloor);
        const terminatorIndirectOcclusion = Number(material.userData.moonTerminatorIndirectOcclusion);
        const terrainShadowStrength = material.displacementMap
            ? Number(material.userData.moonTerrainShadowStrength)
            : 0.0;
        const terrainShadowTexelStride = Number(material.userData.moonTerrainShadowTexelStride);
        const terrainShadowSlopeBias = Number(material.userData.moonTerrainShadowSlopeBias);
        if (Number.isFinite(lsBlend) && shader.uniforms.uMoonLsBlend) {
            shader.uniforms.uMoonLsBlend.value = lsBlend;
        }
        if (Number.isFinite(opposition) && shader.uniforms.uMoonOppositionStrength) {
            shader.uniforms.uMoonOppositionStrength.value = opposition;
        }
        if (Number.isFinite(lsClampMin) && shader.uniforms.uMoonLsClampMin) {
            shader.uniforms.uMoonLsClampMin.value = lsClampMin;
        }
        if (Number.isFinite(lsClampMax) && shader.uniforms.uMoonLsClampMax) {
            shader.uniforms.uMoonLsClampMax.value = lsClampMax;
        }
        if (Number.isFinite(shadowLift) && shader.uniforms.uMoonShadowLift) {
            shader.uniforms.uMoonShadowLift.value = shadowLift;
        }
        if (Number.isFinite(highlightBoost) && shader.uniforms.uMoonHighlightBoost) {
            shader.uniforms.uMoonHighlightBoost.value = highlightBoost;
        }
        if (Number.isFinite(shadowWeightExponent) && shader.uniforms.uMoonShadowWeightExponent) {
            shader.uniforms.uMoonShadowWeightExponent.value = shadowWeightExponent;
        }
        if (Number.isFinite(highlightWeightExponent) && shader.uniforms.uMoonHighlightWeightExponent) {
            shader.uniforms.uMoonHighlightWeightExponent.value = highlightWeightExponent;
        }
        if (Number.isFinite(terminatorContrast) && shader.uniforms.uMoonTerminatorContrast) {
            shader.uniforms.uMoonTerminatorContrast.value = terminatorContrast;
        }
        if (Number.isFinite(terminatorReliefStrength) && shader.uniforms.uMoonTerminatorReliefStrength) {
            shader.uniforms.uMoonTerminatorReliefStrength.value = terminatorReliefStrength;
        }
        if (Number.isFinite(terminatorShadowFloor) && shader.uniforms.uMoonTerminatorShadowFloor) {
            shader.uniforms.uMoonTerminatorShadowFloor.value = terminatorShadowFloor;
        }
        if (Number.isFinite(terminatorIndirectOcclusion) && shader.uniforms.uMoonTerminatorIndirectOcclusion) {
            shader.uniforms.uMoonTerminatorIndirectOcclusion.value = terminatorIndirectOcclusion;
        }
        if (shader.uniforms.uMoonHeightMap) {
            shader.uniforms.uMoonHeightMap.value = material.displacementMap || null;
        }
        if (shader.uniforms.uMoonHeightTexelSize && material.userData.moonHeightTexelSize) {
            shader.uniforms.uMoonHeightTexelSize.value.copy?.(material.userData.moonHeightTexelSize);
        }
        if (Number.isFinite(terrainShadowStrength) && shader.uniforms.uMoonTerrainShadowStrength) {
            shader.uniforms.uMoonTerrainShadowStrength.value = terrainShadowStrength;
        }
        if (Number.isFinite(terrainShadowTexelStride) && shader.uniforms.uMoonTerrainShadowTexelStride) {
            shader.uniforms.uMoonTerrainShadowTexelStride.value = terrainShadowTexelStride;
        }
        if (Number.isFinite(terrainShadowSlopeBias) && shader.uniforms.uMoonTerrainShadowSlopeBias) {
            shader.uniforms.uMoonTerrainShadowSlopeBias.value = terrainShadowSlopeBias;
        }
    };
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

        if (
            disposePrevious &&
            previousGeneratedNormalMap &&
            previousGeneratedNormalMap !== this.generatedNormalMap &&
            previousGeneratedNormalMap !== this.normalMap &&
            previousGeneratedNormalMap !== this.displacementMap &&
            previousGeneratedNormalMap !== this.texture
        ) {
            previousGeneratedNormalMap.dispose?.();
        }

        return this.normalMap || this.generatedNormalMap || null;
    }

    _applyRenderSettingsToMaterial() {
        const material = this.mesh?.material;
        if (!material) {
            return;
        }

        applyMoonRenderSettingsToMaterial(material, this.renderSettings);
        material.needsUpdate = true;
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

    setRenderSettings(renderSettings = null) {
        this.renderSettings = normalizeMoonRenderSettings(renderSettings);
        const resolvedNormalMap = this._refreshGeneratedNormalMap({ disposePrevious: true });
        const material = this.mesh?.material;
        if (!material) {
            return;
        }

        material.normalMap = resolvedNormalMap;
        material.bumpMap = resolvedNormalMap ? null : (this.displacementMap || null);
        material.bumpScale = resolvedNormalMap ? 0.0 : 0.0045;
        this._applyRenderSettingsToMaterial();
    }

    /**
     * Update Moon textures after creation.
     * @param {THREE.Texture} texture
     * @param {THREE.Texture} displacementMap
     * @param {THREE.Texture|null} normalMap
     * @param {{ disposePrevious?: boolean }} options
     */
    updateTextures(
        texture,
        displacementMap,
        normalMap = null,
        { disposePrevious = true, renderSettings = null, deferGeneratedNormalMap = false } = {},
    ) {
        const previousTexture = this.texture;
        const previousDisplacementMap = this.displacementMap;
        const previousNormalMap = this.normalMap;
        const previousGeneratedNormalMap = this.generatedNormalMap;

        if (renderSettings) {
            this.renderSettings = normalizeMoonRenderSettings(renderSettings);
        }

        this.texture = texture;
        this.displacementMap = displacementMap;
        this.normalMap = normalMap;

        const resolvedNormalMap = deferGeneratedNormalMap
            ? (this.normalMap || null)
            : this._refreshGeneratedNormalMap({ disposePrevious: false });

        const material = this.mesh?.material;
        if (material) {
            material.map = this.texture || null;
            material.displacementMap = this.displacementMap || null;
            material.normalMap = resolvedNormalMap;
            material.bumpMap = resolvedNormalMap ? null : (this.displacementMap || null);
            material.bumpScale = resolvedNormalMap ? 0.0 : 0.0045;
            this._applyRenderSettingsToMaterial();
        }

        if (disposePrevious) {
            if (previousTexture && previousTexture !== this.texture) {
                previousTexture.dispose?.();
            }
            if (
                previousDisplacementMap &&
                previousDisplacementMap !== this.displacementMap &&
                previousDisplacementMap !== this.texture
            ) {
                previousDisplacementMap.dispose?.();
            }
            if (
                previousNormalMap &&
                previousNormalMap !== this.normalMap &&
                previousNormalMap !== this.displacementMap &&
                previousNormalMap !== this.texture &&
                previousNormalMap !== this.generatedNormalMap
            ) {
                previousNormalMap.dispose?.();
            }
            if (
                previousGeneratedNormalMap &&
                previousGeneratedNormalMap !== this.generatedNormalMap &&
                previousGeneratedNormalMap !== this.normalMap &&
                previousGeneratedNormalMap !== this.displacementMap &&
                previousGeneratedNormalMap !== this.texture
            ) {
                previousGeneratedNormalMap.dispose?.();
            }
        }
    }

    refreshGeneratedNormalMap({ disposePrevious = true } = {}) {
        const resolvedNormalMap = this._refreshGeneratedNormalMap({ disposePrevious });
        const material = this.mesh?.material;
        if (!material) {
            return resolvedNormalMap;
        }
        material.normalMap = resolvedNormalMap;
        material.bumpMap = resolvedNormalMap ? null : (this.displacementMap || null);
        material.bumpScale = resolvedNormalMap ? 0.0 : 0.0045;
        this._applyRenderSettingsToMaterial();
        return resolvedNormalMap;
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
            this.generatedNormalMap = buildMoonNormalMapFromHeightTexture(this.displacementMap, this.renderSettings);
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
            displacementScale: this.renderSettings.displacementScale,
            displacementBias: this.renderSettings.displacementBias,
            normalMap: resolvedNormalMap,
            normalScale: new THREE.Vector2(this.renderSettings.normalScale, this.renderSettings.normalScale),
            roughness: this.renderSettings.roughness,
            metalness: this.renderSettings.metalness,
            emissive: 0x000000,
            emissiveIntensity: 0.0
        });
        applyMoonRenderSettingsToMaterial(material, this.renderSettings);
        applyMoonPhotometricShader(material);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.onBeforeRender = () => {
            material.userData?.refreshMoonShaderUniforms?.();
        };
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
