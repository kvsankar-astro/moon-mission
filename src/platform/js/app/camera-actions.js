import {
    planCameraPairTransition,
    resolveAllowedLooks,
    resolveAllowedPositions,
    resolveLockAvailability,
    resolvePairFromValue,
    resolvePairKey,
} from "../core/domain/camera-policy.js";
import { applySkyLayerVisibility } from "./sky-visibility.js";

export function createCameraActions({
    animationScenes,
    getConfig,
    readCameraPositionMode,
    readCameraLookMode,
    applyCameraFromTo,
    readPlaneSelection,
    setPlaneSelection,
    handlePlaneChange,
    render,
    getViewSky,
    getViewConstellationLines,
}) {
    const CAMERA_MODE_VALUES = ["manual", "earth", "moon", "spacecraft"];
    let pendingApplyHandle = null;
    let lastAppliedPositionMode = "manual";
    let lastAppliedLookMode = "manual";
    let lastAppliedConfig = null;
    let savedFov = null;

    const mountedBodyOverride = {
        earth: { hidden: null },
        moon: { hidden: null },
    };
    let autoAdjusting = false;

    function resolveFromToTargets(scene) {
        return {
            earth: scene.earthContainer ?? null,
            moon: scene.moonContainer ?? null,
            spacecraft: scene.craft ?? null,
        };
    }

    function applySkyVisibility(scene) {
        applySkyLayerVisibility(scene, {
            viewSky: getViewSky(),
            viewConstellationLines: getViewConstellationLines(),
        });
    }

    function getAllowedLook(positionMode) {
        return resolveAllowedLooks(positionMode);
    }

    function getAllowedPosition(lookMode) {
        return resolveAllowedPositions(lookMode);
    }

    function updateSelectOptions(selectId, allowedValues) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const allowed = new Set(allowedValues);
        for (const option of select.options) {
            option.disabled = !allowed.has(option.value);
        }
    }

    function updatePillOptions(groupName, allowedValues) {
        const inputs = document.querySelectorAll(`input[name="${groupName}"]`);
        if (!inputs.length) return;
        const allowed = new Set(allowedValues);

        inputs.forEach((input) => {
            const enabled = allowed.has(input.value);
            input.disabled = !enabled;
            const wrapper = input.closest(".camera-pill");
            if (wrapper) {
                wrapper.classList.toggle("is-disabled", !enabled);
            }
        });
    }

    function updateFromToOptionStates(positionMode, lookMode) {
        const allowedLookModes = getAllowedLook(positionMode);
        const allowedPositionModes = getAllowedPosition(lookMode);

        updateSelectOptions("camera-look", allowedLookModes);
        updateSelectOptions("camera-position", allowedPositionModes);
        // Keep pill controls fully interactive; normalization handles invalid
        // combinations by auto-selecting the nearest valid pair.
        updatePillOptions("camera-look-pill", CAMERA_MODE_VALUES);
        updatePillOptions("camera-position-pill", CAMERA_MODE_VALUES);
    }

    function updateCameraModeSelection(positionMode, lookMode, pairKeyOverride) {
        const positionPill = document.querySelector(
            `input[name="camera-position-pill"][value="${positionMode}"]`,
        );
        if (positionPill && !positionPill.checked) {
            positionPill.checked = true;
        }

        const lookPill = document.querySelector(
            `input[name="camera-look-pill"][value="${lookMode}"]`,
        );
        if (lookPill && !lookPill.checked) {
            lookPill.checked = true;
        }

        // Backward-compatible sync for legacy camera-pair radios (if present).
        const key = pairKeyOverride || resolvePairKey(positionMode, lookMode);
        const selected = document.querySelector(`input[name="camera-pair"][value="${key}"]`);
        if (selected && !selected.checked) {
            selected.checked = true;
        }
    }

    function resolvePairFromEvent(event) {
        const value = event?.target?.value;
        return resolvePairFromValue(value);
    }

    function updateLockOption(scene, { id, enabled, flagKey }) {
        const input = document.getElementById(id);
        if (!input) return;
        input.disabled = !enabled;
        const wrapper = input.closest(".settings-option");
        if (wrapper) {
            wrapper.classList.toggle("is-disabled", !enabled);
        }
        if (!enabled && input.checked) {
            input.checked = false;
            if (scene) {
                if (flagKey === "sc") scene.lockOnSC = false;
                if (flagKey === "moon") scene.lockOnMoon = false;
                if (flagKey === "earth") scene.lockOnEarth = false;
            }
        }
    }

    function updateLockOnAvailability(scene, positionMode, lookMode) {
        const allowSet = new Set(resolveLockAvailability(positionMode, lookMode));

        updateLockOption(scene, {
            id: "checkbox-lock-sc",
            enabled: allowSet.has("sc"),
            flagKey: "sc",
        });
        updateLockOption(scene, {
            id: "checkbox-lock-moon",
            enabled: allowSet.has("moon"),
            flagKey: "moon",
        });
        updateLockOption(scene, {
            id: "checkbox-lock-earth",
            enabled: allowSet.has("earth"),
            flagKey: "earth",
        });
    }

    function applyFixedFov(scene, positionMode, lookMode) {
        const toggle = document.getElementById("camera-fov-one-degree");
        const wantsFixed = !!toggle?.checked;
        const isEligible =
            (positionMode === "earth" || positionMode === "moon") &&
            (lookMode === "earth" || lookMode === "moon");
        if (toggle) {
            toggle.disabled = !isEligible;
        }

        const controller = scene?.cameraController;
        if (!controller) return;

        const shouldFix = wantsFixed && isEligible;
        controller.setMountedWheelFovEnabled?.(!shouldFix);
        if (shouldFix) {
            if (savedFov === null) {
                const current = scene?.camera?.fov ?? controller.camera?.fov;
                savedFov = Number.isFinite(current) ? current : 50;
            }
            controller.setFov(1);
            // Reset zoom/standoff when enabling fixed FoV so the view is centered.
            if (positionMode !== "manual") {
                snapMountedCamera(scene, positionMode, lookMode, { preserveDistance: false });
            }
            if (controller.controls) {
                controller.controls.noZoom = true;
            }
        } else if (savedFov !== null) {
            controller.setFov(savedFov);
            savedFov = null;
            if (controller.controls) {
                controller.controls.noZoom = false;
            }
        }
    }

    function updateFovIndicator(positionMode, lookMode) {
        const indicator = document.getElementById("camera-fov-indicator");
        const toggle = document.getElementById("camera-fov-one-degree");
        const isEligible =
            (positionMode === "earth" || positionMode === "moon") &&
            (lookMode === "earth" || lookMode === "moon");
        const fixed = !!toggle?.checked && isEligible;
        if (toggle) toggle.disabled = !isEligible;
        if (indicator) {
            indicator.textContent = "";
            indicator.classList.toggle("is-active", fixed);
        }
    }

    function estimateRadius(scene, mode) {
        if (!scene) return null;

        const mesh = mode === "earth"
            ? scene.earth
            : mode === "moon"
                ? scene.moon
                : null;

        const geometry = mesh?.geometry;
        if (geometry) {
            if (!geometry.boundingSphere) {
                geometry.computeBoundingSphere?.();
            }
            const r = geometry.boundingSphere?.radius;
            if (Number.isFinite(r) && r > 0) {
                return r;
            }
        }

        return null;
    }

    function resolveDefaultLookTarget(scene, positionMode) {
        if (!scene) return null;

        if (positionMode === "spacecraft") {
            return scene.moonContainer ?? scene.earthContainer ?? null;
        }

        // From Earth/Moon center, default to looking toward the spacecraft.
        return scene.craft ?? null;
    }

    function updateMountedCraftVisibility(scene, positionMode) {
        if (!scene?.craft) return;

        const hideCraft = positionMode === "spacecraft";
        scene.hideCraftForMountedCamera = hideCraft;

        if (hideCraft) {
            scene.craft.visible = false;
            if (scene.drone) scene.drone.visible = false;
        }
    }

    function updateMountedBodyVisibility(scene, positionMode) {
        if (!scene) return;

        updateMountedCraftVisibility(scene, positionMode);
        if (!scene.cameraController) return;

        const controller = scene.cameraController;

        // When not mounted, lift any visibility override.
        if (positionMode !== "earth") {
            mountedBodyOverride.earth.hidden = null;
            if (scene.earthContainer) scene.earthContainer.visible = true;
        }
        if (positionMode !== "moon") {
            mountedBodyOverride.moon.hidden = null;
            if (scene.moonContainer) scene.moonContainer.visible = true;
        }

        const updateOne = (bodyMode) => {
            const container = bodyMode === "earth" ? scene.earthContainer : scene.moonContainer;
            if (!container) return;

            const radius = estimateRadius(scene, bodyMode);
            if (!Number.isFinite(radius) || radius <= 0) return;

            const distance = controller.mountOffset?.length?.();
            if (!Number.isFinite(distance)) return;

            const hideThreshold = 0.95 * radius;
            const showThreshold = 1.05 * radius;

            const state = mountedBodyOverride[bodyMode];
            if (state.hidden === null) {
                state.hidden = distance < radius;
            } else if (state.hidden && distance > showThreshold) {
                state.hidden = false;
            } else if (!state.hidden && distance < hideThreshold) {
                state.hidden = true;
            }

            // Hide only when the camera is inside the body; otherwise allow normal visibility rules.
            container.visible = !state.hidden;
        };

        if (positionMode === "earth") updateOne("earth");
        if (positionMode === "moon") updateOne("moon");
    }

    function ensureMountedVisibilityListener(scene) {
        const controller = scene?.cameraController;
        const controls = controller?.controls;
        if (!controller || !controls) return;
        if (controller.__fromToMountedVisibilityListenerAttached) return;
        controller.__fromToMountedVisibilityListenerAttached = true;

        controls.addEventListener("change", () => {
            if (autoAdjusting) return;
            const positionMode = readCameraPositionMode();
            const lookMode = readCameraLookMode();

            updateMountedBodyVisibility(scene, positionMode);

            // If the mounted body is hidden (camera inside), "look at self" becomes meaningless.
            // Auto-switch to manual aim and orient toward a meaningful target without teleporting.
            const hiddenState = mountedBodyOverride[positionMode]?.hidden;
            if ((positionMode === "earth" || positionMode === "moon") && hiddenState === true && lookMode === positionMode) {
                autoAdjusting = true;
                try {
                    applyCameraFromTo?.({ lookMode: "manual" });
                    controller.setFromToModes?.(positionMode, "manual");

                    const targets = resolveFromToTargets(scene);
                    controller.updateFromTo?.(targets);

                    const mountPos = controller._resolveTargetWorld?.(positionMode, controller._mountWorld);
                    if (mountPos) {
                        const cameraWorld = mountPos.clone().add(controller.mountOffset);
                        const defaultLookTarget = resolveDefaultLookTarget(scene, positionMode);
                        const lookWorld = defaultLookTarget?.getWorldPosition?.(controller._lookWorld);
                        if (lookWorld) {
                            const dir = lookWorld.clone().sub(cameraWorld).normalize();
                            const epsilon = Math.max(controller.mountOffset.length() * 0.05, 0.01);
                            const targetWorld = cameraWorld.clone().add(dir.multiplyScalar(epsilon));
                            controller.setMountTargetOffset?.(targetWorld.clone().sub(mountPos));
                            if (controller.controls?.target) {
                                controller.controls.target.copy(targetWorld);
                                controller.controls.update();
                            }
                        }
                    }

                    render();
                } finally {
                    autoAdjusting = false;
                }
            }
        }, { passive: true });
    }

    function snapMountedCamera(scene, positionMode, lookMode, { preserveDistance = false } = {}) {
        const controller = scene?.cameraController;
        if (!controller || !scene.camera) return;
        if (positionMode === "manual") return;

        const targets = resolveFromToTargets(scene);
        controller.updateFromTo?.(targets);

        const mountPos = controller._resolveTargetWorld?.(positionMode, controller._mountWorld);
        if (!mountPos) return;

        // Snap to the exact mount origin by default (no standoff).
        // Preserve distance only for explicit "keep distance" paths.
        const defaultDistance = 0;
        const distance = preserveDistance
            ? Math.max(controller.mountOffset?.length?.() ?? defaultDistance, 0)
            : defaultDistance;

        // Default view direction when using manual aim:
        // - From Earth/Moon: look toward spacecraft
        // - From Spacecraft: look toward Moon (fallback Earth)
        let mountOffset = { x: 0, y: 0, z: distance };
        let lookWorld = null;
        if (lookMode === "manual") {
            const defaultLookTarget = resolveDefaultLookTarget(scene, positionMode);
            lookWorld = defaultLookTarget?.getWorldPosition?.(controller._lookWorld) ?? null;
            if (lookWorld) {
                const dir = lookWorld.clone().sub(mountPos).normalize();
                // Place the camera opposite the direction of the target so the target is "in front".
                const cameraOffset = dir.clone().multiplyScalar(-distance);
                mountOffset = { x: cameraOffset.x, y: cameraOffset.y, z: cameraOffset.z };
            }
        }

        controller.setMountOffset?.(mountOffset);
        controller.setMountTargetOffset?.({ x: 0, y: 0, z: 0 });

        scene.camera.position.copy(mountPos).add(controller.mountOffset);

        // Ensure TrackballControls has up-to-date camera+target state immediately.
        if (lookMode === "manual") {
            scene.camera.up.set(0, 0, 1);
            if (lookWorld) {
                scene.camera.lookAt(lookWorld);
            }
        }

        updateMountedBodyVisibility(scene, positionMode);
    }

    function changeCameraFromTo(event) {
        const targetName = event?.target?.name;
        const sourceId = targetName === "camera-position-pill"
            ? "camera-position"
            : targetName === "camera-look-pill"
                ? "camera-look"
                : event?.target?.id;
        const pairSelection = targetName === "camera-pair"
            ? resolvePairFromEvent(event)
            : null;

        if (targetName === "camera-position-pill") {
            applyCameraFromTo?.({ positionMode: event?.target?.value });
        } else if (targetName === "camera-look-pill") {
            applyCameraFromTo?.({ lookMode: event?.target?.value });
        } else if (targetName === "camera-pair") {
            if (pairSelection) {
                applyCameraFromTo?.(pairSelection);
            }
        }

        let positionMode = readCameraPositionMode();
        let lookMode = readCameraLookMode();

        const transitionPlan = planCameraPairTransition({
            positionMode,
            lookMode,
            sourceId,
        });

        if (
            transitionPlan.positionMode !== positionMode ||
            transitionPlan.lookMode !== lookMode
        ) {
            applyCameraFromTo?.({
                positionMode: transitionPlan.positionMode,
                lookMode: transitionPlan.lookMode,
            });
            positionMode = transitionPlan.positionMode;
            lookMode = transitionPlan.lookMode;
        }

        updateFromToOptionStates(positionMode, lookMode);
        updateCameraModeSelection(positionMode, lookMode, transitionPlan.pairKey);

        const config = getConfig();
        const scene = animationScenes[config];
        updateLockOnAvailability(scene, positionMode, lookMode);
        applyFixedFov(scene, positionMode, lookMode);
        updateFovIndicator(positionMode, lookMode);

        const configChanged = config !== lastAppliedConfig;
        const positionChanged = positionMode !== lastAppliedPositionMode;
        const lookChanged = lookMode !== lastAppliedLookMode;
        const shouldSnap =
            positionMode !== "manual" &&
            (positionChanged || lookChanged || configChanged);
        if (!scene || !scene.initialized3D) {
            // Browser reloads can restore <select> values after scripts start.
            // Re-try shortly so UI selections always match camera behavior.
            if (!pendingApplyHandle) {
                pendingApplyHandle = setTimeout(() => {
                    pendingApplyHandle = null;
                    changeCameraFromTo();
                }, 200);
            }
            return;
        }

        if (scene && scene.initialized3D) {
            scene.cameraController?.setFromToModes?.(positionMode, lookMode);
            applySkyVisibility(scene);

            ensureMountedVisibilityListener(scene);

            // Immediate camera feedback: only snap when the mount changes (or when we just forced look->manual).
            if (positionMode !== "manual" && shouldSnap) {
                snapMountedCamera(scene, positionMode, lookMode);
            }

            scene.cameraController?.updateFromTo?.(resolveFromToTargets(scene));
            // Ensure forced-look changes take effect immediately even if the animation is paused.
            if (!scene.cameraController?._freeFlyActive) {
                scene.cameraController?.controls?.update?.();
            }

            updateMountedBodyVisibility(scene, positionMode);

            // Preserve the legacy "Camera: Default" behavior: when returning to the standard
            // manual/manual mode, reset camera parameters to a predictable default.
            if (positionMode === "manual" && lookMode === "manual") {
                scene.setCameraParameters(false);
                // Ensure TrackballControls rotates around the scene origin again.
                if (scene.cameraController?.controls?.target) {
                    scene.cameraController.controls.target.set(0, 0, 0);
                    scene.cameraController.controls.noRotate = false;
                    scene.cameraController.controls.noPan = false;
                    scene.cameraController.controls.update();
                }
                // Lift any visibility overrides when returning to free camera.
                updateMountedBodyVisibility(scene, positionMode);
                // Re-enable full controls for manual/manual
                if (scene.cameraController?.controls) {
                    scene.cameraController.controls.enabled = true;
                    scene.cameraController.controls.noRotate = false;
                    scene.cameraController.controls.noPan = false;
                    scene.cameraController._setFreeFlyEnabled?.(false);
                    scene.cameraController.controls.update?.();
                }
            }
        }

        lastAppliedPositionMode = positionMode;
        lastAppliedLookMode = lookMode;
        lastAppliedConfig = config;
        render();
    }

    function recenterMountedCamera() {
        const positionMode = readCameraPositionMode();
        if (positionMode === "manual") return;

        // Reset aim to manual and snap back to center-feel defaults.
        applyCameraFromTo?.({ lookMode: "manual" });

        const config = getConfig();
        const scene = animationScenes[config];
        if (!scene || !scene.initialized3D) return;

        scene.cameraController?.setFromToModes?.(positionMode, "manual");
        snapMountedCamera(scene, positionMode, "manual");
        scene.cameraController?.updateFromTo?.(resolveFromToTargets(scene));
        if (!scene.cameraController?._freeFlyActive) {
            scene.cameraController?.controls?.update?.();
        }
        updateMountedBodyVisibility(scene, positionMode);
        render();
    }

    function togglePlane() {
        setPlaneSelection(readPlaneSelection());
        handlePlaneChange(false, false);

        // Plane switches should preserve legacy centered behavior in manual view:
        // reset TrackballControls pivot to scene origin so DEFAULT/plane views
        // keep the origin centered on screen.
        const positionMode = readCameraPositionMode();
        const lookMode = readCameraLookMode();
        if (positionMode === "manual" && lookMode === "manual") {
            const config = getConfig();
            const scene = animationScenes[config];
            const controls = scene?.cameraController?.controls;
            if (controls?.target) {
                controls.target.set(0, 0, 0);
                controls.noRotate = false;
                controls.noPan = false;
                scene.cameraController?._setFreeFlyEnabled?.(false);
                controls.update?.();
                render();
            }
        }
    }

    return { changeCameraFromTo, togglePlane, recenterMountedCamera };
}
