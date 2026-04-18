import {
    buildMobileMoonVisibilitySignature,
    computeMobileMoonVisibilityInfoFromSceneState,
    hasFinitePositionVector,
    normalizeVectorInPlace,
    resolveBodyPositionFromSceneState,
    shouldRunMobileMoonVisibilityLoop,
    shouldShowMobileMoonVisibility,
    shouldSkipMobileMoonVisibilityUpdate,
} from "../core/domain/mobile-moon-visibility-state.js";

function createMobileMoonVisibilitySync(deps) {
    const {
        mobileViewsMoonVisibility,
        mobileViewsMoonVisibilitySummary,
        mobileViewsMoonVisibilityHead,
        mobileViewsMoonVisibilityValues,
        mobileViewsFarSideToggle,
        mobileMoonFarSideOverlay,
        resolveActiveScene,
        resolveSceneObject,
        isMobileViewport = () => false,
        getActiveTab = () => "",
        getActiveViewPresetId = () => "",
        getIsThreeD = () => false,
        onLoopFrame = () => {},
        requestSceneRender = () => {},
        windowRef = globalThis?.window || globalThis,
        performanceRef = globalThis?.performance,
        overlayUpdateIntervalMs = 180,
        initialFarSideOverlayEnabled = true,
    } = deps;

    let farSideOverlayEnabled = !!initialFarSideOverlayEnabled;
    let overlayLastUpdateMs = -Infinity;
    let overlayLoopHandle = null;
    let overlayCtx = null;
    let visibilitySignature = "";

    function resolveMoonRenderMesh(scene) {
        if (!scene) return null;
        const directMoon = scene.moon;
        if (directMoon?.isMesh && directMoon.geometry) {
            return directMoon;
        }
        const container = scene.moonContainer;
        if (container?.isMesh && container.geometry) {
            return container;
        }
        let found = null;
        container?.traverse?.((node) => {
            if (found) return;
            if (node?.isMesh && node.geometry) {
                found = node;
            }
        });
        return found;
    }

    function ensureMobileMoonFarSideOverlayMesh(scene) {
        const existing = scene?.mobileMoonFarSideOverlayMesh;
        if (existing?.mesh && existing?.material) {
            return existing;
        }
        const THREE = scene?.THREE || windowRef?.THREE;
        if (!THREE?.ShaderMaterial || !THREE?.Mesh || !THREE?.Vector3 || !THREE?.Vector4) {
            return null;
        }

        const moonMesh = resolveMoonRenderMesh(scene);
        if (!moonMesh?.geometry || typeof moonMesh.add !== "function") {
            return null;
        }

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -2,
            uniforms: {
                uEarthDirWorld: { value: new THREE.Vector3(1, 0, 0) },
                uSunDirWorld: { value: new THREE.Vector3(1, 0, 0) },
                uOverlayColor: { value: new THREE.Vector4(0.56, 0.44, 0.98, 0.52) },
            },
            vertexShader: `
                varying vec3 vWorldNormal;
                void main() {
                    vWorldNormal = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uEarthDirWorld;
                uniform vec3 uSunDirWorld;
                uniform vec4 uOverlayColor;
                varying vec3 vWorldNormal;
                void main() {
                    vec3 n = normalize(vWorldNormal);
                    float farDot = dot(n, normalize(uEarthDirWorld));
                    if (farDot >= 0.0) {
                        discard;
                    }
                    float farMask = smoothstep(0.0, -0.035, farDot);
                    float sunDot = dot(n, normalize(uSunDirWorld));
                    float nightness = smoothstep(0.03, -0.18, sunDot);
                    vec3 rgb = mix(uOverlayColor.rgb, vec3(0.72, 0.64, 0.98), 0.2 * nightness);
                    float alpha = uOverlayColor.a * farMask * mix(0.62, 0.82, nightness);
                    gl_FragColor = vec4(rgb, alpha);
                }
            `,
        });

        const mesh = new THREE.Mesh(moonMesh.geometry, material);
        mesh.name = "mobile-moon-far-side-overlay";
        mesh.renderOrder = (moonMesh.renderOrder || 0) + 1;
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.scale.setScalar(1.0015);
        moonMesh.add(mesh);

        const handle = { mesh, material };
        scene.mobileMoonFarSideOverlayMesh = handle;
        return handle;
    }

    function hideMobileMoonFarSideOverlayForScene(scene) {
        const overlay = scene?.mobileMoonFarSideOverlayMesh;
        if (overlay?.mesh) {
            overlay.mesh.visible = false;
        }
    }

    function hideAllMobileMoonFarSideOverlays() {
        const scenes = windowRef?.animationScenes;
        if (!scenes || typeof scenes !== "object") return;
        Object.values(scenes).forEach((scene) => hideMobileMoonFarSideOverlayForScene(scene));
    }

    function ensureMobileMoonOverlayCanvasSize() {
        if (!mobileMoonFarSideOverlay) return null;
        const cssWidth = Math.max(1, Math.floor(windowRef?.innerWidth || 1));
        const cssHeight = Math.max(1, Math.floor(windowRef?.innerHeight || 1));
        const resized = (mobileMoonFarSideOverlay.width !== cssWidth) ||
            (mobileMoonFarSideOverlay.height !== cssHeight);
        if (resized) {
            mobileMoonFarSideOverlay.width = cssWidth;
            mobileMoonFarSideOverlay.height = cssHeight;
            mobileMoonFarSideOverlay.style.width = `${cssWidth}px`;
            mobileMoonFarSideOverlay.style.height = `${cssHeight}px`;
        }
        return { cssWidth, cssHeight };
    }

    function clearMobileMoonOverlay() {
        if (!mobileMoonFarSideOverlay) return;
        const ctx = overlayCtx || mobileMoonFarSideOverlay.getContext("2d");
        if (!ctx) return;
        overlayCtx = ctx;
        const size = ensureMobileMoonOverlayCanvasSize();
        if (!size) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, mobileMoonFarSideOverlay.width, mobileMoonFarSideOverlay.height);
    }

    function setMobileMoonOverlayActive(active) {
        if (!mobileMoonFarSideOverlay) return;
        mobileMoonFarSideOverlay.classList.toggle("is-active", !!active);
        if (!active) {
            clearMobileMoonOverlay();
        }
    }

    function computeMobileMoonOverlayState(scene, earthObject, moonObject) {
        if (!scene?.camera) {
            return null;
        }

        const resolveSunDirectionWorld = () => {
            const fromState = scene?.stateSunDirections?.moonCentered || scene?.stateSunDirection;
            if (hasFinitePositionVector(fromState)) {
                const sunDir = { x: fromState.x, y: fromState.y, z: fromState.z };
                if (normalizeVectorInPlace(sunDir)) {
                    return sunDir;
                }
            }
            const stateSun = scene?.latestSceneState?.sunDirections?.moonCentered || scene?.latestSceneState?.sunDirection;
            if (hasFinitePositionVector(stateSun)) {
                const sunDir = { x: stateSun.x, y: stateSun.y, z: stateSun.z };
                if (normalizeVectorInPlace(sunDir)) {
                    return sunDir;
                }
            }
            return null;
        };

        const sunDirectionWorld = resolveSunDirectionWorld();
        if (!sunDirectionWorld) {
            return null;
        }

        if (earthObject && moonObject) {
            const earthWorld = scene.camera.position.clone();
            const moonWorld = scene.camera.position.clone();
            earthObject.getWorldPosition?.(earthWorld);
            moonObject.getWorldPosition?.(moonWorld);

            const earthFromMoonDir = earthWorld.sub(moonWorld.clone());
            if (!normalizeVectorInPlace(earthFromMoonDir)) {
                return null;
            }

            return {
                earthDirectionWorld: earthFromMoonDir,
                sunDirectionWorld,
                moonWorld,
            };
        }

        const sceneState = scene?.latestSceneState;
        const stateEarth = resolveBodyPositionFromSceneState(sceneState, scene?.primaryBody, "EARTH");
        const stateMoon = resolveBodyPositionFromSceneState(sceneState, scene?.primaryBody, "MOON");
        if (!hasFinitePositionVector(stateEarth) || !hasFinitePositionVector(stateMoon)) {
            return null;
        }
        const earthFromMoonDir = {
            x: stateEarth.x - stateMoon.x,
            y: stateEarth.y - stateMoon.y,
            z: stateEarth.z - stateMoon.z,
        };
        if (!normalizeVectorInPlace(earthFromMoonDir)) {
            return null;
        }
        const moonWorld = scene.camera.position.clone();
        (scene.moonContainer || scene.moon)?.getWorldPosition?.(moonWorld);
        return {
            earthDirectionWorld: earthFromMoonDir,
            sunDirectionWorld,
            moonWorld,
        };
    }

    function renderMobileMoonFarSideOverlay(scene, visibility) {
        if (!scene?.camera || !visibility?.earthDirectionWorld || !visibility?.sunDirectionWorld) {
            hideMobileMoonFarSideOverlayForScene(scene);
            setMobileMoonOverlayActive(false);
            return;
        }
        const overlay = ensureMobileMoonFarSideOverlayMesh(scene);
        const dir = visibility.earthDirectionWorld;
        const sunDir = visibility.sunDirectionWorld;
        if (!overlay?.mesh || !overlay?.material || !Number.isFinite(dir.x) || !Number.isFinite(dir.y) || !Number.isFinite(dir.z)) {
            hideMobileMoonFarSideOverlayForScene(scene);
            setMobileMoonOverlayActive(false);
            return;
        }
        const uniformDir = overlay.material.uniforms?.uEarthDirWorld?.value;
        const uniformSunDir = overlay.material.uniforms?.uSunDirWorld?.value;
        if (!uniformDir?.copy || !uniformSunDir?.copy) {
            hideMobileMoonFarSideOverlayForScene(scene);
            setMobileMoonOverlayActive(false);
            return;
        }
        uniformDir.copy(dir).normalize();
        uniformSunDir.copy(sunDir).normalize();
        overlay.mesh.visible = true;
        setMobileMoonOverlayActive(true);
    }

    function updateFarSideToggleState() {
        if (!mobileViewsFarSideToggle) return;
        mobileViewsFarSideToggle.textContent = farSideOverlayEnabled ? "Far Side: ON" : "Far Side: OFF";
        mobileViewsFarSideToggle.classList.toggle("is-active", farSideOverlayEnabled);
        mobileViewsFarSideToggle.setAttribute("aria-pressed", farSideOverlayEnabled ? "true" : "false");
    }

    function setMobileMoonVisibilityInfoVisible(visible) {
        if (mobileViewsMoonVisibility) {
            mobileViewsMoonVisibility.hidden = !visible;
        }
        if (!visible) {
            visibilitySignature = "";
            hideAllMobileMoonFarSideOverlays();
            setMobileMoonOverlayActive(false);
        }
    }

    function renderUnavailableSummary() {
        if (!mobileViewsMoonVisibilitySummary) return;
        if (mobileViewsMoonVisibilityHead && mobileViewsMoonVisibilityValues) {
            mobileViewsMoonVisibilityHead.hidden = true;
            mobileViewsMoonVisibilityValues.innerHTML = [
                "<span>--%</span>",
                "<span>--%</span>",
                "<span>--%</span>",
                "<span>--%</span>",
            ].join("");
        } else {
            mobileViewsMoonVisibilitySummary.textContent = "Visible lunar surface: unavailable";
        }
        visibilitySignature = "";
        hideAllMobileMoonFarSideOverlays();
        setMobileMoonOverlayActive(false);
    }

    function renderVisibilitySummary(panelVisibility) {
        if (!mobileViewsMoonVisibilitySummary) return;
        if (mobileViewsMoonVisibilityHead && mobileViewsMoonVisibilityValues) {
            const nextSignature = buildMobileMoonVisibilitySignature(panelVisibility);
            mobileViewsMoonVisibilityHead.hidden = false;
            if (visibilitySignature !== nextSignature) {
                mobileViewsMoonVisibilityValues.innerHTML = [
                    `<span>${panelVisibility.nearDayPct}%</span>`,
                    `<span>${panelVisibility.nearNightPct}%</span>`,
                    `<span>${panelVisibility.farDayPct}%</span>`,
                    `<span>${panelVisibility.farNightPct}%</span>`,
                ].join("");
                visibilitySignature = nextSignature;
            }
            return;
        }

        mobileViewsMoonVisibilitySummary.textContent =
            `${panelVisibility.nearPct}% near (${panelVisibility.nearDayPct}% day; ${panelVisibility.nearNightPct}% night) ` +
            `${panelVisibility.farPct}% far (${panelVisibility.farDayPct}% day; ${panelVisibility.farNightPct}% night)`;
    }

    function sync({ force = false } = {}) {
        const shouldShow = shouldShowMobileMoonVisibility({
            isMobileViewport: isMobileViewport(),
            activeTab: getActiveTab(),
            activeViewPresetId: getActiveViewPresetId(),
        });
        if (!shouldShow) {
            setMobileMoonVisibilityInfoVisible(false);
            return false;
        }

        const nowMs = typeof performanceRef?.now === "function"
            ? performanceRef.now()
            : Date.now();
        if (shouldSkipMobileMoonVisibilityUpdate({
            force,
            nowMs,
            lastUpdateMs: overlayLastUpdateMs,
            minIntervalMs: overlayUpdateIntervalMs,
        })) {
            return false;
        }
        overlayLastUpdateMs = nowMs;
        setMobileMoonVisibilityInfoVisible(true);

        const scene = resolveActiveScene?.();
        const panelVisibility = computeMobileMoonVisibilityInfoFromSceneState({
            sceneState: scene?.latestSceneState || null,
            primaryBody: scene?.primaryBody || "",
            preferredCraftId: scene?.activeCraftId || scene?.primaryCraftId || null,
        });
        if (!panelVisibility) {
            renderUnavailableSummary();
            return false;
        }

        renderVisibilitySummary(panelVisibility);
        updateFarSideToggleState();

        if (!farSideOverlayEnabled || !getIsThreeD()) {
            hideAllMobileMoonFarSideOverlays();
            setMobileMoonOverlayActive(false);
            return true;
        }

        const earthObject = resolveSceneObject?.(scene, "earth");
        const moonObject = resolveSceneObject?.(scene, "moon");
        if (!scene?.camera) {
            hideAllMobileMoonFarSideOverlays();
            setMobileMoonOverlayActive(false);
            return true;
        }

        const overlayVisibility = computeMobileMoonOverlayState(scene, earthObject, moonObject);
        if (!overlayVisibility) {
            hideAllMobileMoonFarSideOverlays();
            setMobileMoonOverlayActive(false);
            return true;
        }

        renderMobileMoonFarSideOverlay(scene, overlayVisibility);
        return true;
    }

    function stopLoop() {
        if (overlayLoopHandle == null) return false;
        windowRef?.cancelAnimationFrame?.(overlayLoopHandle);
        overlayLoopHandle = null;
        hideAllMobileMoonFarSideOverlays();
        setMobileMoonOverlayActive(false);
        return true;
    }

    function shouldRunLoop() {
        return shouldRunMobileMoonVisibilityLoop({
            isMobileViewport: isMobileViewport(),
            activeTab: getActiveTab(),
        });
    }

    function startLoop() {
        if (overlayLoopHandle != null) return false;
        if (!shouldRunLoop()) return false;
        const tick = () => {
            sync();
            if (!shouldRunLoop()) {
                overlayLoopHandle = null;
                return;
            }
            onLoopFrame();
            overlayLoopHandle = windowRef?.requestAnimationFrame?.(tick) ?? null;
        };
        overlayLoopHandle = windowRef?.requestAnimationFrame?.(tick) ?? null;
        return overlayLoopHandle != null;
    }

    function setFarSideOverlayEnabled(enabled) {
        farSideOverlayEnabled = !!enabled;
        updateFarSideToggleState();
        if (!farSideOverlayEnabled) {
            hideAllMobileMoonFarSideOverlays();
            setMobileMoonOverlayActive(false);
        }
    }

    function toggleFarSideOverlay() {
        setFarSideOverlayEnabled(!farSideOverlayEnabled);
        sync({ force: true });
        requestSceneRender();
        windowRef?.requestAnimationFrame?.(() => {
            sync({ force: true });
            requestSceneRender();
        });
    }

    function bind() {
        if (!mobileViewsFarSideToggle) return;
        mobileViewsFarSideToggle.addEventListener("click", () => {
            toggleFarSideOverlay();
        });
    }

    return {
        bind,
        isFarSideOverlayEnabled: () => farSideOverlayEnabled,
        setFarSideOverlayEnabled,
        startLoop,
        stopLoop,
        sync,
        toggleFarSideOverlay,
    };
}

export { createMobileMoonVisibilitySync };
