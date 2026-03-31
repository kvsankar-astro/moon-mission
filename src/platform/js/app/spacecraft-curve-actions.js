import {
    applySceneOrbitVisibility,
    getSceneMissionCraftIds,
    getScenePrimaryCraftId,
} from "./scene-craft-helpers.js";
import {
    mixColors,
    normalizeHexColor,
    ORBIT_TRAIL_STYLE,
    resolveTailVisualStyle,
} from "./orbit-trail-style.js";
import { invalidateSceneOrbitOverlap } from "./orbit-overlap-manager.js";

export function createSpacecraftCurveActions({
    THREE,
    getGlobalConfig,
    planetProperties,
    getViewOrbitDescent,
    getViewOrbit,
    getOrbitStyle = () => "classic",
    getTrailTrackBrightness3D = () => 1,
    getTrailTailBrightness3D = () => 1,
    render,
    wait10,
    createLineMaterial,
}) {
    function applyCraftOrbitVisibility(scene, globalConfig) {
        applySceneOrbitVisibility(
            scene,
            globalConfig,
            getViewOrbit(),
            getOrbitStyle(),
            getTrailTrackBrightness3D(),
            getTrailTailBrightness3D(),
        );
    }

    function isValidVector3(point) {
        return !!point &&
            Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            Number.isFinite(point.z);
    }

    function createLineGeometryFromPoints(points) {
        const vertices = new Float32Array(points.length * 3);
        let offset = 0;
        for (const point of points) {
            vertices[offset++] = point.x;
            vertices[offset++] = point.y;
            vertices[offset++] = point.z;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(vertices, 3),
        );
        return geometry;
    }

    function createDynamicLineGeometry(maxPoints) {
        const capacity = Math.max(2, maxPoints);
        const geometry = new THREE.BufferGeometry();
        const attribute = new THREE.Float32BufferAttribute(
            new Float32Array(capacity * 3),
            3,
        );
        attribute.setUsage?.(THREE.DynamicDrawUsage);
        geometry.setAttribute("position", attribute);
        geometry.setDrawRange(0, 0);
        return geometry;
    }

    function createOrbitTrailBundle({ bodyId, curve, baseColor }) {
        const normalizedBaseColor = normalizeHexColor(baseColor);
        const tailStyle = resolveTailVisualStyle({
            dimension: "3D",
            prominence: getTrailTailBrightness3D(),
        });
        const tailGeometry = createDynamicLineGeometry(curve.length);
        const headGeometry = createDynamicLineGeometry(curve.length);
        const tailLine = new THREE.Line(
            tailGeometry,
            createLineMaterial(normalizedBaseColor, {
                transparent: true,
                opacity: tailStyle.tailOpacity,
                depthWrite: false,
            }),
        );
        const headLine = new THREE.Line(
            headGeometry,
            createLineMaterial(mixColors(normalizedBaseColor, "#ffffff", 0.42), {
                transparent: true,
                opacity: tailStyle.headOpacity,
                depthWrite: false,
            }),
        );

        tailLine.userData = { ...(tailLine.userData || {}), bodyId };
        headLine.userData = { ...(headLine.userData || {}), bodyId };
        tailLine.renderOrder = 12;
        headLine.renderOrder = 13;
        tailLine.visible = false;
        headLine.visible = false;

        return {
            tailLine,
            headLine,
        };
    }

    async function addCurve(scene, { bodyId, curve, orbitMaterial, globalConfig }) {
        const validCurve = curve.filter(isValidVector3);
        let startingIndex = validCurve.length;
        let leftOrbitPoints = startingIndex;
        const orbitLines = [];
        scene.orbitLinesByBodyId[bodyId] = orbitLines;

        do {
            const points = Math.min(leftOrbitPoints, scene.pointsPerSlice);
            if (points <= 0) {
                break;
            }

            startingIndex -= points;
            leftOrbitPoints -= points;

            const arr = validCurve.slice(startingIndex, startingIndex + points + 1);
            if (arr.length < 2) {
                continue;
            }

            const orbitGeometry = createLineGeometryFromPoints(arr);
            const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
            orbitLine.userData = {
                ...(orbitLine.userData || {}),
                bodyId,
            };
            orbitLine.visible = false;
            orbitLines.push(orbitLine);
            scene.orbitLines.push(orbitLine);
            scene.motherContainer.add(orbitLine);
            applyCraftOrbitVisibility(scene, globalConfig);
            render();
            await wait10();
            if (scene.stopCreationFlag) {
                break;
            }
        } while (true);
    }

    function addSpacecraftCurve(scene) {
        invalidateSceneOrbitOverlap(scene);
        scene.orbitLines = [];
        scene.orbitLinesByBodyId = {};
        scene.orbitMaterialsByBodyId = {};
        scene.orbitTrailLinesByBodyId = {};
        scene.pointsPerSlice = 400;
        scene.startingIndex = 0;
        scene.leftOrbitPoints = 0;

        const globalConfig = getGlobalConfig();
        const craftIds = getSceneMissionCraftIds(scene, globalConfig);
        const primaryCraftId = getScenePrimaryCraftId(scene, globalConfig);
        scene.primaryCraftId = primaryCraftId;

        const addAllCurves = async () => {
            for (const craftId of craftIds) {
                const curve = scene.curvesById?.[craftId] || [];
                if (curve.filter(isValidVector3).length < 2) {
                    scene.orbitLinesByBodyId[craftId] = [];
                    continue;
                }
                const craftOrbitColor = (planetProperties[craftId] || planetProperties.SC)?.orbitcolor;
                const orbitMaterial = createLineMaterial(craftOrbitColor, {
                    transparent: true,
                    opacity: ORBIT_TRAIL_STYLE.backgroundOpacity3D,
                    depthWrite: false,
                });
                scene.orbitMaterialsByBodyId[craftId] = orbitMaterial;
                await addCurve(scene, {
                    bodyId: craftId,
                    curve,
                    orbitMaterial,
                    globalConfig,
                });
                if (scene.stopCreationFlag) {
                    break;
                }
                const trailBundle = createOrbitTrailBundle({
                    bodyId: craftId,
                    curve,
                    baseColor: craftOrbitColor,
                });
                scene.orbitTrailLinesByBodyId[craftId] = trailBundle;
                scene.motherContainer.add(trailBundle.tailLine);
                scene.motherContainer.add(trailBundle.headLine);
                applyCraftOrbitVisibility(scene, globalConfig);
                if (scene.stopCreationFlag) {
                    break;
                }
            }
            applyCraftOrbitVisibility(scene, globalConfig);
            scene.state = scene.constructor.SCENE_STATE_ADD_CURVE_DONE;
        };

        addAllCurves();

        if (
            scene.name == "lunar" &&
            globalConfig &&
            globalConfig.landing &&
            globalConfig.landing.enabled &&
            scene.landingCurve.length > 0
        ) {
            const validLandingCurve = scene.landingCurve.filter(isValidVector3);
            if (validLandingCurve.length < 2) {
                return;
            }

            const landingOrbitGeometry = createLineGeometryFromPoints(validLandingCurve);
            const landingOrbitColor = "#FFFFE0"; // Light yellow for landing orbit
            const landingOrbitMaterial = createLineMaterial(landingOrbitColor);
            scene.landingOrbitLine = new THREE.Line(
                landingOrbitGeometry,
                landingOrbitMaterial,
            );
            scene.landingOrbitLine.visible = getViewOrbitDescent();
            scene.motherContainer.add(scene.landingOrbitLine);
            render();
        }
    }

    function disposeSpacecraftCurve(scene) {
        invalidateSceneOrbitOverlap(scene);
        if (scene.orbitLines) {
            scene.orbitLines.forEach((line) => {
                if (line.geometry) {
                    line.geometry.dispose();
                }
                if (line.material) {
                    line.material.dispose();
                }
                scene.motherContainer.remove(line);
            });
            scene.orbitLines = [];
        }

        for (const material of Object.values(scene.orbitMaterialsByBodyId || {})) {
            material?.dispose?.();
        }
        scene.orbitMaterialsByBodyId = {};
        scene.orbitLinesByBodyId = {};

        for (const bundle of Object.values(scene.orbitTrailLinesByBodyId || {})) {
            for (const line of [bundle?.tailLine, bundle?.headLine]) {
                if (!line) continue;
                line.geometry?.dispose?.();
                line.material?.dispose?.();
                scene.motherContainer.remove(line);
            }
        }
        scene.orbitTrailLinesByBodyId = {};

        if (scene.landingOrbitLine) {
            if (scene.landingOrbitLine.geometry) {
                scene.landingOrbitLine.geometry.dispose();
            }
            if (scene.landingOrbitLine.material) {
                scene.landingOrbitLine.material.dispose();
            }
            scene.motherContainer.remove(scene.landingOrbitLine);
            scene.landingOrbitLine = null;
        }

        scene.curvesById = {};
        scene.curveVelocitiesById = {};
        scene.curveTimesById = {};
        scene.landingCurve = [];

        scene.pointsPerSlice = 0;
        scene.startingIndex = 0;
        scene.leftOrbitPoints = 0;
    }

    return { addSpacecraftCurve, disposeSpacecraftCurve };
}
