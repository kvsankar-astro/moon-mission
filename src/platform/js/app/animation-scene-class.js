import { getRelativeFrameQuaternion } from "../data/relative-frame-provider.js";

function createAnimationSceneClass(deps) {
    const {
        THREE,
        PC,
        DEFAULT_VIEW_STATE,
        SceneHelpers,
        lunar_pole,
        sceneCreationActions,
        sceneCameraPositionActions,
        scene3dInitActions,
        dimensionsActions,
        skyActions,
        earthActions,
        moonActions,
        locationActions,
        primarySecondaryBodiesActions,
        spacecraftCurveActions,
        spacecraftActions,
        lineOfSightActions,
        axesHelperActions,
        lightActions,
        sceneCameraControllerActions,
        spacecraftModelActions,
        sceneInitActions,
        orbitVectorProcessingActions,
        bodyRotationActions,
        sceneDisposeActions,
        ensureSceneViewState,
        computeSceneCameraParameters,
        adjustCameraProjectionMatrixAndSkyAngle,
        getDefaultCameraDistance,
        getBodyEphemerisState,
        resolveBodySource,
        getRuntimeState,
    } = deps;

    return class AnimationScene {
        static SCENE_STATE_START = 0;
        static SCENE_STATE_INIT_CONFIG_DONE = 1;
        static SCENE_STATE_INIT_DONE = 2;
        static SCENE_STATE_ADD_CURVE_DONE = 3;

        constructor(name) {
            this.name = name;
            this.orbits = {};
            this.initialized3D = false;
            this.earth = null;
            this.earthContainer = null;
            this.earthAxis = null;
            this.earthGlow = null;
            this.moon = null;
            this.moonAxisRotationAngle = 0;
            this.primaryBody3D = null;
            this.secondaryBody3D = null;
            this.primaryCraftId = "SC";
            this.activeCraftId = "SC";
            this.visibleCraftIds = null;
            this.viewAdditionalCrafts = false;
            this.craftsById = {};
            this.craftInnersById = {};
            this.craftEdgesById = {};
            this.craftAxesHelpersById = {};
            this.dronesById = {};
            this.spacecraftRenderersById = {};
            this.craft = null;
            this.craftInner = null;
            this.craftEdges = null;
            this.craftAxesHelper = null;
            this.drone = null;
            this.camera = null;
            this.cameraControlsEnabled = true;
            this.cameraControls = null;
            this.scene = null;
            this.renderer = null;
            this.curve = [];
            this.landingCurve = [];
            this.curveVelocities = [];
            this.landingCurveVelocities = [];
            this.curvesById = {};
            this.curveTimesById = {};
            this.curveVelocitiesById = {};
            this.orbitLinesByBodyId = {};
            this.orbitTrailLinesByBodyId = {};
            this.orbitSvgPointsByBodyId = {};
            this.orbitTimesByBodyId = {};
            this.supportOrbitsChebByBodyId = {};
            this.locations = [];
            this.sceneHelpers = null;
            this.skyRenderer = null;
            this.lightManager = null;
            this.earthRenderer = null;
            this.moonRenderer = null;
            this.spacecraftRenderer = null;
            this.cameraController = null;
            this.stopCreationFlag = false;
            this.state = AnimationScene.SCENE_STATE_START;

            this.planeSelection = DEFAULT_VIEW_STATE.planeSelection;
            this.plane = DEFAULT_VIEW_STATE.plane;
            this.xVariable = DEFAULT_VIEW_STATE.xVariable;
            this.yVariable = DEFAULT_VIEW_STATE.yVariable;
            this.zVariable = DEFAULT_VIEW_STATE.zVariable;
            this.vxVariable = DEFAULT_VIEW_STATE.vxVariable;
            this.vyVariable = DEFAULT_VIEW_STATE.vyVariable;
            this.vzVariable = DEFAULT_VIEW_STATE.vzVariable;
            this.xFactor = DEFAULT_VIEW_STATE.xFactor;
            this.yFactor = DEFAULT_VIEW_STATE.yFactor;
            this.zFactor = DEFAULT_VIEW_STATE.zFactor;
            this.zoomFactor = DEFAULT_VIEW_STATE.zoomFactor;
            this.panx = DEFAULT_VIEW_STATE.panx;
            this.pany = DEFAULT_VIEW_STATE.pany;
        }

        stopCreation() {
            sceneCreationActions.stopCreation(this);
        }

        setCameraPosition(x, y, z) {
            sceneCameraPositionActions.setCameraPosition(this, x, y, z);
        }

        init3d(callback) {
            scene3dInitActions.init3d(this, callback);
        }

        computeDimensions() {
            dimensionsActions.computeDimensions(this);
        }

        addSky() {
            const { earthRadius, viewSky, viewConstellationLines } = getRuntimeState();
            skyActions.addSky(this, { earthRadius, viewSky, viewConstellationLines });
        }

        disposeSky() {
            skyActions.disposeSky(this);
        }

        addEarth() {
            const { earthRadius, viewPolarAxes, viewPoles } = getRuntimeState();
            earthActions.addEarth(this, {
                earthRadius,
                viewPolarAxes,
                viewPoles,
            });
        }

        disposeEarth() {
            earthActions.disposeEarth(this);
        }

        addMoon() {
            moonActions.addMoon(this);
        }

        disposeMoon() {
            moonActions.disposeMoon(this);
        }

        addMoonSOI() {
            const { globalConfig, moonRadius, viewMoonSOI } = getRuntimeState();
            if (!globalConfig || !globalConfig.is_lunar) {
                return;
            }

            if (!this.sceneHelpers) {
                this.sceneHelpers = new SceneHelpers(this.motherContainer);
            }

            this.sceneHelpers.createMoonSOI(this.moon, moonRadius, viewMoonSOI);
            this.moonSOISphere = this.sceneHelpers.moonSOISphere;
        }

        disposeMoonSOI() {
            const { globalConfig } = getRuntimeState();
            if (!globalConfig || !globalConfig.is_lunar) {
                return;
            }
            if (this.sceneHelpers) {
                this.sceneHelpers.disposeMoonSOI();
            }
            this.moonSOISphere = null;
        }

        addEarthLocations() {
            locationActions.addEarthLocations({ scene: this });
        }

        disposeEarthLocations() {
            locationActions.disposeEarthLocations({ scene: this });
        }

        addMoonLocations() {
            locationActions.addMoonLocations({ scene: this });
        }

        disposeMoonLocations() {
            locationActions.disposeMoonLocations({ scene: this });
        }

        setPrimaryAndSecondaryBodies() {
            primarySecondaryBodiesActions.setPrimaryAndSecondaryBodies(this);
        }

        addSpacecraftCurve() {
            spacecraftCurveActions.addSpacecraftCurve(this);
        }

        disposeSpacecraftCurve() {
            spacecraftCurveActions.disposeSpacecraftCurve(this);
        }

        addSpacecraft() {
            spacecraftActions.addSpacecraft(this);
        }

        disposeSpacecraft() {
            spacecraftActions.disposeSpacecraft(this);
        }

        addLineOfSight() {
            lineOfSightActions.addLineOfSight(this);
        }

        disposeLineOfSight() {
            lineOfSightActions.disposeLineOfSight(this);
        }

        addAxesHelper() {
            const {
                earthRadius,
                viewXYZAxes,
                viewEclipticPlane,
                viewEquatorialPlane,
            } = getRuntimeState();
            axesHelperActions.addAxesHelper(this, {
                earthRadius,
                viewXYZAxes,
                viewEclipticPlane,
                viewEquatorialPlane,
            });
        }

        disposeAxesHelper() {
            axesHelperActions.disposeAxesHelper(this);
        }

        addLight() {
            lightActions.addLight(this);
        }

        disposeLight() {
            lightActions.disposeLight(this);
        }

        addCamera() {
            sceneCameraControllerActions.addCamera(this);
        }

        disposeCamera() {
            sceneCameraControllerActions.disposeCamera(this);
        }

        async addSpacecraftModel() {
            await spacecraftModelActions.addSpacecraftModel(this);
        }

        disposeSpacecraftModel() {
            spacecraftModelActions.disposeSpacecraftModel(this);
        }

        init3dRest() {
            sceneInitActions.init3dRest(this);
        }

        setCameraParameters(isInitialization = false) {
            const sceneViewState = ensureSceneViewState(this);
            let controllerDistance = null;
            if (this.cameraControlsEnabled && this.cameraController) {
                controllerDistance = this.cameraController.getDistanceFromOrigin();
            }

            const params = computeSceneCameraParameters({
                planeSelection: sceneViewState?.planeSelection || DEFAULT_VIEW_STATE.planeSelection,
                missionConfig: this.name,
                isInitialization,
                controllerDistance,
                defaultCameraDistance: getDefaultCameraDistance(),
            });

            if (this.cameraController) {
                this.cameraController.setFov(params.fov);
                if (params.up) {
                    this.cameraController.setUp(params.up.x, params.up.y, params.up.z);
                }
            }

            if (params.position) {
                this.setCameraPosition(params.position.x, params.position.y, params.position.z);
            }

            this.craftVisible = params.craftVisible;
            adjustCameraProjectionMatrixAndSkyAngle();
        }

        processOrbitVectorsData3D() {
            orbitVectorProcessingActions.processOrbitVectorsData3D(this);
        }

        processLandingVectors() {
            orbitVectorProcessingActions.processLandingVectors(this);
        }

        cameraDisntance(position) {
            return sceneCameraPositionActions.cameraDisntance(position);
        }

        rotateMoon(timeMs = getRuntimeState().animTime) {
            const runtimeState = getRuntimeState();
            if (!runtimeState.globalConfig || !runtimeState.globalConfig.is_lunar) return;
            if (!this.moonContainer) return;

            if (runtimeState.frameMode === "relative" && runtimeState.config === "geo") {
                const frameQuat = getRelativeFrameQuaternion({
                    chebyshevData: runtimeState.chebyshevData,
                    config: runtimeState.config,
                    timeMs,
                });

                if (frameQuat) {
                    const qFrame = new THREE.Quaternion(
                        frameQuat.x,
                        frameQuat.y,
                        frameQuat.z,
                        frameQuat.w,
                    );

                    const date = new Date(timeMs);
                    const lp = lunar_pole(date);
                    const alpha = lp.alpha;
                    const delta = lp.delta;
                    const W = lp.W;

                    const qInertial = new THREE.Quaternion();
                    const qx1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1 * PC.EARTH_AXIS_INCLINATION_RADS);
                    const qz2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2 + alpha);
                    const qx3 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 - delta);
                    const qz4 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), W);
                    qInertial.multiply(qx1).multiply(qz2).multiply(qx3).multiply(qz4);

                    this.moonContainer.quaternion.copy(qFrame).multiply(qInertial);
                    return;
                }

                const moonState = getBodyEphemerisState({
                    bodyId: "MOON",
                    timeMs,
                    config: runtimeState.config,
                    npzData: runtimeState.npzData,
                    npzDataLoaded: runtimeState.npzDataLoaded,
                    chebyshevData: runtimeState.chebyshevData,
                    chebyshevDataLoaded: runtimeState.chebyshevDataLoaded,
                    resolvedSource: resolveBodySource({
                        bodyId: "MOON",
                        bodySources: runtimeState.bodyEphemerisSources,
                        defaultSpacecraftSource: runtimeState.ephemerisSource,
                    }),
                    defaultSpacecraftSource: runtimeState.ephemerisSource,
                });
                if (!moonState.available) return;
                const r = new THREE.Vector3(moonState.position.x, moonState.position.y, moonState.position.z);
                const v = new THREE.Vector3(moonState.velocity.vx, moonState.velocity.vy, moonState.velocity.vz);

                if (r.lengthSq() === 0) return;

                const xHat = r.clone().normalize();
                const zHat = new THREE.Vector3().crossVectors(r, v);
                if (zHat.lengthSq() === 0) return;
                zHat.normalize();
                const yHat = new THREE.Vector3().crossVectors(zHat, xHat);
                if (yHat.lengthSq() === 0) return;
                yHat.normalize();

                const relativeToInertial = new THREE.Matrix4().makeBasis(xHat, yHat, zHat);
                const inertialToRelative = relativeToInertial.clone().transpose();
                const qFrame = new THREE.Quaternion().setFromRotationMatrix(inertialToRelative);

                const date = new Date(timeMs);
                const lp = lunar_pole(date);
                const alpha = lp.alpha;
                const delta = lp.delta;
                const W = lp.W;

                const qInertial = new THREE.Quaternion();
                const qx1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1 * PC.EARTH_AXIS_INCLINATION_RADS);
                const qz2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2 + alpha);
                const qx3 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 - delta);
                const qz4 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), W);
                qInertial.multiply(qx1).multiply(qz2).multiply(qx3).multiply(qz4);

                this.moonContainer.quaternion.copy(qFrame).multiply(qInertial);
                return;
            }

            bodyRotationActions.rotateMoon({
                timeMs,
                globalConfig: runtimeState.globalConfig,
                moonContainer: this.moonContainer,
            });
        }

        rotateEarth(timeMs = getRuntimeState().animTime) {
            const runtimeState = getRuntimeState();
            bodyRotationActions.rotateEarth({
                timeMs,
                earthContainer: this.earthContainer,
            });

            if (runtimeState.frameMode === "relative" && runtimeState.config === "geo" && this.earthContainer) {
                const applyRelativeFrame = (frameQuat) => {
                    if (!frameQuat) return false;
                    const qFrame = new THREE.Quaternion(
                        frameQuat.x,
                        frameQuat.y,
                        frameQuat.z,
                        frameQuat.w,
                    );
                    this.earthContainer.quaternion.premultiply(qFrame);
                    return true;
                };

                if (applyRelativeFrame(getRelativeFrameQuaternion({
                    chebyshevData: runtimeState.chebyshevData,
                    config: runtimeState.config,
                    timeMs,
                }))) {
                    return;
                }

                const moonState = getBodyEphemerisState({
                    bodyId: "MOON",
                    timeMs,
                    config: runtimeState.config,
                    npzData: runtimeState.npzData,
                    npzDataLoaded: runtimeState.npzDataLoaded,
                    chebyshevData: runtimeState.chebyshevData,
                    chebyshevDataLoaded: runtimeState.chebyshevDataLoaded,
                    resolvedSource: resolveBodySource({
                        bodyId: "MOON",
                        bodySources: runtimeState.bodyEphemerisSources,
                        defaultSpacecraftSource: runtimeState.ephemerisSource,
                    }),
                    defaultSpacecraftSource: runtimeState.ephemerisSource,
                });
                if (!moonState.available) return;

                const r = new THREE.Vector3(moonState.position.x, moonState.position.y, moonState.position.z);
                const v = new THREE.Vector3(moonState.velocity.vx, moonState.velocity.vy, moonState.velocity.vz);
                if (r.lengthSq() === 0) return;

                const xHat = r.clone().normalize();
                const zHat = new THREE.Vector3().crossVectors(r, v);
                if (zHat.lengthSq() === 0) return;
                zHat.normalize();
                const yHat = new THREE.Vector3().crossVectors(zHat, xHat);
                if (yHat.lengthSq() === 0) return;
                yHat.normalize();

                const relativeToInertial = new THREE.Matrix4().makeBasis(xHat, yHat, zHat);
                const inertialToRelative = relativeToInertial.clone().transpose();
                const qFrame = new THREE.Quaternion().setFromRotationMatrix(inertialToRelative);
                this.earthContainer.quaternion.premultiply(qFrame);
            }
        }

        dispose() {
            sceneDisposeActions.dispose(this);
        }
    };
}

export { createAnimationSceneClass };
