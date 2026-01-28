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
}) {
    let pendingApplyHandle = null;
    let lastAppliedPositionMode = "manual";
    let savedFov = null;

    const allowedLookByPosition = {
        manual: ["manual", "moon", "spacecraft"],
        earth: ["moon", "spacecraft"],
        moon: ["manual", "earth", "spacecraft"],
        spacecraft: ["earth", "moon"],
    };

    const allowedPositionByLook = (() => {
        const map = {
            manual: [],
            earth: [],
            moon: [],
            spacecraft: [],
        };
        for (const [position, looks] of Object.entries(allowedLookByPosition)) {
            looks.forEach((look) => {
                if (!map[look]) map[look] = [];
                map[look].push(position);
            });
        }
        return map;
    })();

    const lockOnAvailability = {
        manual: new Set(["sc", "moon", "earth"]),
        earth: new Set(["sc", "moon"]),
        moon: new Set(["sc", "earth"]),
        spacecraft: new Set(["earth", "moon"]),
    };

    const pairValueMap = new Map([
        ["manual__manual", { positionMode: "manual", lookMode: "manual" }],
        ["manual__moon", { positionMode: "manual", lookMode: "moon" }],
        ["manual__spacecraft", { positionMode: "manual", lookMode: "spacecraft" }],
        ["earth__moon", { positionMode: "earth", lookMode: "moon" }],
        ["earth__spacecraft", { positionMode: "earth", lookMode: "spacecraft" }],
        ["moon__manual", { positionMode: "moon", lookMode: "manual" }],
        ["moon__earth", { positionMode: "moon", lookMode: "earth" }],
        ["moon__spacecraft", { positionMode: "moon", lookMode: "spacecraft" }],
        ["spacecraft__earth", { positionMode: "spacecraft", lookMode: "earth" }],
        ["spacecraft__moon", { positionMode: "spacecraft", lookMode: "moon" }],
    ]);
    const pairKeyByMode = new Map(
        Array.from(pairValueMap.entries()).map(([key, value]) => [
            `${value.positionMode}__${value.lookMode}`,
            key,
        ]),
    );

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

    function getAllowedLook(positionMode) {
        return allowedLookByPosition[positionMode] || ["manual"];
    }

    function getAllowedPosition(lookMode) {
        return allowedPositionByLook[lookMode] || ["manual"];
    }

    function normalizeFromTo({ positionMode, lookMode, sourceId }) {
        let nextPosition = positionMode;
        let nextLook = lookMode;
        const allowedLook = getAllowedLook(nextPosition);
        const allowedPosition = getAllowedPosition(nextLook);

        if (sourceId === "camera-position") {
            if (!allowedLook.includes(nextLook)) {
                nextLook = allowedLook[0];
            }
        } else if (sourceId === "camera-look") {
            if (!allowedPosition.includes(nextPosition)) {
                nextPosition = allowedPosition[0];
            }
        } else {
            if (!allowedLook.includes(nextLook)) {
                nextLook = allowedLook[0];
            }
            const allowedPositionAfterLook = getAllowedPosition(nextLook);
            if (!allowedPositionAfterLook.includes(nextPosition)) {
                nextPosition = allowedPositionAfterLook[0];
            }
        }

        return { positionMode: nextPosition, lookMode: nextLook };
    }

    function updateSelectOptions(selectId, allowedValues) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const allowed = new Set(allowedValues);
        for (const option of select.options) {
            option.disabled = !allowed.has(option.value);
        }
    }

    function updateFromToOptionStates(positionMode, lookMode) {
        updateSelectOptions("camera-look", getAllowedLook(positionMode));
        updateSelectOptions("camera-position", getAllowedPosition(lookMode));
    }

    function updateCameraPairSelection(positionMode, lookMode) {
        const key = pairKeyByMode.get(`${positionMode}__${lookMode}`) || "manual__manual";
        const selected = document.querySelector(`input[name="camera-pair"][value="${key}"]`);
        if (selected && !selected.checked) {
            selected.checked = true;
        }
    }

    function resolvePairFromEvent(event) {
        const value = event?.target?.value;
        if (!value) return null;
        return pairValueMap.get(value) || null;
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
        const allowSet = lookMode === "manual"
            ? lockOnAvailability[positionMode] || new Set()
            : new Set();

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

    function applyFixedFov(scene, positionMode) {
        const toggle = document.getElementById("camera-fov-fixed");
        const fixedEnabled = toggle ? toggle.checked : true;
        if (toggle) {
            toggle.disabled = !(positionMode === "earth" || positionMode === "moon");
        }
        const controller = scene?.cameraController;
        if (!controller) return;

        const shouldFix = fixedEnabled && (positionMode === "earth" || positionMode === "moon");
        if (shouldFix) {
            if (savedFov === null) {
                const current = scene?.camera?.fov ?? controller.camera?.fov;
                savedFov = Number.isFinite(current) ? current : 50;
            }
            controller.setFov(1);
        } else if (savedFov !== null) {
            controller.setFov(savedFov);
            savedFov = null;
        }
    }

    function updateFovIndicator(positionMode) {
        const node = document.getElementById("camera-fov-indicator");
        if (!node) return;
        const toggle = document.getElementById("camera-fov-fixed");
        const fixed = toggle ? toggle.checked && (positionMode === "earth" || positionMode === "moon") : positionMode === "earth" || positionMode === "moon";
        node.textContent = fixed ? "FoV: 1° (fixed)" : "FoV: default";
        node.classList.toggle("is-active", fixed);
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

    function updateMountedBodyVisibility(scene, positionMode) {
        if (!scene?.cameraController) return;

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

        // Snap to a deterministic offset (do not preserve previous offset).
        // We intentionally use a small standoff to feel like a "from the center" viewpoint.
        const baseRadius = estimateRadius(scene, positionMode);
        const defaultDistance = Number.isFinite(baseRadius) ? Math.max(baseRadius * 0.1, 0.01) : 10;
        const distance = preserveDistance
            ? Math.max(controller.mountOffset?.length?.() ?? defaultDistance, 0.01)
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
        const sourceId = event?.target?.id;
        if (event?.target?.name === "camera-pair") {
            const resolved = resolvePairFromEvent(event);
            if (resolved) {
                applyCameraFromTo?.(resolved);
            }
        }

        let positionMode = readCameraPositionMode();
        let lookMode = readCameraLookMode();

        const normalized = normalizeFromTo({ positionMode, lookMode, sourceId });
        if (normalized.positionMode !== positionMode || normalized.lookMode !== lookMode) {
            applyCameraFromTo?.(normalized);
            positionMode = normalized.positionMode;
            lookMode = normalized.lookMode;
        }

        updateFromToOptionStates(positionMode, lookMode);
        updateCameraPairSelection(positionMode, lookMode);

        const config = getConfig();
        const scene = animationScenes[config];
        updateLockOnAvailability(scene, positionMode, lookMode);
        applyFixedFov(scene, positionMode);
        updateFovIndicator(positionMode);

        const shouldSnap = positionMode !== lastAppliedPositionMode;
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
            scene.skyContainer.visible = getViewSky();

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
    }

    return { changeCameraFromTo, togglePlane, recenterMountedCamera };
}
