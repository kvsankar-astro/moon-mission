import { applyViewSettings, setChecked } from "../ui/ui-state.js";

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
    function toggleButtonDownState(id, isDown) {
        const button = document.getElementById(id);
        if (!button) return;
        button.classList.toggle("down", !!isDown);
    }

    function toggleJoyRide() {
        if (getLandingFlag()) {
            toggleLanding();
        }

        const next = !getJoyRideFlag();
        setJoyRideFlag(next);

        const scene = animationScenes[getConfig()];
        scene.craft.visible = !next;
        scene.craftEdges.visible = !next;
        toggleButtonDownState("joyridebutton", next);
        setChecked("joyride", next);

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
        toggleButtonDownState("landingbutton", next);
        setChecked("landing", next);

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
