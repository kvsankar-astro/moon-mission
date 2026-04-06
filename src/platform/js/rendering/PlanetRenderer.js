import * as THREE from "three";

const EARTH_CENTERED_BODIES = Object.freeze([
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Moon",
    "Sun",
]);

const MOON_CENTERED_BODIES = Object.freeze([
    "Mercury",
    "Venus",
    "Earth",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Sun",
]);

const PLANET_STYLE_BY_BODY = Object.freeze({
    Mercury: { color: [0.76, 0.76, 0.72], size: 4.0 },
    Venus: { color: [1.00, 0.93, 0.72], size: 4.8 },
    Earth: { color: [0.55, 0.75, 1.00], size: 4.9 },
    Moon: { color: [0.95, 0.95, 1.00], size: 4.6 },
    Mars: { color: [1.00, 0.56, 0.40], size: 4.3 },
    Jupiter: { color: [1.00, 0.86, 0.66], size: 5.2 },
    Saturn: { color: [1.00, 0.90, 0.62], size: 5.0 },
    Uranus: { color: [0.70, 0.95, 1.00], size: 4.5 },
    Neptune: { color: [0.58, 0.72, 1.00], size: 4.5 },
    Sun: { color: [1.00, 0.95, 0.74], size: 6.2 },
});

// Updating planetary sky markers every render frame is unnecessarily expensive
// (Astronomy.GeoVector + per-attribute writes). Throttle to a modest real-time
// cadence, but still force refresh on large timeline jumps/scrubs.
const PLANET_UPDATE_MIN_REALTIME_MS = 90;
const PLANET_UPDATE_FORCE_SIM_DELTA_MS = 6 * 60 * 60 * 1000;

const PLANET_VERTEX_SHADER = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;

uniform float uAtmosphereEnabled;

varying vec3 vColor;
varying float vAlpha;

void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float atmosphereScale = mix(1.04, 0.95, clamp(uAtmosphereEnabled, 0.0, 1.0));
    gl_PointSize = aSize * atmosphereScale;
    vColor = aColor;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * mvPosition;
}
`;

const PLANET_FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;

void main() {
    vec2 p = (gl_PointCoord * 2.0) - vec2(1.0);
    float r2 = dot(p, p);
    if (r2 > 1.0) {
        discard;
    }
    float core = exp(-r2 * 6.0);
    float edge = smoothstep(1.0, 0.60, r2);
    float profile = 0.58 * core + 0.42 * edge;
    vec3 color = vColor * (0.76 + (0.48 * core));
    gl_FragColor = vec4(color, vAlpha * profile);
}
`;

function normalizeVector3(vector) {
    const x = Number(vector?.x);
    const y = Number(vector?.y);
    const z = Number(vector?.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return null;
    }
    const mag = Math.hypot(x, y, z);
    if (!Number.isFinite(mag) || mag <= 1e-12) {
        return null;
    }
    return { x: x / mag, y: y / mag, z: z / mag };
}

function subtractVector(a, b) {
    return {
        x: Number(a?.x) - Number(b?.x),
        y: Number(a?.y) - Number(b?.y),
        z: Number(a?.z) - Number(b?.z),
    };
}

function negateVector(v) {
    return {
        x: -Number(v?.x),
        y: -Number(v?.y),
        z: -Number(v?.z),
    };
}

function resolveAstronomyGlobal() {
    if (typeof globalThis !== "undefined" && globalThis.Astronomy) {
        return globalThis.Astronomy;
    }
    if (typeof window !== "undefined" && window.Astronomy) {
        return window.Astronomy;
    }
    return null;
}

function resolveBodyToken(astronomy, bodyName) {
    const bodyTable = astronomy?.Body;
    if (bodyTable && Object.prototype.hasOwnProperty.call(bodyTable, bodyName)) {
        return bodyTable[bodyName];
    }
    return bodyName;
}

function getGeoVector(astronomy, bodyName, date) {
    if (!astronomy?.GeoVector) return null;
    try {
        const token = resolveBodyToken(astronomy, bodyName);
        const astroTime = typeof astronomy.MakeTime === "function"
            ? astronomy.MakeTime(date)
            : date;
        return astronomy.GeoVector(token, astroTime, true);
    } catch {
        return null;
    }
}

function resolveBodyList(centerMode) {
    return centerMode === "moon" ? MOON_CENTERED_BODIES : EARTH_CENTERED_BODIES;
}

export class PlanetRenderer {
    constructor(parentContainer, { radius, layer = 2, centerMode = "earth", atmosphereEnabled = false } = {}) {
        this.parentContainer = parentContainer;
        this.radius = Number.isFinite(radius) ? radius : 1;
        this.layer = Number.isFinite(layer) ? layer : 2;
        this.centerMode = centerMode === "moon" ? "moon" : "earth";
        this.atmosphereEnabled = Boolean(atmosphereEnabled);
        this.timeMs = Date.now();
        this.visible = true;

        this.points = null;
        this.geometry = null;
        this.material = null;

        this.positions = new Float32Array(EARTH_CENTERED_BODIES.length * 3);
        this.colors = new Float32Array(EARTH_CENTERED_BODIES.length * 3);
        this.sizes = new Float32Array(EARTH_CENTERED_BODIES.length);
        this.alphas = new Float32Array(EARTH_CENTERED_BODIES.length);
        this.bodySlots = new Array(EARTH_CENTERED_BODIES.length).fill("");
        this.lastUpdateRealtimeMs = Number.NaN;
        this.lastUpdateSimMs = Number.NaN;
    }

    create(visible = true) {
        if (this.points) {
            this.setVisible(visible);
            return;
        }

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute("aColor", new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute("aSize", new THREE.BufferAttribute(this.sizes, 1));
        this.geometry.setAttribute("aAlpha", new THREE.BufferAttribute(this.alphas, 1));
        this.geometry.boundingSphere = new THREE.Sphere(
            new THREE.Vector3(0, 0, 0),
            this.radius * 1.01,
        );

        this.material = new THREE.ShaderMaterial({
            vertexShader: PLANET_VERTEX_SHADER,
            fragmentShader: PLANET_FRAGMENT_SHADER,
            uniforms: {
                uAtmosphereEnabled: { value: this.atmosphereEnabled ? 1 : 0 },
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true,
            toneMapped: false,
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.points.layers.set(this.layer);
        this.points.renderOrder = -23;
        this.points.frustumCulled = false;
        this.parentContainer.add(this.points);

        this.#refreshStaticAttributes();
        this.setVisible(visible);
        this.setTime(this.timeMs, { force: true });
    }

    setVisible(visible) {
        this.visible = Boolean(visible);
        if (this.points) {
            this.points.visible = this.visible;
        }
    }

    setCenterMode(mode) {
        const nextMode = mode === "moon" ? "moon" : "earth";
        if (nextMode === this.centerMode) return;
        this.centerMode = nextMode;
        this.#refreshStaticAttributes();
        this.setTime(this.timeMs, { force: true });
    }

    setAtmosphereEnabled(enabled) {
        this.atmosphereEnabled = Boolean(enabled);
        if (this.material?.uniforms?.uAtmosphereEnabled) {
            this.material.uniforms.uAtmosphereEnabled.value = this.atmosphereEnabled ? 1 : 0;
        }
    }

    setTime(timeMs, { force = false } = {}) {
        const nextTimeMs = Number.isFinite(timeMs) ? Number(timeMs) : this.timeMs;
        const nowMs = (typeof performance !== "undefined" && Number.isFinite(performance.now()))
            ? performance.now()
            : Date.now();
        const hasPriorUpdate = Number.isFinite(this.lastUpdateRealtimeMs) && Number.isFinite(this.lastUpdateSimMs);
        const realtimeDeltaMs = hasPriorUpdate ? (nowMs - this.lastUpdateRealtimeMs) : Number.POSITIVE_INFINITY;
        const simDeltaMs = hasPriorUpdate ? Math.abs(nextTimeMs - this.lastUpdateSimMs) : Number.POSITIVE_INFINITY;
        if (
            !force &&
            realtimeDeltaMs < PLANET_UPDATE_MIN_REALTIME_MS &&
            simDeltaMs < PLANET_UPDATE_FORCE_SIM_DELTA_MS
        ) {
            this.timeMs = nextTimeMs;
            return;
        }

        this.timeMs = nextTimeMs;
        this.#updatePlanetPositions();
        this.lastUpdateRealtimeMs = nowMs;
        this.lastUpdateSimMs = this.timeMs;
    }

    dispose() {
        if (this.points) {
            this.parentContainer.remove(this.points);
            this.points = null;
        }
        this.geometry?.dispose?.();
        this.geometry = null;
        this.material?.dispose?.();
        this.material = null;
    }

    #updatePlanetPositions() {
        if (!this.geometry) return;

        const astronomy = resolveAstronomyGlobal();
        const bodyList = resolveBodyList(this.centerMode);

        // Graceful no-op if Astronomy Engine is unavailable.
        if (!astronomy) {
            this.#hideAllMarkers();
            return;
        }

        const date = new Date(this.timeMs);
        let moonGeo = null;
        if (this.centerMode === "moon") {
            moonGeo = getGeoVector(astronomy, "Moon", date);
            if (!moonGeo) {
                this.#hideAllMarkers();
                return;
            }
        }

        for (let i = 0; i < this.bodySlots.length; i += 1) {
            const bodyName = bodyList[i];
            this.bodySlots[i] = bodyName || "";

            const idx3 = i * 3;
            if (!bodyName) {
                this.positions[idx3] = 0;
                this.positions[idx3 + 1] = 0;
                this.positions[idx3 + 2] = 0;
                this.alphas[i] = 0;
                continue;
            }

            let eqVector = null;
            if (this.centerMode === "moon") {
                if (bodyName === "Earth") {
                    eqVector = negateVector(moonGeo);
                } else {
                    const bodyGeo = getGeoVector(astronomy, bodyName, date);
                    if (bodyGeo) {
                        eqVector = subtractVector(bodyGeo, moonGeo);
                    }
                }
            } else {
                eqVector = getGeoVector(astronomy, bodyName, date);
            }

            const eqDir = normalizeVector3(eqVector);
            if (!eqDir) {
                this.positions[idx3] = 0;
                this.positions[idx3 + 1] = 0;
                this.positions[idx3 + 2] = 0;
                this.alphas[i] = 0;
                continue;
            }

            // Keep alignment identical to star map convention.
            const skyDir = normalizeVector3({
                x: eqDir.x,
                y: -eqDir.y,
                z: eqDir.z,
            });

            const markerRadius = this.radius * 0.995;
            this.positions[idx3] = skyDir.x * markerRadius;
            this.positions[idx3 + 1] = skyDir.y * markerRadius;
            this.positions[idx3 + 2] = skyDir.z * markerRadius;
            this.alphas[i] = 1;
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.aAlpha.needsUpdate = true;
    }

    #refreshStaticAttributes() {
        const bodyList = resolveBodyList(this.centerMode);
        for (let i = 0; i < this.bodySlots.length; i += 1) {
            const bodyName = bodyList[i];
            this.bodySlots[i] = bodyName || "";
            const style = PLANET_STYLE_BY_BODY[bodyName] || PLANET_STYLE_BY_BODY.Mars;
            const idx3 = i * 3;
            this.colors[idx3] = style.color[0];
            this.colors[idx3 + 1] = style.color[1];
            this.colors[idx3 + 2] = style.color[2];
            this.sizes[i] = bodyName ? style.size : 0;
            if (!bodyName) {
                this.alphas[i] = 0;
            }
        }
        if (!this.geometry) return;
        this.geometry.attributes.aColor.needsUpdate = true;
        this.geometry.attributes.aSize.needsUpdate = true;
        this.geometry.attributes.aAlpha.needsUpdate = true;
    }

    #hideAllMarkers() {
        if (!this.geometry) return;
        for (let i = 0; i < this.bodySlots.length; i += 1) {
            const idx3 = i * 3;
            this.positions[idx3] = 0;
            this.positions[idx3 + 1] = 0;
            this.positions[idx3 + 2] = 0;
            this.sizes[i] = 0;
            this.alphas[i] = 0;
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.aSize.needsUpdate = true;
        this.geometry.attributes.aAlpha.needsUpdate = true;
    }
}
