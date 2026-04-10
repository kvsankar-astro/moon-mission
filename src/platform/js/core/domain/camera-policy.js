const CAMERA_ALLOWED_LOOK_BY_POSITION = Object.freeze({
    manual: Object.freeze(["manual", "earth", "moon", "spacecraft"]),
    earth: Object.freeze(["moon", "spacecraft"]),
    moon: Object.freeze(["manual", "earth", "spacecraft"]),
    spacecraft: Object.freeze(["manual", "earth", "moon"]),
});

function buildAllowedPositionByLook(allowedLookByPosition) {
    const map = {
        manual: [],
        earth: [],
        moon: [],
        spacecraft: [],
    };

    for (const [position, looks] of Object.entries(allowedLookByPosition)) {
        looks.forEach((look) => {
            if (!map[look]) map[look] = [];
            map[look].push(position);
        });
    }

    return Object.fromEntries(
        Object.entries(map).map(([look, positions]) => [look, Object.freeze(positions)]),
    );
}

const CAMERA_ALLOWED_POSITION_BY_LOOK = Object.freeze(
    buildAllowedPositionByLook(CAMERA_ALLOWED_LOOK_BY_POSITION),
);

const CAMERA_LOCK_AVAILABILITY_BY_POSITION = Object.freeze({
    manual: Object.freeze(["sc", "moon", "earth"]),
    earth: Object.freeze(["sc", "moon"]),
    moon: Object.freeze(["sc", "earth"]),
    spacecraft: Object.freeze(["earth", "moon"]),
});

const CAMERA_PAIR_VALUE_BY_KEY = Object.freeze({
    manual__manual: Object.freeze({ positionMode: "manual", lookMode: "manual" }),
    manual__earth: Object.freeze({ positionMode: "manual", lookMode: "earth" }),
    manual__moon: Object.freeze({ positionMode: "manual", lookMode: "moon" }),
    manual__spacecraft: Object.freeze({ positionMode: "manual", lookMode: "spacecraft" }),
    earth__moon: Object.freeze({ positionMode: "earth", lookMode: "moon" }),
    earth__spacecraft: Object.freeze({ positionMode: "earth", lookMode: "spacecraft" }),
    moon__manual: Object.freeze({ positionMode: "moon", lookMode: "manual" }),
    moon__earth: Object.freeze({ positionMode: "moon", lookMode: "earth" }),
    moon__spacecraft: Object.freeze({ positionMode: "moon", lookMode: "spacecraft" }),
    spacecraft__manual: Object.freeze({ positionMode: "spacecraft", lookMode: "manual" }),
    spacecraft__earth: Object.freeze({ positionMode: "spacecraft", lookMode: "earth" }),
    spacecraft__moon: Object.freeze({ positionMode: "spacecraft", lookMode: "moon" }),
});

const CAMERA_PAIR_KEY_BY_MODE = Object.freeze(
    Object.fromEntries(
        Object.entries(CAMERA_PAIR_VALUE_BY_KEY).map(([key, value]) => [
            `${value.positionMode}__${value.lookMode}`,
            key,
        ]),
    ),
);

function resolveAllowedLooks(positionMode) {
    return CAMERA_ALLOWED_LOOK_BY_POSITION[positionMode] || ["manual"];
}

function resolveAllowedPositions(lookMode) {
    return CAMERA_ALLOWED_POSITION_BY_LOOK[lookMode] || ["manual"];
}

function normalizeFromTo({ positionMode, lookMode, sourceId }) {
    let nextPosition = positionMode;
    let nextLook = lookMode;
    const allowedLook = resolveAllowedLooks(nextPosition);
    const allowedPosition = resolveAllowedPositions(nextLook);

    if (sourceId === "camera-position") {
        if (!allowedLook.includes(nextLook)) {
            nextLook = allowedLook[0];
        }
    } else if (sourceId === "camera-look") {
        if (!allowedPosition.includes(nextPosition)) {
            nextPosition = allowedPosition[0];
        }
    } else {
        if (!allowedLook.includes(nextLook)) {
            nextLook = allowedLook[0];
        }
        const allowedPositionAfterLook = resolveAllowedPositions(nextLook);
        if (!allowedPositionAfterLook.includes(nextPosition)) {
            nextPosition = allowedPositionAfterLook[0];
        }
    }

    return { positionMode: nextPosition, lookMode: nextLook };
}

function resolvePairFromValue(value) {
    if (!value) return null;
    const pair = CAMERA_PAIR_VALUE_BY_KEY[value];
    return pair
        ? { positionMode: pair.positionMode, lookMode: pair.lookMode }
        : null;
}

function resolvePairKey(positionMode, lookMode) {
    return CAMERA_PAIR_KEY_BY_MODE[`${positionMode}__${lookMode}`] || "manual__manual";
}

function resolveLockAvailability(positionMode, lookMode) {
    if (lookMode !== "manual") {
        return [];
    }
    return CAMERA_LOCK_AVAILABILITY_BY_POSITION[positionMode] || [];
}

function planCameraPairTransition({
    positionMode,
    lookMode,
    sourceId,
    pairValue = null,
}) {
    const basePositionMode = pairValue?.positionMode ?? positionMode;
    const baseLookMode = pairValue?.lookMode ?? lookMode;
    const normalized = normalizeFromTo({
        positionMode: basePositionMode,
        lookMode: baseLookMode,
        sourceId,
    });

    return {
        positionMode: normalized.positionMode,
        lookMode: normalized.lookMode,
        pairKey: resolvePairKey(normalized.positionMode, normalized.lookMode),
        allowedLookModes: resolveAllowedLooks(normalized.positionMode),
        allowedPositionModes: resolveAllowedPositions(normalized.lookMode),
        lockAvailability: resolveLockAvailability(normalized.positionMode, normalized.lookMode),
    };
}

export {
    CAMERA_ALLOWED_LOOK_BY_POSITION,
    CAMERA_ALLOWED_POSITION_BY_LOOK,
    CAMERA_LOCK_AVAILABILITY_BY_POSITION,
    CAMERA_PAIR_KEY_BY_MODE,
    CAMERA_PAIR_VALUE_BY_KEY,
    normalizeFromTo,
    planCameraPairTransition,
    resolveAllowedLooks,
    resolveAllowedPositions,
    resolveLockAvailability,
    resolvePairFromValue,
    resolvePairKey,
};
