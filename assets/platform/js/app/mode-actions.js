import { applyViewSettings } from "../ui/ui-state.js";

export function createModeActions({
    animationScenes,
    getConfig,
    getGlobalConfig,
    render,
    updateCraftScale,
    getLandingFlag,
    setLandingFlag,
    getJoyRideFlag,
    setJoyRideFlag,
    setView,
}) {
    function toggleJoyRide() {
        if (getLandingFlag()) {
            toggleLanding();
        }

        const next = !getJoyRideFlag();
        setJoyRideFlag(next);

        const scene = animationScenes[getConfig()];
        scene.craft.visible = !next;
        scene.craftEdges.visible = !next;
        $("#joyridebutton").toggleClass("down");
        $("#joyride").prop("checked", next);

        if (next) {
            scene.motherContainer.position.set(0, 0, 0);
            applyViewSettings({
                viewOrbit: false,
                viewOrbitDescent: false,
                viewCraters: false,
                viewXYZAxes: false,
                viewPoles: false,
                viewPolarAxes: false,
                viewSky: true,
                viewMoonSOI: false,
                viewEclipticPlane: false,
                viewEquatorialPlane: false,
            });
            setView();
        } else {
            applyViewSettings({
                viewOrbit: true,
                viewOrbitDescent: true,
                viewCraters: true,
                viewXYZAxes: true,
                viewPoles: true,
                viewPolarAxes: true,
                viewSky: true,
                viewMoonSOI: false,
                viewEclipticPlane: false,
                viewEquatorialPlane: false,
            });
            setView();
        }

        updateCraftScale();
        render();
    }

    function toggleLanding() {
        const isLandingEnabled = getGlobalConfig()?.landing?.enabled;
        if (!isLandingEnabled) return;

        if (getJoyRideFlag()) {
            toggleJoyRide();
        }

        const next = !getLandingFlag();
        setLandingFlag(next);

        const scene = animationScenes[getConfig()];
        scene.craft.visible = true;
        scene.craftEdges.visible = true;
        $("#landingbutton").toggleClass("down");
        $("#landing").prop("checked", next);

        if (next) {
            scene.motherContainer.position.set(0, 0, 0);
            applyViewSettings({
                viewOrbit: false,
                viewOrbitDescent: true,
                viewCraters: false,
                viewXYZAxes: false,
                viewPoles: false,
                viewPolarAxes: false,
                viewSky: true,
                viewMoonSOI: false,
                viewEclipticPlane: false,
                viewEquatorialPlane: false,
            });
            setView();
        } else {
            applyViewSettings({
                viewOrbit: true,
                viewOrbitDescent: true,
                viewCraters: true,
                viewXYZAxes: true,
                viewPoles: true,
                viewPolarAxes: true,
                viewSky: true,
                viewMoonSOI: false,
                viewEclipticPlane: false,
                viewEquatorialPlane: false,
            });
            setView();
        }

        updateCraftScale();
        render();
    }

    return { toggleJoyRide, toggleLanding };
}

