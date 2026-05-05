import { getSceneCraftObject } from "./scene-craft-helpers.js";
import { AuxiliaryCameraViewsManager } from "./auxiliary-camera-views.js";
import { DesktopPanelManager } from "./panel-manager.js";
import {
    configureBodyRenderLayers,
    configureCraftRenderLayers,
    configureSkyRenderLayers,
} from "./scene-render-layers.js";
import {
    applyPhotoModeBodyPresentation,
    applyPhotoModeExposure,
    resolvePhotoModeLightingPresentation,
} from "./photo-mode-render-presentation.js";

function createSceneHandlerClass(deps) {
    const {
        THREE,
        d3,
        bindSettingsPanel,
        initSceneHandlerDom,
        computeSVGDimensions,
        getSvgWidth,
        getSvgHeight,
        isTestMode,
        onWindowResize,
        updateCraftScale,
        getRuntimeState,
    } = deps;

    return class SceneHandler {
        constructor() {
            this.scene = null;
            this.renderer = null;
            this.canvasNode = null;
            this.auxiliaryCameraViews = null;
            this.auxiliaryCameraViewsInitializing = false;
            this.desktopPanelManager = null;
            this.initialized = false;
            this.lastAnimationScene = null;
            this.lookAtWorldTarget = new THREE.Vector3();
            this.skyWorldPosition = new THREE.Vector3();
            this.sunWorldPosition = new THREE.Vector3();
            this.mainCameraWorldPosition = new THREE.Vector3();
            this.earthWorldPosition = new THREE.Vector3();
            this.moonWorldPosition = new THREE.Vector3();

            this.init();
        }

        init() {
            if (this.initialized) {
                return;
            }

            const { renderer, canvasNode } = initSceneHandlerDom({
                d3,
                bindSettingsPanel,
                computeSVGDimensions,
                getSvgWidth,
                getSvgHeight,
                isTestMode,
                onWindowResize,
                THREE,
            });
            this.renderer = renderer;
            this.canvasNode = canvasNode;

            if (!isTestMode && window.innerWidth > 600) {
                const overlayHost = document.getElementById("content-wrapper") ||
                    document.getElementById("wrapper") ||
                    document.body;
                this.desktopPanelManager = new DesktopPanelManager({
                    overlayHost,
                });
            }

            this.initialized = true;
        }

        ensureAuxiliaryCameraViews() {
            if (this.auxiliaryCameraViews || this.auxiliaryCameraViewsInitializing || isTestMode || window.innerWidth <= 600) {
                return this.auxiliaryCameraViews;
            }

            const overlayHost = document.getElementById("content-wrapper") ||
                document.getElementById("wrapper") ||
                document.body;
            const pendingManager = {
                render() {},
                dispose() {},
            };
            this.auxiliaryCameraViewsInitializing = true;
            this.auxiliaryCameraViews = pendingManager;
            try {
                const manager = new AuxiliaryCameraViewsManager({
                    THREE,
                    overlayHost,
                    requestRender: () => {
                        if (this.lastAnimationScene) {
                            this.render(this.lastAnimationScene);
                        }
                    },
                });
                this.auxiliaryCameraViews = manager;
                return manager;
            } finally {
                this.auxiliaryCameraViewsInitializing = false;
                if (this.auxiliaryCameraViews === pendingManager) {
                    this.auxiliaryCameraViews = null;
                }
            }
        }

        render(animationScene) {
            if (!animationScene?.initialized3D) {
                return;
            }

            const renderWithCamera = (camera) => {
                if (!camera) return;
                camera.updateMatrixWorld?.();
                if (animationScene.skyContainer?.position) {
                    this.skyWorldPosition.setFromMatrixPosition(camera.matrixWorld);
                    if (animationScene.skyContainer.parent?.worldToLocal) {
                        animationScene.skyContainer.parent.worldToLocal(this.skyWorldPosition);
                    }
                    animationScene.skyContainer.position.copy(this.skyWorldPosition);
                }
                if (animationScene.sunRenderer?.setReferencePosition) {
                    this.sunWorldPosition.setFromMatrixPosition(camera.matrixWorld);
                    const sunParent = animationScene.sunRenderer.group?.parent;
                    if (sunParent?.worldToLocal) {
                        sunParent.worldToLocal(this.sunWorldPosition);
                    }
                    animationScene.sunRenderer.setReferencePosition(
                        this.sunWorldPosition.x,
                        this.sunWorldPosition.y,
                        this.sunWorldPosition.z,
                    );
                }
                // Render sky first on its dedicated layer, then clear depth so
                // foreground bodies fully occlude background stars.
                const renderSkyLayer = animationScene.skyContainer?.visible !== false;
                if (renderSkyLayer) {
                    this.renderer.autoClear = true;
                    configureSkyRenderLayers(camera);
                    this.renderer.render(animationScene.scene, camera);
                    this.renderer.autoClear = false;
                    this.renderer.clearDepth();
                } else {
                    this.renderer.autoClear = true;
                }

                configureBodyRenderLayers(camera);
                this.renderer.render(animationScene.scene, camera);

                this.renderer.autoClear = false;
                configureCraftRenderLayers(camera);
                this.renderer.render(animationScene.scene, camera);
            };
            const setSunDirectionForView = (mode = "earth") => {
                const sunRenderer = animationScene.sunRenderer;
                if (!sunRenderer?.setDirection) {
                    return;
                }
                const directions = animationScene.stateSunDirections || null;
                const chosen = mode === "craft"
                    ? (directions?.craftCenteredLightTime || directions?.craftCentered || directions?.earthCentered || animationScene.stateSunDirection)
                    : (directions?.earthCentered || animationScene.stateSunDirection);
                if (
                    chosen &&
                    Number.isFinite(chosen.x) &&
                    Number.isFinite(chosen.y) &&
                    Number.isFinite(chosen.z)
                ) {
                    sunRenderer.setDirection(chosen.x, chosen.y, chosen.z);
                }
            };

            const previousRenderedScene = this.lastAnimationScene;
            if (
                previousRenderedScene &&
                previousRenderedScene !== animationScene &&
                previousRenderedScene.sceneHelpers?.updateBodyHalos
            ) {
                previousRenderedScene.sceneHelpers.updateBodyHalos({ visible: false });
            }

            this.lastAnimationScene = animationScene;

            const {
                globalConfig,
                joyRideFlag,
                landingFlag,
                viewPhotoMode,
                viewAuxiliaryPanels,
                earthRadius,
                moonRadius,
                timelineEventInfos,
            } = getRuntimeState();
            const auxiliaryCameraViews = viewAuxiliaryPanels
                ? this.ensureAuxiliaryCameraViews()
                : this.auxiliaryCameraViews;
            const renderSceneCamera = (camera) => {
                if (!camera) {
                    return;
                }
                this.mainCameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
                animationScene.earthContainer?.getWorldPosition?.(this.earthWorldPosition);
                animationScene.moonContainer?.getWorldPosition?.(this.moonWorldPosition);
                const photoModePresentation = resolvePhotoModeLightingPresentation({
                    enabled: viewPhotoMode,
                    cameraPosition: this.mainCameraWorldPosition,
                    earthPosition: this.earthWorldPosition,
                    earthRadius,
                    moonPosition: this.moonWorldPosition,
                    moonRadius,
                });
                const restorePhotoModeBodyPresentation = applyPhotoModeBodyPresentation({
                    earth: animationScene.earthContainer,
                    moon: animationScene.moonContainer,
                    presentation: photoModePresentation,
                    earthDayTexture: animationScene.earthPhotoTexture || null,
                });
                const restorePhotoModeExposure = applyPhotoModeExposure({
                    renderer: this.renderer,
                    presentation: photoModePresentation,
                });
                try {
                    renderWithCamera(camera);
                } finally {
                    restorePhotoModeExposure();
                    restorePhotoModeBodyPresentation();
                }
            };

            updateCraftScale();
            const activeCraft =
                getSceneCraftObject(animationScene, globalConfig) ||
                animationScene.craft ||
                Object.values(animationScene.craftsById || {})[0] ||
                null;
            if (!activeCraft) {
                animationScene.refreshBodyHalos?.({ suppress: false });
                setSunDirectionForView("earth");
                renderSceneCamera(animationScene.camera);
                if (viewAuxiliaryPanels) {
                    animationScene.refreshBodyHalos?.({ suppress: true });
                }
                auxiliaryCameraViews?.render({
                    scene: animationScene.scene,
                    skyRenderer: animationScene.skyRenderer,
                    latestSceneState: animationScene.latestSceneState || null,
                    activeCraft: null,
                    craftsById: animationScene.craftsById,
                    dronesById: animationScene.dronesById,
                    earth: animationScene.earthContainer,
                    moon: animationScene.moonContainer,
                    sun: animationScene.sun,
                    sunRenderer: animationScene.sunRenderer,
                    sunDirection: animationScene.stateSunDirection,
                    sunDirections: animationScene.stateSunDirections,
                    skyContainer: animationScene.skyContainer,
                    earthRadius,
                    moonRadius,
                    timelineEventInfos,
                    referenceCamera: animationScene.camera,
                    panelsVisible: viewAuxiliaryPanels,
                    missionConfig: globalConfig,
                    photoModeEnabled: viewPhotoMode,
                    earthPhotoTexture: animationScene.earthPhotoTexture || null,
                });
                if (viewAuxiliaryPanels) {
                    animationScene.refreshBodyHalos?.({ suppress: false });
                }
                return;
            }

            if (animationScene.lockOnEarth || (globalConfig && globalConfig.is_lunar && animationScene.lockOnMoon)) {
                const x = animationScene.secondaryBody3D.position.x;
                const y = animationScene.secondaryBody3D.position.y;
                const z = animationScene.secondaryBody3D.position.z;
                animationScene.motherContainer.position.set(-x, -y, -z);
            } else if (animationScene.lockOnSC) {
                const x = activeCraft.position.x;
                const y = activeCraft.position.y;
                const z = activeCraft.position.z;
                animationScene.motherContainer.position.set(-x, -y, -z);
            } else {
                animationScene.motherContainer.position.set(0, 0, 0);
            }

            if (animationScene.cameraController?.updateFromTo) {
                animationScene.cameraController.updateFromTo({
                    earth: animationScene.earthContainer,
                    moon: animationScene.moonContainer,
                    spacecraft: activeCraft,
                });
            }

            const usingSpecialCamera = joyRideFlag || landingFlag;
            animationScene.refreshBodyHalos?.({ suppress: false });

            if (usingSpecialCamera) {
                const craftEarthDistance = activeCraft.position.distanceTo(animationScene.earthContainer.position);
                const craftMoonDistance = (globalConfig && globalConfig.is_lunar && animationScene.moonContainer)
                    ? activeCraft.position.distanceTo(animationScene.moonContainer.position)
                    : Infinity;
                const earthAngleRads = Math.asin(earthRadius / craftEarthDistance);
                const moonAngleRads = Math.asin(moonRadius / craftMoonDistance);

                let closerBody;
                let closerAngleRads;
                let radius;
                let distance;
                if (craftEarthDistance < craftMoonDistance) {
                    closerBody = animationScene.earthContainer;
                    closerAngleRads = earthAngleRads;
                    distance = craftEarthDistance;
                    radius = earthRadius;
                } else {
                    closerBody = animationScene.moonContainer;
                    closerAngleRads = moonAngleRads;
                    distance = craftMoonDistance;
                    radius = moonRadius;
                }

                // Keep mounted/special cameras north-up in J2000 ecliptic frame.
                animationScene.craftCamera.up.set(0, 0, 1);
                animationScene.droneCamera.up.set(0, 0, 1);

                animationScene.craftCamera.lookAt(closerBody.position);
                animationScene.droneCamera.lookAt(activeCraft.position);

                const specialCamera = joyRideFlag ? animationScene.craftCamera : animationScene.droneCamera;
                if (specialCamera) {
                    setSunDirectionForView(joyRideFlag ? "craft" : "earth");
                    renderSceneCamera(specialCamera);
                } else {
                    setSunDirectionForView("earth");
                    renderSceneCamera(animationScene.camera);
                }
            } else {
                setSunDirectionForView("earth");
                renderSceneCamera(animationScene.camera);
            }

            if (viewAuxiliaryPanels) {
                animationScene.refreshBodyHalos?.({ suppress: true });
            }
            auxiliaryCameraViews?.render({
                scene: animationScene.scene,
                skyRenderer: animationScene.skyRenderer,
                latestSceneState: animationScene.latestSceneState || null,
                activeCraft,
                craftsById: animationScene.craftsById,
                dronesById: animationScene.dronesById,
                earth: animationScene.earthContainer,
                moon: animationScene.moonContainer,
                sun: animationScene.sun,
                sunRenderer: animationScene.sunRenderer,
                sunDirection: animationScene.stateSunDirection,
                sunDirections: animationScene.stateSunDirections,
                skyContainer: animationScene.skyContainer,
                earthRadius,
                moonRadius,
                timelineEventInfos,
                referenceCamera: animationScene.camera,
                panelsVisible: viewAuxiliaryPanels,
                missionConfig: globalConfig,
                photoModeEnabled: viewPhotoMode,
                earthPhotoTexture: animationScene.earthPhotoTexture || null,
            });
            if (viewAuxiliaryPanels) {
                animationScene.refreshBodyHalos?.({ suppress: false });
            }
        }
    };
}

export { createSceneHandlerClass };

