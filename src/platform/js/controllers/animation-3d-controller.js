/**
 * Animation3DController - Renders 3D scene from computed state
 */

import { PHYSICS_CONSTANTS as PC, LIGHT_SETTINGS as LT } from "../core/constants.js";
import { toScreenCoordinates } from "../scene-state.js";
import { resolveTrailLayerWindow, resolveTrailWindow } from "../app/orbit-trail-style.js";
import {
    computeEarthshineLightState,
    computeMoonshineLightState,
} from "../core/domain/reflected-lighting.js";

function normalizeDirection(candidate) {
    const x = Number(candidate?.x);
    const y = Number(candidate?.y);
    const z = Number(candidate?.z);
    const norm = Math.hypot(x, y, z);
    if (!Number.isFinite(norm) || norm <= 1e-12) return null;
    return { x: x / norm, y: y / norm, z: z / norm };
}

function cloneDirection(direction) {
    return direction ? { x: direction.x, y: direction.y, z: direction.z } : null;
}

function createFixedCompareSunDirections(compareDisplayProfile) {
    const fixedDirection = normalizeDirection(compareDisplayProfile?.fixedSunDirection);
    if (!fixedDirection) return null;
    return {
        earthCentered: cloneDirection(fixedDirection),
        moonCentered: cloneDirection(fixedDirection),
        craftCentered: cloneDirection(fixedDirection),
        craftCenteredLightTime: cloneDirection(fixedDirection),
    };
}

export class Animation3DController {
    constructor(config, animationScene) {
        this.config = config;
        this.scene = animationScene;
        this._frozenNextScreenPosByCraftId = {};
    }

    render(state, options = {}) {
        if (!this.scene || !this.scene.initialized3D) return;

        const renderOptions = options || {};
        const {
            craftId = "SC",
            pixelsPerAU = 250,
            updateCraftScale,
            landingFreezeTime = null,
            compareMode = false,
            compareDisplayProfile = null,
        } = renderOptions;
        
        const fixedCompareSunDirections = compareMode ? createFixedCompareSunDirections(compareDisplayProfile) : null;
        const effectiveSunDirections = fixedCompareSunDirections || state.sunDirections || null;
        const effectiveSunDirection = effectiveSunDirections?.earthCentered || state.sunDirection;
        this.pixelsPerAU = pixelsPerAU;
        
        this.scene.stateSunDirection = effectiveSunDirection;
        this.scene.stateSunDirections = effectiveSunDirections;
        this.scene.stateTime = state.time;
        this.scene.latestSceneState = state;
        
        if (!(compareMode && compareDisplayProfile?.freezeSkyOrientation)) {
            this.scene.skyRenderer?.setTime?.(state.time, { realtimeFrame: true });
        }

        this.updateLighting(state.sunLongitude, state.bodies, effectiveSunDirections, compareMode ? compareDisplayProfile : null);

        if (!(compareMode && compareDisplayProfile?.freezeEarthRotation)) this.scene.rotateEarth(state.time);
        if (!(compareMode && compareDisplayProfile?.freezeMoonRotation)) this.scene.rotateMoon(state.time);

        this.updateBodyPositions(state.bodies, craftId, state.time, landingFreezeTime);
        this.updateOrbitTrails(state.time, state.bodies);

        if (updateCraftScale) updateCraftScale();
    }

    updateLighting(sunLongitude, bodies = null, sunDirections = null, compareDisplayProfile = null) {
        if (!this.scene.light || !this.scene.light2) return;
        
        const bodyAmbientLight = this.scene.lightManager?.bodyAmbientLight || null;
        const renderSettings = this.scene.moonRenderSettings || null;
        if (bodyAmbientLight) {
            bodyAmbientLight.intensity = Number.isFinite(LT.AMBIENT_INTENSITY) ? LT.AMBIENT_INTENSITY : 0;
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
            if (candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z)) {
                const norm = Math.hypot(candidate.x, candidate.y, candidate.z);
                if (norm > 1e-12) return { x: candidate.x / norm, y: candidate.y / norm, z: candidate.z / norm };
            }
            return { x: fallbackX, y: fallbackY, z: fallbackZ };
        };

        const fallbackDir = normalizeDir({ x: Math.cos(sunLongitude), y: Math.sin(sunLongitude), z: 0 });
        const earthSunDir = normalizeDir(sunDirections?.earthCentered || this.scene.stateSunDirection, fallbackDir.x, fallbackDir.y, fallbackDir.z);
        const moonSunDir = normalizeDir(sunDirections?.moonCentered, earthSunDir.x, earthSunDir.y, earthSunDir.z);
        const craftSunDir = normalizeDir(sunDirections?.craftCenteredLightTime || sunDirections?.craftCentered, earthSunDir.x, earthSunDir.y, earthSunDir.z);

        this.scene.light2.position.set(craftSunDir.x, craftSunDir.y, craftSunDir.z);
        this.scene.sunRenderer?.setDirection?.(earthSunDir.x, earthSunDir.y, earthSunDir.z);
        this.scene.sunRenderer?.updateAppearance?.(this.scene?.stateTime ?? 0);

        const shadowAnchorState = moonState?.available ? moonState : (earthState?.available ? earthState : null);
        
        // NORMALIZED UNIT LOCK (Moon Radius = 1.0)
        const shadowFrustumHalf = 2.0; 
        const shadowDistance = 8.0;   

        if (shadowAnchorState && Number.isFinite(this.pixelsPerAU)) {
            const anchorX = shadowAnchorState.position.x * this.pixelsPerAU;
            const anchorY = shadowAnchorState.position.y * this.pixelsPerAU;
            const anchorZ = shadowAnchorState.position.z * this.pixelsPerAU;
            
            const sunX = moonState?.available ? moonSunDir.x : earthSunDir.x;
            const sunY = moonState?.available ? moonSunDir.y : earthSunDir.y;
            const sunZ = moonState?.available ? moonSunDir.z : earthSunDir.z;

            this.scene.light.position.set(
                anchorX + sunX * shadowDistance,
                anchorY + sunY * shadowDistance,
                anchorZ + sunZ * shadowDistance
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
                shadowCamera.near = 4.0; 
                shadowCamera.far = 12.0; 
                shadowCamera.updateProjectionMatrix?.();
            }
        } else {
            this.scene.light.position.set(
                moonState?.available ? moonSunDir.x : earthSunDir.x,
                moonState?.available ? moonSunDir.y : earthSunDir.y,
                moonState?.available ? moonSunDir.z : earthSunDir.z
            );
            if (this.scene.light.target) {
                this.scene.light.target.position.set(0, 0, 0);
                this.scene.light.target.updateMatrixWorld();
            }
        }

        if (this.scene.lightFill) {
            if (compareDisplayProfile?.disableEarthshine) {
                this.scene.lightFill.intensity = 0.0;
            } else {
                const earthshineState = computeEarthshineLightState({
                    earthPosition: earthState?.available ? earthState.position : { x: 0, y: 0, z: 0 },
                    moonPosition: moonState?.available ? moonState.position : { x: 0, y: 0, z: 0 },
                    moonSunDirection: moonSunDir,
                    maxIntensity: LT.EARTHSHINE_MAX_INTENSITY,
                    phaseExponent: LT.EARTHSHINE_PHASE_EXPONENT,
                });
                if (earthshineState) {
                    this.scene.lightFill.position.set(earthshineState.direction.x, earthshineState.direction.y, earthshineState.direction.z);
                    this.scene.lightFill.intensity = earthshineState.intensity;
                } else {
                    this.scene.lightFill.intensity = 0.0;
                }
            }
        }

        if (this.scene.lightMoonshine) {
            if (compareDisplayProfile?.disableEarthshine) {
                this.scene.lightMoonshine.intensity = 0.0;
                return;
            }
            const moonshineState = computeMoonshineLightState({
                earthPosition: earthState?.available ? earthState.position : { x: 0, y: 0, z: 0 },
                moonPosition: moonState?.available ? moonState.position : { x: 0, y: 0, z: 0 },
                earthSunDirection: earthSunDir,
                maxIntensity: LT.MOONSHINE_MAX_INTENSITY,
                phaseExponent: LT.MOONSHINE_PHASE_EXPONENT,
            });
            if (moonshineState) {
                this.scene.lightMoonshine.position.set(moonshineState.direction.x, moonshineState.direction.y, moonshineState.direction.z);
                this.scene.lightMoonshine.intensity = moonshineState.intensity;
            } else {
                this.scene.lightMoonshine.intensity = 0.0;
            }
        }
    }

    updateBodyPositions(bodies, craftId, stateTime, landingFreezeTime) {
        for (const [bodyId, bodyState] of Object.entries(bodies)) {
            if (!bodyState || !bodyState.available) continue;
            const screenPos = toScreenCoordinates(bodyState.position, this.pixelsPerAU);
            if (bodyId === this.scene.secondaryBody) {
                this.updateSecondaryBodyPosition(screenPos);
                this.scene.updateSecondaryBodyVisualAids?.(bodyId, bodyState, this.pixelsPerAU, stateTime);
            } else if (this.scene?.craftsById?.[bodyId]) {
                this.updateSpacecraftPosition(bodyState, screenPos, bodies, stateTime, landingFreezeTime, bodyId, { isActiveCraft: bodyId === craftId });
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
            if (!bundle || curve.length < 2 || curveTimes.length < 2 || !bodyState?.available) {
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
            this.updateTrailLineGeometry(bundle.tailLine, curve, layers.tailStartIndex, layers.currentIndex);
            this.updateTrailLineGeometry(bundle.midLine, curve, layers.midStartIndex, layers.currentIndex);
            this.updateTrailLineGeometry(bundle.headGlowLine, curve, layers.headGlowStartIndex, layers.currentIndex);
            this.updateTrailLineGeometry(bundle.headLine, curve, layers.headStartIndex, layers.currentIndex);
        }
    }

    updateTrailLineGeometry(line, curve, startIndex, endIndex) {
        if (!line?.geometry) return;
        const positionAttr = line.geometry.getAttribute?.("position");
        if (!positionAttr?.array) return;
        if (!Number.isFinite(startIndex) || !Number.isFinite(endIndex) || startIndex < 0 || endIndex < startIndex) {
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
        line.geometry.setDrawRange(0, count);
        line.geometry.computeBoundingSphere?.();
    }

    setTrailDrawRange(line, count) {
        if (line?.geometry) line.geometry.setDrawRange(0, count);
    }

    updateSecondaryBodyPosition(screenPos) {
        if (this.scene.secondaryBody3D) this.scene.secondaryBody3D.position.set(screenPos.x, screenPos.y, screenPos.z);
    }

    updateSpacecraftPosition(bodyState, screenPos, allBodies, stateTime, landingFreezeTime, craftId = "SC", options = {}) {
        const { isActiveCraft = false } = options || {};
        const craftObject = isActiveCraft ? (this.scene.craft || this.scene.craftsById?.[craftId]) : this.scene.craftsById?.[craftId];
        if (!craftObject) return;

        craftObject.position.set(screenPos.x, screenPos.y, screenPos.z);
        
        const shouldFreeze = typeof landingFreezeTime === "number" && stateTime >= landingFreezeTime;
        if (!shouldFreeze) delete this._frozenNextScreenPosByCraftId[craftId];
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

        const vel = bodyState?.velocity;
        let lookX = nextScreenPos.x, lookY = nextScreenPos.y, lookZ = nextScreenPos.z;
        if (vel && Number.isFinite(vel.vx)) {
            const speed = Math.hypot(vel.vx, vel.vy, vel.vz);
            if (speed > 1e-12) {
                lookX = screenPos.x + (vel.vx / speed);
                lookY = screenPos.y + (vel.vy / speed);
                lookZ = screenPos.z + (vel.vz / speed);
            }
        }
        craftObject.up.set(0, 0, 1);
        craftObject.lookAt(lookX, lookY, lookZ);

        const renderer = this.scene.spacecraftRenderersById?.[craftId] || (isActiveCraft ? this.scene.spacecraftRenderer : null);
        const attitudeOffset = renderer?.getAttitudeOffsetQuaternion?.();
        if (attitudeOffset) craftObject.quaternion.multiply(attitudeOffset);

        const craftSun = this.scene.stateSunDirections?.craftCenteredLightTime || this.scene.stateSunDirections?.craftCentered || this.scene.stateSunDirection;
        renderer?.updateSolarArrayTracking?.(craftSun);
    }

    calculateNextPosition(bodyState) {
        const dt = 60;
        return {
            x: bodyState.position.x + bodyState.velocity.vx * dt,
            y: bodyState.position.y + bodyState.velocity.vy * dt,
            z: bodyState.position.z + bodyState.velocity.vz * dt
        };
    }

    updateCameraAndSky() {
        if (!this.scene.cameraControlsEnabled) return;
        this.scene.camera.updateProjectionMatrix();
        if (this.scene.skyContainer) this.scene.skyContainer.position.setFromMatrixPosition(this.scene.camera.matrixWorld);
        if (this.scene.cameraControls) this.scene.cameraControls.update();
    }
}
