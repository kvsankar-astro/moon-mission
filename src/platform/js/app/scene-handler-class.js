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

            this.lastAnimationScene = animationScene;

            const {
                globalConfig,
                joyRideFlag,
                landingFlag,
                viewAuxiliaryPanels,
                earthRadius,
                moonRadius,
            } = getRuntimeState();

            updateCraftScale();
            const activeCraft = getSceneCraftObject(animationScene, globalConfig);
            if (!activeCraft) {
                this.auxiliaryCameraViews?.render({
                    scene: animationScene.scene,
                    activeCraft: null,
                    earth: animationScene.earthContainer,
                    moon: animationScene.moonContainer,
                    earthRadius,
                    moonRadius,
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

                let upDir;
                if (closerBody === animationScene.moonContainer) {
                    upDir = new THREE.Vector3()
                        .subVectors(activeCraft.position, animationScene.moonContainer.position)
                        .normalize();
                    if (upDir.lengthSq() === 0) {
                        upDir.set(0, 0, 1);
                    }
                } else {
                    upDir = new THREE.Vector3(0, 0, 1)
                        .applyQuaternion(closerBody.quaternion)
                        .normalize();
                }

                animationScene.craftCamera.up.copy(upDir);
                animationScene.droneCamera.up.copy(upDir);

                animationScene.craftCamera.lookAt(closerBody.position);
                animationScene.droneCamera.lookAt(activeCraft.position);

                const specialCamera = joyRideFlag ? animationScene.craftCamera : animationScene.droneCamera;
                this.renderer.autoClear = true;
                specialCamera.layers.set(0);
                this.renderer.render(animationScene.scene, specialCamera);

                this.renderer.autoClear = false;
                specialCamera.layers.set(1);
                this.renderer.render(animationScene.scene, specialCamera);
            } else {
                this.renderer.autoClear = true;
                animationScene.camera.layers.set(0);
                this.renderer.render(animationScene.scene, animationScene.camera);

                this.renderer.autoClear = false;
                animationScene.camera.layers.set(1);
                this.renderer.render(animationScene.scene, animationScene.camera);
            }

            this.auxiliaryCameraViews?.render({
                scene: animationScene.scene,
                activeCraft,
                earth: animationScene.earthContainer,
                moon: animationScene.moonContainer,
                earthRadius,
                moonRadius,
                referenceCamera: animationScene.camera,
                panelsVisible: viewAuxiliaryPanels,
            });
        }
    };
}

export { createSceneHandlerClass };
