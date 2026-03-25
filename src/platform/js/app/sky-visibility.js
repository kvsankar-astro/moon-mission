export function applySkyLayerVisibility(scene, { viewSky = false, viewConstellationLines = false } = {}) {
    const showSky = Boolean(viewSky);
    const showConstellationLines = Boolean(viewConstellationLines);

    if (scene.sky) {
        scene.sky.visible = showSky;
    }
    if (scene.skyConstellation) {
        scene.skyConstellation.visible = showConstellationLines;
    }
    if (scene.skyContainer) {
        scene.skyContainer.visible = showSky || showConstellationLines;
    }
}
