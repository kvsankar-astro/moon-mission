export function createBodyRotationActions({ lunar_pole, Astronomy, degreesToRadians, PC }) {
    function rotateMoon({ timeMs, globalConfig, moonContainer }) {
        if (!globalConfig || !globalConfig.is_lunar) return;
        if (!moonContainer) return;

        const today = new Date(timeMs);
        const lp = lunar_pole(today);
        const alpha = lp["alpha"];
        const delta = lp["delta"];
        const W = lp["W"];

        moonContainer.rotation.set(0, 0, 0);
        moonContainer.rotateX(-1 * PC.EARTH_AXIS_INCLINATION_RADS);
        moonContainer.rotateZ(+1 * (Math.PI / 2 + alpha));
        moonContainer.rotateX(+1 * (Math.PI / 2 - delta));
        moonContainer.rotateZ(+1 * W);
    }

    function rotateEarth({ timeMs, earthContainer }) {
        if (!earthContainer) return;

        // Greenwich Apparent Sidereal Time (hours × 15 = degrees, then to radians)
        const mst = degreesToRadians(Astronomy.SiderealTime(new Date(timeMs)) * 15);
        earthContainer.rotation.z = mst;
    }

    return { rotateMoon, rotateEarth };
}

