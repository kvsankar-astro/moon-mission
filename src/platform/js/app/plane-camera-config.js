export const PLANE_CAMERA_CONFIG = {
    DEFAULT: {
        geo: {
            posx: -1 / 6,
            posy: -1 / 30,
            posz: 1 / 24,
            dirx: 0,
            diry: 0,
            dirz: 1,
        },
        lunar: {
            posx: -1 / 96,
            posy: -1 / 96,
            posz: -1 / 96,
            dirx: 0,
            diry: 0,
            dirz: 1,
        },
    },
    XY: { posx: 0, posy: 0, posz: 1, dirx: 0, diry: 1, dirz: 0 },
    YZ: { posx: 1, posy: 0, posz: 0, dirx: 0, diry: 0, dirz: 1 },
    ZX: { posx: 0, posy: 1, posz: 0, dirx: 1, diry: 0, dirz: 0 },
    "XY-": { posx: 0, posy: 0, posz: -1, dirx: 0, diry: 1, dirz: 0 },
    "YZ-": { posx: -1, posy: 0, posz: 0, dirx: 0, diry: 0, dirz: 1 },
    "ZX-": { posx: 0, posy: -1, posz: 0, dirx: 1, diry: 0, dirz: 0 },
};

function isPoseConfig(config) {
    return (
        config &&
        typeof config === "object" &&
        Number.isFinite(config.posx) &&
        Number.isFinite(config.posy) &&
        Number.isFinite(config.posz) &&
        Number.isFinite(config.dirx) &&
        Number.isFinite(config.diry) &&
        Number.isFinite(config.dirz)
    );
}

export function getPlaneCameraPose({ planeSelection, missionConfig, cameraDistance }) {
    const entry = PLANE_CAMERA_CONFIG[planeSelection];
    if (!entry) return null;

    const config = isPoseConfig(entry) ? entry : entry[missionConfig];
    if (!isPoseConfig(config)) return null;

    return {
        position: {
            x: config.posx * cameraDistance,
            y: config.posy * cameraDistance,
            z: config.posz * cameraDistance,
        },
        up: { x: config.dirx, y: config.diry, z: config.dirz },
    };
}

