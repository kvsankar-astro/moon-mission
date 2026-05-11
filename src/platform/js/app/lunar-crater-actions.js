import lunarCraterCatalog from "../../../../assets/lunar-craters.json";

const CRATER_RING_SEGMENTS = 96;
const CRATER_RING_SURFACE_SCALE = 1.002;
const CRATER_HOVER_RING_SURFACE_SCALE = 1.004;
const CRATER_LABEL_SURFACE_SCALE = 1.11;
const CRATER_ALWAYS_LABEL_SURFACE_SCALE = 1.048;
const CRATER_RING_COLOR = 0x4f6f9f;
const CRATER_HOVER_RING_COLOR = CRATER_RING_COLOR;
const CRATER_LABEL_FILL_COLOR = "rgba(8, 13, 23, 0.72)";
const CRATER_LABEL_TEXT_COLOR = "#e8eef8";
const CRATER_LABEL_FONT_FAMILY = '"IBM Plex Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const CRATER_HOVER_LABEL_EDGE_GAP = 0.01;
const CRATER_HOVER_LABEL_SCREEN_GAP_MIN_PX = 4;
const CRATER_HOVER_LABEL_SCREEN_GAP_MAX_PX = 10;
const CRATER_HOVER_LABEL_SCREEN_GAP_RATIO = 0.08;
const CRATER_HOVER_LABEL_FALLBACK_RADIUS_MULTIPLIER = 1.7;
const CRATER_HOVER_LABEL_MAX_ANGULAR_OFFSET = 1.1;
const CRATER_LABEL_MAX_SCREEN_HEIGHT_PX = 36;
const CRATER_HOVER_LABEL_MAX_SCREEN_HEIGHT_PX = 36;
const DEFAULT_CRATER_LIMIT = 120;
const DEFAULT_CRATER_MIN_LIMIT = 25;
const DEFAULT_CRATER_MAX_LIMIT = 500;
const CRATER_DISPLAY_MODE_ALWAYS = "always";
const CRATER_DISPLAY_MODE_HOVER = "hover";

function createCanvas(width, height) {
    if (typeof document !== "undefined" && document.createElement) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    if (typeof OffscreenCanvas !== "undefined") {
        return new OffscreenCanvas(width, height);
    }
    return null;
}

function getCraterLimitBounds(catalog = lunarCraterCatalog) {
    const featureCount = Array.isArray(catalog?.features) ? catalog.features.length : DEFAULT_CRATER_MAX_LIMIT;
    const configuredMin = Number(catalog?.display?.minLimit);
    const configuredMax = Number(catalog?.display?.maxLimit);
    const configuredDefault = Number(catalog?.display?.defaultLimit);
    const minLimit = Number.isFinite(configuredMin) ? configuredMin : DEFAULT_CRATER_MIN_LIMIT;
    const maxLimit = Number.isFinite(configuredMax)
        ? Math.min(configuredMax, featureCount)
        : Math.min(DEFAULT_CRATER_MAX_LIMIT, featureCount);
    const defaultLimit = Number.isFinite(configuredDefault) ? configuredDefault : DEFAULT_CRATER_LIMIT;
    return {
        minLimit: Math.max(1, Math.min(minLimit, maxLimit)),
        maxLimit: Math.max(1, maxLimit),
        defaultLimit: Math.max(1, Math.min(defaultLimit, maxLimit)),
    };
}

function normalizeCraterDisplayLimit(value, catalog = lunarCraterCatalog) {
    const { minLimit, maxLimit, defaultLimit } = getCraterLimitBounds(catalog);
    const numericValue = Number(value);
    const nextValue = Number.isFinite(numericValue) ? numericValue : defaultLimit;
    return Math.max(minLimit, Math.min(maxLimit, Math.round(nextValue)));
}

function normalizeCraterDisplayMode(value) {
    return value === CRATER_DISPLAY_MODE_ALWAYS
        ? CRATER_DISPLAY_MODE_ALWAYS
        : CRATER_DISPLAY_MODE_HOVER;
}

function getValidCraterFeatures(catalog = lunarCraterCatalog) {
    return (catalog?.features || [])
        .filter((feature) =>
            Number.isFinite(feature?.latitudeDeg) &&
            Number.isFinite(feature?.longitudeDeg) &&
            Number.isFinite(feature?.diameterKm) &&
            typeof feature.name === "string" &&
            feature.name.trim(),
        )
        .sort((a, b) => b.diameterKm - a.diameterKm);
}

function getCraterDisplayFeatures(catalog = lunarCraterCatalog, options = {}) {
    const features = getValidCraterFeatures(catalog);
    if (options.includeAll === true) {
        return features;
    }
    const limit = normalizeCraterDisplayLimit(options.limit ?? catalog?.display?.defaultLimit, catalog);
    return features.slice(0, limit);
}

function buildCraterCirclePositions({
    THREE,
    normal,
    angularRadius,
    radius,
    segments = CRATER_RING_SEGMENTS,
}) {
    const centerNormal = normal.clone().normalize();
    const referenceAxis = Math.abs(centerNormal.z) > 0.92
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);
    const tangentA = new THREE.Vector3()
        .crossVectors(referenceAxis, centerNormal)
        .normalize();
    const tangentB = new THREE.Vector3()
        .crossVectors(centerNormal, tangentA)
        .normalize();
    const cosAngularRadius = Math.cos(angularRadius);
    const sinAngularRadius = Math.sin(angularRadius);
    const positions = [];

    for (let index = 0; index < segments; index += 1) {
        const theta = (index / segments) * Math.PI * 2;
        const point = centerNormal.clone().multiplyScalar(cosAngularRadius)
            .add(tangentA.clone().multiplyScalar(Math.cos(theta) * sinAngularRadius))
            .add(tangentB.clone().multiplyScalar(Math.sin(theta) * sinAngularRadius))
            .normalize()
            .multiplyScalar(radius);
        positions.push(point.x, point.y, point.z);
    }

    return positions;
}

function getCraterAngularRadius(crater, lunarRadiusKm) {
    return Math.max(
        0.0001,
        (crater.diameterKm * 0.5) / lunarRadiusKm,
    );
}

function createCraterRing({
    THREE,
    crater,
    normal,
    moonRadius,
    material,
    lunarRadiusKm,
    surfaceScale = CRATER_RING_SURFACE_SCALE,
    renderOrder = 8,
    namePrefix = "lunar-crater-ring",
}) {
    const angularRadius = getCraterAngularRadius(crater, lunarRadiusKm);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            buildCraterCirclePositions({
                THREE,
                normal,
                angularRadius,
                radius: moonRadius * surfaceScale,
            }),
            3,
        ),
    );

    const ring = new THREE.LineLoop(geometry, material);
    ring.name = `${namePrefix}:${crater.cleanName || crater.name}`;
    ring.renderOrder = renderOrder;
    ring.frustumCulled = false;
    ring.userData = {
        lunarCrater: true,
        name: crater.name,
        diameterKm: crater.diameterKm,
    };
    return ring;
}

function drawRoundedRect(context, x, y, width, height, radius) {
    const right = x + width;
    const bottom = y + height;
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(right - radius, y);
    context.quadraticCurveTo(right, y, right, y + radius);
    context.lineTo(right, bottom - radius);
    context.quadraticCurveTo(right, bottom, right - radius, bottom);
    context.lineTo(x + radius, bottom);
    context.quadraticCurveTo(x, bottom, x, bottom - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
}

function resolveCraterLabelNormal({
    THREE,
    normal,
    offsetAngularRadius = 0,
}) {
    const centerNormal = normal.clone().normalize();
    const numericOffset = Number(offsetAngularRadius);
    if (!Number.isFinite(numericOffset) || numericOffset <= 0) {
        return centerNormal;
    }

    const referenceAxis = Math.abs(centerNormal.z) > 0.88
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);
    const tangent = referenceAxis
        .sub(centerNormal.clone().multiplyScalar(referenceAxis.dot(centerNormal)));
    if (tangent.lengthSq() <= 1e-10) {
        return centerNormal;
    }
    tangent.normalize();

    return centerNormal
        .multiplyScalar(Math.cos(numericOffset))
        .add(tangent.multiplyScalar(Math.sin(numericOffset)))
        .normalize();
}

function createCraterLabelTexture(THREE, crater) {
    const canvas = createCanvas(448, 112);
    if (!canvas) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const label = `${crater.name}  ${Math.round(crater.diameterKm)} km`;

    context.clearRect(0, 0, canvas.width, canvas.height);
    drawRoundedRect(context, 10, 14, canvas.width - 20, canvas.height - 28, 18);
    context.fillStyle = CRATER_LABEL_FILL_COLOR;
    context.fill();

    context.textAlign = "center";
    context.textBaseline = "middle";
    let fontSize = 32;
    const maxTextWidth = canvas.width - 48;
    do {
        context.font = `400 ${fontSize}px ${CRATER_LABEL_FONT_FAMILY}`;
        fontSize -= 1;
    } while (fontSize > 15 && context.measureText(label).width > maxTextWidth);

    context.fillStyle = CRATER_LABEL_TEXT_COLOR;
    context.fillText(label, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) {
        texture.colorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding) {
        texture.encoding = THREE.sRGBEncoding;
    }
    texture.needsUpdate = true;
    return texture;
}

function getCameraViewportHeight(camera, rendererDomElement) {
    const viewportHeight = Number(rendererDomElement?.clientHeight || rendererDomElement?.height);
    if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
        return viewportHeight;
    }
    if (Number.isFinite(camera?.aspect) && camera.aspect > 0) {
        return 720;
    }
    return 1;
}

function getCameraViewportSize(camera, rendererDomElement) {
    const height = getCameraViewportHeight(camera, rendererDomElement);
    const viewportWidth = Number(rendererDomElement?.clientWidth || rendererDomElement?.width);
    if (Number.isFinite(viewportWidth) && viewportWidth > 0) {
        return { width: viewportWidth, height };
    }
    const aspect = Number(camera?.aspect);
    return {
        width: Number.isFinite(aspect) && aspect > 0 ? height * aspect : height,
        height,
    };
}

function calculateCraterLabelScaleRatio({
    camera,
    rendererDomElement = null,
    labelWorldHeight,
    labelWorldPosition,
    maxScreenHeightPx,
}) {
    const maxHeight = Number(maxScreenHeightPx);
    const baseHeight = Number(labelWorldHeight);
    if (!camera || !Number.isFinite(baseHeight) || baseHeight <= 0 || !Number.isFinite(maxHeight) || maxHeight <= 0) {
        return 1;
    }

    const viewportHeight = getCameraViewportHeight(camera, rendererDomElement);
    let pixelsPerWorldUnit = 0;

    if (camera.isPerspectiveCamera) {
        const distance = camera.position?.distanceTo?.(labelWorldPosition);
        if (!Number.isFinite(distance) || distance <= 0) {
            return 1;
        }
        const fovRadians = (Number(camera.fov) * Math.PI) / 180;
        const visibleHeight = 2 * distance * Math.tan(fovRadians / 2);
        pixelsPerWorldUnit = viewportHeight / visibleHeight;
    } else if (camera.isOrthographicCamera) {
        const top = Number(camera.top);
        const bottom = Number(camera.bottom);
        const zoom = Number(camera.zoom) || 1;
        const visibleHeight = (top - bottom) / zoom;
        pixelsPerWorldUnit = viewportHeight / visibleHeight;
    }

    if (!Number.isFinite(pixelsPerWorldUnit) || pixelsPerWorldUnit <= 0) {
        return 1;
    }

    const projectedHeight = baseHeight * pixelsPerWorldUnit;
    if (!Number.isFinite(projectedHeight) || projectedHeight <= maxHeight) {
        return 1;
    }
    return maxHeight / projectedHeight;
}

function calculateCraterLabelDimensions({
    crater,
    moonRadius,
    labelWidthMin,
    labelWidthMax,
    labelWidthBase,
    labelWidthPerNameChar,
}) {
    const labelWidth = moonRadius * Math.min(
        labelWidthMax,
        Math.max(labelWidthMin, labelWidthBase + crater.name.length * labelWidthPerNameChar),
    );
    const labelHeight = labelWidth * 0.25;
    return { labelWidth, labelHeight };
}

function calculateCraterHoverLabelOffset({
    angularRadius = 0,
    projectedCraterRadiusPx = null,
    labelScreenHeightPx = CRATER_HOVER_LABEL_MAX_SCREEN_HEIGHT_PX,
}) {
    const craterAngularRadius = Math.max(0, Number(angularRadius) || 0);
    const craterScreenRadius = Number(projectedCraterRadiusPx);
    const labelScreenHeight = Number(labelScreenHeightPx);
    if (
        Number.isFinite(craterScreenRadius) &&
        craterScreenRadius > 0 &&
        Number.isFinite(labelScreenHeight) &&
        labelScreenHeight > 0
    ) {
        const screenGapPx = Math.min(
            CRATER_HOVER_LABEL_SCREEN_GAP_MAX_PX,
            Math.max(CRATER_HOVER_LABEL_SCREEN_GAP_MIN_PX, craterScreenRadius * CRATER_HOVER_LABEL_SCREEN_GAP_RATIO),
        );
        const labelClearanceAngular = craterAngularRadius *
            ((labelScreenHeight * 0.5 + screenGapPx) / craterScreenRadius);
        return Math.min(
            CRATER_HOVER_LABEL_MAX_ANGULAR_OFFSET,
            craterAngularRadius + labelClearanceAngular,
        );
    }

    return Math.min(
        CRATER_HOVER_LABEL_MAX_ANGULAR_OFFSET,
        craterAngularRadius * CRATER_HOVER_LABEL_FALLBACK_RADIUS_MULTIPLIER + CRATER_HOVER_LABEL_EDGE_GAP,
    );
}

function projectMoonLocalNormalToScreen({
    scene,
    camera,
    rendererDomElement,
    normal,
    radius,
}) {
    if (!scene?.moonContainer || !camera || !normal) {
        return null;
    }
    const numericRadius = Number(radius);
    if (!Number.isFinite(numericRadius) || numericRadius <= 0) {
        return null;
    }
    const { width, height } = getCameraViewportSize(camera, rendererDomElement);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        return null;
    }

    const point = normal.clone().normalize().multiplyScalar(numericRadius);
    scene.moonContainer.localToWorld(point);
    point.project(camera);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return null;
    }
    return {
        x: (point.x * 0.5 + 0.5) * width,
        y: (-point.y * 0.5 + 0.5) * height,
    };
}

function calculateCraterProjectedRadiusPx({
    THREE,
    scene,
    camera,
    rendererDomElement,
    normal,
    angularRadius,
    moonRadius,
}) {
    const craterAngularRadius = Number(angularRadius);
    const numericMoonRadius = Number(moonRadius);
    if (
        !THREE ||
        !Number.isFinite(craterAngularRadius) ||
        craterAngularRadius <= 0 ||
        !Number.isFinite(numericMoonRadius) ||
        numericMoonRadius <= 0
    ) {
        return null;
    }

    const center = projectMoonLocalNormalToScreen({
        scene,
        camera,
        rendererDomElement,
        normal,
        radius: numericMoonRadius * CRATER_HOVER_RING_SURFACE_SCALE,
    });
    const edgeNormal = resolveCraterLabelNormal({
        THREE,
        normal,
        offsetAngularRadius: craterAngularRadius,
    });
    const edge = projectMoonLocalNormalToScreen({
        scene,
        camera,
        rendererDomElement,
        normal: edgeNormal,
        radius: numericMoonRadius * CRATER_HOVER_RING_SURFACE_SCALE,
    });
    if (!center || !edge) {
        return null;
    }
    const projectedRadius = Math.hypot(edge.x - center.x, edge.y - center.y);
    return Number.isFinite(projectedRadius) && projectedRadius > 0 ? projectedRadius : null;
}

function createCraterLabelSprite({
    THREE,
    crater,
    normal,
    moonRadius,
    surfaceScale = CRATER_LABEL_SURFACE_SCALE,
    depthTest = false,
    renderOrder = 20,
    namePrefix = "lunar-crater-hover-label",
    hoverLabel = true,
    labelWidthMin = 0.28,
    labelWidthMax = 0.58,
    labelWidthBase = 0.2,
    labelWidthPerNameChar = 0.015,
    offsetAngularRadius = 0,
}) {
    const texture = createCraterLabelTexture(THREE, crater);
    if (!texture) return null;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.98,
        depthTest,
        depthWrite: false,
    });
    const label = new THREE.Sprite(material);
    label.name = `${namePrefix}:${crater.cleanName || crater.name}`;
    const labelNormal = resolveCraterLabelNormal({
        THREE,
        normal,
        offsetAngularRadius,
    });
    label.position.copy(labelNormal).multiplyScalar(moonRadius * surfaceScale);
    const { labelWidth, labelHeight } = calculateCraterLabelDimensions({
        crater,
        moonRadius,
        labelWidthMin,
        labelWidthMax,
        labelWidthBase,
        labelWidthPerNameChar,
    });
    label.scale.set(labelWidth, labelHeight, 1);
    label.renderOrder = renderOrder;
    label.frustumCulled = false;
    label.userData = {
        lunarCrater: true,
        hoverLabel,
        offsetAngularRadius,
        baseScaleX: labelWidth,
        baseScaleY: labelHeight,
        name: crater.name,
        diameterKm: crater.diameterKm,
    };
    return label;
}

function disposeObjectResources(object, disposedMaterials, disposedTextures) {
    object.geometry?.dispose?.();

    const materials = Array.isArray(object.material)
        ? object.material
        : [object.material].filter(Boolean);
    for (const material of materials) {
        if (!material || disposedMaterials.has(material)) continue;
        if (material.map && !disposedTextures.has(material.map)) {
            material.map.dispose?.();
            disposedTextures.add(material.map);
        }
        material.dispose?.();
        disposedMaterials.add(material);
    }
}

function createLunarCraterActions({
    THREE,
    sphericalToCartesian,
    degreesToRadians,
    PC,
    getMoonRadius,
    getGlobalConfig,
    getViewLunarCraters,
    getLunarCraterLimit = () => DEFAULT_CRATER_LIMIT,
    getLunarCraterDisplayMode = () => CRATER_DISPLAY_MODE_HOVER,
    craterCatalog = lunarCraterCatalog,
}) {
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const surfaceNormal = new THREE.Vector3();
    const labelWorldPosition = new THREE.Vector3();

    function getLunarRadiusKm() {
        return Number.isFinite(PC?.MOON_RADIUS_KM)
            ? PC.MOON_RADIUS_KM
            : 1737.4;
    }

    function resolveDisplayLimit(scene) {
        const configuredLimit = Number.isFinite(scene?.lunarCraterDisplayLimit)
            ? scene.lunarCraterDisplayLimit
            : getLunarCraterLimit();
        return normalizeCraterDisplayLimit(configuredLimit, craterCatalog);
    }

    function resolveDisplayMode(scene) {
        return normalizeCraterDisplayMode(scene?.lunarCraterDisplayMode ?? getLunarCraterDisplayMode());
    }

    function buildCraterPickTarget({ crater, moonRadius, lunarRadiusKm }) {
        const position = sphericalToCartesian(
            moonRadius,
            degreesToRadians(crater.longitudeDeg),
            degreesToRadians(crater.latitudeDeg),
        );
        const centerNormal = new THREE.Vector3(position.x, position.y, position.z).normalize();
        return {
            crater,
            centerNormal,
            angularRadius: getCraterAngularRadius(crater, lunarRadiusKm),
        };
    }

    function ensureHoverLabel({
        scene,
        crater,
        normal,
        moonRadius,
        angularRadius = 0,
        projectedCraterRadiusPx = null,
    }) {
        const offsetAngularRadius = calculateCraterHoverLabelOffset({
            angularRadius,
            projectedCraterRadiusPx,
        });
        const needsNewLabel = !scene.lunarCraterHoverLabel ||
            scene.lunarCraterHoverLabel.userData?.name !== crater.name;
        if (needsNewLabel) {
            const previousLabel = scene.lunarCraterHoverLabel;
            if (previousLabel?.parent) {
                previousLabel.parent.remove(previousLabel);
            }
            if (previousLabel) {
                disposeObjectResources(previousLabel, new Set(), new Set());
            }
            scene.lunarCraterHoverLabel = createCraterLabelSprite({
                THREE,
                crater,
                normal,
                moonRadius,
                offsetAngularRadius,
            });
            if (scene.lunarCraterHoverLabel) {
                scene.lunarCraterGroup.add(scene.lunarCraterHoverLabel);
            }
        }
        if (!scene.lunarCraterHoverLabel) return;
        const labelNormal = resolveCraterLabelNormal({
            THREE,
            normal,
            offsetAngularRadius,
        });
        scene.lunarCraterHoverLabel.userData.offsetAngularRadius = offsetAngularRadius;
        scene.lunarCraterHoverLabel.position.copy(labelNormal).multiplyScalar(
            moonRadius * CRATER_LABEL_SURFACE_SCALE,
        );
        scene.lunarCraterHoverLabel.visible = true;
    }

    function ensureHoverRing({ scene, target, moonRadius, lunarRadiusKm }) {
        if (!scene.lunarCraterHoverMaterial) {
            scene.lunarCraterHoverMaterial = new THREE.LineBasicMaterial({
                color: CRATER_HOVER_RING_COLOR,
                transparent: true,
                opacity: 0.96,
                depthTest: false,
                depthWrite: false,
            });
            scene.lunarCraterGroup.userData.sharedMaterials.push(scene.lunarCraterHoverMaterial);
        }

        const nextRing = createCraterRing({
            THREE,
            crater: target.crater,
            normal: target.centerNormal,
            moonRadius,
            material: scene.lunarCraterHoverMaterial,
            lunarRadiusKm,
            surfaceScale: CRATER_HOVER_RING_SURFACE_SCALE,
            renderOrder: 19,
            namePrefix: "lunar-crater-hover-ring",
        });

        if (scene.lunarCraterHoverRing?.parent) {
            scene.lunarCraterHoverRing.parent.remove(scene.lunarCraterHoverRing);
        }
        scene.lunarCraterHoverRing?.geometry?.dispose?.();
        scene.lunarCraterHoverRing = nextRing;
        scene.lunarCraterGroup.add(nextRing);
    }

    function hideLunarCraterHover({ scene }) {
        let changed = false;
        if (scene?.lunarCraterHoverLabel?.visible) {
            scene.lunarCraterHoverLabel.visible = false;
            changed = true;
        }
        if (scene?.lunarCraterHoverRing?.visible) {
            scene.lunarCraterHoverRing.visible = false;
            changed = true;
        }
        if (scene && scene.lunarCraterHoveredName) {
            scene.lunarCraterHoveredName = null;
            scene.lunarCraterHoveredDiameterKm = null;
            changed = true;
        }
        return changed;
    }

    function findCraterTargetAtPointer({
        scene,
        camera,
        rendererDomElement,
        clientX,
        clientY,
    }) {
        if (!scene?.moon || !scene?.moonContainer || !camera || !rendererDomElement) {
            return null;
        }
        const rect = rendererDomElement.getBoundingClientRect?.();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return null;
        }

        pointerNdc.set(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -(((clientY - rect.top) / rect.height) * 2 - 1),
        );
        camera.updateMatrixWorld?.();
        raycaster.setFromCamera(pointerNdc, camera);

        const intersections = raycaster.intersectObject(scene.moon, true);
        if (!intersections.length) {
            return null;
        }

        surfaceNormal.copy(intersections[0].point);
        scene.moonContainer.worldToLocal(surfaceNormal);
        surfaceNormal.normalize();

        let bestTarget = null;
        let bestScore = Infinity;
        for (const target of scene.lunarCraterPickTargets || []) {
            const angle = surfaceNormal.angleTo(target.centerNormal);
            const pickPadding = Math.min(0.018, Math.max(0.002, target.angularRadius * 0.12));
            if (angle > target.angularRadius + pickPadding) {
                continue;
            }
            const score = target.angularRadius;
            if (score < bestScore) {
                bestTarget = target;
                bestScore = score;
            }
        }
        return bestTarget;
    }

    function addLunarCraterAnnotations({ scene }) {
        const globalConfig = getGlobalConfig();
        if (!scene || !globalConfig?.is_lunar || !scene.moonContainer) {
            return;
        }

        disposeLunarCraterAnnotations({ scene });

        const moonRadius = getMoonRadius();
        if (!Number.isFinite(moonRadius) || moonRadius <= 0) {
            return;
        }

        const lunarRadiusKm = getLunarRadiusKm();
        const displayLimit = resolveDisplayLimit(scene);
        const displayMode = resolveDisplayMode(scene);
        const shouldShowAlways = displayMode === CRATER_DISPLAY_MODE_ALWAYS;
        const group = new THREE.Group();
        group.name = "lunar-crater-annotations";
        group.visible = getViewLunarCraters() === true;
        group.userData.sharedMaterials = [];

        const annotations = [];
        const pickTargets = [];
        const craterFeatures = getCraterDisplayFeatures(craterCatalog, {
            includeAll: !shouldShowAlways,
            limit: displayLimit,
        });
        const ringMaterial = shouldShowAlways
            ? new THREE.LineBasicMaterial({
                color: CRATER_RING_COLOR,
                transparent: true,
                opacity: 0.92,
                depthTest: true,
                depthWrite: false,
            })
            : null;
        if (ringMaterial) {
            group.userData.sharedMaterials.push(ringMaterial);
        }

        for (const crater of craterFeatures) {
            const target = buildCraterPickTarget({ crater, moonRadius, lunarRadiusKm });
            pickTargets.push(target);
            if (!shouldShowAlways) {
                continue;
            }

            const ring = createCraterRing({
                THREE,
                crater,
                normal: target.centerNormal,
                moonRadius,
                material: ringMaterial,
                lunarRadiusKm,
            });
            const label = createCraterLabelSprite({
                THREE,
                crater,
                normal: target.centerNormal,
                moonRadius,
                surfaceScale: CRATER_ALWAYS_LABEL_SURFACE_SCALE,
                depthTest: true,
                renderOrder: 9,
                namePrefix: "lunar-crater-label",
                hoverLabel: false,
                labelWidthMin: 0.16,
                labelWidthMax: 0.36,
                labelWidthBase: 0.11,
                labelWidthPerNameChar: 0.008,
            });
            target.ring = ring;
            group.add(ring);
            annotations.push(ring);
            if (label) {
                group.add(label);
                annotations.push(label);
            }
        }

        scene.lunarCraterDisplayLimit = displayLimit;
        scene.lunarCraterDisplayMode = displayMode;
        scene.lunarCraterGroup = group;
        scene.lunarCraterAnnotations = annotations;
        scene.lunarCraterPickTargets = pickTargets;
        scene.lunarCraterHoverLabelsEnabled = displayMode === CRATER_DISPLAY_MODE_HOVER;
        scene.lunarCraterHoverLabel = null;
        scene.lunarCraterHoverRing = null;
        scene.lunarCraterHoverMaterial = null;
        scene.lunarCraterHoveredName = null;
        scene.lunarCraterHoveredDiameterKm = null;
        scene.moonContainer.add(group);
    }

    function disposeLunarCraterAnnotations({ scene }) {
        const group = scene?.lunarCraterGroup;
        if (!group) {
            if (scene) {
                scene.lunarCraterAnnotations = [];
                scene.lunarCraterPickTargets = [];
                scene.lunarCraterHoverLabel = null;
                scene.lunarCraterHoverRing = null;
                scene.lunarCraterHoverMaterial = null;
                scene.lunarCraterHoveredName = null;
                scene.lunarCraterHoveredDiameterKm = null;
            }
            return;
        }

        if (group.parent) {
            group.parent.remove(group);
        }

        const disposedMaterials = new Set();
        const disposedTextures = new Set();
        group.traverse((object) => {
            disposeObjectResources(object, disposedMaterials, disposedTextures);
        });
        for (const material of group.userData?.sharedMaterials || []) {
            if (!disposedMaterials.has(material)) {
                if (material.map && !disposedTextures.has(material.map)) {
                    material.map.dispose?.();
                    disposedTextures.add(material.map);
                }
                material.dispose?.();
                disposedMaterials.add(material);
            }
        }
        scene.lunarCraterGroup = null;
        scene.lunarCraterAnnotations = [];
        scene.lunarCraterPickTargets = [];
        scene.lunarCraterHoverLabel = null;
        scene.lunarCraterHoverRing = null;
        scene.lunarCraterHoverMaterial = null;
        scene.lunarCraterHoveredName = null;
        scene.lunarCraterHoveredDiameterKm = null;
    }

    function setLunarCraterAnnotationsVisible({ scene, visible }) {
        if (scene?.lunarCraterGroup) {
            scene.lunarCraterGroup.visible = visible === true;
            if (visible !== true) {
                hideLunarCraterHover({ scene });
            }
        }
    }

    function setLunarCraterDisplayLimit({ scene, limit }) {
        if (!scene) return false;
        const nextLimit = normalizeCraterDisplayLimit(limit, craterCatalog);
        if (scene.lunarCraterDisplayLimit === nextLimit) {
            return false;
        }
        scene.lunarCraterDisplayLimit = nextLimit;
        if (resolveDisplayMode(scene) === CRATER_DISPLAY_MODE_HOVER) {
            return false;
        }
        if (scene.moonContainer && getGlobalConfig()?.is_lunar) {
            addLunarCraterAnnotations({ scene });
            return true;
        }
        return false;
    }

    function setLunarCraterDisplayMode({ scene, mode }) {
        if (!scene) return false;
        const nextMode = normalizeCraterDisplayMode(mode);
        if (resolveDisplayMode(scene) === nextMode) {
            scene.lunarCraterDisplayMode = nextMode;
            return false;
        }
        scene.lunarCraterDisplayMode = nextMode;
        hideLunarCraterHover({ scene });
        if (scene.moonContainer && getGlobalConfig()?.is_lunar) {
            addLunarCraterAnnotations({ scene });
            return true;
        }
        return true;
    }

    function setLunarCraterHoverLabelsEnabled({ scene, enabled }) {
        if (!scene) return false;
        const nextEnabled = enabled !== false;
        const changed = scene.lunarCraterHoverLabelsEnabled !== nextEnabled;
        scene.lunarCraterHoverLabelsEnabled = nextEnabled;
        if (!nextEnabled) {
            return hideLunarCraterHover({ scene }) || changed;
        }
        return changed;
    }

    function updateLunarCraterLabelScales({ scene, camera, rendererDomElement = null }) {
        if (!scene?.lunarCraterGroup || !camera) {
            return false;
        }
        let changed = false;
        scene.lunarCraterGroup.traverse((object) => {
            if (!object?.userData?.lunarCrater || !Number.isFinite(object.userData.baseScaleY)) {
                return;
            }
            const baseScaleX = object.userData.baseScaleX;
            const baseScaleY = object.userData.baseScaleY;
            object.getWorldPosition(labelWorldPosition);
            const ratio = calculateCraterLabelScaleRatio({
                camera,
                rendererDomElement,
                labelWorldHeight: baseScaleY,
                labelWorldPosition,
                maxScreenHeightPx: object.userData.hoverLabel
                    ? CRATER_HOVER_LABEL_MAX_SCREEN_HEIGHT_PX
                    : CRATER_LABEL_MAX_SCREEN_HEIGHT_PX,
            });
            const nextScaleX = baseScaleX * ratio;
            const nextScaleY = baseScaleY * ratio;
            if (object.scale.x !== nextScaleX || object.scale.y !== nextScaleY) {
                object.scale.set(nextScaleX, nextScaleY, 1);
                changed = true;
            }
        });
        return changed;
    }

    function updateLunarCraterHoverFromPointer({
        scene,
        camera,
        rendererDomElement,
        clientX,
        clientY,
    }) {
        const displayMode = resolveDisplayMode(scene);
        if (
            !scene?.lunarCraterGroup?.visible ||
            displayMode !== CRATER_DISPLAY_MODE_HOVER ||
            scene.lunarCraterHoverLabelsEnabled === false
        ) {
            return hideLunarCraterHover({ scene });
        }

        const target = findCraterTargetAtPointer({
            scene,
            camera,
            rendererDomElement,
            clientX,
            clientY,
        });
        if (!target) {
            return hideLunarCraterHover({ scene });
        }

        const moonRadius = getMoonRadius();
        if (!Number.isFinite(moonRadius) || moonRadius <= 0) {
            return hideLunarCraterHover({ scene });
        }

        const projectedCraterRadiusPx = calculateCraterProjectedRadiusPx({
            THREE,
            scene,
            camera,
            rendererDomElement,
            normal: target.centerNormal,
            angularRadius: target.angularRadius,
            moonRadius,
        });
        const alreadyHovered = scene.lunarCraterHoveredName === target.crater.name;
        ensureHoverLabel({
            scene,
            crater: target.crater,
            normal: target.centerNormal,
            moonRadius,
            angularRadius: target.angularRadius,
            projectedCraterRadiusPx,
        });
        if (!alreadyHovered || !scene.lunarCraterHoverRing?.visible) {
            ensureHoverRing({
                scene,
                target,
                moonRadius,
                lunarRadiusKm: getLunarRadiusKm(),
            });
        }
        if (scene.lunarCraterHoverRing) {
            scene.lunarCraterHoverRing.visible = true;
        }
        scene.lunarCraterHoveredName = target.crater.name;
        scene.lunarCraterHoveredDiameterKm = target.crater.diameterKm;
        return !alreadyHovered;
    }

    return {
        addLunarCraterAnnotations,
        disposeLunarCraterAnnotations,
        hideLunarCraterHover,
        setLunarCraterAnnotationsVisible,
        setLunarCraterDisplayLimit,
        setLunarCraterDisplayMode,
        setLunarCraterHoverLabelsEnabled,
        updateLunarCraterLabelScales,
        updateLunarCraterHoverFromPointer,
    };
}

export {
    buildCraterCirclePositions,
    calculateCraterHoverLabelOffset,
    calculateCraterLabelScaleRatio,
    createLunarCraterActions,
    getCraterDisplayFeatures,
    normalizeCraterDisplayLimit,
};
