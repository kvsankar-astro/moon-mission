import { getSceneCraftObject } from "./scene-craft-helpers.js";
import { AuxiliaryCameraViewsManager } from "./auxiliary-camera-views.js";

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
            this.initialized = false;
            this.lastAnimationScene = null;
            this.lookAtWorldTarget = new THREE.Vector3();

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
                this.auxiliaryCameraViews = new AuxiliaryCameraViewsManager({
                    THREE,
                    overlayHost,
                    requestRender: () => {
                        if (this.lastAnimationScene) {
                            this.render(this.lastAnimationScene);
                        }
                    },
                });
            }

            this.initialized = true;
        }

        render(animationScene) {
            if (!animationScene?.initialized3D) {
                return;
            }

            const skyWorldPosition = new THREE.Vector3();

            const renderWithCamera = (camera) => {
                if (!camera) return;
                if (animationScene.skyContainer?.position) {
                    camera.updateMatrixWorld?.();
                    skyWorldPosition.setFromMatrixPosition(camera.matrixWorld);
                    if (animationScene.skyContainer.parent?.worldToLocal) {
                        animationScene.skyContainer.parent.worldToLocal(skyWorldPosition);
                    }
                    animationScene.skyContainer.position.copy(skyWorldPosition);
                }
                this.renderer.autoClear = true;
                camera.layers.set(0);
                this.renderer.render(animationScene.scene, camera);

                this.renderer.autoClear = false;
                camera.layers.set(1);
                this.renderer.render(animationScene.scene, camera);
            };

            const previousRenderedScene = this.lastAnimationScene;
            if (
                previousRenderedScene &&
                previousRenderedScene !== animationScene &&
                previousRenderedScene.sceneHelpers?.updateBodyHighlight
            ) {
                previousRenderedScene.sceneHelpers.updateBodyHighlight({ visible: false });
            }

            this.lastAnimationScene = animationScene;

            const {
                globalConfig,
                joyRideFlag,
                landingFlag,
                viewAuxiliaryPanels,
                earthRadius,
                moonRadius,
                timelineEventInfos,
            } = getRuntimeState();

            updateCraftScale();
            const activeCraft =
                getSceneCraftObject(animationScene, globalConfig) ||
                animationScene.craft ||
                Object.values(animationScene.craftsById || {})[0] ||
                null;
            if (!activeCraft) {
                animationScene.refreshSecondaryBodyHighlight?.({ suppress: true });
                renderWithCamera(animationScene.camera);
                this.auxiliaryCameraViews?.render({
                    scene: animationScene.scene,
                    activeCraft: null,
                    earth: animationScene.earthContainer,
                    moon: animationScene.moonContainer,
                    sun: animationScene.sun,
                    sunDirection: animationScene.stateSunDirection,
                    skyContainer: animationScene.skyContainer,
                    earthRadius,
                    moonRadius,
                    timelineEventInfos,
                    referenceCamera: animationScene.camera,
                    panelsVisible: viewAuxiliaryPanels,
                });
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
            animationScene.refreshSecondaryBodyHighlight?.({
                suppress: usingSpecialCamera,
            });

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
                    renderWithCamera(specialCamera);
                } else {
                    renderWithCamera(animationScene.camera);
                }
            } else {
                renderWithCamera(animationScene.camera);
            }

            this.auxiliaryCameraViews?.render({
                scene: animationScene.scene,
                activeCraft,
                earth: animationScene.earthContainer,
                moon: animationScene.moonContainer,
                sun: animationScene.sun,
                sunDirection: animationScene.stateSunDirection,
                skyContainer: animationScene.skyContainer,
                earthRadius,
                moonRadius,
                timelineEventInfos,
                referenceCamera: animationScene.camera,
                panelsVisible: viewAuxiliaryPanels,
            });
        }
    };
}

export { createSceneHandlerClass };
