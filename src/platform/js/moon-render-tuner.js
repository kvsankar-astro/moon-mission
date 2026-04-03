import * as THREE from "three";

const DEFAULTS = {
    normalMapMaxWidth: 4096,
    normalMapStrength: 0.72,
    normalScaleX: 0.58,
    normalScaleY: 0.58,
    displacementScale: 0.0068,
    displacementBias: -0.0038,
    roughness: 0.96,
    metalness: 0.0,
    lommelSeeligerBlend: 0.1,
    lsClampMin: 0.93,
    lsClampMax: 1.05,
    oppositionStrength: 0.004,
    shadowLift: 0.06,
    highlightBoost: 1.12,
    shadowWeightExponent: 0.95,
    highlightWeightExponent: 0.8,
    primaryIntensity: 2.8,
    ambientIntensity: 0.04,
    earthshineIntensity: 0.08,
    primaryAzimuthDeg: 135,
    primaryElevationDeg: 28,
    earthshineAzimuthDeg: -18,
    earthshineElevationDeg: 5,
    toneExposure: 1.26,
    cameraFovDeg: 28,
    cameraDistance: 3.1,
};

const PRESETS = {
    mainAppParity: {
        normalMapMaxWidth: 4096,
        normalMapStrength: 0.72,
        normalScaleX: 0.58,
        normalScaleY: 0.58,
        displacementScale: 0.0068,
        displacementBias: -0.0038,
        roughness: 0.96,
        metalness: 0.0,
        lommelSeeligerBlend: 0.1,
        lsClampMin: 0.93,
        lsClampMax: 1.05,
        oppositionStrength: 0.004,
        shadowLift: 0.06,
        highlightBoost: 1.12,
        shadowWeightExponent: 0.95,
        highlightWeightExponent: 0.8,
        primaryIntensity: 2.8,
        ambientIntensity: 0.04,
        earthshineIntensity: 0.08,
        // In main app these directions are mission/time-driven; these are neutral preview defaults.
        primaryAzimuthDeg: 135,
        primaryElevationDeg: 28,
        earthshineAzimuthDeg: -18,
        earthshineElevationDeg: 5,
        toneExposure: 1.14,
        cameraFovDeg: 28,
        cameraDistance: 3.1,
    },
};

const CONTROL_GROUPS = [
    {
        title: "Surface",
        controls: [
            { key: "normalMapMaxWidth", label: "Normal Map Max Width", min: 512, max: 8192, step: 128 },
            { key: "normalMapStrength", label: "Normal Map Strength", min: 0.0, max: 2.5, step: 0.01 },
            { key: "normalScaleX", label: "Normal Scale X", min: 0.0, max: 2.5, step: 0.01 },
            { key: "normalScaleY", label: "Normal Scale Y", min: 0.0, max: 2.5, step: 0.01 },
            { key: "displacementScale", label: "Displacement Scale", min: 0.0, max: 0.02, step: 0.0001 },
            { key: "displacementBias", label: "Displacement Bias", min: -0.02, max: 0.02, step: 0.0001 },
            { key: "roughness", label: "Roughness", min: 0.0, max: 1.0, step: 0.01 },
            { key: "metalness", label: "Metalness", min: 0.0, max: 1.0, step: 0.01 },
        ],
    },
    {
        title: "Photometric",
        controls: [
            { key: "lommelSeeligerBlend", label: "LS Blend", min: 0.0, max: 1.0, step: 0.01 },
            { key: "lsClampMin", label: "LS Clamp Min", min: 0.5, max: 1.3, step: 0.005 },
            { key: "lsClampMax", label: "LS Clamp Max", min: 0.7, max: 1.6, step: 0.005 },
            { key: "oppositionStrength", label: "Opposition Strength", min: 0.0, max: 0.04, step: 0.0005 },
            { key: "shadowLift", label: "Shadow Lift", min: 0.0, max: 0.2, step: 0.001 },
            { key: "highlightBoost", label: "Highlight Boost", min: 1.0, max: 1.5, step: 0.005 },
            { key: "shadowWeightExponent", label: "Shadow Exponent", min: 0.2, max: 3.0, step: 0.01 },
            { key: "highlightWeightExponent", label: "Highlight Exponent", min: 0.2, max: 3.0, step: 0.01 },
        ],
    },
    {
        title: "Lighting",
        controls: [
            { key: "primaryIntensity", label: "Primary Light", min: 0.1, max: 6.0, step: 0.05 },
            { key: "ambientIntensity", label: "Ambient", min: 0.0, max: 0.3, step: 0.005 },
            { key: "earthshineIntensity", label: "Earthshine", min: 0.0, max: 0.4, step: 0.005 },
            { key: "primaryAzimuthDeg", label: "Primary Azimuth", min: -180, max: 180, step: 1 },
            { key: "primaryElevationDeg", label: "Primary Elevation", min: -10, max: 89, step: 1 },
            { key: "earthshineAzimuthDeg", label: "Earthshine Azimuth", min: -180, max: 180, step: 1 },
            { key: "earthshineElevationDeg", label: "Earthshine Elevation", min: -30, max: 89, step: 1 },
            { key: "toneExposure", label: "Tone Exposure", min: 0.5, max: 2.5, step: 0.01 },
        ],
    },
    {
        title: "Camera",
        controls: [
            { key: "cameraFovDeg", label: "Camera FoV", min: 5, max: 80, step: 1 },
            { key: "cameraDistance", label: "Camera Distance", min: 1.7, max: 8.0, step: 0.01 },
        ],
    },
];

const state = { ...DEFAULTS };
const controlsByKey = new Map();

const canvas = document.getElementById("tuner-canvas");
const controlsRoot = document.getElementById("tuner-controls-root");
const jsonBox = document.getElementById("tuner-json");
const presetMainButton = document.getElementById("tuner-preset-main");
const resetButton = document.getElementById("tuner-reset");
const copyButton = document.getElementById("tuner-copy");
const applyButton = document.getElementById("tuner-apply");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03070f);

const camera = new THREE.PerspectiveCamera(state.cameraFovDeg, 1, 0.01, 50);
scene.add(camera);

const primaryLight = new THREE.DirectionalLight(0xffffff, state.primaryIntensity);
const earthshineLight = new THREE.DirectionalLight(0x9fb2d8, state.earthshineIntensity);
const ambientLight = new THREE.AmbientLight(0x222222, state.ambientIntensity);
scene.add(primaryLight);
scene.add(primaryLight.target);
scene.add(earthshineLight);
scene.add(earthshineLight.target);
scene.add(ambientLight);

const moonContainer = new THREE.Group();
scene.add(moonContainer);

let moonMaterial = null;
let moonMesh = null;
let baseTexture = null;
let heightTexture = null;
let generatedNormalMap = null;
let shaderRef = null;
let cameraYaw = -0.35;
let cameraPitch = 0.22;
let isDragging = false;
let dragLastX = 0;
let dragLastY = 0;
let normalMapRegenTimer = null;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function degreesToRadians(value) {
    return (Number(value) || 0) * Math.PI / 180;
}

function directionFromAzEl(azimuthDeg, elevationDeg) {
    const az = degreesToRadians(azimuthDeg);
    const el = degreesToRadians(elevationDeg);
    const cosEl = Math.cos(el);
    return new THREE.Vector3(
        cosEl * Math.cos(az),
        Math.sin(el),
        cosEl * Math.sin(az),
    ).normalize();
}

function updateCamera() {
    camera.fov = state.cameraFovDeg;
    camera.updateProjectionMatrix();
    const radius = state.cameraDistance;
    const cosPitch = Math.cos(cameraPitch);
    camera.position.set(
        radius * cosPitch * Math.cos(cameraYaw),
        radius * Math.sin(cameraPitch),
        radius * cosPitch * Math.sin(cameraYaw),
    );
    camera.lookAt(0, 0, 0);
}

function buildNormalMapFromHeightTexture(heightTex, strength, maxWidth) {
    const image = heightTex?.image;
    if (!image || typeof document === "undefined") return null;

    const sourceWidth = Number(image.width) || 0;
    const sourceHeight = Number(image.height) || 0;
    if (sourceWidth < 2 || sourceHeight < 2) return null;

    let width = sourceWidth;
    let height = sourceHeight;
    if (width > maxWidth) {
        const scale = maxWidth / width;
        width = maxWidth;
        height = Math.max(2, Math.round(height * scale));
    }

    const canvasEl = document.createElement("canvas");
    canvasEl.width = width;
    canvasEl.height = height;
    const context = canvasEl.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, 0, 0, width, height);
    const sourceData = context.getImageData(0, 0, width, height).data;
    const normalData = new Uint8Array(width * height * 4);

    const sampleHeight = (x, y) => {
        const cx = Math.max(0, Math.min(width - 1, x));
        const cy = Math.max(0, Math.min(height - 1, y));
        const index = (cy * width + cx) * 4;
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

            let nx = -1 * (hR - hL) * strength;
            let ny = -1 * (hD - hU) * strength;
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
    normalTexture.wrapS = heightTex.wrapS;
    normalTexture.wrapT = heightTex.wrapT;
    normalTexture.magFilter = THREE.LinearFilter;
    normalTexture.minFilter = THREE.LinearMipmapLinearFilter;
    normalTexture.generateMipmaps = true;
    normalTexture.flipY = heightTex.flipY;
    normalTexture.needsUpdate = true;
    return normalTexture;
}

function applyPhotometricShader(material) {
    material.onBeforeCompile = (shader) => {
        shaderRef = shader;
        shader.uniforms.uMoonLsBlend = { value: state.lommelSeeligerBlend };
        shader.uniforms.uMoonLsClampMin = { value: state.lsClampMin };
        shader.uniforms.uMoonLsClampMax = { value: state.lsClampMax };
        shader.uniforms.uMoonOppositionStrength = { value: state.oppositionStrength };
        shader.uniforms.uMoonShadowLift = { value: state.shadowLift };
        shader.uniforms.uMoonHighlightBoost = { value: state.highlightBoost };
        shader.uniforms.uMoonShadowWeightExponent = { value: state.shadowWeightExponent };
        shader.uniforms.uMoonHighlightWeightExponent = { value: state.highlightWeightExponent };

        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
uniform float uMoonLsBlend;
uniform float uMoonLsClampMin;
uniform float uMoonLsClampMax;
uniform float uMoonOppositionStrength;
uniform float uMoonShadowLift;
uniform float uMoonHighlightBoost;
uniform float uMoonShadowWeightExponent;
uniform float uMoonHighlightWeightExponent;`,
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
    moonLsScale = clamp( moonLsScale, min(uMoonLsClampMin, uMoonLsClampMax), max(uMoonLsClampMin, uMoonLsClampMax) );
    reflectedLight.directDiffuse *= mix( 1.0, moonLsScale, uMoonLsBlend );

    float moonPhaseAlignment = clamp( dot( moonLightDir, moonViewDir ), 0.0, 1.0 );
    float moonOpposition = pow( moonPhaseAlignment, 18.0 ) * uMoonOppositionStrength;
    diffuseColor.rgb *= ( 1.0 + moonOpposition );

    float moonShadowWeight = pow( 1.0 - moonNdotL, max(0.2, uMoonShadowWeightExponent) );
    float moonHighlightWeight = pow( moonNdotL, max(0.2, uMoonHighlightWeightExponent) );
    float moonShadowTone = 1.0 + uMoonShadowLift * moonShadowWeight;
    float moonHighlightTone = mix(1.0, uMoonHighlightBoost, moonHighlightWeight);
    vec3 moonToneMultiplier = vec3( moonShadowTone * moonHighlightTone );
    reflectedLight.directDiffuse *= moonToneMultiplier;
#endif`,
            );
    };
    material.customProgramCacheKey = () => "moon-render-tuner-v1";
}

function updateShaderUniforms() {
    if (!shaderRef || !shaderRef.uniforms) return;
    shaderRef.uniforms.uMoonLsBlend.value = state.lommelSeeligerBlend;
    shaderRef.uniforms.uMoonLsClampMin.value = state.lsClampMin;
    shaderRef.uniforms.uMoonLsClampMax.value = state.lsClampMax;
    shaderRef.uniforms.uMoonOppositionStrength.value = state.oppositionStrength;
    shaderRef.uniforms.uMoonShadowLift.value = state.shadowLift;
    shaderRef.uniforms.uMoonHighlightBoost.value = state.highlightBoost;
    shaderRef.uniforms.uMoonShadowWeightExponent.value = state.shadowWeightExponent;
    shaderRef.uniforms.uMoonHighlightWeightExponent.value = state.highlightWeightExponent;
}

function updateLightSettings() {
    primaryLight.intensity = state.primaryIntensity;
    ambientLight.intensity = state.ambientIntensity;
    earthshineLight.intensity = state.earthshineIntensity;
    primaryLight.position.copy(directionFromAzEl(state.primaryAzimuthDeg, state.primaryElevationDeg).multiplyScalar(8));
    earthshineLight.position.copy(directionFromAzEl(state.earthshineAzimuthDeg, state.earthshineElevationDeg).multiplyScalar(6));
}

function updateMaterialSettings() {
    if (!moonMaterial) return;
    moonMaterial.normalScale.set(state.normalScaleX, state.normalScaleY);
    moonMaterial.displacementScale = state.displacementScale;
    moonMaterial.displacementBias = state.displacementBias;
    moonMaterial.roughness = state.roughness;
    moonMaterial.metalness = state.metalness;
    moonMaterial.needsUpdate = true;
    updateShaderUniforms();
}

function applyRendererSettings() {
    renderer.toneMappingExposure = state.toneExposure;
}

function scheduleNormalMapRebuild() {
    if (!heightTexture || !moonMaterial) return;
    if (normalMapRegenTimer) {
        window.clearTimeout(normalMapRegenTimer);
        normalMapRegenTimer = null;
    }
    normalMapRegenTimer = window.setTimeout(() => {
        normalMapRegenTimer = null;
        const rebuilt = buildNormalMapFromHeightTexture(
            heightTexture,
            state.normalMapStrength,
            Math.max(512, Math.round(state.normalMapMaxWidth)),
        );
        if (!rebuilt) return;
        if (generatedNormalMap) generatedNormalMap.dispose();
        generatedNormalMap = rebuilt;
        moonMaterial.normalMap = generatedNormalMap;
        moonMaterial.needsUpdate = true;
    }, 140);
}

function serializeState() {
    return {
        version: 1,
        target: "moon-render",
        values: { ...state },
    };
}

function updateJsonBox() {
    jsonBox.value = JSON.stringify(serializeState(), null, 2);
}

function clampControlValue(control, rawValue) {
    const numeric = Number(rawValue);
    const safe = Number.isFinite(numeric) ? numeric : DEFAULTS[control.key];
    return clamp(safe, control.min, control.max);
}

function applyControlValue(control, nextValue, source = null) {
    const value = clampControlValue(control, nextValue);
    state[control.key] = value;
    const controlRefs = controlsByKey.get(control.key);
    if (controlRefs) {
        if (source !== controlRefs.slider) controlRefs.slider.value = String(value);
        if (source !== controlRefs.number) controlRefs.number.value = String(value);
    }

    if (control.key === "cameraFovDeg" || control.key === "cameraDistance") {
        updateCamera();
    } else if (control.key === "normalMapStrength" || control.key === "normalMapMaxWidth") {
        scheduleNormalMapRebuild();
    } else if (
        control.key === "primaryIntensity"
        || control.key === "ambientIntensity"
        || control.key === "earthshineIntensity"
        || control.key === "primaryAzimuthDeg"
        || control.key === "primaryElevationDeg"
        || control.key === "earthshineAzimuthDeg"
        || control.key === "earthshineElevationDeg"
    ) {
        updateLightSettings();
    } else if (control.key === "toneExposure") {
        applyRendererSettings();
    } else {
        updateMaterialSettings();
    }

    updateJsonBox();
}

function createControls() {
    controlsRoot.innerHTML = "";
    CONTROL_GROUPS.forEach((group) => {
        const groupEl = document.createElement("section");
        groupEl.className = "tuner-group";

        const titleEl = document.createElement("h2");
        titleEl.className = "tuner-group-title";
        titleEl.textContent = group.title;
        groupEl.appendChild(titleEl);

        group.controls.forEach((control) => {
            const rowEl = document.createElement("div");
            rowEl.className = "tuner-row";

            const sliderWrap = document.createElement("div");
            const labelEl = document.createElement("label");
            labelEl.className = "tuner-label";
            labelEl.textContent = control.label;
            sliderWrap.appendChild(labelEl);

            const sliderEl = document.createElement("input");
            sliderEl.className = "tuner-slider";
            sliderEl.type = "range";
            sliderEl.min = String(control.min);
            sliderEl.max = String(control.max);
            sliderEl.step = String(control.step);
            sliderEl.value = String(state[control.key]);
            sliderWrap.appendChild(sliderEl);

            const numberEl = document.createElement("input");
            numberEl.className = "tuner-number";
            numberEl.type = "number";
            numberEl.min = String(control.min);
            numberEl.max = String(control.max);
            numberEl.step = String(control.step);
            numberEl.value = String(state[control.key]);

            sliderEl.addEventListener("input", (event) => {
                applyControlValue(control, event.target.value, sliderEl);
            });
            numberEl.addEventListener("input", (event) => {
                applyControlValue(control, event.target.value, numberEl);
            });

            controlsByKey.set(control.key, { slider: sliderEl, number: numberEl, meta: control });
            rowEl.appendChild(sliderWrap);
            rowEl.appendChild(numberEl);
            groupEl.appendChild(rowEl);
        });

        controlsRoot.appendChild(groupEl);
    });
}

function parseAndApplyJson(text) {
    const parsed = JSON.parse(text);
    const values = parsed && typeof parsed === "object" && parsed.values ? parsed.values : parsed;
    if (!values || typeof values !== "object") return;

    CONTROL_GROUPS.forEach((group) => {
        group.controls.forEach((control) => {
            if (Object.prototype.hasOwnProperty.call(values, control.key)) {
                applyControlValue(control, values[control.key], null);
            }
        });
    });
}

function applyPreset(presetValues) {
    if (!presetValues || typeof presetValues !== "object") return;
    CONTROL_GROUPS.forEach((group) => {
        group.controls.forEach((control) => {
            if (Object.prototype.hasOwnProperty.call(presetValues, control.key)) {
                applyControlValue(control, presetValues[control.key], null);
            }
        });
    });
}

function attachButtons() {
    presetMainButton.addEventListener("click", () => {
        applyPreset(PRESETS.mainAppParity);
        presetMainButton.textContent = "Main Preset Applied";
        window.setTimeout(() => { presetMainButton.textContent = "Main App Preset"; }, 1400);
    });

    resetButton.addEventListener("click", () => {
        applyPreset(DEFAULTS);
        cameraYaw = -0.35;
        cameraPitch = 0.22;
        updateCamera();
    });

    copyButton.addEventListener("click", async () => {
        updateJsonBox();
        const text = jsonBox.value;
        try {
            await navigator.clipboard.writeText(text);
            copyButton.textContent = "Copied";
            window.setTimeout(() => { copyButton.textContent = "Copy JSON"; }, 1200);
        } catch {
            jsonBox.focus();
            jsonBox.select();
            copyButton.textContent = "Select + Ctrl+C";
            window.setTimeout(() => { copyButton.textContent = "Copy JSON"; }, 1500);
        }
    });

    applyButton.addEventListener("click", () => {
        try {
            parseAndApplyJson(jsonBox.value);
            applyButton.textContent = "Applied";
            window.setTimeout(() => { applyButton.textContent = "Apply JSON"; }, 1200);
        } catch (error) {
            applyButton.textContent = "Invalid JSON";
            window.setTimeout(() => { applyButton.textContent = "Apply JSON"; }, 1500);
            console.error(error);
        }
    });
}

function attachPointerControls() {
    canvas.addEventListener("pointerdown", (event) => {
        isDragging = true;
        dragLastX = event.clientX;
        dragLastY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
        if (!isDragging) return;
        const dx = event.clientX - dragLastX;
        const dy = event.clientY - dragLastY;
        dragLastX = event.clientX;
        dragLastY = event.clientY;
        cameraYaw -= dx * 0.0045;
        cameraPitch = clamp(cameraPitch - dy * 0.0038, -1.45, 1.45);
        updateCamera();
    });
    const endDrag = () => { isDragging = false; };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        state.cameraDistance = clamp(state.cameraDistance * (event.deltaY > 0 ? 1.055 : 0.945), 1.7, 8.0);
        const refs = controlsByKey.get("cameraDistance");
        if (refs) {
            refs.slider.value = String(state.cameraDistance);
            refs.number.value = String(state.cameraDistance);
        }
        updateCamera();
        updateJsonBox();
    }, { passive: false });

    canvas.addEventListener("dblclick", () => {
        cameraYaw = -0.35;
        cameraPitch = 0.22;
        updateCamera();
    });
}

function resize() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function createMoon() {
    const geometry = new THREE.SphereGeometry(1, 256, 256);
    moonMaterial = new THREE.MeshStandardMaterial({
        map: baseTexture,
        displacementMap: heightTexture,
        displacementScale: state.displacementScale,
        displacementBias: state.displacementBias,
        normalMap: generatedNormalMap,
        normalScale: new THREE.Vector2(state.normalScaleX, state.normalScaleY),
        roughness: state.roughness,
        metalness: state.metalness,
    });
    applyPhotometricShader(moonMaterial);
    moonMesh = new THREE.Mesh(geometry, moonMaterial);
    moonMesh.castShadow = false;
    moonMesh.receiveShadow = false;
    moonMesh.rotateX(Math.PI / 2);
    moonContainer.add(moonMesh);
}

function loadTexture(url) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(url, (tex) => resolve(tex), undefined, (err) => reject(err));
    });
}

async function initScene() {
    [baseTexture, heightTexture] = await Promise.all([
        loadTexture("images/moon/Solarsystemscope_texture_8k_moon.jpg"),
        loadTexture("images/moon/ldem_16_gsfc.png"),
    ]);
    baseTexture.colorSpace = THREE.SRGBColorSpace;
    baseTexture.wrapS = THREE.ClampToEdgeWrapping;
    baseTexture.wrapT = THREE.ClampToEdgeWrapping;
    heightTexture.wrapS = THREE.ClampToEdgeWrapping;
    heightTexture.wrapT = THREE.ClampToEdgeWrapping;

    generatedNormalMap = buildNormalMapFromHeightTexture(
        heightTexture,
        state.normalMapStrength,
        Math.max(512, Math.round(state.normalMapMaxWidth)),
    );
    createMoon();
    applyRendererSettings();
    updateLightSettings();
    updateMaterialSettings();
    updateCamera();
    resize();
}

function animate() {
    requestAnimationFrame(animate);
    moonContainer.rotation.y += 0.00035;
    renderer.render(scene, camera);
}

function setFatalMessage(error) {
    console.error(error);
    controlsRoot.innerHTML =
        '<div class="tuner-group"><h2 class="tuner-group-title">Error</h2><p style="margin:0;color:#ffd2d2;font-size:12px;">Failed to initialize tuner. Check console for details.</p></div>';
}

createControls();
attachButtons();
attachPointerControls();
updateJsonBox();
window.addEventListener("resize", resize);

initScene()
    .then(() => animate())
    .catch((error) => setFatalMessage(error));
