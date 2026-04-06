import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const host = document.getElementById("sky-demo-canvas");
const statusEl = document.getElementById("status");

const controlsDom = {
    atmosphereEnabled: document.getElementById("atmosphere-enabled"),
    timeSlider: document.getElementById("time-slider"),
    observerLat: document.getElementById("observer-lat"),
    observerLon: document.getElementById("observer-lon"),
    starSizeScale: document.getElementById("star-size-scale"),
    extinctionStrength: document.getElementById("extinction-strength"),
    twinkleStrength: document.getElementById("twinkle-strength"),
    bloomStrength: document.getElementById("bloom-strength"),
    timeValue: document.getElementById("time-value"),
    observerLatValue: document.getElementById("observer-lat-value"),
    observerLonValue: document.getElementById("observer-lon-value"),
    starSizeScaleValue: document.getElementById("star-size-scale-value"),
    extinctionStrengthValue: document.getElementById("extinction-strength-value"),
    twinkleStrengthValue: document.getElementById("twinkle-strength-value"),
    bloomStrengthValue: document.getElementById("bloom-strength-value"),
};

function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
}

function toNumber(input, fallback = 0) {
    const value = Number(input?.value);
    return Number.isFinite(value) ? value : fallback;
}

function computeDaylightFactor(timeHours) {
    const hour = ((Number(timeHours) % 24) + 24) % 24;
    const solarPhase = ((hour - 6) / 24) * Math.PI * 2;
    return Math.max(0, Math.sin(solarPhase));
}

function invokeFirst(target, methodNames, ...args) {
    if (!target) return false;
    for (const methodName of methodNames) {
        const fn = target[methodName];
        if (typeof fn !== "function") continue;
        fn.apply(target, args);
        return true;
    }
    return false;
}

function setColorTextureSpace(texture) {
    if (!texture) return;
    if ("colorSpace" in texture && THREE.SRGBColorSpace) {
        texture.colorSpace = THREE.SRGBColorSpace;
    } else if ("encoding" in texture && THREE.sRGBEncoding) {
        texture.encoding = THREE.sRGBEncoding;
    }
}

function loadTexture(url) {
    return new Promise((resolve) => {
        new THREE.TextureLoader().load(
            url,
            (texture) => resolve(texture),
            undefined,
            () => resolve(null),
        );
    });
}

async function loadDemoSkyTextures() {
    const [skyTexture, constellationTexture] = await Promise.all([
        loadTexture("/images/sky/starmap_2020_4k_stars.jpg"),
        loadTexture("/images/sky/constellation_figures_2020_4k.jpg"),
    ]);
    setColorTextureSpace(skyTexture);
    setColorTextureSpace(constellationTexture);
    return { skyTexture, constellationTexture };
}

class FallbackSkyController {
    constructor(parentContainer, baseRadius = 1) {
        this.parentContainer = parentContainer;
        this.baseRadius = baseRadius;
        this.container = new THREE.Group();
        this.container.renderOrder = -40;
        this.points = null;
        this.material = null;
        this.params = {
            atmosphere_enabled: false,
            star_size_scale: 1.2,
            twinkle_strength: 0.05,
            bloom_strength: 0.7,
        };
        this.timeHours = 22;
    }

    create(visible = true) {
        const count = 1800;
        const positions = new Float32Array(count * 3);
        const brightness = new Float32Array(count);
        for (let i = 0; i < count; i += 1) {
            const t = i + 1;
            const y = 1 - ((t / count) * 2);
            const radius = Math.sqrt(Math.max(0, 1 - (y * y)));
            const golden = Math.PI * (3 - Math.sqrt(5));
            const theta = golden * t;
            positions[(i * 3)] = Math.cos(theta) * radius;
            positions[(i * 3) + 1] = y;
            positions[(i * 3) + 2] = Math.sin(theta) * radius;
            brightness[i] = 0.2 + (0.8 * (1 - (i % 31) / 31));
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uTime: { value: 0 },
                uSizeScale: { value: this.params.star_size_scale },
                uTwinkle: { value: this.params.twinkle_strength },
                uBloom: { value: this.params.bloom_strength },
                uAtmosphere: { value: this.params.atmosphere_enabled ? 1 : 0 },
            },
            vertexShader: `
                attribute float aBrightness;
                varying float vBrightness;
                varying vec3 vPos;
                uniform float uTime;
                uniform float uSizeScale;
                uniform float uTwinkle;
                uniform float uAtmosphere;

                float hash(float n) {
                    return fract(sin(n) * 43758.5453123);
                }

                void main() {
                    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                    float seed = hash(position.x * 83.0 + position.y * 211.0 + position.z * 197.0);
                    float twinkle = (sin((uTime * 1.7) + (seed * 9.0)) * 0.5 + 0.5) * uTwinkle;
                    float altitudeFactor = smoothstep(-0.2, 0.5, position.y);
                    float atmGain = mix(1.0, altitudeFactor, uAtmosphere);
                    vBrightness = aBrightness * (0.9 + twinkle) * atmGain;
                    vPos = position;
                    gl_PointSize = (1.2 + (2.5 * aBrightness)) * uSizeScale;
                    gl_Position = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: `
                varying float vBrightness;
                varying vec3 vPos;
                uniform float uBloom;
                uniform float uAtmosphere;

                void main() {
                    vec2 uv = gl_PointCoord * 2.0 - 1.0;
                    float r2 = dot(uv, uv);
                    if (r2 > 1.0) discard;
                    float core = exp(-r2 * 11.0);
                    float halo = exp(-r2 * 2.8) * uBloom * 0.35;
                    float strength = vBrightness * (core + halo);
                    vec3 color = mix(vec3(0.73, 0.82, 1.0), vec3(1.0), 0.7);
                    if (uAtmosphere > 0.5) {
                        color = mix(color, vec3(0.86, 0.92, 1.0), 0.16);
                    }
                    gl_FragColor = vec4(color * strength, clamp(strength, 0.0, 1.0));
                }
            `,
        });

        this.points = new THREE.Points(geometry, this.material);
        this.points.frustumCulled = false;
        this.container.add(this.points);
        this.container.scale.setScalar(300 * this.baseRadius);
        this.container.visible = visible;
        this.parentContainer.add(this.container);
    }

    setVisible(visible) {
        if (this.container) this.container.visible = !!visible;
    }

    setParameters(params = {}) {
        Object.assign(this.params, params);
        if (!this.material) return;
        this.material.uniforms.uSizeScale.value = Number(this.params.star_size_scale || 1);
        this.material.uniforms.uTwinkle.value = Number(this.params.twinkle_strength || 0);
        this.material.uniforms.uBloom.value = Number(this.params.bloom_strength || 0);
        this.material.uniforms.uAtmosphere.value = this.params.atmosphere_enabled ? 1 : 0;
    }

    setTime(hours = 22) {
        this.timeHours = Number.isFinite(hours) ? hours : this.timeHours;
    }

    update(timeSeconds = 0) {
        if (!this.material) return;
        this.material.uniforms.uTime.value = timeSeconds;
        this.container.rotation.y = ((this.timeHours % 24) / 24) * Math.PI * 2;
    }

    dispose() {
        if (this.points) {
            this.points.geometry?.dispose?.();
            this.points.material?.dispose?.();
            this.container.remove(this.points);
            this.points = null;
        }
        this.parentContainer.remove(this.container);
    }
}

function createAtmosphereDome() {
    const geometry = new THREE.SphereGeometry(300, 48, 32);
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        uniforms: {
            uAtmosphere: { value: 1 },
            uDaylight: { value: 0 },
            uZenithColor: { value: new THREE.Color(0x163a74) },
            uHorizonColor: { value: new THREE.Color(0x87b7ff) },
            uSunsetColor: { value: new THREE.Color(0xd57f3a) },
        },
        vertexShader: `
            varying vec3 vWorldDir;
            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldDir = normalize(worldPos.xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            uniform float uAtmosphere;
            uniform float uDaylight;
            uniform vec3 uZenithColor;
            uniform vec3 uHorizonColor;
            uniform vec3 uSunsetColor;
            varying vec3 vWorldDir;

            void main() {
                float y = clamp(vWorldDir.y * 0.5 + 0.5, 0.0, 1.0);
                float horizonBand = smoothstep(0.38, 0.65, y) * (1.0 - smoothstep(0.65, 0.9, y));
                vec3 nightZenith = vec3(0.01, 0.03, 0.09);
                vec3 nightHorizon = vec3(0.03, 0.05, 0.12);
                vec3 dayColor = mix(uHorizonColor, uZenithColor, smoothstep(0.2, 0.9, y));
                dayColor = mix(dayColor, uSunsetColor, horizonBand * 0.25);
                vec3 nightColor = mix(nightHorizon, nightZenith, smoothstep(0.2, 0.9, y));
                vec3 color = mix(nightColor, dayColor, uDaylight);
                float alpha = (0.25 + (0.55 * uDaylight)) * uAtmosphere;
                gl_FragColor = vec4(color, alpha);
            }
        `,
    });
    const dome = new THREE.Mesh(geometry, material);
    dome.frustumCulled = false;
    return dome;
}

async function loadSkyControllerCtor() {
    try {
        const module = await import("./rendering/SkyController.js");
        if (module?.SkyController) {
            setStatus("Using SkyController from rendering pipeline.");
            return module.SkyController;
        }
    } catch (error) {
        console.warn("SkyController import unavailable; using fallback demo sky:", error);
    }
    setStatus("SkyController not found yet. Using deterministic fallback sky renderer.");
    return FallbackSkyController;
}

function readUiState() {
    return {
        atmosphereEnabled: !!controlsDom.atmosphereEnabled?.checked,
        timeHours: toNumber(controlsDom.timeSlider, 22),
        observerLat: toNumber(controlsDom.observerLat, 28.6),
        observerLon: toNumber(controlsDom.observerLon, -80.6),
        starSizeScale: toNumber(controlsDom.starSizeScale, 1.2),
        extinctionStrength: toNumber(controlsDom.extinctionStrength, 0.18),
        twinkleStrength: toNumber(controlsDom.twinkleStrength, 0.05),
        bloomStrength: toNumber(controlsDom.bloomStrength, 0.7),
    };
}

function syncUiLabels(state) {
    controlsDom.timeValue.textContent = `${state.timeHours.toFixed(2)} h`;
    controlsDom.observerLatValue.textContent = `${state.observerLat.toFixed(1)}°`;
    controlsDom.observerLonValue.textContent = `${state.observerLon.toFixed(1)}°`;
    controlsDom.starSizeScaleValue.textContent = state.starSizeScale.toFixed(2);
    controlsDom.extinctionStrengthValue.textContent = state.extinctionStrength.toFixed(3);
    controlsDom.twinkleStrengthValue.textContent = state.twinkleStrength.toFixed(3);
    controlsDom.bloomStrengthValue.textContent = state.bloomStrength.toFixed(2);
}

function wireEvents(onChange) {
    const ids = [
        "atmosphereEnabled",
        "timeSlider",
        "observerLat",
        "observerLon",
        "starSizeScale",
        "extinctionStrength",
        "twinkleStrength",
        "bloomStrength",
    ];
    ids.forEach((id) => controlsDom[id]?.addEventListener("input", onChange));
    ids.forEach((id) => controlsDom[id]?.addEventListener("change", onChange));
}

function main() {
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(62, host.clientWidth / host.clientHeight, 0.1, 3000);
    camera.position.set(0, 4.8, 12.5);
    // SkyController renders background/stars on layer 2 (same as mission runtime).
    // Enable that layer in the demo camera so stars are actually visible.
    camera.layers.enable(2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 40;
    controls.target.set(0, 2, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(8, 8, 3);
    scene.add(key);

    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(75, 120),
        new THREE.MeshStandardMaterial({
            color: 0x0b1020,
            roughness: 1,
            metalness: 0,
        }),
    );
    ground.rotation.x = -Math.PI * 0.5;
    ground.position.y = -0.12;
    scene.add(ground);

    const horizonRing = new THREE.Mesh(
        new THREE.TorusGeometry(64, 0.25, 20, 190),
        new THREE.MeshBasicMaterial({
            color: 0x1e304d,
            transparent: true,
            opacity: 0.5,
        }),
    );
    horizonRing.rotation.x = Math.PI * 0.5;
    horizonRing.position.y = -0.1;
    scene.add(horizonRing);

    const atmosphereDome = createAtmosphereDome();
    scene.add(atmosphereDome);

    const skyRoot = new THREE.Group();
    scene.add(skyRoot);

    let skyController = null;
    let state = readUiState();
    syncUiLabels(state);

    const baseDate = Date.UTC(2026, 3, 6, 0, 0, 0);
    const clock = new THREE.Clock();

    loadSkyControllerCtor().then(async (SkyControllerCtor) => {
        skyController = new SkyControllerCtor(skyRoot, 1);
        const textures = await loadDemoSkyTextures();
        invokeFirst(
            skyController,
            ["setTextures", "updateTextures"],
            textures.skyTexture || null,
            textures.constellationTexture || null,
        );
        if (typeof skyController.create === "function") {
            skyController.create(true);
        }

        const applyToSkyController = () => {
            const params = {
                atmosphere_enabled: state.atmosphereEnabled,
                atmosphereEnabled: state.atmosphereEnabled,
                star_size_scale: state.starSizeScale,
                starSizeScale: state.starSizeScale,
                star_intensity_scale: 12.0,
                starIntensityScale: 12.0,
                extinction_strength: state.extinctionStrength,
                extinctionStrength: state.extinctionStrength,
                twinkle_strength: state.twinkleStrength,
                twinkleStrength: state.twinkleStrength,
                bloom_strength: state.bloomStrength,
                bloomStrength: state.bloomStrength,
                observer_lat: state.observerLat,
                observerLat: state.observerLat,
                observer_lon: state.observerLon,
                observerLon: state.observerLon,
            };

            invokeFirst(skyController, ["setParameters", "updateParameters", "setOptions"], params);
            invokeFirst(skyController, ["setAtmosphereEnabled"], state.atmosphereEnabled);
            invokeFirst(skyController, ["setObserverLocation"], state.observerLat, state.observerLon);

            const timeMs = baseDate + (state.timeHours * 3600 * 1000);
            const siderealSeconds = state.timeHours * 3600;
            invokeFirst(skyController, ["setTimeMs", "setTime", "updateTime"], timeMs);
            invokeFirst(skyController, ["setTimeSeconds"], siderealSeconds);
        };

        applyToSkyController();

        wireEvents(() => {
            state = readUiState();
            syncUiLabels(state);
            applyToSkyController();
            const daylight = computeDaylightFactor(state.timeHours);
            atmosphereDome.material.uniforms.uAtmosphere.value = state.atmosphereEnabled ? 1 : 0;
            atmosphereDome.material.uniforms.uDaylight.value = daylight;
            scene.background.set((state.atmosphereEnabled && daylight > 0.08) ? 0x0b1d39 : 0x000000);
            horizonRing.visible = state.atmosphereEnabled;
        });
    });

    const onResize = () => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize, { passive: true });
    onResize();

    const renderLoop = () => {
        const elapsed = clock.getElapsedTime();
        controls.update();
        if (skyController) {
            invokeFirst(skyController, ["update", "tick"], elapsed);
        }
        renderer.render(scene, camera);
        requestAnimationFrame(renderLoop);
    };

    state = readUiState();
    atmosphereDome.material.uniforms.uAtmosphere.value = state.atmosphereEnabled ? 1 : 0;
    atmosphereDome.material.uniforms.uDaylight.value = computeDaylightFactor(state.timeHours);
    scene.background.set(0x000000);
    horizonRing.visible = state.atmosphereEnabled;
    renderLoop();
}

main();
