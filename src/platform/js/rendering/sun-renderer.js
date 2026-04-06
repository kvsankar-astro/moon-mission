import * as THREE from "three";

const SKY_RADIUS_MULTIPLIER = 200;
const SUN_ANGULAR_DIAMETER_DEGREES = 0.533;
const SUN_HALO_SCALE = 4.8;
const SUN_HALO_OPACITY = 0.36;
const SUN_STARBURST_SCALE = 16.0;
const SUN_STARBURST_OPACITY = 0.0;
const SUN_FLARE_SCALE_X = 26.0;
const SUN_FLARE_SCALE_Y = 2.4;
const SUN_FLARE_OPACITY = 0.0;
const SUN_SAFE_DISTANCE_FACTOR = 0.985;
const SUN_FALLBACK_DISTANCE_MULTIPLIER = 180;

/**
 * Sun Renderer - Physically constrained visual Sun disk.
 *
 * This renderer keeps the Sun at a far, camera-anchored reference position so
 * it behaves like a distant source while preserving the ephemeris light
 * direction used by scene lighting.
 */
export class SunRenderer {
    /**
     * @param {THREE.Object3D} parentContainer
     * @param {number} baseRadius
     */
    constructor(parentContainer, baseRadius) {
        this.parentContainer = parentContainer;
        this.baseRadius = Number.isFinite(baseRadius) && baseRadius > 0 ? baseRadius : 1;

        this.distance = this.computeSafeDistance();
        this.radius = this.computeAngularRadius(this.distance);

        this.group = null;
        this.coreSprite = null;
        this.haloSprite = null;
        this.starburstSprite = null;
        this.flareSprite = null;
        this._dynamicTextures = [];

        this._direction = new THREE.Vector3(1, 0, 0);
        this._referencePosition = new THREE.Vector3();
        this._position = new THREE.Vector3();
        this._visualState = {
            coreOpacity: 1.0,
            coreScaleMul: 1.0,
            haloOpacity: SUN_HALO_OPACITY,
            haloScaleMul: SUN_HALO_SCALE,
            starburstOpacity: SUN_STARBURST_OPACITY,
            starburstScaleMul: SUN_STARBURST_SCALE,
            flareOpacity: SUN_FLARE_OPACITY,
            flareScaleXMul: SUN_FLARE_SCALE_X,
            flareScaleYMul: SUN_FLARE_SCALE_Y,
        };
    }

    computeSafeDistance() {
        const skyRadius = SKY_RADIUS_MULTIPLIER * this.baseRadius;
        const nominalDistance = skyRadius * SUN_SAFE_DISTANCE_FACTOR;
        const fallbackDistance = this.baseRadius * SUN_FALLBACK_DISTANCE_MULTIPLIER;
        return Math.max(fallbackDistance, nominalDistance);
    }

    computeAngularRadius(distance) {
        const halfAngleRad = THREE.MathUtils.degToRad(SUN_ANGULAR_DIAMETER_DEGREES * 0.5);
        const angularRadius = Math.tan(halfAngleRad) * distance;
        return Math.max(angularRadius, this.baseRadius * 0.01);
    }

    /**
     * Create visible sun sprites.
     * @param {boolean} visible
     */
    create(visible = true) {
        this.group = new THREE.Group();
        this.group.frustumCulled = false;

        const discTexture = this._createSunDiscTexture();
        const haloTexture = this._createHaloTexture();
        const starburstTexture = this._createStarburstTexture();
        const flareTexture = this._createFlareTexture();

        this.coreSprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: discTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 1.0,
                depthWrite: false,
                depthTest: true,
                toneMapped: false,
                blending: THREE.NormalBlending,
            }),
        );
        this.coreSprite.scale.setScalar(this.radius * 2);
        this.coreSprite.renderOrder = -18;
        this.group.add(this.coreSprite);

        this.haloSprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: haloTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 1.0,
                depthWrite: false,
                depthTest: true,
                toneMapped: false,
                blending: THREE.AdditiveBlending,
            }),
        );
        this.haloSprite.renderOrder = -19;
        this.group.add(this.haloSprite);

        this.starburstSprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: starburstTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 1.0,
                depthWrite: false,
                depthTest: true,
                toneMapped: false,
                blending: THREE.AdditiveBlending,
            }),
        );
        this.starburstSprite.renderOrder = -20;
        this.group.add(this.starburstSprite);

        this.flareSprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: flareTexture,
                color: 0xffe1b8,
                transparent: true,
                opacity: 1.0,
                depthWrite: false,
                depthTest: true,
                toneMapped: false,
                blending: THREE.AdditiveBlending,
            }),
        );
        this.flareSprite.renderOrder = -21;
        this.group.add(this.flareSprite);

        this._applyVisualState();

        this.group.visible = visible;
        this.parentContainer.add(this.group);

        this.setDirection(1, 0, 0);
    }

    /**
     * Set sun direction in scene coordinates.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setDirection(x, y, z) {
        if (!this.group) {
            return;
        }
        const dx = Number(x);
        const dy = Number(y);
        const dz = Number(z);
        if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz)) {
            return;
        }

        this._direction.set(dx, dy, dz);
        const norm = this._direction.length();
        if (!Number.isFinite(norm) || norm <= 1e-12) {
            return;
        }
        this._direction.multiplyScalar(1 / norm);

        this._position
            .copy(this._referencePosition)
            .addScaledVector(this._direction, this.distance);
        this.group.position.copy(this._position);
    }

    /**
     * Set a camera-relative anchor position in scene coordinates.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setReferencePosition(x, y, z) {
        if (!this.group) {
            return;
        }
        const rx = Number(x);
        const ry = Number(y);
        const rz = Number(z);
        if (!Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(rz)) {
            return;
        }
        this._referencePosition.set(rx, ry, rz);
        this._position
            .copy(this._referencePosition)
            .addScaledVector(this._direction, this.distance);
        this.group.position.copy(this._position);
    }

    /**
     * Copy current reference position into outVector.
     * @param {THREE.Vector3} outVector
     * @returns {boolean}
     */
    getReferencePosition(outVector) {
        if (!outVector || !this.group) {
            return false;
        }
        outVector.copy(this._referencePosition);
        return true;
    }

    /**
     * Keep appearance stable (no stylized pulsing).
     * @param {number} _timeMs
     */
    updateAppearance(_timeMs) {
        // Intentionally stable for physically constrained baseline rendering.
    }

    /**
     * Get current visual state used by sprite optics.
     * @returns {Object}
     */
    getVisualState() {
        return { ...this._visualState };
    }

    /**
     * Apply partial visual overrides to the Sun sprite optics.
     * @param {Object} nextState
     */
    setVisualState(nextState = {}) {
        if (!nextState || typeof nextState !== "object") {
            return;
        }
        this._visualState = {
            ...this._visualState,
            ...nextState,
        };
        this._applyVisualState();
    }

    _applyVisualState() {
        const base = this.radius * 2;
        const clampOpacity = (value) => THREE.MathUtils.clamp(Number(value), 0, 1);
        const safeScale = (value, fallback) => {
            const n = Number(value);
            if (!Number.isFinite(n) || n <= 0) return fallback;
            return n;
        };

        if (this.coreSprite?.material) {
            const opacity = clampOpacity(this._visualState.coreOpacity);
            this.coreSprite.material.opacity = opacity;
            const scaleMul = safeScale(this._visualState.coreScaleMul, 1.0);
            this.coreSprite.scale.setScalar(base * scaleMul);
            this.coreSprite.visible = opacity > 1e-4;
        }
        if (this.haloSprite?.material) {
            const opacity = clampOpacity(this._visualState.haloOpacity);
            this.haloSprite.material.opacity = opacity;
            const scaleMul = safeScale(this._visualState.haloScaleMul, SUN_HALO_SCALE);
            this.haloSprite.scale.setScalar(base * scaleMul);
            this.haloSprite.visible = opacity > 1e-4;
        }
        if (this.starburstSprite?.material) {
            const opacity = clampOpacity(this._visualState.starburstOpacity);
            this.starburstSprite.material.opacity = opacity;
            const scaleMul = safeScale(this._visualState.starburstScaleMul, SUN_STARBURST_SCALE);
            this.starburstSprite.scale.setScalar(base * scaleMul);
            this.starburstSprite.visible = opacity > 1e-4;
        }
        if (this.flareSprite?.material) {
            const opacity = clampOpacity(this._visualState.flareOpacity);
            this.flareSprite.material.opacity = opacity;
            const scaleXMul = safeScale(this._visualState.flareScaleXMul, SUN_FLARE_SCALE_X);
            const scaleYMul = safeScale(this._visualState.flareScaleYMul, SUN_FLARE_SCALE_Y);
            this.flareSprite.scale.set(base * scaleXMul, base * scaleYMul, 1);
            this.flareSprite.visible = opacity > 1e-4;
        }
    }

    /**
     * @param {boolean} visible
     */
    setVisible(visible) {
        if (this.group) {
            this.group.visible = visible;
        }
    }

    /**
     * Dispose meshes and materials.
     */
    dispose() {
        if (!this.group) {
            return;
        }

        const disposeSprite = (sprite) => {
            if (!sprite) return;
            this.group.remove(sprite);
            if (sprite.material?.map) {
                sprite.material.map.dispose?.();
            }
            sprite.material?.dispose?.();
        };

        disposeSprite(this.coreSprite);
        this.coreSprite = null;

        disposeSprite(this.haloSprite);
        this.haloSprite = null;

        disposeSprite(this.starburstSprite);
        this.starburstSprite = null;

        if (this.flareSprite) {
            disposeSprite(this.flareSprite);
            this.flareSprite = null;
        }

        for (const texture of this._dynamicTextures) {
            texture?.dispose?.();
        }
        this._dynamicTextures = [];

        this.parentContainer.remove(this.group);
        this.group = null;
    }

    _createSunDiscTexture() {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return null;
        }

        ctx.clearRect(0, 0, size, size);

        const gradient = ctx.createRadialGradient(
            size * 0.5,
            size * 0.5,
            size * 0.04,
            size * 0.5,
            size * 0.5,
            size * 0.5,
        );
        gradient.addColorStop(0.00, "rgba(255,255,250,1.0)");
        gradient.addColorStop(0.58, "rgba(255,250,238,1.0)");
        gradient.addColorStop(0.86, "rgba(255,243,218,0.95)");
        gradient.addColorStop(0.96, "rgba(255,228,190,0.50)");
        gradient.addColorStop(1.00, "rgba(255,228,190,0.00)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        this._dynamicTextures.push(texture);
        return texture;
    }

    _createHaloTexture() {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return null;
        }

        ctx.clearRect(0, 0, size, size);

        const gradient = ctx.createRadialGradient(
            size * 0.5,
            size * 0.5,
            size * 0.04,
            size * 0.5,
            size * 0.5,
            size * 0.5,
        );
        gradient.addColorStop(0.00, "rgba(255,245,220,0.26)");
        gradient.addColorStop(0.30, "rgba(255,222,176,0.22)");
        gradient.addColorStop(0.58, "rgba(255,210,150,0.10)");
        gradient.addColorStop(1.00, "rgba(255,180,120,0.00)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        this._dynamicTextures.push(texture);
        return texture;
    }

    _createStarburstTexture() {
        const size = 1024;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return null;
        }

        ctx.clearRect(0, 0, size, size);
        ctx.translate(size * 0.5, size * 0.5);

        const drawRay = (angleDeg, widthPx, innerAlpha, outerAlpha) => {
            const angle = THREE.MathUtils.degToRad(angleDeg);
            const len = size * 0.48;
            const halfW = widthPx * 0.5;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const nx = -sin;
            const ny = cos;

            const x1 = nx * halfW;
            const y1 = ny * halfW;
            const x2 = cos * len + nx * halfW;
            const y2 = sin * len + ny * halfW;
            const x3 = cos * len - nx * halfW;
            const y3 = sin * len - ny * halfW;
            const x4 = -nx * halfW;
            const y4 = -ny * halfW;

            const grad = ctx.createLinearGradient(0, 0, cos * len, sin * len);
            grad.addColorStop(0.0, `rgba(255,248,234,${innerAlpha})`);
            grad.addColorStop(1.0, `rgba(255,220,170,${outerAlpha})`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.lineTo(x4, y4);
            ctx.closePath();
            ctx.fill();
        };

        const primary = [0, 45, 90, 135];
        const secondary = [22.5, 67.5, 112.5, 157.5];
        primary.forEach((deg) => {
            drawRay(deg, size * 0.018, 0.95, 0.02);
            drawRay(deg + 180, size * 0.018, 0.95, 0.02);
        });
        secondary.forEach((deg) => {
            drawRay(deg, size * 0.010, 0.55, 0.01);
            drawRay(deg + 180, size * 0.010, 0.55, 0.01);
        });

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const core = ctx.createRadialGradient(
            size * 0.5,
            size * 0.5,
            size * 0.02,
            size * 0.5,
            size * 0.5,
            size * 0.13,
        );
        core.addColorStop(0.0, "rgba(255,255,252,0.95)");
        core.addColorStop(0.7, "rgba(255,245,220,0.35)");
        core.addColorStop(1.0, "rgba(255,230,190,0.0)");
        ctx.fillStyle = core;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        this._dynamicTextures.push(texture);
        return texture;
    }

    _createFlareTexture() {
        const width = 1024;
        const height = 160;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return null;
        }

        const horizontal = ctx.createLinearGradient(0, height * 0.5, width, height * 0.5);
        horizontal.addColorStop(0.0, "rgba(255, 186, 106, 0.00)");
        horizontal.addColorStop(0.15, "rgba(255, 186, 106, 0.10)");
        horizontal.addColorStop(0.5, "rgba(255, 235, 184, 0.85)");
        horizontal.addColorStop(0.85, "rgba(255, 186, 106, 0.10)");
        horizontal.addColorStop(1.0, "rgba(255, 186, 106, 0.00)");
        ctx.fillStyle = horizontal;
        ctx.fillRect(0, 0, width, height);

        const verticalFalloff = ctx.createLinearGradient(width * 0.5, 0, width * 0.5, height);
        verticalFalloff.addColorStop(0.0, "rgba(0,0,0,0.0)");
        verticalFalloff.addColorStop(0.5, "rgba(0,0,0,0.86)");
        verticalFalloff.addColorStop(1.0, "rgba(0,0,0,0.0)");
        ctx.globalCompositeOperation = "destination-in";
        ctx.fillStyle = verticalFalloff;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        this._dynamicTextures.push(texture);
        return texture;
    }
}
