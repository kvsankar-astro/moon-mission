import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
    buildCraterCirclePositions,
    calculateCraterHoverLabelOffset,
    calculateCraterLabelScaleRatio,
    getCraterDisplayFeatures,
    resolveCraterHoverTarget,
    resolveCraterHoverTargetFromScreen,
} from "../src/platform/js/app/lunar-crater-actions.js";

describe("lunar crater actions", () => {
    it("selects the most prominent craters by display limit", () => {
        const features = getCraterDisplayFeatures({
            display: { defaultLimit: 1, minLimit: 1, maxLimit: 3 },
            features: [
                { name: "Kepler", latitudeDeg: 8.1, longitudeDeg: 321.99, diameterKm: 31.0 },
                { name: "Tycho", latitudeDeg: -43.31, longitudeDeg: 348.82, diameterKm: 85.3 },
                { name: "", latitudeDeg: 0, longitudeDeg: 0, diameterKm: 100 },
            ],
        });

        expect(features).toEqual([
            { name: "Tycho", latitudeDeg: -43.31, longitudeDeg: 348.82, diameterKm: 85.3 },
        ]);
    });

    it("can return the full valid crater set for hover picking", () => {
        const features = getCraterDisplayFeatures({
            display: { defaultLimit: 1, minLimit: 1, maxLimit: 1 },
            features: [
                { name: "Kepler", latitudeDeg: 8.1, longitudeDeg: 321.99, diameterKm: 31.0 },
                { name: "Tycho", latitudeDeg: -43.31, longitudeDeg: 348.82, diameterKm: 85.3 },
                { name: "Clavius", latitudeDeg: -58.62, longitudeDeg: 345.59, diameterKm: 230.8 },
                { name: "", latitudeDeg: 0, longitudeDeg: 0, diameterKm: 100 },
            ],
        }, { includeAll: true });

        expect(features.map((feature) => feature.name)).toEqual(["Clavius", "Tycho", "Kepler"]);
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
});
