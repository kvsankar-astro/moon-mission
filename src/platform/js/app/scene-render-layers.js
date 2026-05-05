import { LIGHT_SETTINGS as LT } from "../core/constants.js";

export function configureSkyRenderLayers(camera) {
    camera?.layers?.set?.(2);
}

export function configureBodyRenderLayers(camera) {
    camera?.layers?.set?.(0);
    camera?.layers?.enable?.(LT.EARTH_REFLECTED_LIGHT_LAYER);
    camera?.layers?.enable?.(LT.MOON_REFLECTED_LIGHT_LAYER);
}

export function configureCraftRenderLayers(camera) {
    camera?.layers?.set?.(1);
}
