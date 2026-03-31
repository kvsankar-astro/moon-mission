/**
 * Scene Helpers - Axes, reference planes, and sphere of influence visualization
 *
 * Manages visual helper objects that aid in understanding the 3D scene:
 * - XYZ axes helper
 * - Ecliptic plane (grid + plane helper)
 * - Equatorial plane (grid + plane helper, tilted by Earth's axial inclination)
 * - Moon's Sphere of Influence (SOI) wireframe
 */

import * as THREE from 'three';
import { COLORS as COL, PHYSICS_CONSTANTS as PC } from '../core/constants.js';

export class SceneHelpers {
    /**
     * @param {THREE.Object3D} parentContainer - Container to add helpers to
     */
    constructor(parentContainer) {
        this.parentContainer = parentContainer;

        // Axes
        this.axesHelper = null;

        // Ecliptic plane
        this.eclipticPolarGridHelper = null;
        this.eclipticPlaneHelper = null;

        // Equatorial plane
        this.equatorialPlaneContainer = null;
        this.equatorialPolarGridHelper = null;
        this.equatorialPlaneHelper = null;

        // Moon SOI
        this.moonSOISphere = null;
        this.moonContainer = null;  // Reference to moon container for SOI attachment
    }

    /**
     * Create XYZ axes helper
     * @param {number} size - Length of axes
     * @param {boolean} visible - Initial visibility
     */
    createAxesHelper(size, visible = false) {
        this.axesHelper = new THREE.AxesHelper(size);
        this.axesHelper.visible = visible;
        this.parentContainer.add(this.axesHelper);
    }

    /**
     * Create ecliptic plane visualization (grid + plane helper)
     * @param {number} gridRadius - Radius of the polar grid
     * @param {number} planeSize - Size of the plane helper
     * @param {boolean} visible - Initial visibility
     */
    createEclipticPlane(gridRadius, planeSize, visible = false) {
        const sectors = 18;   // 20° increments
        const rings = 6;
        const divisions = 64;

        // Polar grid on ecliptic
        this.eclipticPolarGridHelper = new THREE.PolarGridHelper(
            gridRadius, sectors, rings, divisions,
            COL.ECLIPTIC_PLANE, COL.ECLIPTIC_PLANE
        );
        this.eclipticPolarGridHelper.rotation.x = Math.PI / 2;
        this.eclipticPolarGridHelper.visible = visible;
        this.parentContainer.add(this.eclipticPolarGridHelper);

        // Plane helper for ecliptic
        const eclipticPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        this.eclipticPlaneHelper = new THREE.PlaneHelper(eclipticPlane, planeSize, COL.ECLIPTIC_PLANE);
        this.eclipticPlaneHelper.visible = visible;
        this.parentContainer.add(this.eclipticPlaneHelper);
    }

    /**
     * Create equatorial plane visualization (tilted by Earth's axial inclination)
     * @param {number} gridRadius - Radius of the polar grid
     * @param {number} planeSize - Size of the plane helper
     * @param {boolean} visible - Initial visibility
     */
    createEquatorialPlane(gridRadius, planeSize, visible = false) {
        const sectors = 18;
        const rings = 6;
        const divisions = 64;

        // Container tilted to equatorial plane
        this.equatorialPlaneContainer = new THREE.Group();
        this.equatorialPlaneContainer.lookAt(
            0,
            Math.sin(PC.EARTH_AXIS_INCLINATION_RADS),
            Math.cos(PC.EARTH_AXIS_INCLINATION_RADS)
        );

        // Polar grid on equatorial plane
        this.equatorialPolarGridHelper = new THREE.PolarGridHelper(
            gridRadius, sectors, rings, divisions,
            COL.EQUATORIAL_PLANE, COL.EQUATORIAL_PLANE
        );
        this.equatorialPolarGridHelper.rotation.x = Math.PI / 2;
        this.equatorialPolarGridHelper.visible = visible;
        this.equatorialPlaneContainer.add(this.equatorialPolarGridHelper);

        // Plane helper for equatorial plane
        const direction = new THREE.Vector3();
        this.equatorialPlaneContainer.getWorldDirection(direction);
        const equatorialPlane = new THREE.Plane(direction, 0);
        this.equatorialPlaneHelper = new THREE.PlaneHelper(equatorialPlane, planeSize, COL.EQUATORIAL_PLANE);
        this.equatorialPlaneHelper.visible = visible;
        this.equatorialPlaneContainer.add(this.equatorialPlaneHelper);

        this.parentContainer.add(this.equatorialPlaneContainer);
    }

    /**
     * Create Moon's Sphere of Influence wireframe
     * @param {THREE.Object3D} moonContainer - Moon container to attach SOI to
     * @param {number} moonRadius - Visual radius of the moon
     * @param {boolean} visible - Initial visibility
     */
    createMoonSOI(moonContainer, moonRadius, visible = false) {
        this.moonContainer = moonContainer;

        const soiRadius = moonRadius * (PC.MOON_SOI_RADIUS_KM / PC.MOON_RADIUS_KM);
        const latSegments = 18;   // 10° increments
        const longSegments = 36;  // 10° increments

        const geometry = new THREE.SphereGeometry(soiRadius, longSegments, latSegments);
        const material = new THREE.MeshBasicMaterial({
            color: COL.MOON_SOI,
            wireframe: true
        });

        this.moonSOISphere = new THREE.Mesh(geometry, material);
        this.moonSOISphere.visible = visible;
        this.moonContainer.add(this.moonSOISphere);
    }

    // ===== Visibility Controls =====

    setAxesVisible(visible) {
        if (this.axesHelper) this.axesHelper.visible = visible;
    }

    setEclipticPlaneVisible(visible) {
        if (this.eclipticPolarGridHelper) this.eclipticPolarGridHelper.visible = visible;
        if (this.eclipticPlaneHelper) this.eclipticPlaneHelper.visible = visible;
    }

    setEquatorialPlaneVisible(visible) {
        if (this.equatorialPolarGridHelper) this.equatorialPolarGridHelper.visible = visible;
        if (this.equatorialPlaneHelper) this.equatorialPlaneHelper.visible = visible;
    }

    setMoonSOIVisible(visible) {
        if (this.moonSOISphere) this.moonSOISphere.visible = visible;
    }

    // ===== Disposal =====

    disposeAxesHelper() {
        if (this.axesHelper) {
            this.parentContainer.remove(this.axesHelper);
            this.axesHelper.dispose();
            this.axesHelper = null;
        }
    }

    disposeEclipticPlane() {
        if (this.eclipticPolarGridHelper) {
            this.parentContainer.remove(this.eclipticPolarGridHelper);
            this.eclipticPolarGridHelper.dispose();
            this.eclipticPolarGridHelper = null;
        }
        if (this.eclipticPlaneHelper) {
            this.parentContainer.remove(this.eclipticPlaneHelper);
            this.eclipticPlaneHelper.dispose();
            this.eclipticPlaneHelper = null;
        }
    }

    disposeEquatorialPlane() {
        if (this.equatorialPolarGridHelper) {
            this.equatorialPolarGridHelper.dispose();
            this.equatorialPolarGridHelper = null;
        }
        if (this.equatorialPlaneHelper) {
            this.equatorialPlaneHelper.dispose();
            this.equatorialPlaneHelper = null;
        }
        if (this.equatorialPlaneContainer) {
            this.parentContainer.remove(this.equatorialPlaneContainer);
            this.equatorialPlaneContainer.clear();
            this.equatorialPlaneContainer = null;
        }
    }

    disposeMoonSOI() {
        if (this.moonSOISphere && this.moonContainer) {
            this.moonContainer.remove(this.moonSOISphere);
            this.moonSOISphere.geometry.dispose();
            this.moonSOISphere.material.dispose();
            this.moonSOISphere = null;
        }
    }

    /**
     * Dispose all helpers
     */
    dispose() {
        this.disposeAxesHelper();
        this.disposeEclipticPlane();
        this.disposeEquatorialPlane();
        this.disposeMoonSOI();
    }
}
