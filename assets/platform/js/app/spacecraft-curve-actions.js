export function createSpacecraftCurveActions({
    THREE,
    getGlobalConfig,
    getConfig,
    getCraftId,
    planetProperties,
    getOrbitPointsCount,
    getLandingPointsCount,
    getViewOrbitDescent,
    getViewOrbit,
    render,
    wait10,
    createLineMaterial,
}) {
    async function addCurve(scene) {
        scene.startingIndex = scene.leftOrbitPoints;

        do {
            const points = Math.min(scene.leftOrbitPoints, scene.pointsPerSlice);
            if (points <= 0) {
                break;
            }

            scene.startingIndex -= points;
            scene.leftOrbitPoints -= points;

            const arr = scene.curve.slice(scene.startingIndex, scene.startingIndex + points + 1);
            const curves = new THREE.CatmullRomCurve3(arr);

            const orbitGeometry = new THREE.BufferGeometry();
            const vertexVectors = curves.getSpacedPoints(points * 40);
            const vertices = [];
            vertexVectors.forEach(function (elem) {
                vertices.push(elem.x, elem.y, elem.z);
            });
            orbitGeometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(vertices, 3),
            );
            const orbitLine = new THREE.Line(orbitGeometry, scene.orbitMaterial);
            orbitLine.visible = getViewOrbit();
            scene.orbitLines.push(orbitLine);
            scene.motherContainer.add(orbitLine);
            render();
            await wait10();
            if (scene.stopCreationFlag) {
                break;
            }
        } while (true);

        scene.state = scene.constructor.SCENE_STATE_ADD_CURVE_DONE;
    }

    function addSpacecraftCurve(scene) {
        scene.orbitLines = [];
        scene.pointsPerSlice = 100;
        scene.startingIndex = 0;
        scene.leftOrbitPoints = getOrbitPointsCount();

        const craftOrbitColor = planetProperties[getCraftId()]["orbitcolor"];
        scene.orbitMaterial = createLineMaterial(craftOrbitColor);

        addCurve(scene);

        const config = getConfig();
        const globalConfig = getGlobalConfig();
        if (
            config == "lunar" &&
            globalConfig &&
            globalConfig.landing &&
            globalConfig.landing.enabled &&
            scene.landingCurve.length > 0
        ) {
            const landingCurves = new THREE.CatmullRomCurve3(scene.landingCurve);
            const landingOrbitGeometry = new THREE.BufferGeometry();
            const vertexVectors = landingCurves.getSpacedPoints(getLandingPointsCount() * 40);
            const vertices = [];
            vertexVectors.forEach(function (elem) {
                vertices.push(elem.x, elem.y, elem.z);
            });
            landingOrbitGeometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(vertices, 3),
            );
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

        if (scene.orbitMaterial) {
            scene.orbitMaterial.dispose();
            scene.orbitMaterial = null;
        }

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

        scene.chandrayaanCurve = [];
        scene.landingCurve = [];

        scene.pointsPerSlice = 0;
        scene.startingIndex = 0;
        scene.leftOrbitPoints = 0;
    }

    return { addSpacecraftCurve, disposeSpacecraftCurve };
}
