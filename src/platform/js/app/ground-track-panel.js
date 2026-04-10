import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const VIEW_MODE_2D = "map2d";
const VIEW_MODE_3D = "globe3d";
const MAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const MAP_TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const EARTH_TEXTURE_URL = "images/earth/2_no_clouds_8k.jpg";
const DEFAULT_MAP_CENTER = [12, 0];
const DEFAULT_MAP_ZOOM = 2;
const TRACK_WRAP_OFFSETS = [-360, 0, 360];
const PANEL_EDGE_MARGIN_PX = 8;
const PANEL_DEFAULT_LEFT_PX = 10;
const PANEL_DEFAULT_BOTTOM_GAP_PX = 12;
const GLOBE_RADIUS = 1.0;
const GLOBE_TRACK_ALTITUDE = 1.014;
const GLOBE_MARKER_ALTITUDE = 1.035;
const GLOBE_MIN_DISTANCE = 1.9;
const GLOBE_MAX_DISTANCE = 5.2;
const GLOBE_FOV_DEGREES = 32;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function dateToJulianDate(ms) {
    return (ms / 86400000) + 2440587.5;
}

function julianDateToGmstRadians(julianDate) {
    const t = (julianDate - 2451545.0) / 36525.0;
    const gmstDegrees = 280.46061837 +
        (360.98564736629 * (julianDate - 2451545.0)) +
        (0.000387933 * t * t) -
        ((t * t * t) / 38710000.0);
    const radians = (gmstDegrees * Math.PI) / 180;
    const twoPi = Math.PI * 2;
    let normalized = radians % twoPi;
    if (normalized < 0) normalized += twoPi;
    return normalized;
}

function normalizeBodyId(bodyId) {
    return String(bodyId || "").trim().toUpperCase();
}

function resolveTelemetryBodyId(sceneState) {
    const requested = normalizeBodyId(sceneState?.telemetryBodyId);
    if (requested) return requested;
    if (sceneState?.bodies?.SC) return "SC";
    for (const [bodyId, state] of Object.entries(sceneState?.bodies || {})) {
        const id = normalizeBodyId(bodyId);
        if (id === "EARTH" || id === "MOON" || id === "SUN") continue;
        if (state?.position) return id;
    }
    return "SC";
}

function hasVector(vector) {
    return !!vector &&
        Number.isFinite(vector.x) &&
        Number.isFinite(vector.y) &&
        Number.isFinite(vector.z);
}

function subtractVectors(a, b) {
    return {
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z,
    };
}

function eciToLatLonDegrees(vectorEci, timeMs) {
    if (!hasVector(vectorEci) || !Number.isFinite(timeMs)) return null;
    const gmst = julianDateToGmstRadians(dateToJulianDate(timeMs));
    const cosG = Math.cos(gmst);
    const sinG = Math.sin(gmst);
    const x = (vectorEci.x * cosG) + (vectorEci.y * sinG);
    const y = (-vectorEci.x * sinG) + (vectorEci.y * cosG);
    const z = vectorEci.z;
    const r = Math.hypot(x, y, z);
    if (!Number.isFinite(r) || r <= 1e-9) return null;
    const lat = Math.asin(clamp(z / r, -1, 1)) * (180 / Math.PI);
    const lon = Math.atan2(y, x) * (180 / Math.PI);
    return [lat, lon];
}

function unwrapTrackPoints(points) {
    const unwrapped = [];
    let previousLon = null;
    for (const point of points) {
        if (!Array.isArray(point) || point.length !== 2) continue;
        const lat = point[0];
        let lon = point[1];
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (Number.isFinite(previousLon)) {
            while ((lon - previousLon) > 180) lon -= 360;
            while ((lon - previousLon) < -180) lon += 360;
        }
        unwrapped.push([lat, lon]);
        previousLon = lon;
    }
    return unwrapped.length >= 2 ? [unwrapped] : [];
}

function duplicateWrappedSegments(segments, wrapOffsets = TRACK_WRAP_OFFSETS) {
    const repeated = [];
    for (const segment of segments) {
        if (!Array.isArray(segment) || segment.length < 2) continue;
        for (const offset of wrapOffsets) {
            repeated.push(segment.map(([lat, lon]) => [lat, lon + offset]));
        }
    }
    return repeated;
}

function wrapLongitudeNearReference(lon, referenceLon = 0) {
    if (!Number.isFinite(lon)) return lon;
    let wrapped = lon;
    while ((wrapped - referenceLon) > 180) wrapped -= 360;
    while ((wrapped - referenceLon) < -180) wrapped += 360;
    return wrapped;
}

function readCssPx(name, fallback = 0) {
    const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
}

function latLonToVector3(latDeg, lonDeg, radius = GLOBE_RADIUS) {
    const lat = THREE.MathUtils.degToRad(latDeg);
    const lon = THREE.MathUtils.degToRad(lonDeg);
    const cosLat = Math.cos(lat);
    return new THREE.Vector3(
        radius * cosLat * Math.cos(lon),
        radius * Math.sin(lat),
        radius * cosLat * Math.sin(lon),
    );
}

function disposeObject3D(object) {
    if (!object) return;
    if (object.geometry?.dispose) object.geometry.dispose();
    const material = object.material;
    if (Array.isArray(material)) {
        material.forEach((entry) => entry?.dispose?.());
    } else {
        material?.dispose?.();
    }
}

function createGroundTrackPanelActions() {
    let initialized = false;
    let map = null;
    let tileLayer = null;
    let marker = null;
    let trackLayerGroup = null;
    let currentTrackKey = "";
    let currentSegments = [];
    let currentLocation = null;
    let shadowRoot = null;
    let shadowShell = null;
    let mapHost = null;
    let globeHost = null;
    let resizeObserver = null;
    let latestPayload = null;
    let panelMode = VIEW_MODE_2D;
    let hasMapUserView = false;
    let hasGlobeUserView = false;
    let isProgrammaticMapViewChange = false;
    let isProgrammaticGlobeViewChange = false;
    let panelPosition = null;
    let dragState = null;
    const cacheByKey = new Map();
    const globeState = {
        renderer: null,
        scene: null,
        camera: null,
        controls: null,
        globeRoot: null,
        earthMesh: null,
        trackGroup: null,
        markerMesh: null,
        texturePromise: null,
    };

    const getNode = (id) => document.getElementById(id);

    function setStatus(text) {
        const node = getNode("ground-track-status");
        if (node) node.textContent = text;
    }

    function setCoords(text) {
        const node = getNode("ground-track-coords");
        if (node) node.textContent = text;
    }

    function updateModeButtons() {
        const button2d = getNode("ground-track-style-2d");
        const button3d = getNode("ground-track-style-3d");
        const is2D = panelMode === VIEW_MODE_2D;
        button2d?.classList.toggle("is-active", is2D);
        button3d?.classList.toggle("is-active", !is2D);
        button2d?.setAttribute("aria-pressed", is2D ? "true" : "false");
        button3d?.setAttribute("aria-pressed", is2D ? "false" : "true");
    }

    function ensureShadowSurface(container) {
        if (!container) return null;
        shadowRoot = container.shadowRoot || container.attachShadow({ mode: "open" });

        let stylesheet = shadowRoot.querySelector("link[data-ground-track-leaflet]");
        if (!stylesheet) {
            stylesheet = document.createElement("link");
            stylesheet.rel = "stylesheet";
            stylesheet.href = LEAFLET_CSS_URL;
            stylesheet.setAttribute("data-ground-track-leaflet", "true");
            shadowRoot.appendChild(stylesheet);
        }

        let style = shadowRoot.querySelector("style[data-ground-track-surface-style]");
        if (!style) {
            style = document.createElement("style");
            style.setAttribute("data-ground-track-surface-style", "true");
            style.textContent = `
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                }
                [hidden] {
                    display: none !important;
                }
                .ground-track-shadow-shell {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    background: #07101d;
                }
                .ground-track-shadow-view {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                }
                .ground-track-shadow-map.leaflet-container {
                    width: 100%;
                    height: 100%;
                    background: #cfe6ef;
                    font-family: var(--font-ui, sans-serif);
                }
                .ground-track-shadow-map .leaflet-control-attribution {
                    font-size: 9px;
                    background: rgba(248, 252, 255, 0.88);
                    color: #37516f;
                }
                .ground-track-shadow-map .leaflet-control-attribution a {
                    color: #264f7d;
                }
                .ground-track-shadow-map img,
                .ground-track-shadow-map .leaflet-tile {
                    max-width: none !important;
                    max-height: none !important;
                    mix-blend-mode: normal !important;
                }
                .ground-track-shadow-globe {
                    background: radial-gradient(circle at 50% 40%, #15345c 0%, #0a1525 68%, #060d17 100%);
                }
                .ground-track-shadow-globe canvas {
                    display: block;
                    width: 100% !important;
                    height: 100% !important;
                }
            `;
            shadowRoot.appendChild(style);
        }

        shadowShell = shadowRoot.querySelector(".ground-track-shadow-shell");
        if (!shadowShell) {
            shadowShell = document.createElement("div");
            shadowShell.className = "ground-track-shadow-shell";
            shadowRoot.appendChild(shadowShell);
        }

        mapHost = shadowShell.querySelector(".ground-track-shadow-map");
        if (!mapHost) {
            mapHost = document.createElement("div");
            mapHost.className = "ground-track-shadow-view ground-track-shadow-map";
            shadowShell.appendChild(mapHost);
        }

        globeHost = shadowShell.querySelector(".ground-track-shadow-globe");
        if (!globeHost) {
            globeHost = document.createElement("div");
            globeHost.className = "ground-track-shadow-view ground-track-shadow-globe";
            shadowShell.appendChild(globeHost);
        }

        return shadowShell;
    }

    function ensureMap() {
        if (map) return map;
        const L = window["L"];
        const container = getNode("ground-track-map");
        ensureShadowSurface(container);
        if (!mapHost || !L) return null;

        map = L.map(mapHost, {
            center: DEFAULT_MAP_CENTER,
            zoom: DEFAULT_MAP_ZOOM,
            zoomControl: true,
            attributionControl: true,
            worldCopyJump: true,
            preferCanvas: true,
        });
        tileLayer = L.tileLayer(MAP_TILE_URL, {
            attribution: MAP_TILE_ATTRIBUTION,
            maxZoom: 19,
            minZoom: 1,
            detectRetina: true,
            subdomains: "abcd",
        }).addTo(map);
        trackLayerGroup = L.layerGroup().addTo(map);
        marker = L.circleMarker([0, 0], {
            radius: 5,
            color: "#fff0ba",
            weight: 2,
            fillColor: "#ff9f1a",
            fillOpacity: 0.96,
        }).addTo(map);
        map.on("movestart zoomstart", () => {
            if (isProgrammaticMapViewChange) return;
            hasMapUserView = true;
        });
        return map;
    }

    function ensureGlobe() {
        if (globeState.renderer) return globeState;
        const container = getNode("ground-track-map");
        ensureShadowSurface(container);
        if (!globeHost) return null;

        const width = Math.max(globeHost.clientWidth, 2);
        const height = Math.max(globeHost.clientHeight, 2);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.style.display = "block";
        globeHost.replaceChildren(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x08172a);

        const camera = new THREE.PerspectiveCamera(GLOBE_FOV_DEGREES, width / height, 0.1, 100);
        camera.position.set(0, 0, 3.15);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enablePan = false;
        controls.enableDamping = false;
        controls.rotateSpeed = 0.8;
        controls.zoomSpeed = 0.9;
        controls.minDistance = GLOBE_MIN_DISTANCE;
        controls.maxDistance = GLOBE_MAX_DISTANCE;
        controls.addEventListener("change", () => {
            if (!isProgrammaticGlobeViewChange) {
                hasGlobeUserView = true;
            }
            renderGlobeNow();
        });

        const globeRoot = new THREE.Group();
        scene.add(globeRoot);

        const earthMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0x081322,
            specular: 0x24364c,
            shininess: 10,
        });
        const earthMesh = new THREE.Mesh(
            new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64),
            earthMaterial,
        );
        globeRoot.add(earthMesh);

        const trackGroup = new THREE.Group();
        globeRoot.add(trackGroup);

        const markerMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.034, 20, 16),
            new THREE.MeshBasicMaterial({ color: 0xff9f1a }),
        );
        markerMesh.visible = false;
        globeRoot.add(markerMesh);

        const ambient = new THREE.AmbientLight(0xb7d0ef, 0.72);
        scene.add(ambient);
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.08);
        keyLight.position.set(2.4, 1.7, 3.2);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0x58779a, 0.42);
        fillLight.position.set(-2.8, -0.8, -1.5);
        scene.add(fillLight);

        globeState.renderer = renderer;
        globeState.scene = scene;
        globeState.camera = camera;
        globeState.controls = controls;
        globeState.globeRoot = globeRoot;
        globeState.earthMesh = earthMesh;
        globeState.trackGroup = trackGroup;
        globeState.markerMesh = markerMesh;

        if (!globeState.texturePromise) {
            globeState.texturePromise = new Promise((resolve) => {
                const loader = new THREE.TextureLoader();
                loader.load(
                    EARTH_TEXTURE_URL,
                    (texture) => {
                        if ("colorSpace" in texture && THREE.SRGBColorSpace) {
                            texture.colorSpace = THREE.SRGBColorSpace;
                        }
                        earthMaterial.map = texture;
                        earthMaterial.needsUpdate = true;
                        renderGlobeNow();
                        resolve(texture);
                    },
                    undefined,
                    () => resolve(null),
                );
            });
        }

        renderGlobeNow();
        return globeState;
    }

    function renderGlobeNow() {
        if (!globeState.renderer || !globeState.scene || !globeState.camera) return;
        globeState.renderer.render(globeState.scene, globeState.camera);
    }

    function resizeGlobe() {
        if (!globeState.renderer || !globeState.camera || !globeHost) return;
        const width = Math.max(globeHost.clientWidth, 2);
        const height = Math.max(globeHost.clientHeight, 2);
        globeState.camera.aspect = width / height;
        globeState.camera.updateProjectionMatrix();
        globeState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        globeState.renderer.setSize(width, height, false);
        renderGlobeNow();
    }

    function clearMapTrack() {
        trackLayerGroup?.clearLayers();
        if (marker) marker.setStyle({ opacity: 0, fillOpacity: 0 });
    }

    function renderMapTrack(segments) {
        if (!trackLayerGroup || !window["L"]) return;
        trackLayerGroup.clearLayers();
        duplicateWrappedSegments(segments).forEach((segment) => {
            window["L"].polyline(segment, {
                color: "#2b84c6",
                weight: 2.2,
                opacity: 0.92,
                lineCap: "round",
                lineJoin: "round",
                noClip: true,
            }).addTo(trackLayerGroup);
        });
    }

    function fitMapOverviewIfNeeded() {
        if (!map || hasMapUserView) return;
        isProgrammaticMapViewChange = true;
        map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, { animate: false });
        isProgrammaticMapViewChange = false;
    }

    function updateMapMarker(location) {
        if (!marker) return;
        if (!location) {
            marker.setStyle({ opacity: 0, fillOpacity: 0 });
            return;
        }
        const referenceLon = map?.getCenter?.().lng ?? 0;
        marker.setLatLng([location[0], wrapLongitudeNearReference(location[1], referenceLon)]);
        marker.setStyle({ opacity: 1, fillOpacity: 0.96 });
    }

    function clearGlobeTrack() {
        if (!globeState.trackGroup) return;
        while (globeState.trackGroup.children.length > 0) {
            const child = globeState.trackGroup.children.pop();
            disposeObject3D(child);
            child?.removeFromParent();
        }
        if (globeState.markerMesh) {
            globeState.markerMesh.visible = false;
        }
        renderGlobeNow();
    }

    function renderGlobeTrack(segments) {
        if (!globeState.trackGroup) return;
        clearGlobeTrack();
        segments.forEach((segment) => {
            if (!Array.isArray(segment) || segment.length < 2) return;
            const points = segment.map(([lat, lon]) => latLonToVector3(lat, lon, GLOBE_TRACK_ALTITUDE));
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: 0x4ec3ff,
                transparent: true,
                opacity: 0.95,
            });
            const line = new THREE.Line(geometry, material);
            globeState.trackGroup.add(line);
        });
        renderGlobeNow();
    }

    function updateGlobeMarker(location) {
        if (!globeState.markerMesh) return;
        if (!location) {
            globeState.markerMesh.visible = false;
            renderGlobeNow();
            return;
        }
        globeState.markerMesh.position.copy(latLonToVector3(location[0], location[1], GLOBE_MARKER_ALTITUDE));
        globeState.markerMesh.visible = true;
        renderGlobeNow();
    }

    function orientGlobeToTrack(segments) {
        if (!globeState.globeRoot) return;
        const points = segments.flat();
        if (points.length === 0) {
            isProgrammaticGlobeViewChange = true;
            globeState.globeRoot.quaternion.identity();
            globeState.camera.position.set(0, 0, 3.15);
            globeState.controls?.update();
            isProgrammaticGlobeViewChange = false;
            renderGlobeNow();
            return;
        }
        const midpoint = points[Math.floor(points.length * 0.5)];
        const front = new THREE.Vector3(0, 0, 1);
        const vector = latLonToVector3(midpoint[0], midpoint[1]).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(vector, front);
        isProgrammaticGlobeViewChange = true;
        globeState.globeRoot.quaternion.copy(quaternion);
        globeState.camera.position.set(0, 0, 3.15);
        globeState.controls?.target.set(0, 0, 0);
        globeState.controls?.update();
        isProgrammaticGlobeViewChange = false;
        renderGlobeNow();
    }

    function zoomGlobe(multiplier) {
        if (!globeState.camera || !globeState.controls) return;
        const offset = globeState.camera.position.clone().sub(globeState.controls.target);
        const nextLength = clamp(offset.length() * multiplier, GLOBE_MIN_DISTANCE, GLOBE_MAX_DISTANCE);
        offset.setLength(nextLength);
        globeState.camera.position.copy(globeState.controls.target.clone().add(offset));
        hasGlobeUserView = true;
        globeState.camera.updateProjectionMatrix();
        globeState.controls.update();
        renderGlobeNow();
    }

    function resolveDefaultPanelPosition(panel) {
        const width = Math.max(panel.offsetWidth || 400, 280);
        const height = Math.max(panel.offsetHeight || 320, 220);
        const timelineHeight = readCssPx("--timeline-dock-height", 88);
        const timelineOffset = readCssPx("--timeline-dock-offset", 10);
        const x = PANEL_DEFAULT_LEFT_PX;
        const y = window.innerHeight - height - timelineHeight - timelineOffset - PANEL_DEFAULT_BOTTOM_GAP_PX;
        return clampPanelRect({ x, y, width, height });
    }

    function clampPanelRect({ x, y, width, height }) {
        const maxX = Math.max(PANEL_EDGE_MARGIN_PX, window.innerWidth - width - PANEL_EDGE_MARGIN_PX);
        const maxY = Math.max(PANEL_EDGE_MARGIN_PX, window.innerHeight - height - PANEL_EDGE_MARGIN_PX);
        return {
            x: clamp(Math.round(x), PANEL_EDGE_MARGIN_PX, maxX),
            y: clamp(Math.round(y), PANEL_EDGE_MARGIN_PX, maxY),
        };
    }

    function applyPanelPosition(panel, x, y) {
        if (!panel) return;
        const width = Math.max(panel.offsetWidth || 400, 280);
        const height = Math.max(panel.offsetHeight || 320, 220);
        const clamped = clampPanelRect({ x, y, width, height });
        panelPosition = clamped;
        panel.style.left = `${clamped.x}px`;
        panel.style.top = `${clamped.y}px`;
    }

    function clampPanelPosition(panel) {
        if (!panelPosition) {
            applyPanelPosition(panel, resolveDefaultPanelPosition(panel).x, resolveDefaultPanelPosition(panel).y);
            return;
        }
        applyPanelPosition(panel, panelPosition.x, panelPosition.y);
    }

    function ensurePanelPosition(panel) {
        if (!panel) return;
        if (!panelPosition) {
            const initial = resolveDefaultPanelPosition(panel);
            applyPanelPosition(panel, initial.x, initial.y);
            return;
        }
        clampPanelPosition(panel);
    }

    function shouldStartDrag(event) {
        if (event.button !== 0) return false;
        if (!(event.target instanceof Element)) return false;
        return !event.target.closest("button, input, select, option, label, output, a");
    }

    function bindPanelDragging(panel, header) {
        if (!panel || !header) return;

        const onPointerDown = (event) => {
            if (!shouldStartDrag(event)) return;
            const rect = panel.getBoundingClientRect();
            dragState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                panelX: rect.left,
                panelY: rect.top,
            };
            header.setPointerCapture(event.pointerId);
            event.preventDefault();
        };

        const onPointerMove = (event) => {
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            const dx = event.clientX - dragState.startX;
            const dy = event.clientY - dragState.startY;
            applyPanelPosition(panel, dragState.panelX + dx, dragState.panelY + dy);
        };

        const releaseDrag = (event) => {
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            if (header.hasPointerCapture(event.pointerId)) {
                header.releasePointerCapture(event.pointerId);
            }
            dragState = null;
        };

        header.addEventListener("pointerdown", onPointerDown);
        header.addEventListener("pointermove", onPointerMove);
        header.addEventListener("pointerup", releaseDrag);
        header.addEventListener("pointercancel", releaseDrag);
    }

    function syncVisibleView() {
        const panel = getNode("ground-track-panel");
        if (!panel || panel.classList.contains("ground-track-panel--hidden")) return;
        const container = getNode("ground-track-map");
        ensureShadowSurface(container);
        updateModeButtons();
        const show2D = panelMode === VIEW_MODE_2D;
        if (mapHost) mapHost.hidden = !show2D;
        if (globeHost) globeHost.hidden = show2D;

        if (show2D) {
            const activeMap = ensureMap();
            if (!activeMap) return;
            activeMap.invalidateSize(false);
            fitMapOverviewIfNeeded();
            renderMapTrack(currentSegments);
            updateMapMarker(currentLocation);
            return;
        }

        ensureGlobe();
        resizeGlobe();
        renderGlobeTrack(currentSegments);
        updateGlobeMarker(currentLocation);
        if (!hasGlobeUserView) {
            orientGlobeToTrack(currentSegments);
        } else {
            renderGlobeNow();
        }
    }

    function setViewMode(mode) {
        panelMode = mode === VIEW_MODE_3D ? VIEW_MODE_3D : VIEW_MODE_2D;
        syncVisibleView();
    }

    function setPanelVisible(visible) {
        const panel = getNode("ground-track-panel");
        if (!panel) return;
        panel.classList.toggle("ground-track-panel--hidden", !visible);
        document.dispatchEvent(new CustomEvent("ground-track-panel-visibilitychange", {
            detail: { visible: !!visible },
        }));
        if (!visible) return;
        ensurePanelPosition(panel);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                syncVisibleView();
            });
        });
    }

    function ensurePanelEventsBound() {
        if (initialized) return;
        initialized = true;

        const toggleButton = getNode("ground-track-button");
        const closeButton = getNode("ground-track-panel-close");
        const zoomInButton = getNode("ground-track-zoom-in");
        const zoomOutButton = getNode("ground-track-zoom-out");
        const style2dButton = getNode("ground-track-style-2d");
        const style3dButton = getNode("ground-track-style-3d");
        const panel = getNode("ground-track-panel");
        const header = panel?.querySelector(".ground-track-panel__header");

        bindPanelDragging(panel, header);

        if (toggleButton && panel) {
            toggleButton.addEventListener("click", () => {
                const hidden = panel.classList.contains("ground-track-panel--hidden");
                setPanelVisible(hidden);
            });
        }
        document.addEventListener("ground-track-panel-open", () => {
            setPanelVisible(true);
        });
        closeButton?.addEventListener("click", () => setPanelVisible(false));
        zoomInButton?.addEventListener("click", () => {
            if (panelMode === VIEW_MODE_2D) {
                map?.zoomIn();
                hasMapUserView = true;
            } else {
                zoomGlobe(0.86);
            }
        });
        zoomOutButton?.addEventListener("click", () => {
            if (panelMode === VIEW_MODE_2D) {
                map?.zoomOut();
                hasMapUserView = true;
            } else {
                zoomGlobe(1.16);
            }
        });
        style2dButton?.addEventListener("click", () => setViewMode(VIEW_MODE_2D));
        style3dButton?.addEventListener("click", () => setViewMode(VIEW_MODE_3D));

        if (panel && typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(() => {
                if (panel.classList.contains("ground-track-panel--hidden")) return;
                clampPanelPosition(panel);
                map?.invalidateSize(false);
                resizeGlobe();
            });
            resizeObserver.observe(panel);
        }

        window.addEventListener("resize", () => {
            if (!panel) return;
            if (!panel.classList.contains("ground-track-panel--hidden")) {
                clampPanelPosition(panel);
            }
            map?.invalidateSize(false);
            resizeGlobe();
        });

        updateModeButtons();
    }

    function resolveCurrentEarthCenteredVector(sceneState, config) {
        const bodies = sceneState?.bodies || {};
        const craftId = resolveTelemetryBodyId(sceneState);
        const craftPos = bodies?.[craftId]?.position || null;
        if (!hasVector(craftPos)) return null;
        if (config === "lunar") {
            const earthPos = bodies?.EARTH?.position || null;
            if (!hasVector(earthPos)) return null;
            return subtractVectors(craftPos, earthPos);
        }
        if (config === "relative") return null;
        return craftPos;
    }

    function resolveTrackSegments(config) {
        if (config !== "geo" && config !== "lunar") return { key: `${config}:none`, segments: [] };
        const scene = window.animationScenes?.[config];
        if (!scene) return { key: `${config}:none`, segments: [] };
        const craftId = scene.activeCraftId || scene.primaryCraftId || "SC";
        const craftCurve = scene.curvesById?.[craftId] || [];
        const craftTimes = scene.curveTimesById?.[craftId] || [];
        if (!Array.isArray(craftCurve) || !Array.isArray(craftTimes) || craftCurve.length < 2 || craftTimes.length < 2) {
            return { key: `${config}:${craftId}:empty`, segments: [] };
        }
        const earthCurve = config === "lunar" ? (scene.curvesById?.EARTH || []) : null;
        const count = config === "lunar"
            ? Math.min(craftCurve.length, craftTimes.length, earthCurve.length)
            : Math.min(craftCurve.length, craftTimes.length);
        const key = `${config}:${craftId}:${count}`;
        if (cacheByKey.has(key)) return { key, segments: cacheByKey.get(key) };

        const points = [];
        for (let i = 0; i < count; i += 1) {
            const craft = craftCurve[i];
            const timeMs = craftTimes[i];
            if (!hasVector(craft) || !Number.isFinite(timeMs)) continue;
            let earthCentered = craft;
            if (config === "lunar") {
                const earth = earthCurve[i];
                if (!hasVector(earth)) continue;
                earthCentered = subtractVectors(craft, earth);
            }
            const latLon = eciToLatLonDegrees(earthCentered, timeMs);
            if (latLon) points.push(latLon);
        }
        const segments = unwrapTrackPoints(points);
        cacheByKey.set(key, segments);
        return { key, segments };
    }

    function clearTrackVisuals() {
        currentSegments = [];
        currentLocation = null;
        currentTrackKey = "";
        clearMapTrack();
        clearGlobeTrack();
    }

    function renderPayload({ sceneState, config, animTime }) {
        if (!sceneState || !Number.isFinite(animTime) || !config) return;

        if (config === "relative") {
            clearTrackVisuals();
            setStatus("Ground track is unavailable in Relative origin.");
            setCoords("--");
            syncVisibleView();
            return;
        }

        const { key, segments } = resolveTrackSegments(config);
        if (key !== currentTrackKey) {
            currentTrackKey = key;
            currentSegments = segments;
            hasMapUserView = false;
            hasGlobeUserView = false;
        }

        const vector = resolveCurrentEarthCenteredVector(sceneState, config);
        currentLocation = eciToLatLonDegrees(vector, animTime);
        if (!currentLocation) {
            setStatus("Current ground location unavailable.");
            setCoords("--");
        } else {
            setStatus("Ground track synced to mission timeline.");
            setCoords(`${currentLocation[0].toFixed(2)}°, ${currentLocation[1].toFixed(2)}°`);
        }

        syncVisibleView();
    }

    function update({ sceneState, config, animTime }) {
        ensurePanelEventsBound();
        latestPayload = { sceneState, config, animTime };
        renderPayload(latestPayload);
    }

    return { update, setPanelVisible };
}

export { createGroundTrackPanelActions };
