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
            this.initialized = false;
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

            this.initialized = true;
        }

        render(animationScene) {
            if (!animationScene?.initialized3D) {
                return;
            }

            const {
                globalConfig,
                joyRideFlag,
                landingFlag,
                earthRadius,
                moonRadius,
            } = getRuntimeState();

            updateCraftScale();

            if (animationScene.lockOnEarth || (globalConfig && globalConfig.is_lunar && animationScene.lockOnMoon)) {
                const x = animationScene.secondaryBody3D.position.x;
                const y = animationScene.secondaryBody3D.position.y;
                const z = animationScene.secondaryBody3D.position.z;
                animationScene.motherContainer.position.set(-x, -y, -z);
            } else if (animationScene.lockOnSC) {
                const x = animationScene.craft.position.x;
                const y = animationScene.craft.position.y;
                const z = animationScene.craft.position.z;
                animationScene.motherContainer.position.set(-x, -y, -z);
            } else {
                animationScene.motherContainer.position.set(0, 0, 0);
            }

            if (animationScene.cameraController?.updateFromTo) {
                animationScene.cameraController.updateFromTo({
                    earth: animationScene.earthContainer,
                    moon: animationScene.moonContainer,
                    spacecraft: animationScene.craft,
                });
            }

            if (joyRideFlag || landingFlag) {
                const craftEarthDistance = animationScene.craft.position.distanceTo(animationScene.earthContainer.position);
                const craftMoonDistance = (globalConfig && globalConfig.is_lunar && animationScene.moonContainer)
                    ? animationScene.craft.position.distanceTo(animationScene.moonContainer.position)
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
                        .subVectors(animationScene.craft.position, animationScene.moonContainer.position)
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
                animationScene.droneCamera.lookAt(animationScene.craft.position);

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
        }
    };
}

export { createSceneHandlerClass };
