export const LUNAR_FEATURE_TYPE_COLORS = Object.freeze({
    // Generated with farthest-point sampling over in-gamut OKLCH candidates.
    "Crater, craters": "#127eee",
    "Mare, maria": "#3a9742",
    "Mons, montes": "#fdc010",
    "Rima, rimae": "#ee5cf8",
    "Vallis, valles": "#0ae442",
    "Dorsum, dorsa": "#f88d96",
    "Catena, catenae": "#9b48fb",
    "Promontorium, promontoria": "#bd9121",
    "Oceanus, oceani": "#44e1f9",
    "Palus, paludes": "#af609f",
    "Planitia, planitiae": "#e13a01",
    "Satellite Feature": "#b0a2fe",
});

export const LUNAR_FEATURE_FALLBACK_COLOR = "#6fa7dc";

function parseHexColor(hex) {
    const normalized = String(hex || "").trim().replace(/^#/, "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16),
    };
}

function formatHexColor({ r, g, b }) {
    const toHex = (component) =>
        Math.round(Math.min(255, Math.max(0, component)))
            .toString(16)
            .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHexColors(sourceHex, targetHex, amount) {
    const source = parseHexColor(sourceHex);
    const target = parseHexColor(targetHex);
    if (!source || !target) return sourceHex;
    const ratio = Math.min(1, Math.max(0, Number(amount) || 0));
    return formatHexColor({
        r: source.r + (target.r - source.r) * ratio,
        g: source.g + (target.g - source.g) * ratio,
        b: source.b + (target.b - source.b) * ratio,
    });
}

export function getLunarFeatureTypeColor(featureType) {
    return LUNAR_FEATURE_TYPE_COLORS[featureType] || LUNAR_FEATURE_FALLBACK_COLOR;
}

export function getLunarFeatureBoundaryColor(featureType, { sunlit = true, hover = false } = {}) {
    let color = getLunarFeatureTypeColor(featureType);
    if (sunlit === false) {
        color = mixHexColors(color, "#ffffff", 0.24);
    }
    if (hover === true) {
        color = mixHexColors(color, "#ffffff", sunlit === false ? 0.14 : 0.1);
    }
    return color;
}
