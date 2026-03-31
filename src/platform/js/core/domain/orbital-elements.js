import { PHYSICS_CONSTANTS as PC } from "../constants.js";

const DEFAULT_SAMPLE_COUNT = 192;
const ORBIT_EPSILON = 1e-9;

function dot(a, b) {
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function cross(a, b) {
    return {
        x: (a.y * b.z) - (a.z * b.y),
        y: (a.z * b.x) - (a.x * b.z),
        z: (a.x * b.y) - (a.y * b.x),
    };
}

function magnitude(vector) {
    return Math.sqrt(dot(vector, vector));
}

function scale(vector, scalar) {
    return {
        x: vector.x * scalar,
        y: vector.y * scalar,
        z: vector.z * scalar,
    };
}

function subtract(a, b) {
    return {
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z,
    };
}

function buildPerifocalToInertialMatrix({ ascendingNodeLongitude, inclination, argumentOfPeriapsis }) {
    const cosOmega = Math.cos(ascendingNodeLongitude);
    const sinOmega = Math.sin(ascendingNodeLongitude);
    const cosInclination = Math.cos(inclination);
    const sinInclination = Math.sin(inclination);
    const cosArgument = Math.cos(argumentOfPeriapsis);
    const sinArgument = Math.sin(argumentOfPeriapsis);

    return [
        [
            (cosOmega * cosArgument) - (sinOmega * sinArgument * cosInclination),
            (-1 * cosOmega * sinArgument) - (sinOmega * cosArgument * cosInclination),
            sinOmega * sinInclination,
        ],
        [
            (sinOmega * cosArgument) + (cosOmega * sinArgument * cosInclination),
            (-1 * sinOmega * sinArgument) + (cosOmega * cosArgument * cosInclination),
            -1 * cosOmega * sinInclination,
        ],
        [
            sinArgument * sinInclination,
            cosArgument * sinInclination,
            cosInclination,
        ],
    ];
}

function transformPoint(matrix, point) {
    return {
        x: (matrix[0][0] * point.x) + (matrix[0][1] * point.y) + (matrix[0][2] * point.z),
        y: (matrix[1][0] * point.x) + (matrix[1][1] * point.y) + (matrix[1][2] * point.z),
        z: (matrix[2][0] * point.x) + (matrix[2][1] * point.y) + (matrix[2][2] * point.z),
    };
}

function normalizeAngleRadians(angle) {
    if (!Number.isFinite(angle)) return 0;
    let normalized = angle % (2 * Math.PI);
    if (normalized < 0) normalized += 2 * Math.PI;
    return normalized;
}

export function deriveOsculatingElementsFromState({
    position,
    velocity,
    gravitationalParameter = PC.EARTH_GM_KM3_S2,
}) {
    if (!position || !velocity || !Number.isFinite(gravitationalParameter) || gravitationalParameter <= 0) {
        return null;
    }

    const radius = magnitude(position);
    const speedSquared = dot(velocity, velocity);
    if (radius <= ORBIT_EPSILON) {
        return null;
    }

    const specificAngularMomentum = cross(position, velocity);
    const angularMomentumMagnitude = magnitude(specificAngularMomentum);
    if (angularMomentumMagnitude <= ORBIT_EPSILON) {
        return null;
    }

    const ascendingNode = {
        x: -1 * specificAngularMomentum.y,
        y: specificAngularMomentum.x,
        z: 0,
    };
    const ascendingNodeMagnitude = magnitude(ascendingNode);

    const eccentricityVector = subtract(
        scale(cross(velocity, specificAngularMomentum), 1 / gravitationalParameter),
        scale(position, 1 / radius),
    );
    const eccentricity = magnitude(eccentricityVector);

    const orbitalEnergy = (speedSquared / 2) - (gravitationalParameter / radius);
    if (!Number.isFinite(orbitalEnergy) || orbitalEnergy >= 0) {
        return null;
    }

    const semiMajorAxis = -1 * gravitationalParameter / (2 * orbitalEnergy);
    if (!Number.isFinite(semiMajorAxis) || semiMajorAxis <= 0) {
        return null;
    }

    const inclination = Math.acos(
        Math.max(-1, Math.min(1, specificAngularMomentum.z / angularMomentumMagnitude)),
    );

    let ascendingNodeLongitude = 0;
    if (ascendingNodeMagnitude > ORBIT_EPSILON) {
        ascendingNodeLongitude = normalizeAngleRadians(
            Math.atan2(ascendingNode.y, ascendingNode.x),
        );
    }

    let argumentOfPeriapsis = 0;
    if (eccentricity > ORBIT_EPSILON && ascendingNodeMagnitude > ORBIT_EPSILON) {
        const cosArgument = dot(ascendingNode, eccentricityVector) / (ascendingNodeMagnitude * eccentricity);
        const sinArgument =
            dot(cross(ascendingNode, eccentricityVector), specificAngularMomentum) /
            (ascendingNodeMagnitude * eccentricity * angularMomentumMagnitude);
        argumentOfPeriapsis = normalizeAngleRadians(Math.atan2(sinArgument, cosArgument));
    } else if (eccentricity > ORBIT_EPSILON) {
        argumentOfPeriapsis = normalizeAngleRadians(
            Math.atan2(eccentricityVector.y, eccentricityVector.x),
        );
    }

    return {
        semiMajorAxis,
        eccentricity,
        inclination,
        ascendingNodeLongitude,
        argumentOfPeriapsis,
    };
}

export function sampleOsculatingOrbitPoints({
    position,
    velocity,
    gravitationalParameter = PC.EARTH_GM_KM3_S2,
    sampleCount = DEFAULT_SAMPLE_COUNT,
}) {
    const elements = deriveOsculatingElementsFromState({
        position,
        velocity,
        gravitationalParameter,
    });
    if (!elements) {
        return null;
    }

    const {
        semiMajorAxis,
        eccentricity,
        inclination,
        ascendingNodeLongitude,
        argumentOfPeriapsis,
    } = elements;

    const semiLatusRectum = semiMajorAxis * (1 - (eccentricity * eccentricity));
    if (!Number.isFinite(semiLatusRectum) || semiLatusRectum <= ORBIT_EPSILON) {
        return null;
    }

    const rotationMatrix = buildPerifocalToInertialMatrix({
        ascendingNodeLongitude,
        inclination,
        argumentOfPeriapsis,
    });
    const points = [];
    const samples = Math.max(32, Math.floor(sampleCount));

    for (let index = 0; index < samples; index++) {
        const trueAnomaly = (2 * Math.PI * index) / samples;
        const denominator = 1 + (eccentricity * Math.cos(trueAnomaly));
        if (Math.abs(denominator) <= ORBIT_EPSILON) {
            return null;
        }

        const radius = semiLatusRectum / denominator;
        const perifocalPoint = {
            x: radius * Math.cos(trueAnomaly),
            y: radius * Math.sin(trueAnomaly),
            z: 0,
        };
        points.push(transformPoint(rotationMatrix, perifocalPoint));
    }

    return {
        elements,
        points,
    };
}
