import { LIGHT_SETTINGS as LT } from "../core/constants.js";

function enableLayerRecursively(root, layer) {
    if (!root?.traverse || !Number.isInteger(layer)) {
        return;
    }
    root.traverse((node) => {
        node?.layers?.enable?.(layer);
    });
}

export function computePrimarySecondaryBodies({ config, isLunarMission }) {
    if (config === "geo") {
        return {
            primaryBody: "earth",
            secondaryBody: isLunarMission ? "moon" : null,
            addMoonComponents: isLunarMission,
        };
    }

    if (config === "lunar") {
        return {
            primaryBody: "moon",
            secondaryBody: "earth",
            addMoonComponents: isLunarMission,
        };
    }

    return {
        primaryBody: "earth",
        secondaryBody: null,
        addMoonComponents: false,
    };
}

export function createPrimarySecondaryBodiesActions({ getConfig, getGlobalConfig }) {
    function setPrimaryAndSecondaryBodies(scene) {
        const config = getConfig();
        const globalConfig = getGlobalConfig();
        const isLunarMission = !!globalConfig?.is_lunar;

        const plan = computePrimarySecondaryBodies({
            config,
            isLunarMission,
        });

        if (plan.primaryBody === "earth") {
            scene.primaryBody3D = scene.earthContainer;
            scene.secondaryBody3D = scene.moonContainer;

            scene.earthContainer.add(scene.earthAxis);
            scene.earthContainer.add(scene.earthNorthPoleSphere);
            scene.earthContainer.add(scene.earthSouthPoleSphere);

            if (plan.addMoonComponents && scene.moonContainer) {
                scene.moonContainer.add(scene.moonAxis);
                scene.moonContainer.add(scene.moonNorthPoleSphere);
                scene.moonContainer.add(scene.moonSouthPoleSphere);
            }
        } else if (plan.primaryBody === "moon") {
            scene.primaryBody3D = scene.moonContainer;
            scene.secondaryBody3D = scene.earthContainer;

            if (plan.addMoonComponents && scene.moonContainer) {
                scene.moonContainer.add(scene.moonAxis);
                scene.moonContainer.add(scene.moonNorthPoleSphere);
                scene.moonContainer.add(scene.moonSouthPoleSphere);
            }

            scene.earthContainer.add(scene.earthAxis);
            scene.earthContainer.add(scene.earthNorthPoleSphere);
            scene.earthContainer.add(scene.earthSouthPoleSphere);
        }

        enableLayerRecursively(scene.earthContainer, LT.EARTH_REFLECTED_LIGHT_LAYER);
        enableLayerRecursively(scene.moonContainer, LT.MOON_REFLECTED_LIGHT_LAYER);

        scene.motherContainer.add(scene.primaryBody3D);
        if (scene.secondaryBody3D) {
            scene.motherContainer.add(scene.secondaryBody3D);
        }
    }

    return { setPrimaryAndSecondaryBodies };
}
