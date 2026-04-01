/**
 * Animation2DController - Renders 2D SVG scene from computed state
 *
 * Part of the pull-based renderer architecture:
 * - Animation loop pulls state from SceneStateController
 * - Passes state to this controller
 * - Controller updates SVG elements via D3
 *
 * One instance per config (geo, lunar).
 */

import { PHYSICS_CONSTANTS as PC } from "../core/constants.js";
import { velocityToAngle } from "../utils/math-utils.js";
import { projectToPlane, toScreenCoordinates } from "../scene-state.js";
import { resolveTrailLayerWindow, resolveTrailWindow } from "../app/orbit-trail-style.js";

// PIXELS_PER_AU is passed as a render option since it varies by config

export class Animation2DController {
    /**
     * Create a 2D animation controller.
     * @param {string} config - Configuration name: "geo" or "lunar"
     * @param {Object} options - Configuration options
     * @param {Object} options.planetProperties - Planet display properties
     * @param {Function} options.showPlanet - Function to determine planet visibility
     */
    constructor(config, options = {}) {
        this.config = config;
        this.planetProperties = options.planetProperties || {};
        this.showPlanet = options.showPlanet || (() => true);

        // Plane configuration for coordinate projection
        // These determine which 3D axes map to 2D x/y
        this.planeConfig = {
            xVariable: "x",
            yVariable: "y",
            zVariable: "z",
            xFactor: 1,
            yFactor: 1,
            zFactor: 1
        };

        // Zoom and pan state
        this.zoomFactor = 1;
        this.panx = 0;
        this.pany = 0;

        // Cached spacecraft data for transforms
        this.craftData = { x: 0, y: 0, z: 0, angle: 0 };
    }

    /**
     * Update plane configuration for coordinate projection.
     * @param {Object} planeConfig - Plane configuration
     */
    setPlaneConfig(planeConfig) {
        this.planeConfig = { ...this.planeConfig, ...planeConfig };
    }

    /**
     * Update zoom and pan state.
     * @param {number} zoomFactor - Current zoom level
     * @param {number} panx - Pan offset X
     * @param {number} pany - Pan offset Y
     */
    setZoomPan(zoomFactor, panx = 0, pany = 0) {
        this.zoomFactor = zoomFactor;
        this.panx = panx;
        this.pany = pany;
    }

    /**
     * Render the 2D scene based on computed state.
     * @param {Object} state - Scene state from computeSceneState()
     * @param {Object} options - Additional render options
     * @param {string} options.craftId - Spacecraft ID (e.g., "SC")
     * @param {number} options.pixelsPerAU - Scale factor for coordinate conversion
     * @param {string} options.primaryBody - Primary body name
     * @param {Array} options.planetsForLocations - List of planet IDs to render
     */
    render(state, options = {}) {
        const {
            craftId = "SC",
            pixelsPerAU = 250,
            primaryBody,
            planetsForLocations = [],
            scene = null,
        } = options;
        this.pixelsPerAU = pixelsPerAU;

        // Update body positions
        for (const bodyId of planetsForLocations) {
            const bodyState = state.bodies[bodyId];

            if (!bodyState || !bodyState.available) {
                this.hideBody(bodyId);
                continue;
            }

            this.updateBodyPosition(bodyId, bodyState, craftId);
        }

        // Update spacecraft-specific rendering
        if (state.bodies.SC?.available) {
            this.updateSpacecraftVisuals(state.bodies.SC, state);
        }

        this.updateOrbitTrails(scene, state.time);
    }

    /**
     * Update a body's position in the SVG.
     * @param {string} bodyId - Body identifier
     * @param {Object} bodyState - Body state with position and velocity
     * @param {string} craftId - Spacecraft ID for special handling
     */
    updateBodyPosition(bodyId, bodyState, craftId) {
        // Project 3D position to 2D based on plane selection
        const projected = this.project3Dto2D(bodyState);

        // Convert to screen coordinates
        const screenPos = {
            x: (projected.x / PC.KM_PER_AU) * this.pixelsPerAU,
            y: -1 * (projected.y / PC.KM_PER_AU) * this.pixelsPerAU, // Y is inverted for SVG
            z: (projected.z / PC.KM_PER_AU) * this.pixelsPerAU
        };

        // Update SVG element
        const visible = this.showPlanet(bodyId);
        d3.select("#" + bodyId)
            .attr("visibility", visible ? "visible" : "hidden")
            .attr("cx", screenPos.x)
            .attr("cy", screenPos.y);

        // Cache spacecraft position for transform calculations
        if (bodyId === craftId) {
            this.craftData.x = screenPos.x;
            this.craftData.y = screenPos.y;
            this.craftData.z = screenPos.z;

            // Calculate angle from velocity
            const projectedVel = this.projectVelocity(bodyState);
            this.craftData.angle = velocityToAngle(projectedVel.vx, projectedVel.vy);
        }
    }

    /**
     * Project 3D position to 2D based on plane configuration.
     * @param {Object} bodyState - Body state with position
     * @returns {Object} Projected 2D coordinates
     */
    project3Dto2D(bodyState) {
        const pos = bodyState.position;
        const { xVariable, yVariable, zVariable, xFactor, yFactor, zFactor } = this.planeConfig;

        return {
            x: xFactor * pos[xVariable],
            y: yFactor * pos[yVariable],
            z: zFactor * pos[zVariable]
        };
    }

    /**
     * Project velocity to 2D based on plane configuration.
     * @param {Object} bodyState - Body state with velocity
     * @returns {Object} Projected velocity components
     */
    projectVelocity(bodyState) {
        const vel = bodyState.velocity;
        const { xVariable, yVariable, zVariable, xFactor, yFactor, zFactor } = this.planeConfig;

        // Map velocity components (vx, vy, vz) to plane axes
        const velMap = { x: vel.vx, y: vel.vy, z: vel.vz };

        return {
            vx: xFactor * velMap[xVariable],
            vy: yFactor * velMap[yVariable],
            vz: zFactor * velMap[zVariable]
        };
    }

    /**
     * Hide a body in the SVG.
     * @param {string} bodyId - Body identifier
     */
    hideBody(bodyId) {
        d3.select("#" + bodyId).attr("visibility", "hidden");
    }

    /**
     * Update spacecraft-specific visual elements.
     * @param {Object} scState - Spacecraft state
     * @param {Object} state - Full scene state
     */
    updateSpacecraftVisuals(scState, state) {
        // Update burn indicator transform
        this.updateBurnIndicator();
    }

    updateOrbitTrails(scene, timeMs) {
        if (!scene?.orbitSvgPointsByBodyId || !scene?.orbitTimesByBodyId) {
            return;
        }

        const pointsToAttr = (points) =>
            points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

        for (const [bodyId, points] of Object.entries(scene.orbitSvgPointsByBodyId)) {
            const times = scene.orbitTimesByBodyId?.[bodyId] || [];
            const orbitStyleMetadata = scene.orbitStyleMetadataByBodyId?.[bodyId] || null;
            const window = resolveTrailWindow(times, timeMs, {
                orbitStyleMetadata,
                phaseKey: scene?.name,
                tailOrbitFraction: scene?.orbitTrailTailFraction,
                headOrbitFraction: scene?.orbitTrailHeadFraction,
            });
            const layers = resolveTrailLayerWindow(window);
            const tailPoints =
                layers.tailStartIndex >= 0 && layers.currentIndex >= layers.tailStartIndex
                    ? points.slice(layers.tailStartIndex, layers.currentIndex + 1)
                    : [];
            const midPoints =
                layers.midStartIndex >= 0 && layers.currentIndex >= layers.midStartIndex
                    ? points.slice(layers.midStartIndex, layers.currentIndex + 1)
                    : [];
            const headGlowPoints =
                layers.headGlowStartIndex >= 0 && layers.currentIndex >= layers.headGlowStartIndex
                    ? points.slice(layers.headGlowStartIndex, layers.currentIndex + 1)
                    : [];
            const headPoints =
                layers.headStartIndex >= 0 && layers.currentIndex >= layers.headStartIndex
                    ? points.slice(layers.headStartIndex, layers.currentIndex + 1)
                    : [];

            d3.select(`#orbit-trail-${bodyId}`).attr(
                "points",
                tailPoints.length >= 2 ? pointsToAttr(tailPoints) : "",
            );
            d3.select(`#orbit-mid-${bodyId}`).attr(
                "points",
                midPoints.length >= 2 ? pointsToAttr(midPoints) : "",
            );
            d3.select(`#orbit-head-glow-${bodyId}`).attr(
                "points",
                headGlowPoints.length >= 2 ? pointsToAttr(headGlowPoints) : "",
            );
            d3.select(`#orbit-head-${bodyId}`).attr(
                "points",
                headPoints.length >= 2 ? pointsToAttr(headPoints) : "",
            );
        }
    }

    /**
     * Update the burn indicator transform.
     */
    updateBurnIndicator() {
        const { x, y, angle } = this.craftData;

        // Only update if we have valid coordinates
        if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
            return;
        }

        const scale = 1 / this.zoomFactor;

        const transformString =
            `translate(${x}, ${y}) ` +
            `rotate(${angle || 0} 0 0) ` +
            `scale(${scale} ${scale})`;

        d3.select("#burng").attr("transform", transformString);
    }

    /**
     * Update label position for a body.
     * @param {string} bodyId - Body identifier
     * @param {Object} options - Label options
     */
    updateLabelPosition(bodyId, options = {}) {
        const props = this.planetProperties[bodyId];
        if (!props) return;

        const bodyElement = d3.select("#" + bodyId);
        const cx = parseFloat(bodyElement.attr("cx")) || 0;
        const cy = parseFloat(bodyElement.attr("cy")) || 0;

        const labelOffsetX = (props.labelOffsetX || 0) / this.zoomFactor;
        const labelOffsetY = (props.labelOffsetY || 0) / this.zoomFactor;

        d3.select("#label-" + bodyId)
            .attr("x", cx + labelOffsetX)
            .attr("y", cy + labelOffsetY)
            .attr("visibility", "visible");
    }

    /**
     * Apply zoom/pan transform to the SVG.
     * @param {Object} options - Transform options
     */
    applyZoomPanTransform(options = {}) {
        // This would update the SVG viewBox or transform
        // Implementation depends on how zoom/pan is handled in the existing code
    }

    /**
     * Get current craft data (position and angle).
     * @returns {Object} Craft data
     */
    getCraftData() {
        return { ...this.craftData };
    }
}
