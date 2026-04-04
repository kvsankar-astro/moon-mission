import * as THREE from 'three';

const SKY_RADIUS_MULTIPLIER = 200;
const SUN_BASE_RADIUS_MIN_MULTIPLIER = 0.7;
const SUN_RADIUS_DISTANCE_MULTIPLIER = 0.0036;
const SUN_MAX_FLARE_HALF_EXTENT_MULTIPLIER = 18.2;
const SUN_EDGE_MARGIN_RADIUS_MULTIPLIER = 0.8;

/**
 * Sun Renderer - Lightweight visual sun disk + glow
 *
 * The sun is rendered as an emissive-looking sphere and halo that follows the
 * existing sun direction used by scene lighting.
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
        this.radius = Math.max(
            this.baseRadius * SUN_BASE_RADIUS_MIN_MULTIPLIER,
            this.distance * SUN_RADIUS_DISTANCE_MULTIPLIER,
        );

        this.group = null;
        this.coreMesh = null;
        this.glowMesh = null;
        this.coronaSprite = null;
        this.haloSprite = null;
        this.flareSprite = null;
        this._dynamicTextures = [];

        this._direction = new THREE.Vector3(1, 0, 0);
        this._referencePosition = new THREE.Vector3();
        this._position = new THREE.Vector3();
        this._pulsePhase = Math.random() * Math.PI * 2;
        this._lastAppearanceUpdateMs = -Infinity;
    }

    computeSafeDistance() {
        const skyRadius = SKY_RADIUS_MULTIPLIER * this.baseRadius;
        const nominalDistance = skyRadius * 0.94;
        const nominalRadius = Math.max(
            this.baseRadius * SUN_BASE_RADIUS_MIN_MULTIPLIER,
            nominalDistance * SUN_RADIUS_DISTANCE_MULTIPLIER,
        );
        const flareHalfExtent = nominalRadius * SUN_MAX_FLARE_HALF_EXTENT_MULTIPLIER;
        const edgeMargin = nominalRadius * SUN_EDGE_MARGIN_RADIUS_MULTIPLIER;
        const safeDistance = skyRadius - flareHalfExtent - edgeMargin;
        const fallbackDistance = 180 * this.baseRadius;

        return Math.max(fallbackDistance, safeDistance);
    }

    /**
     * Create visible sun meshes
     * @param {boolean} visible
     */
    create(visible = true) {
        this.group = new THREE.Group();

        const coreGeometry = new THREE.SphereGeometry(this.radius, 32, 24);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0xfff2c3,
            toneMapped: false,
            depthWrite: false,
        });
        this.coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
        this.coreMesh.castShadow = false;
        this.coreMesh.receiveShadow = false;
        this.coreMesh.frustumCulled = false;
        this.coreMesh.renderOrder = -18;
        this.group.add(this.coreMesh);

        const glowGeometry = new THREE.SphereGeometry(this.radius * 2.4, 24, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffb661,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true,
            toneMapped: false,
        });
        this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.glowMesh.castShadow = false;
        this.glowMesh.receiveShadow = false;
        this.glowMesh.frustumCulled = false;
        this.glowMesh.renderOrder = -19;
        this.group.add(this.glowMesh);

        const coronaTexture = this._createRadialTexture({
            innerColor: "rgba(255, 234, 168, 0.92)",
            midColor: "rgba(255, 170, 88, 0.38)",
            outerColor: "rgba(255, 124, 48, 0.00)",
        });
        const haloTexture = this._createRadialTexture({
            innerColor: "rgba(255, 196, 124, 0.40)",
            midColor: "rgba(255, 140, 60, 0.12)",
            outerColor: "rgba(255, 120, 40, 0.00)",
        });
        const flareTexture = this._createFlareTexture();

        this.coronaSprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: coronaTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 0.76,
                depthWrite: false,
                depthTest: true,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }),
        );
        this.coronaSprite.scale.setScalar(this.radius * 11.5);
        this.coronaSprite.renderOrder = -20;
        this.group.add(this.coronaSprite);

        this.haloSprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: haloTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 0.34,
                depthWrite: false,
                depthTest: true,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }),
        );
        this.haloSprite.scale.setScalar(this.radius * 23);
        this.haloSprite.renderOrder = -22;
        this.group.add(this.haloSprite);

        this.flareSprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: flareTexture,
                color: 0xffb772,
                transparent: true,
                opacity: 0.30,
                depthWrite: false,
                depthTest: true,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }),
        );
        this.flareSprite.scale.set(this.radius * 36, this.radius * 2.8, 1);
        this.flareSprite.renderOrder = -21;
        this.group.add(this.flareSprite);

        this.group.visible = visible;
        this.group.frustumCulled = false;
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
     * This keeps the Sun visually "at infinity" while preserving physical
     * lighting direction from ephemeris.
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
     * Subtle breathing so the sun feels alive without distracting flicker.
     * @param {number} timeMs
     */
    updateAppearance(timeMs) {
        if (Number.isFinite(this._lastAppearanceUpdateMs) && Math.abs(timeMs - this._lastAppearanceUpdateMs) < 80) {
            return;
        }
        this._lastAppearanceUpdateMs = timeMs;

        const t = Number.isFinite(timeMs) ? timeMs * 0.001 : 0;
        const pulseA = 0.5 + 0.5 * Math.sin(t * 0.85 + this._pulsePhase);
        const pulseB = 0.5 + 0.5 * Math.sin(t * 0.48 + this._pulsePhase * 0.63 + 1.7);

        if (this.coronaSprite?.material) {
            this.coronaSprite.material.opacity = 0.66 + pulseA * 0.18;
        }
        if (this.haloSprite?.material) {
            this.haloSprite.material.opacity = 0.26 + pulseB * 0.12;
        }
        if (this.flareSprite?.material) {
            this.flareSprite.material.opacity = 0.20 + pulseA * 0.16;
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

        if (this.coreMesh) {
            this.group.remove(this.coreMesh);
            this.coreMesh.geometry?.dispose?.();
            this.coreMesh.material?.dispose?.();
            this.coreMesh = null;
        }

        if (this.glowMesh) {
            this.group.remove(this.glowMesh);
            this.glowMesh.geometry?.dispose?.();
            this.glowMesh.material?.dispose?.();
            this.glowMesh = null;
        }

        if (this.coronaSprite) {
            this.group.remove(this.coronaSprite);
            this.coronaSprite.material?.dispose?.();
            this.coronaSprite = null;
        }
        if (this.haloSprite) {
            this.group.remove(this.haloSprite);
            this.haloSprite.material?.dispose?.();
            this.haloSprite = null;
        }
        if (this.flareSprite) {
            this.group.remove(this.flareSprite);
            this.flareSprite.material?.dispose?.();
            this.flareSprite = null;
        }

        for (const texture of this._dynamicTextures) {
            texture?.dispose?.();
        }
        this._dynamicTextures = [];

        this.parentContainer.remove(this.group);
        this.group = null;
    }

    _createRadialTexture({ innerColor, midColor, outerColor }) {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return null;
        }

        const gradient = ctx.createRadialGradient(
            size * 0.5,
            size * 0.5,
            size * 0.02,
            size * 0.5,
            size * 0.5,
            size * 0.5,
        );
        gradient.addColorStop(0.0, innerColor);
        gradient.addColorStop(0.38, midColor);
        gradient.addColorStop(1.0, outerColor);
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

    _createFlareTexture() {
        const width = 1024;
        const height = 128;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return null;
        }

        const horizontal = ctx.createLinearGradient(0, height * 0.5, width, height * 0.5);
        horizontal.addColorStop(0.0, "rgba(255, 186, 106, 0.00)");
        horizontal.addColorStop(0.2, "rgba(255, 186, 106, 0.14)");
        horizontal.addColorStop(0.5, "rgba(255, 222, 160, 0.95)");
        horizontal.addColorStop(0.8, "rgba(255, 186, 106, 0.14)");
        horizontal.addColorStop(1.0, "rgba(255, 186, 106, 0.00)");
        ctx.fillStyle = horizontal;
        ctx.fillRect(0, 0, width, height);

        const verticalFalloff = ctx.createLinearGradient(width * 0.5, 0, width * 0.5, height);
        verticalFalloff.addColorStop(0.0, "rgba(0,0,0,0.0)");
        verticalFalloff.addColorStop(0.5, "rgba(0,0,0,0.8)");
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
