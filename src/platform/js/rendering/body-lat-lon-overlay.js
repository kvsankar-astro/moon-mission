import * as THREE from "three";

const DEFAULT_GRID_STEP_DEGREES = 10;
const GRID_SEGMENTS = 144;
const GRID_RADIUS_SCALE = 1.0025;
const LABEL_RADIUS_SCALE = 1.035;
const HOVER_RADIUS_SCALE = 1.018;
const HOVER_TANGENT_OFFSET_SCALE = 0.055;
const LABEL_MIN_INTERVAL_DEGREES = 10;
const LABEL_MIN_SCREEN_RADIUS_PX = 160;
const STEPS_BY_SCREEN_RADIUS = Object.freeze([
    { minScreenRadiusPx: 620, stepDegrees: 5 },
    { minScreenRadiusPx: 280, stepDegrees: 10 },
    { minScreenRadiusPx: 130, stepDegrees: 20 },
    { minScreenRadiusPx: 0, stepDegrees: 30 },
]);

function latLonPoint(radius, latitudeDeg, longitudeDeg) {
    const lat = THREE.MathUtils.degToRad(latitudeDeg);
    const lon = THREE.MathUtils.degToRad(displayLongitudeToRenderLongitude(longitudeDeg));
    const cosLat = Math.cos(lat);
    return new THREE.Vector3(
        radius * cosLat * Math.sin(lon),
        radius * cosLat * Math.cos(lon),
        radius * Math.sin(lat),
    );
}

function displayLongitudeToRenderLongitude(longitudeDeg) {
    return 90 - Number(longitudeDeg);
}

function renderLongitudeToDisplayLongitude(longitudeDeg) {
    const normalized = 90 - Number(longitudeDeg);
    if (!Number.isFinite(normalized)) return 0;
    return THREE.MathUtils.euclideanModulo(normalized + 180, 360) - 180;
}

function pushLineVertexPair(vertices, start, end) {
    vertices.push(start.x, start.y, start.z, end.x, end.y, end.z);
}

function buildLatitudeLineVertices(radius, latitudeDeg, segments = GRID_SEGMENTS) {
    const vertices = [];
    for (let i = 0; i < segments; i += 1) {
        const lon0 = -180 + (360 * i / segments);
        const lon1 = -180 + (360 * (i + 1) / segments);
        pushLineVertexPair(
            vertices,
            latLonPoint(radius, latitudeDeg, lon0),
            latLonPoint(radius, latitudeDeg, lon1),
        );
    }
    return vertices;
}

function buildLongitudeLineVertices(radius, longitudeDeg, segments = GRID_SEGMENTS) {
    const vertices = [];
    for (let i = 0; i < segments; i += 1) {
        const lat0 = -90 + (180 * i / segments);
        const lat1 = -90 + (180 * (i + 1) / segments);
        pushLineVertexPair(
            vertices,
            latLonPoint(radius, lat0, longitudeDeg),
            latLonPoint(radius, lat1, longitudeDeg),
        );
    }
    return vertices;
}

function createLineSegmentsFromVertices(vertices, material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return new THREE.LineSegments(geometry, material);
}

function normalizeGridStep(stepDegrees) {
    const candidate = Number(stepDegrees);
    if ([5, 10, 20, 30].includes(candidate)) {
        return candidate;
    }
    return DEFAULT_GRID_STEP_DEGREES;
}

function resolveGridStepFromScreenRadius(screenRadiusPx) {
    const radiusPx = Number(screenRadiusPx);
    if (!Number.isFinite(radiusPx)) {
        return DEFAULT_GRID_STEP_DEGREES;
    }
    const match = STEPS_BY_SCREEN_RADIUS.find(
        (entry) => radiusPx >= entry.minScreenRadiusPx,
    );
    return match?.stepDegrees ?? DEFAULT_GRID_STEP_DEGREES;
}

function resolveHoverCoordinateDecimals(screenRadiusPx) {
    const radiusPx = Number(screenRadiusPx);
    if (!Number.isFinite(radiusPx)) {
        return 0;
    }
    if (radiusPx >= 780) return 2;
    if (radiusPx >= 420) return 1;
    return 0;
}

function formatCoordinate(value, positiveSuffix, negativeSuffix, zeroLabel = "0") {
    const degrees = Math.round(Number(value));
    if (!Number.isFinite(degrees) || degrees === 0) {
        return zeroLabel;
    }
    return `${Math.abs(degrees)}°${degrees > 0 ? positiveSuffix : negativeSuffix}`;
}

function formatHoverCoordinate(value, positiveSuffix, negativeSuffix, decimals = 0) {
    const candidate = Number(value);
    if (!Number.isFinite(candidate)) {
        return "0°";
    }
    const precision = Math.max(0, Math.min(2, Number(decimals) || 0));
    const rounded = precision > 0
        ? Number(candidate.toFixed(precision))
        : Math.round(candidate);
    if (Object.is(rounded, -0) || rounded === 0) {
        return precision > 0 ? `${(0).toFixed(precision)}°` : "0°";
    }
    const magnitude = precision > 0 ? Math.abs(rounded).toFixed(precision) : String(Math.abs(rounded));
    return `${magnitude}°${rounded > 0 ? positiveSuffix : negativeSuffix}`;
}

function clampLabelLatitude(latitudeDeg) {
    return THREE.MathUtils.clamp(Number(latitudeDeg) || 0, -84, 84);
}

function resolveLatitudeLabelAnchor(radius, latitudeDeg, cameraDirectionLocal) {
    const lat = clampLabelLatitude(latitudeDeg);
    const xyLength = Math.hypot(cameraDirectionLocal.x, cameraDirectionLocal.y);
    const longitudeDeg = xyLength > 1e-5
        ? renderLongitudeToDisplayLongitude(THREE.MathUtils.radToDeg(Math.atan2(cameraDirectionLocal.x, cameraDirectionLocal.y)))
        : 0;
    const normal = latLonPoint(1, lat, longitudeDeg).normalize();
    return {
        position: latLonPoint(radius, lat, longitudeDeg),
        facing: normal.dot(cameraDirectionLocal),
    };
}

function resolveLongitudeLabelAnchor(radius, longitudeDeg, cameraDirectionLocal) {
    const lonRad = THREE.MathUtils.degToRad(displayLongitudeToRenderLongitude(longitudeDeg));
    const horizontalDirection = new THREE.Vector3(Math.sin(lonRad), Math.cos(lonRad), 0);
    const horizontalDot = horizontalDirection.dot(cameraDirectionLocal);
    const latitudeDeg = clampLabelLatitude(
        THREE.MathUtils.radToDeg(Math.atan2(cameraDirectionLocal.z, horizontalDot)),
    );
    const normal = latLonPoint(1, latitudeDeg, longitudeDeg).normalize();
    return {
        position: latLonPoint(radius, latitudeDeg, longitudeDeg),
        facing: normal.dot(cameraDirectionLocal),
    };
}

function resolveHoverLabelOffsetPosition({
    radius,
    latitudeDeg,
    longitudeDeg,
    camera,
    container,
}) {
    const normal = latLonPoint(1, latitudeDeg, longitudeDeg).normalize();
    const position = latLonPoint(radius * HOVER_RADIUS_SCALE, latitudeDeg, longitudeDeg);
    const cameraQuaternion = new THREE.Quaternion();
    const containerQuaternion = new THREE.Quaternion();
    const inverseContainerQuaternion = new THREE.Quaternion();
    camera?.getWorldQuaternion?.(cameraQuaternion);
    container?.getWorldQuaternion?.(containerQuaternion);
    inverseContainerQuaternion.copy(containerQuaternion).invert();

    const screenUpLocal = new THREE.Vector3(0, 1, 0)
        .applyQuaternion(cameraQuaternion)
        .applyQuaternion(inverseContainerQuaternion)
        .normalize();
    let tangent = screenUpLocal.sub(normal.clone().multiplyScalar(screenUpLocal.dot(normal)));
    if (tangent.lengthSq() < 1e-6) {
        tangent = new THREE.Vector3(1, 0, 0).sub(normal.clone().multiplyScalar(normal.x));
    }
    if (tangent.lengthSq() < 1e-6) {
        tangent = new THREE.Vector3(0, 1, 0).sub(normal.clone().multiplyScalar(normal.y));
    }
    tangent.normalize();
    return position.add(tangent.multiplyScalar(radius * HOVER_TANGENT_OFFSET_SCALE));
}

function createCanvasTextSprite(text, {
    color = "#eef5ff",
    background = "rgba(5, 9, 16, 0.68)",
    border = "rgba(190, 215, 255, 0.46)",
    fontSize = 22,
    paddingX = 10,
    paddingY = 5,
} = {}) {
    const documentRef = globalThis?.document || null;
    const canvas = documentRef?.createElement?.("canvas") || null;
    const context = canvas?.getContext?.("2d") || null;
    if (!canvas || !context || typeof context.measureText !== "function") {
        return null;
    }

    context.font = `700 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
    const metrics = context.measureText(text);
    const width = Math.ceil(metrics.width + paddingX * 2);
    const height = Math.ceil(fontSize + paddingY * 2);
    canvas.width = Math.max(2, width);
    canvas.height = Math.max(2, height);

    context.font = `700 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = background;
    context.strokeStyle = border;
    context.lineWidth = 2;
    const radius = 6;
    const right = canvas.width - 1;
    const bottom = canvas.height - 1;
    context.beginPath();
    context.moveTo(radius, 1);
    context.lineTo(right - radius, 1);
    context.quadraticCurveTo(right, 1, right, radius);
    context.lineTo(right, bottom - radius);
    context.quadraticCurveTo(right, bottom, right - radius, bottom);
    context.lineTo(radius, bottom);
    context.quadraticCurveTo(1, bottom, 1, bottom - radius);
    context.lineTo(1, radius);
    context.quadraticCurveTo(1, 1, radius, 1);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.userData.labelPixelWidth = canvas.width;
    sprite.userData.labelPixelHeight = canvas.height;
    sprite.userData.labelText = text;
    sprite.renderOrder = 4;
    return sprite;
}

function replaceCanvasTextSpriteMaterial(sprite, text, options = {}) {
    if (!sprite) return false;
    const nextSprite = createCanvasTextSprite(text, options);
    if (!nextSprite) return false;
    const previousMaterial = sprite.material;
    sprite.material = nextSprite.material;
    sprite.userData.labelPixelWidth = nextSprite.userData.labelPixelWidth;
    sprite.userData.labelPixelHeight = nextSprite.userData.labelPixelHeight;
    sprite.userData.labelText = text;
    previousMaterial?.map?.dispose?.();
    previousMaterial?.dispose?.();
    return true;
}

function disposeObjectMaterialAndGeometry(object) {
    object?.geometry?.dispose?.();
    const material = object?.material;
    if (Array.isArray(material)) {
        material.forEach((entry) => {
            entry?.map?.dispose?.();
            entry?.dispose?.();
        });
        return;
    }
    material?.map?.dispose?.();
    material?.dispose?.();
}

export class BodyLatLonOverlay {
    constructor({
        bodyName = "body",
        radius,
        mesh,
        container,
        longitudePositiveSuffix = "E",
        longitudeNegativeSuffix = "W",
        latitudePositiveSuffix = "N",
        latitudeNegativeSuffix = "S",
    }) {
        this.bodyName = bodyName;
        this.radius = radius;
        this.mesh = mesh;
        this.container = container;
        this.longitudePositiveSuffix = longitudePositiveSuffix;
        this.longitudeNegativeSuffix = longitudeNegativeSuffix;
        this.latitudePositiveSuffix = latitudePositiveSuffix;
        this.latitudeNegativeSuffix = latitudeNegativeSuffix;
        this.grid = null;
        this.labels = null;
        this.hoverLabel = null;
        this.gridStepDegrees = DEFAULT_GRID_STEP_DEGREES;
        this.gridVisible = false;
        this.labelsVisible = true;
        this.hoverEnabled = false;
        this.screenRadiusPx = 0;
        this.raycaster = new THREE.Raycaster();
        this.pointerNdc = new THREE.Vector2();
        this.hoverPoint = new THREE.Vector3();
    }

    create({ gridVisible = false, labelsVisible = true, hoverEnabled = false } = {}) {
        this.gridVisible = Boolean(gridVisible);
        this.labelsVisible = labelsVisible !== false;
        this.hoverEnabled = Boolean(hoverEnabled);
        this.rebuildGrid(this.gridStepDegrees);
        if (this.hoverEnabled) {
            this._createHoverLabel();
        }
        if (this.hoverLabel) {
            this.container?.add?.(this.hoverLabel);
        }
    }

    _createGrid({ visible = false, labelsVisible = true, stepDegrees = DEFAULT_GRID_STEP_DEGREES } = {}) {
        const normalizedStep = normalizeGridStep(stepDegrees);
        const gridGroup = new THREE.Group();
        gridGroup.name = `${this.bodyName}-lat-lon-grid`;
        gridGroup.visible = visible;
        gridGroup.renderOrder = 3;
        this.gridStepDegrees = normalizedStep;

        const gridRadius = this.radius * GRID_RADIUS_SCALE;
        const minorVertices = [];
        const equatorVertices = [];
        const primeMeridianVertices = [];
        for (let lat = -90 + normalizedStep; lat < 90; lat += normalizedStep) {
            const target = lat === 0 ? equatorVertices : minorVertices;
            target.push(...buildLatitudeLineVertices(gridRadius, lat));
        }
        for (let lon = -180; lon < 180; lon += normalizedStep) {
            const target = lon === 0 ? primeMeridianVertices : minorVertices;
            target.push(...buildLongitudeLineVertices(gridRadius, lon));
        }

        const minorMaterial = new THREE.LineBasicMaterial({
            color: 0xd9e2f2,
            transparent: true,
            opacity: 0.34,
            depthTest: true,
            depthWrite: false,
        });
        const equatorMaterial = new THREE.LineBasicMaterial({
            color: 0xff4d5f,
            transparent: true,
            opacity: 0.74,
            depthTest: true,
            depthWrite: false,
        });
        const primeMeridianMaterial = new THREE.LineBasicMaterial({
            color: 0x5977ff,
            transparent: true,
            opacity: 0.82,
            depthTest: true,
            depthWrite: false,
        });

        gridGroup.add(createLineSegmentsFromVertices(minorVertices, minorMaterial));
        gridGroup.add(createLineSegmentsFromVertices(equatorVertices, equatorMaterial));
        gridGroup.add(createLineSegmentsFromVertices(primeMeridianVertices, primeMeridianMaterial));
        this.grid = gridGroup;
        this.labels = visible && labelsVisible
            ? this._createLabels({ visible: true, stepDegrees: normalizedStep })
            : null;
    }

    _createLabels({ visible = false, stepDegrees = DEFAULT_GRID_STEP_DEGREES } = {}) {
        const labelGroup = new THREE.Group();
        labelGroup.name = `${this.bodyName}-lat-lon-labels`;
        labelGroup.visible = visible;
        labelGroup.renderOrder = 4;

        const labelRadius = this.radius * LABEL_RADIUS_SCALE;
        const labelInterval = Math.max(
            LABEL_MIN_INTERVAL_DEGREES,
            normalizeGridStep(stepDegrees),
        );
        const labelSpecs = [];

        for (let lat = -90 + labelInterval; lat < 90; lat += labelInterval) {
            if (lat === 0) {
                labelSpecs.push({
                    text: "Equator",
                    position: latLonPoint(labelRadius, 0, -12),
                    color: "#ffd7dc",
                    kind: "latitude",
                    latitudeDeg: 0,
                });
                continue;
            }
            labelSpecs.push({
                text: formatCoordinate(lat, this.latitudePositiveSuffix, this.latitudeNegativeSuffix),
                position: latLonPoint(labelRadius, lat, 0),
                kind: "latitude",
                latitudeDeg: lat,
            });
        }

        for (let lon = -180 + labelInterval; lon < 180; lon += labelInterval) {
            if (lon === 0) {
                labelSpecs.push({
                    text: "Prime",
                    position: latLonPoint(labelRadius, 10, 0),
                    color: "#dbe4ff",
                    kind: "longitude",
                    longitudeDeg: 0,
                });
                continue;
            }
            labelSpecs.push({
                text: formatCoordinate(lon, this.longitudePositiveSuffix, this.longitudeNegativeSuffix),
                position: latLonPoint(labelRadius, 0, lon),
                kind: "longitude",
                longitudeDeg: lon,
            });
        }

        labelSpecs.forEach((spec) => {
            const sprite = createCanvasTextSprite(spec.text, {
                color: spec.color || "#eef5ff",
            });
            if (!sprite) return;
            sprite.position.copy(spec.position);
            sprite.userData.latLonLabelKind = spec.kind;
            sprite.userData.latitudeDeg = spec.latitudeDeg;
            sprite.userData.longitudeDeg = spec.longitudeDeg;
            labelGroup.add(sprite);
        });

        return labelGroup;
    }

    _createHoverLabel() {
        const sprite = createCanvasTextSprite("0°N 0°E", {
            color: "#f8fbff",
            background: "rgba(7, 12, 20, 0.82)",
            border: "rgba(230, 245, 255, 0.62)",
            fontSize: 24,
            paddingX: 12,
            paddingY: 6,
        });
        if (!sprite) {
            this.hoverLabel = null;
            return;
        }
        sprite.name = `${this.bodyName}-lat-lon-hover-label`;
        sprite.visible = false;
        this.hoverLabel = sprite;
    }

    setGridVisible(visible) {
        this.gridVisible = Boolean(visible);
        this._syncVisibility();
    }

    setLabelsVisible(visible) {
        this.labelsVisible = Boolean(visible);
        this._syncVisibility();
    }

    setHoverEnabled(enabled) {
        this.hoverEnabled = Boolean(enabled);
        if (this.hoverEnabled && !this.hoverLabel) {
            this._createHoverLabel();
            if (this.container && this.hoverLabel) {
                this.container.add(this.hoverLabel);
            }
        }
        if (!this.hoverEnabled && this.hoverLabel) {
            this.hoverLabel.visible = false;
        }
    }

    _syncVisibility() {
        if (this.grid) {
            this.grid.visible = this.gridVisible;
        }
        if (this.gridVisible && this.labelsVisible && !this.labels) {
            this.rebuildGrid(this.gridStepDegrees);
            return;
        }
        if (this.labels) {
            this.labels.visible = this.gridVisible && this.labelsVisible;
        }
    }

    _disposeGridAndLabels() {
        if (this.grid) {
            this.grid.traverse((child) => {
                disposeObjectMaterialAndGeometry(child);
            });
            this.container?.remove?.(this.grid);
            this.grid = null;
        }
        if (this.labels) {
            this.labels.traverse((child) => {
                disposeObjectMaterialAndGeometry(child);
            });
            this.container?.remove?.(this.labels);
            this.labels = null;
        }
    }

    rebuildGrid(stepDegrees = DEFAULT_GRID_STEP_DEGREES) {
        const normalizedStep = normalizeGridStep(stepDegrees);
        if (
            normalizedStep === this.gridStepDegrees &&
            this.grid &&
            (this.labels || !this.gridVisible || !this.labelsVisible)
        ) {
            this._syncVisibility();
            return false;
        }
        this._disposeGridAndLabels();
        this._createGrid({
            visible: this.gridVisible,
            labelsVisible: this.labelsVisible,
            stepDegrees: normalizedStep,
        });
        if (this.container && this.grid) {
            this.container.add(this.grid);
        }
        if (this.container && this.labels) {
            this.container.add(this.labels);
        }
        this._syncVisibility();
        return true;
    }

    updateForCamera({ camera = null, rendererDomElement = null } = {}) {
        if (!camera || !this.container) {
            return false;
        }
        const bodyWorldPosition = new THREE.Vector3();
        this.container.getWorldPosition(bodyWorldPosition);
        const cameraWorldPosition = new THREE.Vector3();
        camera.getWorldPosition?.(cameraWorldPosition);
        const distance = cameraWorldPosition.distanceTo(bodyWorldPosition);
        const viewportHeight = Math.max(1, Number(rendererDomElement?.clientHeight) || 720);
        const fov = Number(camera.fov);
        const visibleWorldHeight = Number.isFinite(fov)
            ? 2 * distance * Math.tan(THREE.MathUtils.degToRad(fov) / 2)
            : Math.max(1, camera.top - camera.bottom);
        const screenRadiusPx = visibleWorldHeight > 0
            ? (this.radius / visibleWorldHeight) * viewportHeight
            : 0;
        const nextStep = resolveGridStepFromScreenRadius(screenRadiusPx);
        this.screenRadiusPx = screenRadiusPx;
        const rebuilt = this.rebuildGrid(nextStep);
        this._updateLabelScales({ camera, rendererDomElement });
        return rebuilt;
    }

    getScreenRadiusPx({ camera = null, rendererDomElement = null } = {}) {
        if (!camera || !this.container) {
            return Number(this.screenRadiusPx) || 0;
        }
        const bodyWorldPosition = new THREE.Vector3();
        this.container.getWorldPosition(bodyWorldPosition);
        const cameraWorldPosition = new THREE.Vector3();
        camera.getWorldPosition?.(cameraWorldPosition);
        const distance = cameraWorldPosition.distanceTo(bodyWorldPosition);
        const viewportHeight = Math.max(1, Number(rendererDomElement?.clientHeight) || 720);
        const fov = Number(camera.fov);
        const visibleWorldHeight = Number.isFinite(fov)
            ? 2 * distance * Math.tan(THREE.MathUtils.degToRad(fov) / 2)
            : Math.max(1, camera.top - camera.bottom);
        return visibleWorldHeight > 0
            ? (this.radius / visibleWorldHeight) * viewportHeight
            : 0;
    }

    _updateLabelScales({ camera = null, rendererDomElement = null } = {}) {
        if (!camera) return;
        const viewportHeight = Math.max(1, Number(rendererDomElement?.clientHeight) || 720);
        const fov = Number(camera.fov);
        const bodyWorldPosition = new THREE.Vector3();
        const cameraWorld = new THREE.Vector3();
        this.container?.getWorldPosition?.(bodyWorldPosition);
        camera.getWorldPosition?.(cameraWorld);
        const labelsReadable = (Number(this.screenRadiusPx) || 0) >= LABEL_MIN_SCREEN_RADIUS_PX;
        if (this.labels) {
            this.labels.visible = this.gridVisible && this.labelsVisible && labelsReadable;
            if (!this.labels.visible && !this.hoverLabel?.visible) {
                return;
            }
        }
        const cameraDirectionFromBody = cameraWorld.clone().sub(bodyWorldPosition).normalize();
        const cameraLocalPosition = cameraWorld.clone();
        this.container?.worldToLocal?.(cameraLocalPosition);
        const cameraDirectionLocal = cameraLocalPosition.normalize();
        const labelRadius = this.radius * LABEL_RADIUS_SCALE;
        const updateSpriteScale = (sprite, targetPixelHeight = 18) => {
            if (!sprite?.getWorldPosition) return;
            if (sprite.parent === this.labels) {
                const kind = sprite.userData.latLonLabelKind;
                const anchor = kind === "latitude"
                    ? resolveLatitudeLabelAnchor(labelRadius, sprite.userData.latitudeDeg, cameraDirectionLocal)
                    : kind === "longitude"
                        ? resolveLongitudeLabelAnchor(labelRadius, sprite.userData.longitudeDeg, cameraDirectionLocal)
                        : null;
                if (anchor) {
                    sprite.position.copy(anchor.position);
                    sprite.visible = anchor.facing > -0.03;
                    if (!sprite.visible) return;
                }
            }
            const spriteWorld = new THREE.Vector3();
            sprite.getWorldPosition(spriteWorld);
            const spriteDirectionFromBody = spriteWorld.clone().sub(bodyWorldPosition).normalize();
            const isFrontSide = spriteDirectionFromBody.dot(cameraDirectionFromBody) > -0.03;
            if (sprite.parent === this.labels) {
                sprite.visible = sprite.visible !== false && isFrontSide;
                if (!isFrontSide) return;
            }
            const distance = Math.max(1e-6, cameraWorld.distanceTo(spriteWorld));
            const visibleWorldHeight = Number.isFinite(fov)
                ? 2 * distance * Math.tan(THREE.MathUtils.degToRad(fov) / 2)
                : Math.max(1, camera.top - camera.bottom);
            const worldHeight = visibleWorldHeight * (targetPixelHeight / viewportHeight);
            const aspect = Math.max(
                1,
                Number(sprite.userData.labelPixelWidth) / Math.max(1, Number(sprite.userData.labelPixelHeight)),
            );
            sprite.scale.set(worldHeight * aspect, worldHeight, 1);
        };

        this.labels?.children?.forEach?.((sprite) => {
            updateSpriteScale(sprite, 17);
        });
        if (this.hoverLabel?.visible) {
            updateSpriteScale(this.hoverLabel, 24);
        }
    }

    updateHoverFromPointer({
        camera = null,
        rendererDomElement = null,
        clientX = null,
        clientY = null,
    } = {}) {
        if (!this.hoverEnabled || !this.mesh || !this.container || !camera || !rendererDomElement) {
            return this.hideHover();
        }
        const rect = rendererDomElement.getBoundingClientRect?.() || null;
        const width = Number(rect?.width) || Number(rendererDomElement.clientWidth) || 0;
        const height = Number(rect?.height) || Number(rendererDomElement.clientHeight) || 0;
        if (!width || !height || !Number.isFinite(Number(clientX)) || !Number.isFinite(Number(clientY))) {
            return this.hideHover();
        }

        this.pointerNdc.set(
            ((Number(clientX) - (Number(rect?.left) || 0)) / width) * 2 - 1,
            -(((Number(clientY) - (Number(rect?.top) || 0)) / height) * 2 - 1),
        );
        this.raycaster.setFromCamera(this.pointerNdc, camera);
        const [hit] = this.raycaster.intersectObject(this.mesh, false);
        if (!hit?.point) {
            return this.hideHover();
        }

        this.hoverPoint.copy(hit.point);
        this.container.worldToLocal(this.hoverPoint);
        const radius = Math.max(1e-6, this.hoverPoint.length());
        const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(this.hoverPoint.z / radius, -1, 1)));
        const lon = renderLongitudeToDisplayLongitude(THREE.MathUtils.radToDeg(Math.atan2(this.hoverPoint.x, this.hoverPoint.y)));
        const hoverPosition = resolveHoverLabelOffsetPosition({
            radius: this.radius,
            latitudeDeg: lat,
            longitudeDeg: lon,
            camera,
            container: this.container,
        });
        const screenRadiusPx = this.getScreenRadiusPx({ camera, rendererDomElement });
        const hoverDecimals = resolveHoverCoordinateDecimals(screenRadiusPx);
        const label = `${formatHoverCoordinate(lat, this.latitudePositiveSuffix, this.latitudeNegativeSuffix, hoverDecimals)} ${formatHoverCoordinate(lon, this.longitudePositiveSuffix, this.longitudeNegativeSuffix, hoverDecimals)}`;
        if (this.hoverLabel?.userData?.labelText !== label) {
            replaceCanvasTextSpriteMaterial(this.hoverLabel, label, {
                color: "#f8fbff",
                background: "rgba(7, 12, 20, 0.82)",
                border: "rgba(230, 245, 255, 0.62)",
                fontSize: 24,
                paddingX: 12,
                paddingY: 6,
            });
        }
        if (this.hoverLabel) {
            this.hoverLabel.position.copy(hoverPosition);
            this.hoverLabel.visible = true;
            this._updateLabelScales({ camera, rendererDomElement });
        }
        return true;
    }

    hideHover() {
        if (!this.hoverLabel?.visible) {
            return false;
        }
        this.hoverLabel.visible = false;
        return true;
    }

    dispose() {
        this._disposeGridAndLabels();
        if (this.hoverLabel) {
            disposeObjectMaterialAndGeometry(this.hoverLabel);
            this.container?.remove?.(this.hoverLabel);
            this.hoverLabel = null;
        }
    }
}
