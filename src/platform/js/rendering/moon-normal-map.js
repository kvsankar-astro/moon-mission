import * as THREE from "three";
import { DataUtils } from "three";

export const DEFAULT_MOON_NORMAL_MAP_SETTINGS = Object.freeze({
    normalMapMaxWidth: 5760,
    normalMapStrength: 2.4,
    normalDetailBoost: 2.0,
    // detailRadius=4 is a compromise: wide enough that the boost doesn't
    // amplify single-pixel LDEM noise, narrow enough that micro-features in
    // smooth maria don't get smeared out (which read as "JPEG"-like blocky
    // artifacts at radius=5).
    normalDetailRadius: 4,
});

function resolveNormalMapSetting(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

export function buildMoonNormalMapFromHeightTexture(
    heightTexture,
    renderSettings = DEFAULT_MOON_NORMAL_MAP_SETTINGS,
) {
    const image = heightTexture?.image;
    if (!image || typeof document === "undefined") {
        return null;
    }

    const sourceWidth = Number(image.width) || 0;
    const sourceHeight = Number(image.height) || 0;
    if (sourceWidth < 2 || sourceHeight < 2) {
        return null;
    }

    let width = sourceWidth;
    let height = sourceHeight;
    const maxWidth = Math.max(
        512,
        Math.round(
            resolveNormalMapSetting(
                renderSettings?.normalMapMaxWidth,
                DEFAULT_MOON_NORMAL_MAP_SETTINGS.normalMapMaxWidth,
            ),
        ),
    );
    if (width > maxWidth) {
        const scale = maxWidth / width;
        width = maxWidth;
        height = Math.max(2, Math.round(height * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
        return null;
    }

    context.drawImage(image, 0, 0, width, height);
    const sourceData = context.getImageData(0, 0, width, height).data;
    const grayscale = new Float32Array(width * height);
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    for (let index = 0, pixel = 0; index < sourceData.length; index += 4, pixel += 1) {
        const r = sourceData[index] / 255;
        const g = sourceData[index + 1] / 255;
        const b = sourceData[index + 2] / 255;
        const heightValue = 0.299 * r + 0.587 * g + 0.114 * b;
        grayscale[pixel] = heightValue;
        if (heightValue < minHeight) {
            minHeight = heightValue;
        }
        if (heightValue > maxHeight) {
            maxHeight = heightValue;
        }
    }

    const invHeightRange = 1 / Math.max(1e-5, maxHeight - minHeight);
    // Half-float (16-bit) output instead of Uint8 (8-bit). With normalScale up
    // around 2.0+, 8-bit-per-channel quantization is visible as banding /
    // "JPEG"-look artifacts in flat regions where the gradient is small. Half
    // float gives ~10 bits of mantissa precision, eliminating the banding
    // without paying the 4x memory cost of Float32. Storage is still in the
    // 0..1 range (with the *0.5+0.5 encoding) so three.js's MeshStandardMaterial
    // normal-map unpacking (n*2-1) keeps working unchanged.
    const normalData = new Uint16Array(width * height * 4);
    const halfOne = DataUtils.toHalfFloat(1.0);
    const detailBoost = resolveNormalMapSetting(
        renderSettings?.normalDetailBoost,
        DEFAULT_MOON_NORMAL_MAP_SETTINGS.normalDetailBoost,
    );
    const detailRadius = Math.max(
        2,
        Math.round(
            resolveNormalMapSetting(
                renderSettings?.normalDetailRadius,
                DEFAULT_MOON_NORMAL_MAP_SETTINGS.normalDetailRadius,
            ),
        ),
    );
    const normalStrength = resolveNormalMapSetting(
        renderSettings?.normalMapStrength,
        DEFAULT_MOON_NORMAL_MAP_SETTINGS.normalMapStrength,
    );

    const sampleHeight = (x, y) => {
        const clampedX = Math.max(0, Math.min(width - 1, x));
        const clampedY = Math.max(0, Math.min(height - 1, y));
        const sample = grayscale[clampedY * width + clampedX];
        return (sample - minHeight) * invHeightRange;
    };

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const hL = sampleHeight(x - 1, y);
            const hR = sampleHeight(x + 1, y);
            const hU = sampleHeight(x, y - 1);
            const hD = sampleHeight(x, y + 1);
            const hLWide = sampleHeight(x - detailRadius, y);
            const hRWide = sampleHeight(x + detailRadius, y);
            const hUWide = sampleHeight(x, y - detailRadius);
            const hDWide = sampleHeight(x, y + detailRadius);
            const gradientXFine = hR - hL;
            const gradientYFine = hD - hU;
            const gradientXWide = (hRWide - hLWide) / detailRadius;
            const gradientYWide = (hDWide - hUWide) / detailRadius;
            const gradientX = gradientXWide + (gradientXFine - gradientXWide) * detailBoost;
            const gradientY = gradientYWide + (gradientYFine - gradientYWide) * detailBoost;

            // Image-space gradient -> tangent-space normal:
            //   image X axis runs +east  (matches +U / +tangent), so nx = -dh/du = -gradientX
            //   image Y axis runs +south (OPPOSITE of +V / +bitangent, because the texture
            //                             is uploaded with flipY=true, mapping image-row 0
            //                             to V=1 / north pole). So a height gradient in
            //                             image-Y direction has *opposite* sign to dh/dv.
            //                             ny = -dh/dv = -(-gradientY) = +gradientY.
            // Previously this used -1 * gradientY, encoding the bitangent direction
            // flipped, which mirrored the perturbed normal across the tangent-normal
            // plane and produced shadow plumes pointing 90deg off the sun direction
            // when the moon was viewed obliquely.
            let nx = -1 * gradientX * normalStrength;
            let ny = +1 * gradientY * normalStrength;
            let nz = 1.0;
            const invLen = 1 / Math.max(1e-8, Math.hypot(nx, ny, nz));
            nx *= invLen;
            ny *= invLen;
            nz *= invLen;

            const outIndex = (y * width + x) * 4;
            normalData[outIndex] = DataUtils.toHalfFloat(nx * 0.5 + 0.5);
            normalData[outIndex + 1] = DataUtils.toHalfFloat(ny * 0.5 + 0.5);
            normalData[outIndex + 2] = DataUtils.toHalfFloat(nz * 0.5 + 0.5);
            normalData[outIndex + 3] = halfOne;
        }
    }

    const normalTexture = new THREE.DataTexture(
        normalData,
        width,
        height,
        THREE.RGBAFormat,
        THREE.HalfFloatType,
    );
    normalTexture.wrapS = heightTexture.wrapS;
    normalTexture.wrapT = heightTexture.wrapT;
    normalTexture.magFilter = THREE.LinearFilter;
    normalTexture.minFilter = THREE.LinearMipmapLinearFilter;
    normalTexture.generateMipmaps = true;
    normalTexture.flipY = heightTexture?.flipY !== false;
    normalTexture.needsUpdate = true;
    return normalTexture;
}
