function clampMobileComposeEarthshineGain(value, {
    min = 0,
    max = 2.4,
    fallback = 1,
} = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
}

function buildMobileComposeEarthshineState({
    value,
    min = 0,
    max = 2.4,
} = {}) {
    const gain = clampMobileComposeEarthshineGain(value, { min, max });
    const text = gain.toFixed(2);
    return {
        gain,
        sliderValue: text,
        text,
    };
}

function normalizeMobileComposeRollRad(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    const twoPi = Math.PI * 2;
    return ((numeric % twoPi) + twoPi) % twoPi;
}

function formatMobileComposeRollLabel(degrees) {
    const normalized = ((Math.round(degrees) % 360) + 360) % 360;
    if (normalized === 0) return `N ${normalized}\u00b0`;
    if (normalized === 90) return `E ${normalized}\u00b0`;
    if (normalized === 180) return `S ${normalized}\u00b0`;
    if (normalized === 270) return `W ${normalized}\u00b0`;
    return `${normalized}\u00b0`;
}

function buildMobileComposeRollState({
    rollRad,
} = {}) {
    const normalizedRollRad = normalizeMobileComposeRollRad(rollRad);
    const degreesNormalized = (((normalizedRollRad * 180) / Math.PI) % 360 + 360) % 360;
    const roundedDegrees = Math.round(degreesNormalized) % 360;
    return {
        rollRad: normalizedRollRad,
        degrees: roundedDegrees,
        label: formatMobileComposeRollLabel(roundedDegrees),
    };
}

export {
    buildMobileComposeEarthshineState,
    buildMobileComposeRollState,
    clampMobileComposeEarthshineGain,
    formatMobileComposeRollLabel,
    normalizeMobileComposeRollRad,
};
