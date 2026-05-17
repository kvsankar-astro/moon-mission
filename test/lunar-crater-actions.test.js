import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import {
    buildCraterCirclePositions,
    calculateCraterHoverLabelOffset,
    calculateCraterLabelScaleRatio,
    calculateCraterProjectedScreenBounds,
    calculateCraterProjectedRadiusPx,
    countCraterDisplayFeatures,
    createLunarCraterActions,
    formatCraterLabelText,
    getCraterDisplayFeatures,
    resolveCraterHoverTarget,
    resolveCraterHoverTargetFromScreen,
    resolveMoonSurfaceHitNormal,
} from "../src/platform/js/app/lunar-crater-actions.js";
import { getLunarFeatureBoundaryColor } from "../src/platform/js/core/domain/lunar-feature-colors.js";

function withFakeCanvas(callback) {
    const previousDocument = globalThis.document;
    const context = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        closePath: vi.fn(),
        clearRect: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn((text) => ({ width: text.length * 8 })),
        set fillStyle(value) {
            this._fillStyle = value;
        },
        get fillStyle() {
            return this._fillStyle;
        },
        textAlign: "center",
        textBaseline: "middle",
        font: "",
    };
    globalThis.document = {
        createElement: vi.fn(() => ({
            width: 0,
            height: 0,
            getContext: vi.fn(() => context),
        })),
    };
    const restoreDocument = () => {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    };
    try {
        const result = callback(context);
        if (result && typeof result.then === "function") {
            return result.finally(restoreDocument);
        }
        restoreDocument();
        return result;
    } catch (error) {
        restoreDocument();
        throw error;
    }
}

describe("lunar crater actions", () => {
    it("selects craters within the requested diameter range", () => {
        const catalog = {
            display: {
                defaultMinDiameterKm: 80,
                defaultMaxDiameterKm: 600,
                rangeMinDiameterKm: 0,
                rangeMaxDiameterKm: 600,
            },
            features: [
                { name: "Kepler", latitudeDeg: 8.1, longitudeDeg: 321.99, diameterKm: 31.0 },
                { name: "Tycho", latitudeDeg: -43.31, longitudeDeg: 348.82, diameterKm: 85.3 },
                { name: "Clavius", latitudeDeg: -58.62, longitudeDeg: 345.59, diameterKm: 230.8 },
                { name: "", latitudeDeg: 0, longitudeDeg: 0, diameterKm: 100 },
            ],
        };
        const features = getCraterDisplayFeatures({
            ...catalog,
        }, {
            lunarCraterMinDiameterKm: 40,
            lunarCraterMaxDiameterKm: 100,
        });

        expect(features).toEqual([
            { name: "Tycho", latitudeDeg: -43.31, longitudeDeg: 348.82, diameterKm: 85.3 },
        ]);
        expect(countCraterDisplayFeatures(catalog, {
            lunarCraterMinDiameterKm: 40,
            lunarCraterMaxDiameterKm: 100,
        })).toBe(1);
    });

    it("can return the full valid crater set for hover picking", () => {
        const features = getCraterDisplayFeatures({
            display: {
                defaultMinDiameterKm: 0,
                defaultMaxDiameterKm: 600,
                rangeMinDiameterKm: 0,
                rangeMaxDiameterKm: 600,
            },
            features: [
                { name: "Kepler", latitudeDeg: 8.1, longitudeDeg: 321.99, diameterKm: 31.0 },
                { name: "Tycho", latitudeDeg: -43.31, longitudeDeg: 348.82, diameterKm: 85.3 },
                { name: "Clavius", latitudeDeg: -58.62, longitudeDeg: 345.59, diameterKm: 230.8 },
                { name: "", latitudeDeg: 0, longitudeDeg: 0, diameterKm: 100 },
            ],
        }, { includeAll: true });

        expect(features.map((feature) => feature.name)).toEqual(["Clavius", "Tycho", "Kepler"]);
    });

    it("includes adopted satellite-feature crater records when present in the catalog", () => {
        const catalog = {
            display: {
                defaultMinDiameterKm: 0,
                defaultMaxDiameterKm: 600,
                rangeMinDiameterKm: 0,
                rangeMaxDiameterKm: 600,
            },
            features: [
                { name: "Galilaei", featureType: "Crater, craters", latitudeDeg: 10, longitudeDeg: 298, diameterKm: 15.5 },
                { name: "Galilaei A", featureType: "Satellite Feature", latitudeDeg: 11, longitudeDeg: 299, diameterKm: 9.0 },
                { name: "Galilaei B", featureType: "Satellite Feature", latitudeDeg: 12, longitudeDeg: 300, diameterKm: 8.0 },
            ],
        };
        const features = getCraterDisplayFeatures(catalog, {
            lunarCraterMinDiameterKm: 0,
            lunarCraterMaxDiameterKm: 20,
        });

        expect(features.map((feature) => feature.name)).toEqual(
            expect.arrayContaining(["Galilaei", "Galilaei A", "Galilaei B"]),
        );
    });

    it("builds crater circle points on the requested sphere radius", () => {
        const positions = buildCraterCirclePositions({
            THREE,
            normal: new THREE.Vector3(1, 0, 0),
            angularRadius: 0.1,
            radius: 10,
            segments: 12,
        });

        expect(positions).toHaveLength(36);
        for (let index = 0; index < positions.length; index += 3) {
            const radius = Math.hypot(
                positions[index],
                positions[index + 1],
                positions[index + 2],
            );
            expect(radius).toBeCloseTo(10, 6);
        }
    });

    it("renders always-visible feature rings with per-type colors", () => {
        const catalog = {
            display: {
                defaultMinDiameterKm: 0,
                defaultMaxDiameterKm: 600,
                rangeMinDiameterKm: 0,
                rangeMaxDiameterKm: 600,
            },
            features: [
                {
                    name: "Blue crater",
                    featureType: "Crater, craters",
                    latitudeDeg: 0,
                    longitudeDeg: 0,
                    diameterKm: 120,
                },
                {
                    name: "Green mare",
                    featureType: "Mare, maria",
                    latitudeDeg: 5,
                    longitudeDeg: 5,
                    diameterKm: 110,
                },
            ],
        };
        const actions = createLunarCraterActions({
            THREE,
            sphericalToCartesian: (radius, longitudeRad, latitudeRad) => ({
                x: radius * Math.cos(latitudeRad) * Math.cos(longitudeRad),
                y: radius * Math.cos(latitudeRad) * Math.sin(longitudeRad),
                z: radius * Math.sin(latitudeRad),
            }),
            degreesToRadians: (degrees) => degrees * Math.PI / 180,
            PC: { MOON_RADIUS_KM: 1737.4 },
            getMoonRadius: () => 10,
            getGlobalConfig: () => ({ is_lunar: true }),
            getViewLunarCraters: () => true,
            getLunarCraterMinDiameterKm: () => 0,
            getLunarCraterMaxDiameterKm: () => 600,
            getLunarCraterDisplayMode: () => "always",
            getLunarFeatureTypeFilters: () => ({}),
            craterCatalog: catalog,
        });
        const scene = {
            moonContainer: new THREE.Group(),
        };

        actions.addLunarCraterAnnotations({ scene });

        const rings = scene.lunarCraterAnnotations.filter((object) => object.userData?.craterRing);
        const colorByName = new Map(rings.map((ring) => [
            ring.userData.name,
            `#${ring.material.color.getHexString()}`,
        ]));
        expect(colorByName.get("Blue crater")).toBe(
            getLunarFeatureBoundaryColor("Crater, craters"),
        );
        expect(colorByName.get("Green mare")).toBe(
            getLunarFeatureBoundaryColor("Mare, maria"),
        );
        expect(rings.every((ring) => ring.material.toneMapped === false)).toBe(true);
    });

    it("loads lunar feature data on demand before adding annotations", async () => withFakeCanvas(async () => {
        const catalog = {
            display: {
                defaultMinDiameterKm: 0,
                defaultMaxDiameterKm: 600,
                rangeMinDiameterKm: 0,
                rangeMaxDiameterKm: 600,
            },
            features: [
                {
                    name: "Lazy crater",
                    featureType: "Crater, craters",
                    latitudeDeg: 0,
                    longitudeDeg: 0,
                    diameterKm: 120,
                },
            ],
        };
        const render = vi.fn();
        const actions = createLunarCraterActions({
            THREE,
            sphericalToCartesian: (radius, longitudeRad, latitudeRad) => ({
                x: radius * Math.cos(latitudeRad) * Math.cos(longitudeRad),
                y: radius * Math.cos(latitudeRad) * Math.sin(longitudeRad),
                z: radius * Math.sin(latitudeRad),
            }),
            degreesToRadians: (degrees) => degrees * Math.PI / 180,
            PC: { MOON_RADIUS_KM: 1737.4 },
            getMoonRadius: () => 10,
            getGlobalConfig: () => ({ is_lunar: true }),
            getViewLunarCraters: () => true,
            getLunarCraterMinDiameterKm: () => 0,
            getLunarCraterMaxDiameterKm: () => 600,
            getLunarCraterDisplayMode: () => "always",
            getLunarFeatureTypeFilters: () => ({}),
            loadCraterCatalog: vi.fn(() => Promise.resolve(catalog)),
            render,
        });
        const scene = {
            moonContainer: new THREE.Group(),
        };

        actions.addLunarCraterAnnotations({ scene });

        expect(scene.lunarCraterCatalogLoading).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(scene.lunarCraterCatalogLoading).toBe(false);
        expect(scene.lunarCraterAnnotations.some((object) =>
            object.userData?.name === "Lazy crater",
        )).toBe(true);
        expect(render).toHaveBeenCalled();
    }));

    it("keeps Show Always labels sparse instead of labeling every rendered feature", () => {
        const catalog = {
            display: {
                defaultMinDiameterKm: 0,
                defaultMaxDiameterKm: 600,
                rangeMinDiameterKm: 0,
                rangeMaxDiameterKm: 600,
            },
            features: Array.from({ length: 56 }, (_, index) => ({
                name: `Visible crater ${index}`,
                featureType: "Crater, craters",
                latitudeDeg: -10 + (index % 8) * 2.5,
                longitudeDeg: -12 + Math.floor(index / 8) * 4,
                diameterKm: 120 + index,
            })),
        };
        const actions = createLunarCraterActions({
            THREE,
            sphericalToCartesian: (radius, longitudeRad, latitudeRad) => ({
                x: radius * Math.cos(latitudeRad) * Math.cos(longitudeRad),
                y: radius * Math.cos(latitudeRad) * Math.sin(longitudeRad),
                z: radius * Math.sin(latitudeRad),
            }),
            degreesToRadians: (degrees) => degrees * Math.PI / 180,
            PC: { MOON_RADIUS_KM: 1737.4 },
            getMoonRadius: () => 10,
            getGlobalConfig: () => ({ is_lunar: true }),
            getViewLunarCraters: () => true,
            getLunarCraterMinDiameterKm: () => 0,
            getLunarCraterMaxDiameterKm: () => 600,
            getLunarCraterDisplayMode: () => "always",
            getLunarFeatureTypeFilters: () => ({}),
            craterCatalog: catalog,
        });
        const scene = {
            moonContainer: new THREE.Group(),
        };
        const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 1000);
        camera.position.set(100, 0, 0);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();

        actions.addLunarCraterAnnotations({
            scene,
            camera,
            rendererDomElement: { clientWidth: 1000, clientHeight: 1000 },
        });

        const renderedRings = scene.lunarCraterAnnotations.filter((object) => object.userData?.craterRing);
        const renderedLabels = scene.lunarCraterAnnotations.filter((object) =>
            object.userData?.lunarCrater && !object.userData?.craterRing,
        );
        expect(renderedRings.length).toBeGreaterThan(28);
        expect(renderedLabels.length).toBeLessThanOrEqual(28);
        expect(renderedLabels.length).toBeLessThan(renderedRings.length);
    });

    it("preserves hover labels when rebuilding Show Always annotations", () => {
        const catalog = {
            display: {
                defaultMinDiameterKm: 0,
                defaultMaxDiameterKm: 600,
                rangeMinDiameterKm: 0,
                rangeMaxDiameterKm: 600,
            },
            features: [
                {
                    name: "Hoverable crater",
                    featureType: "Crater, craters",
                    latitudeDeg: 0,
                    longitudeDeg: 0,
                    diameterKm: 120,
                },
            ],
        };
        const actions = createLunarCraterActions({
            THREE,
            sphericalToCartesian: (radius, longitudeRad, latitudeRad) => ({
                x: radius * Math.cos(latitudeRad) * Math.cos(longitudeRad),
                y: radius * Math.cos(latitudeRad) * Math.sin(longitudeRad),
                z: radius * Math.sin(latitudeRad),
            }),
            degreesToRadians: (degrees) => degrees * Math.PI / 180,
            PC: { MOON_RADIUS_KM: 1737.4 },
            getMoonRadius: () => 10,
            getGlobalConfig: () => ({ is_lunar: true }),
            getViewLunarCraters: () => true,
            getLunarCraterMinDiameterKm: () => 0,
            getLunarCraterMaxDiameterKm: () => 600,
            getLunarCraterDisplayMode: () => "always",
            getLunarFeatureTypeFilters: () => ({}),
            craterCatalog: catalog,
        });
        const scene = {
            moonContainer: new THREE.Group(),
            lunarCraterDisplayMode: "always",
            lunarCraterHoverLabelsEnabled: true,
        };

        actions.addLunarCraterAnnotations({ scene });

        expect(scene.lunarCraterDisplayMode).toBe("always");
        expect(scene.lunarCraterHoverLabelsEnabled).toBe(true);
        expect(scene.lunarCraterPickTargets.length).toBeGreaterThan(0);
    });

    it("does not add feature-type suffixes to label text", () => {
        expect(formatCraterLabelText({
            name: "Rima test",
            featureType: "Rima, rimae",
            diameterKm: 120,
        })).toBe("Rima test  120 km");
    });

    it("does not show a hover label when the target already has an always-visible label", () => {
        const catalog = {
            display: {
                defaultMinDiameterKm: 0,
                defaultMaxDiameterKm: 600,
                rangeMinDiameterKm: 0,
                rangeMaxDiameterKm: 600,
            },
            features: [{
                name: "Always labeled",
                featureType: "Crater, craters",
                latitudeDeg: 0,
                longitudeDeg: 0,
                diameterKm: 300,
            }],
        };
        const actions = createLunarCraterActions({
            THREE,
            sphericalToCartesian: (radius, longitudeRad, latitudeRad) => ({
                x: radius * Math.cos(latitudeRad) * Math.cos(longitudeRad),
                y: radius * Math.cos(latitudeRad) * Math.sin(longitudeRad),
                z: radius * Math.sin(latitudeRad),
            }),
            degreesToRadians: (degrees) => degrees * Math.PI / 180,
            PC: { MOON_RADIUS_KM: 1737.4 },
            getMoonRadius: () => 10,
            getGlobalConfig: () => ({ is_lunar: true }),
            getViewLunarCraters: () => true,
            getLunarCraterMinDiameterKm: () => 0,
            getLunarCraterMaxDiameterKm: () => 600,
            getLunarCraterDisplayMode: () => "always",
            getLunarFeatureTypeFilters: () => ({}),
            craterCatalog: catalog,
        });
        const scene = {
            moonContainer: new THREE.Group(),
            moon: new THREE.Mesh(
                new THREE.SphereGeometry(10, 16, 8),
                new THREE.MeshBasicMaterial(),
            ),
            lunarCraterHoverLabelsEnabled: true,
        };
        scene.moonContainer.add(scene.moon);
        const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 1000);
        camera.position.set(100, 0, 0);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        const rendererDomElement = {
            clientWidth: 1000,
            clientHeight: 1000,
            getBoundingClientRect: () => ({
                left: 0,
                top: 0,
                width: 1000,
                height: 1000,
            }),
        };

        withFakeCanvas(() => {
            actions.addLunarCraterAnnotations({
                scene,
                camera,
                rendererDomElement,
            });

            const renderedLabels = scene.lunarCraterAnnotations.filter((object) =>
                object.userData?.lunarCrater &&
                !object.userData?.craterRing &&
                object.userData?.hoverLabel === false,
            );
            expect(renderedLabels).toHaveLength(1);
            expect(renderedLabels[0].material.toneMapped).toBe(false);
            expect(scene.lunarCraterPickTargets[0]?.showLabel).toBe(true);

            actions.updateLunarCraterHoverFromPointer({
                scene,
                camera,
                rendererDomElement,
                clientX: 500,
                clientY: 500,
            });
        });

        expect(scene.lunarCraterHoveredName).toBe("Always labeled");
        expect(scene.lunarCraterHoverRing?.visible).not.toBe(true);
        expect(scene.lunarCraterHoveredRing?.userData.hoverAnnotation).toBe(true);
        expect(scene.lunarCraterHoveredLabel?.userData.hoverScaleBoost).toBe(true);
        expect(scene.lunarCraterHoverLabel?.visible).not.toBe(true);
    });

    it("pins searched lunar features as selected annotations without requiring hover", () => {
        const catalog = {
            display: {
                defaultMinDiameterKm: 0,
                defaultMaxDiameterKm: 600,
                rangeMinDiameterKm: 0,
                rangeMaxDiameterKm: 600,
            },
            features: [{
                name: "Mare Orientale",
                featureType: "Mare, maria",
                latitudeDeg: -19.4,
                longitudeDeg: 267.0,
                diameterKm: 294,
            }],
        };
        const actions = createLunarCraterActions({
            THREE,
            sphericalToCartesian: (radius, longitudeRad, latitudeRad) => ({
                x: radius * Math.cos(latitudeRad) * Math.cos(longitudeRad),
                y: radius * Math.cos(latitudeRad) * Math.sin(longitudeRad),
                z: radius * Math.sin(latitudeRad),
            }),
            degreesToRadians: (degrees) => degrees * Math.PI / 180,
            PC: { MOON_RADIUS_KM: 1737.4 },
            getMoonRadius: () => 10,
            getGlobalConfig: () => ({ is_lunar: true }),
            getViewLunarCraters: () => false,
            getLunarCraterMinDiameterKm: () => 0,
            getLunarCraterMaxDiameterKm: () => 600,
            getLunarCraterDisplayMode: () => "hover",
            getLunarFeatureTypeFilters: () => ({}),
            getLunarFeatureSearchQuery: () => "orientale",
            craterCatalog: catalog,
        });
        const scene = {
            moonContainer: new THREE.Group(),
            moon: new THREE.Mesh(
                new THREE.SphereGeometry(10, 16, 8),
                new THREE.MeshBasicMaterial(),
            ),
            lunarCraterHoverLabelsEnabled: true,
        };
        scene.moonContainer.add(scene.moon);
        const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 1000);
        const orientaleNormal = new THREE.Vector3(
            Math.cos(-19.4 * Math.PI / 180) * Math.cos(267.0 * Math.PI / 180),
            Math.cos(-19.4 * Math.PI / 180) * Math.sin(267.0 * Math.PI / 180),
            Math.sin(-19.4 * Math.PI / 180),
        ).normalize();
        camera.position.copy(orientaleNormal).multiplyScalar(100);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        const rendererDomElement = {
            clientWidth: 1000,
            clientHeight: 1000,
            getBoundingClientRect: () => ({
                left: 0,
                top: 0,
                width: 1000,
                height: 1000,
            }),
        };

        withFakeCanvas((context) => {
            actions.addLunarCraterAnnotations({
                scene,
                camera,
                rendererDomElement,
            });

            expect(scene.lunarCraterGroup.visible).toBe(true);
            const searchRing = scene.lunarCraterAnnotations.find((object) =>
                object.name.startsWith("lunar-feature-search-ring:"),
            );
            const searchLabel = scene.lunarCraterAnnotations.find((object) =>
                object.name.startsWith("lunar-feature-search-label:"),
            );
            const searchLeader = scene.lunarCraterAnnotations.find((object) =>
                object.userData?.searchLeader === true,
            );
            expect(searchRing).toBeTruthy();
            expect(searchRing.userData.searchAnnotation).toBe(true);
            expect(searchLabel).toBeTruthy();
            expect(searchLabel.userData.searchAnnotation).toBe(true);
            expect(searchLabel.userData.hoverLabel).toBe(false);
            expect(searchLabel.material.depthTest).toBe(false);
            expect(searchLabel.material.toneMapped).toBe(false);
            expect(searchLeader).toBeTruthy();
            expect(context.fillText).toHaveBeenCalledWith("Mare Orientale", expect.any(Number), expect.any(Number));
            expect(context.fillText).toHaveBeenCalledWith("294 km", expect.any(Number), expect.any(Number));

            actions.updateLunarCraterHoverFromPointer({
                scene,
                camera,
                rendererDomElement,
                clientX: 500,
                clientY: 500,
            });
        });

        expect(scene.lunarCraterPickTargets[0]?.showLabel).toBe(true);
        expect(scene.lunarCraterHoveredName).toBe("Mare Orientale");
        expect(scene.lunarCraterHoverRing?.visible).not.toBe(true);
        expect(scene.lunarCraterHoveredRing?.userData.hoverAnnotation).toBe(true);
        expect(scene.lunarCraterHoveredLabel?.userData.hoverScaleBoost).toBe(true);
        expect(scene.lunarCraterHoverLabel?.visible).not.toBe(true);
    });

    it("caps crater label scale when the camera is too close", () => {
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
        const labelWorldPosition = new THREE.Vector3(0, 0, 0);
        camera.position.set(0, 0, 10);
        camera.updateMatrixWorld();

        const closeRatio = calculateCraterLabelScaleRatio({
            camera,
            rendererDomElement: { clientHeight: 1000 },
            labelWorldHeight: 2,
            labelWorldPosition,
            maxScreenHeightPx: 20,
        });

        camera.position.set(0, 0, 1000);
        camera.updateMatrixWorld();
        const farRatio = calculateCraterLabelScaleRatio({
            camera,
            rendererDomElement: { clientHeight: 1000 },
            labelWorldHeight: 2,
            labelWorldPosition,
            maxScreenHeightPx: 20,
        });

        expect(closeRatio).toBeGreaterThan(0);
        expect(closeRatio).toBeLessThan(1);
        expect(farRatio).toBe(1);
    });

    it("projects crater radius from the rim instead of the moon center plane near the surface", () => {
        const moonRadius = 10;
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
        camera.position.set(0, 0, moonRadius * 1.04);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();

        const moonContainer = new THREE.Group();
        moonContainer.updateMatrixWorld(true);
        const scene = { moonContainer };
        const angularRadius = (10 * 0.5) / 1737.4;
        const projectedRadius = calculateCraterProjectedRadiusPx({
            THREE,
            scene,
            camera,
            rendererDomElement: { clientWidth: 800, clientHeight: 800 },
            normal: new THREE.Vector3(0, 0, 1),
            angularRadius,
            moonRadius,
        });

        const centerPlaneEstimate = angularRadius *
            ((800 * 0.5 * moonRadius) / (camera.position.length() * Math.tan((60 * Math.PI / 180) * 0.5)));
        expect(projectedRadius).toBeGreaterThan(centerPlaneEstimate * 10);
        expect(projectedRadius).toBeGreaterThan(4);
    });

    it("measures apparent crater bounds from projected rim points", () => {
        const moonRadius = 10;
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
        camera.position.set(0, 0, moonRadius * 4);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();

        const moonContainer = new THREE.Group();
        moonContainer.updateMatrixWorld(true);
        const bounds = calculateCraterProjectedScreenBounds({
            THREE,
            scene: { moonContainer },
            camera,
            rendererDomElement: { clientWidth: 800, clientHeight: 800 },
            normal: new THREE.Vector3(0, 0, 1),
            angularRadius: 0.06,
            moonRadius,
        });

        expect(bounds.centerX).toBeCloseTo(400, 4);
        expect(bounds.centerY).toBeCloseTo(400, 4);
        expect(bounds.top).toBeLessThan(bounds.centerY);
        expect(bounds.bottom).toBeGreaterThan(bounds.centerY);
        expect(bounds.radiusPx).toBeGreaterThan(0);
    });

    it("keeps hover labels close while clearing the crater edge", () => {
        const angularRadius = 0.017;
        const offset = calculateCraterHoverLabelOffset({
            angularRadius,
            projectedCraterRadiusPx: 34,
        });
        const largerCraterOffset = calculateCraterHoverLabelOffset({
            angularRadius: 0.04,
            projectedCraterRadiusPx: 80,
        });
        const fallbackOffset = calculateCraterHoverLabelOffset({ angularRadius });

        expect(offset).toBeGreaterThan(angularRadius);
        expect(offset).toBeCloseTo(angularRadius + angularRadius * (22 / 34));
        expect(largerCraterOffset).toBeGreaterThan(offset);
        expect(fallbackOffset).toBeGreaterThan(angularRadius);
    });

    it("picks the crater nearest the pointer surface point instead of the smallest containing crater", () => {
        const surfaceNormal = new THREE.Vector3(1, 0, 0);
        const largeCrater = {
            crater: { name: "Large" },
            centerNormal: new THREE.Vector3(1, 0, 0),
            angularRadius: 0.2,
        };
        const smallOffsetCrater = {
            crater: { name: "Small offset" },
            centerNormal: new THREE.Vector3(Math.cos(0.08), Math.sin(0.08), 0).normalize(),
            angularRadius: 0.09,
        };

        expect(resolveCraterHoverTarget(surfaceNormal, [largeCrater, smallOffsetCrater])).toBe(largeCrater);
    });

    it("picks a smaller nested crater when the pointer is on that crater", () => {
        const smallCenter = new THREE.Vector3(Math.cos(0.08), Math.sin(0.08), 0).normalize();
        const largeCrater = {
            crater: { name: "Large" },
            centerNormal: new THREE.Vector3(1, 0, 0),
            angularRadius: 0.2,
        };
        const smallCrater = {
            crater: { name: "Small" },
            centerNormal: smallCenter,
            angularRadius: 0.09,
        };

        expect(resolveCraterHoverTarget(smallCenter, [largeCrater, smallCrater])).toBe(smallCrater);
    });

    it("picks visible craters by screen position with a far camera and tiny field of view", () => {
        const moonContainer = new THREE.Group();
        const camera = new THREE.PerspectiveCamera(0.5, 1, 0.1, 1000);
        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        moonContainer.updateMatrixWorld(true);
        const rendererDomElement = { clientWidth: 1000, clientHeight: 1000 };
        const centerCrater = {
            crater: { name: "Center" },
            centerNormal: new THREE.Vector3(0, 0, 1),
            angularRadius: 0.01,
        };
        const offsetCrater = {
            crater: { name: "Offset" },
            centerNormal: new THREE.Vector3(0.05, 0, 0.99875).normalize(),
            angularRadius: 0.01,
        };

        const target = resolveCraterHoverTargetFromScreen({
            THREE,
            scene: { moonContainer },
            camera,
            rendererDomElement,
            pointerX: 500,
            pointerY: 500,
            pickTargets: [offsetCrater, centerCrater],
            moonRadius: 1,
            cameraMoonLocalNormal: new THREE.Vector3(0, 0, 1),
        });

        expect(target).toBe(centerCrater);
    });

    it("chooses the real lunar surface hit when raycasting also returns outer moon children", () => {
        const moonContainer = new THREE.Group();
        moonContainer.updateMatrixWorld(true);
        const normal = resolveMoonSurfaceHitNormal({
            scene: { moonContainer },
            moonRadius: 2,
            intersections: [
                { point: new THREE.Vector3(64, 0.1, 0) },
                { point: new THREE.Vector3(1.9, 0.2, 0) },
                { point: new THREE.Vector3(-60, 0, 0) },
            ],
        });

        expect(normal.x).toBeGreaterThan(0.99);
        expect(normal.y).toBeGreaterThan(0.09);
    });
});
