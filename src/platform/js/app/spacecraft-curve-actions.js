import {
    applySceneOrbitVisibility,
    getSceneMissionCraftIds,
    getScenePrimaryCraftId,
} from "./scene-craft-helpers.js";

export function createSpacecraftCurveActions({
    THREE,
    getGlobalConfig,
    planetProperties,
    getViewOrbitDescent,
    getViewOrbit,
    render,
    wait10,
    createLineMaterial,
}) {
    function applyCraftOrbitVisibility(scene, globalConfig) {
        applySceneOrbitVisibility(scene, globalConfig, getViewOrbit());
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
        scene.orbitLines = [];
        scene.orbitLinesByBodyId = {};
        scene.orbitMaterialsByBodyId = {};
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
                const orbitMaterial = createLineMaterial(craftOrbitColor);
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
        scene.landingCurve = [];

        scene.pointsPerSlice = 0;
        scene.startingIndex = 0;
        scene.leftOrbitPoints = 0;
    }

    return { addSpacecraftCurve, disposeSpacecraftCurve };
}
