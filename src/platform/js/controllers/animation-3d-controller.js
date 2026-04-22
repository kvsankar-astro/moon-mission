/**
 * Animation3DController - Renders 3D scene from computed state
 *
 * Part of the pull-based renderer architecture:
 * - Animation loop pulls state from SceneStateController
 * - Passes state to this controller
 * - Controller updates THREE.js objects and renders
 *
 * One instance per config (geo, lunar).
 */

import { PHYSICS_CONSTANTS as PC, LIGHT_SETTINGS as LT } from "../core/constants.js";
import { toScreenCoordinates } from "../scene-state.js";
import { resolveTrailLayerWindow, resolveTrailWindow } from "../app/orbit-trail-style.js";

// PIXELS_PER_AU is passed as a render option since it varies by config

function normalizeDirection(candidate) {
    const x = Number(candidate?.x);
    const y = Number(candidate?.y);
    const z = Number(candidate?.z);
    const norm = Math.hypot(x, y, z);
    if (!Number.isFinite(norm) || norm <= 1e-12) {
        return null;
    }
    return {
        x: x / norm,
        y: y / norm,
        z: z / norm,
    };
}

function cloneDirection(direction) {
    return direction
        ? {
            x: direction.x,
            y: direction.y,
            z: direction.z,
        }
        : null;
}

function createFixedCompareSunDirections(compareDisplayProfile) {
    const fixedDirection = normalizeDirection(compareDisplayProfile?.fixedSunDirection);
    if (!fixedDirection) {
        return null;
    }
    return {
        earthCentered: cloneDirection(fixedDirection),
        moonCentered: cloneDirection(fixedDirection),
        craftCentered: cloneDirection(fixedDirection),
        craftCenteredLightTime: cloneDirection(fixedDirection),
    };
}

export class Animation3DController {
    /**
     * Create a 3D animation controller.
     * @param {string} config - Configuration name: "geo" or "lunar"
     * @param {Object} animationScene - The AnimationScene instance for this config
     */
    constructor(config, animationScene) {
        this.config = config;
        this.scene = animationScene;
        this._frozenNextScreenPosByCraftId = {};
    }

    /**
     * Render the 3D scene based on computed state.
     * @param {Object} state - Scene state from computeSceneState()
     * @param {Object} options - Additional render options
     * @param {string} options.craftId - Spacecraft ID (e.g., "SC")
     * @param {number} options.pixelsPerAU - Scale factor for coordinate conversion
     * @param {Function} options.updateCraftScale - Callback to update craft scale
     */
    render(state, options = /** @type {any} */ ({}) ) {
        if (!this.scene || !this.scene.initialized3D) {
            return;
        }

        /** @type {{ craftId?: string, pixelsPerAU?: number, updateCraftScale?: Function, landingFreezeTime?: number | null, compareMode?: boolean, compareDisplayProfile?: Object | null }} */
        const renderOptions = options || {};
        const {
            craftId = "SC",
            pixelsPerAU = 250,
            updateCraftScale,
            landingFreezeTime = null,
            compareMode = false,
            compareDisplayProfile = null,
        } = renderOptions;
        const fixedCompareSunDirections = compareMode
            ? createFixedCompareSunDirections(compareDisplayProfile)
            : null;
        const effectiveSunDirections = fixedCompareSunDirections || state.sunDirections || null;
        const effectiveSunDirection = effectiveSunDirections?.earthCentered || state.sunDirection;
        this.pixelsPerAU = pixelsPerAU;
        // Carry body-specific sun directions for lighting and craft optics.
        this.scene.stateSunDirection = effectiveSunDirection;
        this.scene.stateSunDirections = effectiveSunDirections;
        this.scene.stateTime = state.time;
        this.scene.latestSceneState = state;
        if (!(compareMode && compareDisplayProfile?.freezeSkyOrientation)) {
            this.scene.skyRenderer?.setTime?.(state.time, { realtimeFrame: true });
        }

        // 1. Update lighting from sun position
        this.updateLighting(
            state.sunLongitude,
            state.bodies,
            effectiveSunDirections,
            compareMode ? compareDisplayProfile : null,
        );

        // 2. Rotate Earth and Moon based on time
        if (!(compareMode && compareDisplayProfile?.freezeEarthRotation)) {
            this.scene.rotateEarth(state.time);
        }
        if (!(compareMode && compareDisplayProfile?.freezeMoonRotation)) {
            this.scene.rotateMoon(state.time);
        }

        // 3. Update body positions
        this.updateBodyPositions(state.bodies, craftId, state.time, landingFreezeTime);

        // 3b. Update time-windowed orbit trails
        this.updateOrbitTrails(state.time, state.bodies);

        // 4. Update spacecraft scale (depends on camera distance)
        if (updateCraftScale) {
            updateCraftScale();
        }

        // 5. Render the scene
        // Note: render() is called separately by the animation loop
    }

    /**
     * Update light positions based on sun longitude.
     * @param {number} sunLongitude - Sun longitude in radians
     */
    updateLighting(sunLongitude, bodies = null, sunDirections = null, compareDisplayProfile = null) {
        if (!this.scene.light || !this.scene.light2) {
            return;
        }
        const bodyAmbientLight = this.scene.lightManager?.bodyAmbientLight || null;
        const renderSettings = this.scene.moonRenderSettings || null;
        const suppressLunarFillLighting =
            (
                (Number.isFinite(Number(renderSettings?.terminatorIndirectOcclusion)) &&
                    Number(renderSettings?.terminatorIndirectOcclusion) >= 0.9) ||
                (Number.isFinite(Number(renderSettings?.terminatorShadowFloor)) &&
                    Number(renderSettings?.terminatorShadowFloor) <= 0.05)
            );
        if (bodyAmbientLight) {
            bodyAmbientLight.intensity = suppressLunarFillLighting
                ? 0.0
                : (Number.isFinite(LT.AMBIENT_INTENSITY) ? LT.AMBIENT_INTENSITY : 0.01);
        }
        const shadowNormalBias = Number(renderSettings?.shadowNormalBias);
        if (Number.isFinite(shadowNormalBias) && this.scene.light?.shadow) {
            this.scene.light.shadow.normalBias = shadowNormalBias;
        }
        const shadowBias = Number(renderSettings?.shadowBias);
        if (Number.isFinite(shadowBias) && this.scene.light?.shadow) {
            this.scene.light.shadow.bias = shadowBias;
        }

        const earthState = bodies?.EARTH;
        const moonState = bodies?.MOON;

        const normalizeDir = (candidate, fallbackX = 1, fallbackY = 0, fallbackZ = 0) => {
            let x = fallbackX;
            let y = fallbackY;
            let z = fallbackZ;
            if (candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z)) {
                x = candidate.x;
                y = candidate.y;
                z = candidate.z;
            }
            const norm = Math.hypot(x, y, z);
            if (!Number.isFinite(norm) || norm <= 1e-12) {
                return { x: fallbackX, y: fallbackY, z: fallbackZ };
            }
            return {
                x: x / norm,
                y: y / norm,
                z: z / norm,
            };
        };

        const fallbackDir = normalizeDir({
            x: Math.cos(sunLongitude),
            y: Math.sin(sunLongitude),
            z: 0,
        });
        const earthSunDir = normalizeDir(
            sunDirections?.earthCentered || this.scene.stateSunDirection,
            fallbackDir.x,
            fallbackDir.y,
            fallbackDir.z,
        );
        const moonSunDir = normalizeDir(
            sunDirections?.moonCentered,
            earthSunDir.x,
            earthSunDir.y,
            earthSunDir.z,
        );
        const craftSunDir = normalizeDir(
            sunDirections?.craftCenteredLightTime || sunDirections?.craftCentered,
            earthSunDir.x,
            earthSunDir.y,
            earthSunDir.z,
        );

        // Keep spacecraft key light directional-only and use craft apparent sun.
        this.scene.light2.position.set(craftSunDir.x, craftSunDir.y, craftSunDir.z);
        // Default global Sun billboard direction remains Earth-centered.
        this.scene.sunRenderer?.setDirection?.(earthSunDir.x, earthSunDir.y, earthSunDir.z);
        this.scene.sunRenderer?.updateAppearance?.(this.scene?.stateTime ?? 0);

        // Anchor the shadow-casting primary light to the illuminated body so
        // the shadow frustum stays tight and terrain relief can self-shadow.
        const shadowAnchorState = moonState?.available
            ? moonState
            : (earthState?.available ? earthState : null);
        const shadowDistance = Number.isFinite(LT.SHADOW_LIGHT_DISTANCE)
            ? LT.SHADOW_LIGHT_DISTANCE
            : 8.0;
        const shadowFrustumHalfFromRadius = Number.isFinite(this.scene.secondaryBodyRadius)
            ? this.scene.secondaryBodyRadius * (Number.isFinite(LT.SHADOW_FRUSTUM_RADIUS_MULTIPLIER) ? LT.SHADOW_FRUSTUM_RADIUS_MULTIPLIER : 1.35)
            : (Number.isFinite(LT.SHADOW_FRUSTUM_HALF_SIZE) ? LT.SHADOW_FRUSTUM_HALF_SIZE : 2.4);
        const shadowFrustumHalf = Math.max(
            Number.isFinite(LT.SHADOW_FRUSTUM_MIN_HALF_SIZE) ? LT.SHADOW_FRUSTUM_MIN_HALF_SIZE : 1.6,
            shadowFrustumHalfFromRadius,
        );

        if (shadowAnchorState && Number.isFinite(this.pixelsPerAU)) {
            const anchorX = shadowAnchorState.position.x * this.pixelsPerAU;
            const anchorY = shadowAnchorState.position.y * this.pixelsPerAU;
            const anchorZ = shadowAnchorState.position.z * this.pixelsPerAU;
            this.scene.light.position.set(
                anchorX + (moonState?.available ? moonSunDir.x : earthSunDir.x) * shadowDistance,
                anchorY + (moonState?.available ? moonSunDir.y : earthSunDir.y) * shadowDistance,
                anchorZ + (moonState?.available ? moonSunDir.z : earthSunDir.z) * shadowDistance,
            );
            if (this.scene.light.target) {
                this.scene.light.target.position.set(anchorX, anchorY, anchorZ);
                this.scene.light.target.updateMatrixWorld();
            }
            const shadowCamera = this.scene.light.shadow?.camera;
            if (shadowCamera) {
                shadowCamera.left = -shadowFrustumHalf;
                shadowCamera.right = shadowFrustumHalf;
                shadowCamera.top = shadowFrustumHalf;
                shadowCamera.bottom = -shadowFrustumHalf;
                shadowCamera.near = Number.isFinite(LT.SHADOW_NEAR) ? LT.SHADOW_NEAR : 0.1;
                shadowCamera.far = Math.max(
                    Number.isFinite(LT.SHADOW_FAR) ? LT.SHADOW_FAR : 32.0,
                    shadowDistance + shadowFrustumHalf * 2.5,
                );
                shadowCamera.updateProjectionMatrix?.();
            }
        } else {
            this.scene.light.position.set(
                moonState?.available ? moonSunDir.x : earthSunDir.x,
                moonState?.available ? moonSunDir.y : earthSunDir.y,
                moonState?.available ? moonSunDir.z : earthSunDir.z,
            );
            if (this.scene.light.target) {
                this.scene.light.target.position.set(0, 0, 0);
                this.scene.light.target.updateMatrixWorld();
            }
        }

        if (!this.scene.lightFill) {
            return;
        }

        if (compareDisplayProfile?.disableEarthshine) {
            this.scene.lightFill.intensity = 0.0;
            return;
        }

        if (suppressLunarFillLighting) {
            this.scene.lightFill.intensity = 0.0;
            return;
        }

        const clamp01 = (value) => Math.max(0, Math.min(1, value));
        const minEarthshine = Number.isFinite(LT.EARTHSHINE_MIN_INTENSITY)
            ? LT.EARTHSHINE_MIN_INTENSITY
            : (Number.isFinite(LT.EARTHSHINE_INTENSITY) ? LT.EARTHSHINE_INTENSITY : 0.02);
        const maxEarthshine = Number.isFinite(LT.EARTHSHINE_MAX_INTENSITY)
            ? LT.EARTHSHINE_MAX_INTENSITY
            : (Number.isFinite(LT.EARTHSHINE_INTENSITY) ? LT.EARTHSHINE_INTENSITY : 0.08);
        const earthshinePhaseExponent = Number.isFinite(LT.EARTHSHINE_PHASE_EXPONENT)
            ? LT.EARTHSHINE_PHASE_EXPONENT
            : 1.35;

        const applyEarthshineDirection = (dx, dy, dz) => {
            const norm = Math.hypot(dx, dy, dz);
            if (!Number.isFinite(norm) || norm <= 1e-12) {
                return false;
            }
            const nx = dx / norm;
            const ny = dy / norm;
            const nz = dz / norm;
            this.scene.lightFill.position.set(nx, ny, nz);

            // Earthshine phase: full Earth at the Moon when Sun and Earth are
            // in similar directions from the Moon's viewpoint.
            const sunEarthAlignment = clamp01((1 + (moonSunDir.x * nx + moonSunDir.y * ny + moonSunDir.z * nz)) * 0.5);
            const phasedEarthshine = Math.pow(sunEarthAlignment, earthshinePhaseExponent);
            this.scene.lightFill.intensity =
                minEarthshine + (maxEarthshine - minEarthshine) * phasedEarthshine;
            return true;
        };

        // Earthshine direction should come from Earth->Moon geometry, not from
        // simply inverting Sun direction.
        if (earthState?.available && moonState?.available) {
            const dx = earthState.position.x - moonState.position.x;
            const dy = earthState.position.y - moonState.position.y;
            const dz = earthState.position.z - moonState.position.z;
            if (applyEarthshineDirection(dx, dy, dz)) {
                return;
            }
        }

        if (moonState?.available) {
            const dx = -moonState.position.x;
            const dy = -moonState.position.y;
            const dz = -moonState.position.z;
            if (applyEarthshineDirection(dx, dy, dz)) {
                return;
            }
        }

        // Final fallback: opposite sun direction.
        this.scene.lightFill.position.set(-moonSunDir.x, -moonSunDir.y, -moonSunDir.z);
        this.scene.lightFill.intensity = minEarthshine;
    }

    /**
     * Update 3D object positions from body states.
     * @param {Object} bodies - Body states keyed by ID
     * @param {string} craftId - Spacecraft ID
     */
    updateBodyPositions(bodies, craftId, stateTime, landingFreezeTime) {
        for (const [bodyId, bodyState] of Object.entries(bodies)) {
            if (!bodyState || !bodyState.available) {
                continue;
            }

            const screenPos = toScreenCoordinates(bodyState.position, this.pixelsPerAU);

            if (bodyId === this.scene.secondaryBody) {
                // Secondary body (Moon in geo, Earth in lunar)
                this.updateSecondaryBodyPosition(screenPos);
                this.scene.updateSecondaryBodyVisualAids?.(
                    bodyId,
                    bodyState,
                    this.pixelsPerAU,
                    stateTime,
                );
            } else if (this.scene?.craftsById?.[bodyId]) {
                this.updateSpacecraftPosition(
                    bodyState,
                    screenPos,
                    bodies,
                    stateTime,
                    landingFreezeTime,
                    bodyId,
                    { isActiveCraft: bodyId === craftId },
                );
            }
        }
    }

    updateOrbitTrails(stateTime, bodies) {
        const trailBundles = this.scene?.orbitTrailLinesByBodyId || {};
        for (const [bodyId, bundle] of Object.entries(trailBundles)) {
            const curve = this.scene?.curvesById?.[bodyId] || [];
            const curveTimes = this.scene?.curveTimesById?.[bodyId] || [];
            const orbitStyleMetadata = this.scene?.orbitStyleMetadataByBodyId?.[bodyId] || null;
            const bodyState = bodies?.[bodyId];
            const isAvailable = !!bodyState?.available;

            if (!bundle || curve.length < 2 || curveTimes.length < 2 || !isAvailable) {
                this.setTrailDrawRange(bundle?.tailLine, 0);
                this.setTrailDrawRange(bundle?.headLine, 0);
                continue;
            }

            const window = resolveTrailWindow(curveTimes, stateTime, {
                orbitStyleMetadata,
                phaseKey: this.scene?.name,
                tailOrbitFraction: this.scene?.orbitTrailTailFraction,
                headOrbitFraction: this.scene?.orbitTrailHeadFraction,
            });
            const layers = resolveTrailLayerWindow(window);
            this.updateTrailLineGeometry(
                bundle.tailLine,
                curve,
                layers.tailStartIndex,
                layers.currentIndex,
            );
            this.updateTrailLineGeometry(
                bundle.midLine,
                curve,
                layers.midStartIndex,
                layers.currentIndex,
            );
            this.updateTrailLineGeometry(
                bundle.headGlowLine,
                curve,
                layers.headGlowStartIndex,
                layers.currentIndex,
            );
            this.updateTrailLineGeometry(
                bundle.headLine,
                curve,
                layers.headStartIndex,
                layers.currentIndex,
            );
        }
    }

    updateTrailLineGeometry(line, curve, startIndex, endIndex) {
        if (!line?.geometry) {
            return;
        }

        const geometry = line.geometry;
        const positionAttr = geometry.getAttribute?.("position");
        if (!positionAttr?.array) {
            return;
        }

        if (
            !Number.isFinite(startIndex) ||
            !Number.isFinite(endIndex) ||
            startIndex < 0 ||
            endIndex < startIndex
        ) {
            this.setTrailDrawRange(line, 0);
            return;
        }

        const count = Math.max(0, endIndex - startIndex + 1);
        if (count < 2) {
            this.setTrailDrawRange(line, 0);
            return;
        }

        const positions = positionAttr.array;
        let offset = 0;
        for (let i = startIndex; i <= endIndex; i++) {
            const point = curve[i];
            positions[offset++] = point.x;
            positions[offset++] = point.y;
            positions[offset++] = point.z;
        }
        positionAttr.needsUpdate = true;
        geometry.setDrawRange(0, count);
        geometry.computeBoundingSphere?.();
    }

    setTrailDrawRange(line, count) {
        if (!line?.geometry) {
            return;
        }
        line.geometry.setDrawRange(0, count);
    }

    /**
     * Update secondary body (Moon/Earth) position.
     * @param {Object} screenPos - Screen coordinates {x, y, z}
     */
    updateSecondaryBodyPosition(screenPos) {
        if (this.scene.secondaryBody3D) {
            this.scene.secondaryBody3D.position.set(
                screenPos.x,
                screenPos.y,
                screenPos.z
            );
        }
    }

    /**
     * Update spacecraft position and orientation.
     * @param {Object} bodyState - Spacecraft body state
     * @param {Object} screenPos - Current screen position
     * @param {Object} allBodies - All body states (for next position calculation)
     */
    updateSpacecraftPosition(
        bodyState,
        screenPos,
        allBodies,
        stateTime,
        landingFreezeTime,
        craftId = "SC",
        options = {},
    ) {
        const { isActiveCraft = false } = options || {};
        const craftObject = isActiveCraft
            ? (this.scene.craft || this.scene.craftsById?.[craftId] || null)
            : (this.scene.craftsById?.[craftId] || null);
        const droneObject = isActiveCraft
            ? (this.scene.drone || this.scene.dronesById?.[craftId] || null)
            : (this.scene.dronesById?.[craftId] || null);
        const renderer = this.scene.spacecraftRenderersById?.[craftId] ||
            (isActiveCraft ? this.scene.spacecraftRenderer : null);

        if (!craftObject) {
            return;
        }

        // Set spacecraft position
        craftObject.position.set(screenPos.x, screenPos.y, screenPos.z);

        // Calculate next position for orientation (prefer Chebyshev-derived next position from state)
        const shouldFreeze = typeof landingFreezeTime === "number" && stateTime >= landingFreezeTime;
        this._frozenNextScreenPosByCraftId ||= {};
        if (!shouldFreeze) {
            delete this._frozenNextScreenPosByCraftId[craftId];
        }

        let nextScreenPos;
        if (shouldFreeze) {
            if (!this._frozenNextScreenPosByCraftId[craftId]) {
                const nextPos = bodyState.nextPosition || this.calculateNextPosition(bodyState);
                this._frozenNextScreenPosByCraftId[craftId] = toScreenCoordinates(nextPos, this.pixelsPerAU);
            }
            nextScreenPos = this._frozenNextScreenPosByCraftId[craftId];
        } else {
            const nextPos = bodyState.nextPosition || this.calculateNextPosition(bodyState);
            nextScreenPos = toScreenCoordinates(nextPos, this.pixelsPerAU);
        }

        // Update drone position (follows spacecraft at offset)
        if (droneObject) {
            const droneScale = 1.05;
            const delta = {
                x: nextScreenPos.x - screenPos.x,
                y: nextScreenPos.y - screenPos.y,
                z: nextScreenPos.z - screenPos.z
            };
            droneObject.position.set(
                droneScale * (screenPos.x - delta.x),
                droneScale * (screenPos.y - delta.y),
                droneScale * (screenPos.z - delta.z)
            );
        }

        // Orient spacecraft to face instantaneous velocity direction.
        // Fallback to next-position heading if velocity is unavailable.
        const vel = bodyState?.velocity;
        const velX = Number(vel?.vx);
        const velY = Number(vel?.vy);
        const velZ = Number(vel?.vz);
        let lookX = nextScreenPos.x;
        let lookY = nextScreenPos.y;
        let lookZ = nextScreenPos.z;
        if (Number.isFinite(velX) && Number.isFinite(velY) && Number.isFinite(velZ)) {
            const speed = Math.hypot(velX, velY, velZ);
            if (speed > 1e-12) {
                const velocityLookDistance = 1.0;
                lookX = screenPos.x + (velX / speed) * velocityLookDistance;
                lookY = screenPos.y + (velY / speed) * velocityLookDistance;
                lookZ = screenPos.z + (velZ / speed) * velocityLookDistance;
            }
        }
        craftObject.up.set(0, 0, 1);
        craftObject.lookAt(lookX, lookY, lookZ);

        // Apply model-specific forward-axis correction after lookAt so the
        // physical body long axis aligns with velocity tangent.
        const attitudeOffset = renderer?.getAttitudeOffsetQuaternion?.();
        if (attitudeOffset) {
            craftObject.quaternion.multiply(attitudeOffset);
        }

        // Orient drone to look back at spacecraft
        if (droneObject) {
            droneObject.lookAt(screenPos.x, screenPos.y, screenPos.z);
        }

        // Keep only solar wings tracking the live sun direction (1-DOF tilt per wing).
        // Craft body attitude remains velocity-aligned above.
        const craftSun = this.scene.stateSunDirections?.craftCenteredLightTime ||
            this.scene.stateSunDirections?.craftCentered ||
            this.scene.stateSunDirection;
        renderer?.updateSolarArrayTracking?.(craftSun);
    }

    /**
     * Calculate approximate next position for orientation.
     * Uses velocity to extrapolate position.
     * @param {Object} bodyState - Current body state with position and velocity
     * @returns {Object} Approximate next position {x, y, z}
     */
    calculateNextPosition(bodyState) {
        // Use velocity to estimate next position (1 minute ahead)
        const dt = 60; // seconds
        return {
            x: bodyState.position.x + bodyState.velocity.vx * dt,
            y: bodyState.position.y + bodyState.velocity.vy * dt,
            z: bodyState.position.z + bodyState.velocity.vz * dt
        };
    }

    /**
     * Update camera projection and sky position.
     * Called when camera controls are enabled.
     */
    updateCameraAndSky() {
        if (!this.scene.cameraControlsEnabled) {
            return;
        }

        this.scene.camera.updateProjectionMatrix();

        if (this.scene.skyContainer) {
            this.scene.skyContainer.position.setFromMatrixPosition(
                this.scene.camera.matrixWorld
            );
        }

        if (this.scene.cameraControls) {
            this.scene.cameraControls.update();
        }
    }
}
