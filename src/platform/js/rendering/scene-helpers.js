/**
 * Scene Helpers - Axes, reference planes, and scene visual aids.
 *
 * Manages:
 * - XYZ axes helper
 * - Ecliptic plane (grid + plane helper)
 * - Equatorial plane (grid + plane helper, tilted by Earth's axial inclination)
 * - Moon's Sphere of Influence (SOI) wireframe
 * - Optional attached halos for Earth, Moon, and active craft
 */

import * as THREE from "three";
import { COLORS as COL, PHYSICS_CONSTANTS as PC } from "../core/constants.js";
import { sampleOsculatingOrbitPoints } from "../core/domain/orbital-elements.js";

const MOON_ORBIT_SAMPLE_COUNT = 192;
const MOON_ORBIT_REFRESH_MS = 15 * 60 * 1000;

const BODY_HALO_KEYS = ["earth", "moon", "craft"];
const BODY_HALO_STYLE = Object.freeze({
    earth: {
        edgeRgb: [214, 236, 255],
        glowRgb: [186, 223, 255],
        edgeAlpha: 0.86,
        innerGlowAlpha: 0.34,
        outerRadiusScale: 2.25,
        innerRadiusScale: 1.0,
    },
    moon: {
        edgeRgb: [232, 240, 255],
        glowRgb: [197, 218, 255],
        edgeAlpha: 0.86,
        innerGlowAlpha: 0.30,
        outerRadiusScale: 3.7,
        innerRadiusScale: 1.0,
    },
    craft: {
        edgeRgb: [255, 208, 124],
        glowRgb: [255, 189, 95],
        edgeAlpha: 0.88,
        innerGlowAlpha: 0.35,
        outerRadiusScale: 1.5,
        innerRadiusScale: 1.0,
        minimumRadius: 0.85,
    },
});

// Hotfix gate: keep craft locator halo disabled without removing the code path.
const BODY_HALO_FEATURE_FLAGS = Object.freeze({
    earth: true,
    moon: true,
    craft: false,
});

function isBodyHaloFeatureEnabled(key) {
    return BODY_HALO_FEATURE_FLAGS[key] !== false;
}

function rgba(rgb, alpha) {
    const [r, g, b] = rgb;
    const normalizedAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha.toFixed(3)})`;
}

export class SceneHelpers {
    /**
     * @param {THREE.Object3D} parentContainer - Container to add helpers to
     */
    constructor(parentContainer) {
        this.parentContainer = parentContainer;

        // Axes
        this.axesHelper = null;

        // Ecliptic plane
        this.eclipticPolarGridHelper = null;
        this.eclipticPlaneHelper = null;

        // Equatorial plane
        this.equatorialPlaneContainer = null;
        this.equatorialPolarGridHelper = null;
        this.equatorialPlaneHelper = null;

        // Moon SOI
        this.moonSOISphere = null;
        this.moonContainer = null;

        // Body halos
        this.bodyHalosEnabled = false;
        this.bodyHaloTargets = {
            earth: null,
            moon: null,
            craft: null,
        };
        this.bodyHaloRadii = {
            earth: 0,
            moon: 0,
            craft: 0,
        };
        this.bodyHaloSprites = {
            earth: null,
            moon: null,
            craft: null,
        };
        this.bodyHaloMaterials = {
            earth: null,
            moon: null,
            craft: null,
        };
        this.bodyHaloTextures = {
            earth: null,
            moon: null,
            craft: null,
        };
        this.resolvedBodyHaloRadii = {
            earth: 0,
            moon: 0,
            craft: 0,
        };
        this.estimatedRadiusByObject = new WeakMap();
        this._bodyHaloCameraPosition = new THREE.Vector3();
        this._bodyHaloTargetPosition = new THREE.Vector3();
        this._bodyHaloOccluderPosition = new THREE.Vector3();
        this._bodyHaloCameraToOccluder = new THREE.Vector3();
        this._bodyHaloRayDirection = new THREE.Vector3();

        // Moon osculating orbit
        this.moonOsculatingOrbitLine = null;
        this.moonOsculatingOrbitLastUpdateTimeMs = null;
    }

    createAxesHelper(size, visible = false) {
        this.axesHelper = new THREE.AxesHelper(size);
        this.axesHelper.visible = visible;
        this.parentContainer.add(this.axesHelper);
    }

    createEclipticPlane(gridRadius, planeSize, visible = false) {
        const sectors = 18;
        const rings = 6;
        const divisions = 64;

        this.eclipticPolarGridHelper = new THREE.PolarGridHelper(
            gridRadius,
            sectors,
            rings,
            divisions,
            COL.ECLIPTIC_PLANE,
            COL.ECLIPTIC_PLANE,
        );
        this.eclipticPolarGridHelper.rotation.x = Math.PI / 2;
        this.eclipticPolarGridHelper.visible = visible;
        this.parentContainer.add(this.eclipticPolarGridHelper);

        const eclipticPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        this.eclipticPlaneHelper = new THREE.PlaneHelper(eclipticPlane, planeSize, COL.ECLIPTIC_PLANE);
        this.eclipticPlaneHelper.visible = visible;
        this.parentContainer.add(this.eclipticPlaneHelper);
    }

    createEquatorialPlane(gridRadius, planeSize, visible = false) {
        const sectors = 18;
        const rings = 6;
        const divisions = 64;

        this.equatorialPlaneContainer = new THREE.Group();
        this.equatorialPlaneContainer.lookAt(
            0,
            Math.sin(PC.EARTH_AXIS_INCLINATION_RADS),
            Math.cos(PC.EARTH_AXIS_INCLINATION_RADS),
        );

        this.equatorialPolarGridHelper = new THREE.PolarGridHelper(
            gridRadius,
            sectors,
            rings,
            divisions,
            COL.EQUATORIAL_PLANE,
            COL.EQUATORIAL_PLANE,
        );
        this.equatorialPolarGridHelper.rotation.x = Math.PI / 2;
        this.equatorialPolarGridHelper.visible = visible;
        this.equatorialPlaneContainer.add(this.equatorialPolarGridHelper);

        const direction = new THREE.Vector3();
        this.equatorialPlaneContainer.getWorldDirection(direction);
        const equatorialPlane = new THREE.Plane(direction, 0);
        this.equatorialPlaneHelper = new THREE.PlaneHelper(
            equatorialPlane,
            planeSize,
            COL.EQUATORIAL_PLANE,
        );
        this.equatorialPlaneHelper.visible = visible;
        this.equatorialPlaneContainer.add(this.equatorialPlaneHelper);

        this.parentContainer.add(this.equatorialPlaneContainer);
    }

    createMoonSOI(moonContainer, moonRadius, visible = false) {
        this.moonContainer = moonContainer;

        const soiRadius = moonRadius * (PC.MOON_SOI_RADIUS_KM / PC.MOON_RADIUS_KM);
        const latSegments = 18;
        const longSegments = 36;

        const geometry = new THREE.SphereGeometry(soiRadius, longSegments, latSegments);
        const material = new THREE.MeshBasicMaterial({
            color: COL.MOON_SOI,
            wireframe: true,
        });

        this.moonSOISphere = new THREE.Mesh(geometry, material);
        this.moonSOISphere.visible = visible;
        this.moonContainer.add(this.moonSOISphere);
    }

    _createBodyHaloTexture(key) {
        const canvas = document.createElement("canvas");
        const size = 512;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) {
            return null;
        }

        const style = BODY_HALO_STYLE[key];
        const center = size / 2;
        const outerRadius = center * 0.92;
        const innerRadiusRatio = (style.innerRadiusScale || 1) / (style.outerRadiusScale || 1.5);
        const innerRadius = Math.max(0, Math.min(outerRadius * 0.99, outerRadius * innerRadiusRatio));

        context.clearRect(0, 0, size, size);

        // Draw an annulus that starts exactly at the body edge and fades to the outer halo radius.
        const haloGradient = context.createRadialGradient(
            center,
            center,
            innerRadius,
            center,
            center,
            outerRadius,
        );
        haloGradient.addColorStop(0.0, rgba(style.glowRgb, style.innerGlowAlpha));
        haloGradient.addColorStop(0.5, rgba(style.glowRgb, (style.innerGlowAlpha || 0.3) * 0.55));
        haloGradient.addColorStop(1.0, rgba(style.glowRgb, 0));

        context.beginPath();
        context.arc(center, center, outerRadius, 0, Math.PI * 2);
        context.arc(center, center, innerRadius, 0, Math.PI * 2, true);
        context.fillStyle = haloGradient;
        context.fill("evenodd");

        // Crisp edge exactly at body radius so the locator starts at 1.0r.
        context.beginPath();
        context.arc(center, center, innerRadius, 0, Math.PI * 2);
        context.strokeStyle = rgba(style.edgeRgb, style.edgeAlpha);
        context.lineWidth = size * 0.008;
        context.stroke();

        // Very soft outer edge helps visibility without a hard boundary.
        context.beginPath();
        context.arc(center, center, outerRadius * 0.985, 0, Math.PI * 2);
        context.strokeStyle = rgba(style.glowRgb, 0.08);
        context.lineWidth = size * 0.004;
        context.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        return texture;
    }

    _ensureBodyHaloSprite(key) {
        if (this.bodyHaloSprites[key]) {
            return this.bodyHaloSprites[key];
        }

        if (typeof document === "undefined") {
            return null;
        }

        const texture = this._createBodyHaloTexture(key);
        if (!texture) {
            return null;
        }
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.visible = false;
        sprite.renderOrder = 22;

        this.bodyHaloTextures[key] = texture;
        this.bodyHaloMaterials[key] = material;
        this.bodyHaloSprites[key] = sprite;
        return sprite;
    }

    _attachBodyHaloSprite(key, target) {
        const sprite = this._ensureBodyHaloSprite(key);
        if (!sprite || !target) {
            return;
        }

        if (sprite.parent === target) {
            return;
        }

        sprite.parent?.remove?.(sprite);
        target.add(sprite);
    }

    setBodyHaloTargets({
        earthTarget = undefined,
        earthRadius = undefined,
        moonTarget = undefined,
        moonRadius = undefined,
        craftTarget = undefined,
        craftRadius = undefined,
    } = {}) {
        const updateTarget = (key, value) => {
            if (value === undefined) return;
            if (!isBodyHaloFeatureEnabled(key)) {
                this.bodyHaloTargets[key] = null;
                this.bodyHaloRadii[key] = 0;
                return;
            }
            this.bodyHaloTargets[key] = value || null;
        };

        const updateRadius = (key, value) => {
            if (value === undefined) return;
            if (!isBodyHaloFeatureEnabled(key)) {
                this.bodyHaloRadii[key] = 0;
                return;
            }
            this.bodyHaloRadii[key] = Number.isFinite(value) && value > 0 ? value : 0;
        };

        updateTarget("earth", earthTarget);
        updateTarget("moon", moonTarget);
        updateTarget("craft", craftTarget);
        updateRadius("earth", earthRadius);
        updateRadius("moon", moonRadius);
        updateRadius("craft", craftRadius);
    }

    createBodyHalos({
        earthTarget = undefined,
        earthRadius = undefined,
        moonTarget = undefined,
        moonRadius = undefined,
        craftTarget = undefined,
        craftRadius = undefined,
        visible = false,
    } = {}) {
        this.setBodyHaloTargets({
            earthTarget,
            earthRadius,
            moonTarget,
            moonRadius,
            craftTarget,
            craftRadius,
        });
        this.bodyHalosEnabled = Boolean(visible);

        if (typeof document === "undefined") {
            return;
        }

        for (const key of BODY_HALO_KEYS) {
            if (!isBodyHaloFeatureEnabled(key)) continue;
            const target = this.bodyHaloTargets[key];
            if (!target) continue;
            this._attachBodyHaloSprite(key, target);
        }

        if (!this.bodyHalosEnabled) {
            this.hideBodyHalos();
        }
    }

    hideBodyHalos() {
        for (const key of BODY_HALO_KEYS) {
            const sprite = this.bodyHaloSprites[key];
            if (sprite) {
                sprite.visible = false;
            }
        }
    }

    _estimateObjectRadius(object, fallback = 1) {
        if (!object) return fallback;
        if (this.estimatedRadiusByObject.has(object)) {
            return this.estimatedRadiusByObject.get(object);
        }

        let radius = Number.NaN;
        const considerGeometry = (geometry, scaleFactor = 1) => {
            if (!geometry) return;
            if (!geometry.boundingSphere) {
                geometry.computeBoundingSphere?.();
            }
            const geometryRadius = geometry.boundingSphere?.radius;
            if (!Number.isFinite(geometryRadius) || geometryRadius <= 0) return;
            const scaled = geometryRadius * scaleFactor;
            if (!Number.isFinite(radius) || scaled > radius) {
                radius = scaled;
            }
        };

        const rootScale = Math.max(
            Math.abs(object.scale?.x ?? 1),
            Math.abs(object.scale?.y ?? 1),
            Math.abs(object.scale?.z ?? 1),
        );
        considerGeometry(object.geometry, rootScale);

        if (typeof object.traverse === "function") {
            object.traverse((node) => {
                const nodeScale = Math.max(
                    Math.abs(node?.scale?.x ?? 1),
                    Math.abs(node?.scale?.y ?? 1),
                    Math.abs(node?.scale?.z ?? 1),
                );
                considerGeometry(node?.geometry, nodeScale);
            });
        }

        if (Number.isFinite(radius) && radius > 0) {
            this.estimatedRadiusByObject.set(object, radius);
            return radius;
        }

        return fallback;
    }

    _resolveHaloBodyRadius(key, target) {
        const style = BODY_HALO_STYLE[key];
        const explicitRadius = this.bodyHaloRadii[key];
        let resolvedRadius = Number.isFinite(explicitRadius) && explicitRadius > 0
            ? explicitRadius
            : key === "craft"
                ? this._estimateObjectRadius(target, style.minimumRadius || 0.75)
                : 0;

        if (key === "craft" && Number.isFinite(style.minimumRadius)) {
            resolvedRadius = Math.max(style.minimumRadius, resolvedRadius);
        }
        if (!Number.isFinite(resolvedRadius) || resolvedRadius <= 0) {
            return 0;
        }
        return resolvedRadius;
    }

    _isBodyHaloOccluded({
        key,
        targetDistance,
        cameraWorldPosition,
    }) {
        const occlusionPadding = 0.98;
        for (const occluderKey of BODY_HALO_KEYS) {
            if (occluderKey === key) continue;
            const occluderTarget = this.bodyHaloTargets[occluderKey];
            if (!occluderTarget) continue;
            const occluderRadius = this.resolvedBodyHaloRadii[occluderKey];
            if (!Number.isFinite(occluderRadius) || occluderRadius <= 0) continue;

            occluderTarget.getWorldPosition(this._bodyHaloOccluderPosition);
            this._bodyHaloCameraToOccluder
                .copy(this._bodyHaloOccluderPosition)
                .sub(cameraWorldPosition);
            const projectedDistance = this._bodyHaloCameraToOccluder.dot(this._bodyHaloRayDirection);
            if (projectedDistance <= 0 || projectedDistance >= targetDistance) {
                continue;
            }

            const centerDistanceSq = this._bodyHaloCameraToOccluder.lengthSq();
            const perpendicularDistanceSq = Math.max(
                0,
                centerDistanceSq - projectedDistance * projectedDistance,
            );
            const occluderRadiusSq = (occluderRadius * occlusionPadding) ** 2;
            if (perpendicularDistanceSq <= occluderRadiusSq) {
                return true;
            }
        }
        return false;
    }

    _updateSingleBodyHalo({ key, cameraWorldPosition }) {
        const target = this.bodyHaloTargets[key];
        const sprite = this.bodyHaloSprites[key];
        if (!target || !sprite) {
            if (sprite) sprite.visible = false;
            return;
        }

        if (sprite.parent !== target) {
            this._attachBodyHaloSprite(key, target);
        }

        const style = BODY_HALO_STYLE[key];
        const resolvedRadius = this.resolvedBodyHaloRadii[key];
        if (!Number.isFinite(resolvedRadius) || resolvedRadius <= 0) {
            sprite.visible = false;
            return;
        }

        target.getWorldPosition(this._bodyHaloTargetPosition);
        this._bodyHaloRayDirection
            .copy(this._bodyHaloTargetPosition)
            .sub(cameraWorldPosition);
        const targetDistance = this._bodyHaloRayDirection.length();
        if (!Number.isFinite(targetDistance) || targetDistance <= 1e-6) {
            sprite.visible = false;
            return;
        }
        this._bodyHaloRayDirection.multiplyScalar(1 / targetDistance);
        if (this._isBodyHaloOccluded({
            key,
            targetDistance,
            cameraWorldPosition,
        })) {
            sprite.visible = false;
            return;
        }

        const outerRadiusScale = Number.isFinite(style.outerRadiusScale) && style.outerRadiusScale > 0
            ? style.outerRadiusScale
            : 1.5;
        const diameter = resolvedRadius * outerRadiusScale * 2;
        sprite.scale.set(diameter, diameter, 1);
        sprite.visible = true;
    }

    updateBodyHalos({
        camera,
        visible = true,
        earthTarget = undefined,
        earthRadius = undefined,
        moonTarget = undefined,
        moonRadius = undefined,
        craftTarget = undefined,
        craftRadius = undefined,
    } = {}) {
        this.setBodyHaloTargets({
            earthTarget,
            earthRadius,
            moonTarget,
            moonRadius,
            craftTarget,
            craftRadius,
        });

        if (!visible || !this.bodyHalosEnabled || !camera || !camera.isPerspectiveCamera) {
            this.hideBodyHalos();
            return;
        }

        camera.getWorldPosition(this._bodyHaloCameraPosition);
        for (const key of BODY_HALO_KEYS) {
            if (!isBodyHaloFeatureEnabled(key)) {
                this.resolvedBodyHaloRadii[key] = 0;
                if (this.bodyHaloSprites[key]) {
                    this.bodyHaloSprites[key].visible = false;
                }
                continue;
            }
            const target = this.bodyHaloTargets[key];
            this.resolvedBodyHaloRadii[key] = target
                ? this._resolveHaloBodyRadius(key, target)
                : 0;
        }

        for (const key of BODY_HALO_KEYS) {
            if (!isBodyHaloFeatureEnabled(key)) continue;
            if (!this.bodyHaloSprites[key]) {
                this._ensureBodyHaloSprite(key);
            }
            this._updateSingleBodyHalo({
                key,
                cameraWorldPosition: this._bodyHaloCameraPosition,
            });
        }
    }

    createMoonOsculatingOrbit(visible = false) {
        const geometry = new THREE.BufferGeometry();
        const attribute = new THREE.Float32BufferAttribute(
            new Float32Array(MOON_ORBIT_SAMPLE_COUNT * 3),
            3,
        );
        geometry.setAttribute("position", attribute);
        geometry.setDrawRange(0, MOON_ORBIT_SAMPLE_COUNT);

        const material = new THREE.LineBasicMaterial({
            color: COL.MOON_OSCULATING_ORBIT,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
        });
        this.moonOsculatingOrbitLine = new THREE.LineLoop(geometry, material);
        this.moonOsculatingOrbitLine.visible = visible;
        this.parentContainer.add(this.moonOsculatingOrbitLine);
    }

    updateMoonOsculatingOrbit({
        position,
        velocity,
        pixelsPerAU,
        timeMs,
        visible = false,
    }) {
        if (!this.moonOsculatingOrbitLine) {
            return;
        }

        const shouldRefreshOrbit =
            !Number.isFinite(this.moonOsculatingOrbitLastUpdateTimeMs) ||
            !Number.isFinite(timeMs) ||
            Math.abs(timeMs - this.moonOsculatingOrbitLastUpdateTimeMs) >= MOON_ORBIT_REFRESH_MS;

        if (!shouldRefreshOrbit) {
            this.moonOsculatingOrbitLine.visible = Boolean(visible);
            return;
        }

        const sampledOrbit = sampleOsculatingOrbitPoints({
            position,
            velocity: {
                x: velocity.vx,
                y: velocity.vy,
                z: velocity.vz,
            },
            gravitationalParameter: PC.EARTH_GM_KM3_S2,
            sampleCount: MOON_ORBIT_SAMPLE_COUNT,
        });
        if (!sampledOrbit?.points?.length) {
            this.moonOsculatingOrbitLine.visible = false;
            return;
        }

        const scale = pixelsPerAU / PC.KM_PER_AU;
        const positions = this.moonOsculatingOrbitLine.geometry.getAttribute("position");
        let offset = 0;
        for (const point of sampledOrbit.points) {
            positions.array[offset++] = point.x * scale;
            positions.array[offset++] = point.y * scale;
            positions.array[offset++] = point.z * scale;
        }
        positions.needsUpdate = true;
        this.moonOsculatingOrbitLine.geometry.computeBoundingSphere?.();
        this.moonOsculatingOrbitLine.visible = Boolean(visible);
        this.moonOsculatingOrbitLastUpdateTimeMs = Number.isFinite(timeMs)
            ? timeMs
            : this.moonOsculatingOrbitLastUpdateTimeMs;
    }

    setAxesVisible(visible) {
        if (this.axesHelper) this.axesHelper.visible = visible;
    }

    setEclipticPlaneVisible(visible) {
        if (this.eclipticPolarGridHelper) this.eclipticPolarGridHelper.visible = visible;
        if (this.eclipticPlaneHelper) this.eclipticPlaneHelper.visible = visible;
    }

    setEquatorialPlaneVisible(visible) {
        if (this.equatorialPolarGridHelper) this.equatorialPolarGridHelper.visible = visible;
        if (this.equatorialPlaneHelper) this.equatorialPlaneHelper.visible = visible;
    }

    setMoonSOIVisible(visible) {
        if (this.moonSOISphere) this.moonSOISphere.visible = visible;
    }

    setBodyHalosVisible(visible) {
        this.bodyHalosEnabled = Boolean(visible);
        if (!this.bodyHalosEnabled) {
            this.hideBodyHalos();
        }
    }

    setMoonOsculatingOrbitVisible(visible) {
        if (this.moonOsculatingOrbitLine) this.moonOsculatingOrbitLine.visible = visible;
    }

    disposeAxesHelper() {
        if (this.axesHelper) {
            this.parentContainer.remove(this.axesHelper);
            this.axesHelper.dispose();
            this.axesHelper = null;
        }
    }

    disposeEclipticPlane() {
        if (this.eclipticPolarGridHelper) {
            this.parentContainer.remove(this.eclipticPolarGridHelper);
            this.eclipticPolarGridHelper.dispose();
            this.eclipticPolarGridHelper = null;
        }
        if (this.eclipticPlaneHelper) {
            this.parentContainer.remove(this.eclipticPlaneHelper);
            this.eclipticPlaneHelper.dispose();
            this.eclipticPlaneHelper = null;
        }
    }

    disposeEquatorialPlane() {
        if (this.equatorialPolarGridHelper) {
            this.equatorialPolarGridHelper.dispose();
            this.equatorialPolarGridHelper = null;
        }
        if (this.equatorialPlaneHelper) {
            this.equatorialPlaneHelper.dispose();
            this.equatorialPlaneHelper = null;
        }
        if (this.equatorialPlaneContainer) {
            this.parentContainer.remove(this.equatorialPlaneContainer);
            this.equatorialPlaneContainer.clear();
            this.equatorialPlaneContainer = null;
        }
    }

    disposeMoonSOI() {
        if (this.moonSOISphere && this.moonContainer) {
            this.moonContainer.remove(this.moonSOISphere);
            this.moonSOISphere.geometry.dispose();
            this.moonSOISphere.material.dispose();
            this.moonSOISphere = null;
        }
    }

    disposeBodyHalos() {
        for (const key of BODY_HALO_KEYS) {
            const sprite = this.bodyHaloSprites[key];
            if (sprite?.parent) {
                sprite.parent.remove(sprite);
            }
            this.bodyHaloMaterials[key]?.dispose?.();
            this.bodyHaloTextures[key]?.dispose?.();
            this.bodyHaloSprites[key] = null;
            this.bodyHaloMaterials[key] = null;
            this.bodyHaloTextures[key] = null;
            this.bodyHaloTargets[key] = null;
            this.bodyHaloRadii[key] = 0;
            this.resolvedBodyHaloRadii[key] = 0;
        }
        this.bodyHalosEnabled = false;
        this.estimatedRadiusByObject = new WeakMap();
    }

    disposeMoonOsculatingOrbit() {
        if (this.moonOsculatingOrbitLine) {
            this.parentContainer.remove(this.moonOsculatingOrbitLine);
            this.moonOsculatingOrbitLine.geometry?.dispose?.();
            this.moonOsculatingOrbitLine.material?.dispose?.();
            this.moonOsculatingOrbitLine = null;
            this.moonOsculatingOrbitLastUpdateTimeMs = null;
        }
    }

    dispose() {
        this.disposeAxesHelper();
        this.disposeEclipticPlane();
        this.disposeEquatorialPlane();
        this.disposeMoonSOI();
        this.disposeBodyHalos();
        this.disposeMoonOsculatingOrbit();
    }
}
