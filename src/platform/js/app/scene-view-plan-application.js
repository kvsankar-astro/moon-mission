function applySceneViewPlanToScene({
    scene,
    configKey,
    plan,
    globalConfig,
    documentRef = null,
    applyOrbitSvgStyle,
    applySceneTailProminence,
    applySceneOrbitVisibility,
    setSceneVisibleCraftIds,
    syncSceneActiveCraft,
    refreshSceneOrbitStyleOpacities,
    applySkyLayerVisibility,
}) {
    const view = plan?.view || {};
    if (scene) {
        scene.trailContextOpacity2D = plan.trailContextOpacity2D;
        scene.trailContextOpacity3D = plan.trailContextOpacity3D;
        scene.trailTailProminence2D = plan.trailTailProminence2D;
        scene.trailTailProminence3D = plan.trailTailProminence3D;
        setSceneVisibleCraftIds(scene, globalConfig, plan.visibleCraftIds);
        scene.viewAdditionalCrafts = plan.nextViewAdditionalCrafts;
        syncSceneActiveCraft(scene, globalConfig, plan.nextActiveCraftId);
        refreshSceneOrbitStyleOpacities(scene);
        applySceneTailProminence(
            scene,
            plan.trailTailProminence2D,
            plan.trailTailProminence3D,
        );
    }

    if (scene?.planetsForLocations) {
        for (const bodyId of scene.planetsForLocations) {
            const orbitElement = documentRef?.getElementById?.(`orbit-${bodyId}`) || null;
            if (!orbitElement) continue;
            applyOrbitSvgStyle(
                orbitElement,
                plan.effectiveOrbitStyle,
                view.trailTrackBrightness2D,
                view.trailTailBrightness2D,
            );
            orbitElement.setAttribute(
                "visibility",
                plan.orbitVisibilityByBodyId[bodyId] ? "visible" : "hidden",
            );
        }
    }

    if (!scene?.initialized3D) {
        return;
    }

    applySceneOrbitVisibility(
        scene,
        globalConfig,
        view.viewOrbit,
        plan.effectiveOrbitStyle,
        view.trailTrackBrightness3D,
        view.trailTailBrightness3D,
    );
    if (configKey === "lunar" && globalConfig?.landing?.enabled && scene.landingOrbitLine) {
        scene.landingOrbitLine.visible = plan.showLandingOrbit;
    }

    scene.locations.forEach((location) => {
        location.visible = view.viewCraters;
    });
    if (view.lunarCraterDisplayMode === "always" || view.lunarCraterDisplayMode === "hover") {
        scene.setLunarCraterDisplayMode?.(view.lunarCraterDisplayMode);
    }
    if (
        Number.isFinite(Number(view.lunarCraterMinDiameterKm)) ||
        Number.isFinite(Number(view.lunarCraterMaxDiameterKm))
    ) {
        scene.setLunarCraterDiameterRange?.({
            lunarCraterMinDiameterKm: view.lunarCraterMinDiameterKm,
            lunarCraterMaxDiameterKm: view.lunarCraterMaxDiameterKm,
        });
    }
    if (Object.prototype.hasOwnProperty.call(view, "lunarCraterHoverLabels")) {
        scene.setLunarCraterHoverLabelsEnabled?.(view.lunarCraterHoverLabels);
    }
    if (view.lunarFeatureTypeFilters && typeof view.lunarFeatureTypeFilters === "object") {
        scene.setLunarFeatureTypeFilters?.(view.lunarFeatureTypeFilters);
    }
    if (Object.prototype.hasOwnProperty.call(view, "lunarFeatureSearchQuery")) {
        scene.setLunarFeatureSearchQuery?.(view.lunarFeatureSearchQuery);
    }
    if (Object.prototype.hasOwnProperty.call(view, "lunarFeatureExcludedKeys")) {
        scene.setLunarFeatureExcludedKeys?.(view.lunarFeatureExcludedKeys);
    }
    scene.setLunarCraterAnnotationsVisible?.(view.viewLunarCraters);

    if (scene.axesHelper) {
        scene.axesHelper.visible = view.viewXYZAxes;
    }

    scene.earthNorthPoleSphere.visible = view.viewPoles;
    scene.earthSouthPoleSphere.visible = view.viewPoles;
    if (scene.sceneHelpers?.setBodyHalosVisible) {
        scene.sceneHelpers.setBodyHalosVisible(view.viewBodyHalos);
    }

    if (globalConfig?.is_lunar) {
        scene.moonNorthPoleSphere.visible = view.viewPoles;
        scene.moonSouthPoleSphere.visible = view.viewPoles;
        scene.moonAxis.visible = view.viewPolarAxes;
        scene.moonRenderer?.setLatLonGridVisible?.(view.viewMoonLatLonGrid);
        scene.moonRenderer?.setLatLonLabelsVisible?.(view.viewMoonLatLonLabels);
        scene.moonRenderer?.setLatLonHoverEnabled?.(view.viewMoonLatLonHover);
        if (scene.moonSOISphere) {
            scene.moonSOISphere.visible = view.viewMoonSOI;
        }
        if (scene.moonHillSphere) {
            scene.moonHillSphere.visible = view.viewMoonHillSphere;
        }
        if (scene.moonOsculatingOrbitLine) {
            scene.moonOsculatingOrbitLine.visible = plan.showMoonOsculatingOrbit;
        }
    }

    scene.earthAxis.visible = view.viewPolarAxes;

    applySkyLayerVisibility(scene, {
        viewSky: view.viewSky,
        viewConstellationLines: view.viewConstellationLines,
    });
    if (plan.skyPatch) {
        scene.skyRenderer?.setParameters?.(plan.skyPatch);
        if (Number.isFinite(plan.skyPatch.sky_time_ms)) {
            scene.skyRenderer?.setTime?.(plan.skyPatch.sky_time_ms);
        }
    }
    scene.sceneHelpers?.setEclipticPlaneVisible?.(view.viewEclipticPlane);
    scene.sceneHelpers?.setEquatorialPlaneVisible?.(view.viewEquatorialPlane);
    if (scene.eclipticPlaneHelper) scene.eclipticPlaneHelper.visible = view.viewEclipticPlane;
    if (scene.eclipticPolarGridHelper) scene.eclipticPolarGridHelper.visible = view.viewEclipticPlane;
    if (scene.equatorialPlaneHelper) scene.equatorialPlaneHelper.visible = view.viewEquatorialPlane;
    if (scene.equatorialPolarGridHelper) scene.equatorialPolarGridHelper.visible = view.viewEquatorialPlane;
}

export { applySceneViewPlanToScene };
