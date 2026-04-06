import { STAR_CATALOG_BRIGHT as CROSS_INDEX_BRIGHT_STARS } from "../rendering/star-catalog-bright.js";

const PANEL_SPECS = Object.freeze([
    {
        id: "earth",
        title: "Craft -> Earth",
        chipLabel: "Craft -> Earth",
        anchorKey: "craft",
        targetKey: "earth",
        infoMode: "none",
        defaultFov: 45,
    },
    {
        id: "moon",
        title: "Craft -> Moon",
        chipLabel: "Craft -> Moon",
        anchorKey: "craft",
        targetKey: "moon",
        infoMode: "moon-visibility",
        defaultFov: 45,
    },
    {
        id: "earth-to-moon",
        title: "Earth -> Moon",
        chipLabel: "Earth -> Moon",
        anchorKey: "earth",
        targetKey: "moon",
        infoMode: "moon-phase",
        defaultFov: 45,
    },
    {
        id: "earth-rise-composer",
        title: "Flyby in Focus",
        chipLabel: "Flyby",
        anchorKey: "craft",
        targetKey: "moon",
        infoMode: "none",
        mode: "composer",
        side: "left",
        defaultFov: 50,
    },
]);

const AUXILIARY_VIEW_CAMERA_PRESETS = Object.freeze(
    PANEL_SPECS
        .filter((spec) => spec.mode !== "composer")
        .map((spec) => ({
            id: spec.id,
            label: spec.title,
            positionMode: spec.anchorKey === "craft" ? "spacecraft" : spec.anchorKey,
            lookMode: spec.targetKey,
        })),
);

const PANEL_GAP_PX = 8;
const PANEL_MARGIN_PX = 8;
const PANEL_TOP_OFFSET_PX = 38;
const PANEL_SIDE_RATIO_DEFAULT = 0.27;
const PANEL_SIDE_RATIO_COMPOSER = 0.52;
const PANEL_MIN_SIDE_DEFAULT = 160;
const PANEL_MIN_SIDE_COMPOSER = 300;
const COMPOSER_DEFAULT_ASPECT_RATIO = 16 / 9;
const AUTO_FOV_MARGIN_SCALE = 1.03;
const AUTO_FOV_MIN_DEGREES = 1;
const AUTO_FOV_MAX_DEGREES = 179;
const PANEL_STATE_STORAGE_KEY = "moon-mission:aux-camera-panels:v1";
const COMPOSER_DRAG_SENSITIVITY = 0.004;
const COMPOSER_MAX_PITCH_RAD = (Math.PI * 0.5) - 0.02;
const COMPOSER_TIMELINE_WINDOW_MS = 2 * 60 * 60 * 1000;
const COMPOSER_FLYBY_WINDOW_PADDING_MS = 5 * 60 * 1000;
const COMPOSER_TIMELINE_RESOLUTION = 1000;
const COMPOSER_DEFAULT_EARTH_AMBIENT = 0.10;
const COMPOSER_DEFAULT_MOON_AMBIENT = 0.0;
const COMPOSER_MIN_AMBIENT = 0;
const COMPOSER_MAX_AMBIENT = 2.4;
const COMPOSER_MOONLIGHT_AMBIENT_SCALE = 0.22;
const COMPOSER_MOONLIGHT_DISTANCE_WEIGHT = 0.24;
const COMPOSER_MOON_SHADOW_LIFT_BASE = 0.06;
const COMPOSER_MOON_SHADOW_LIFT_SCALE = 0.28;
const COMPOSER_MOON_OUTLINE_THICKNESS_PX = 1.2;
const COMPOSER_MOON_OUTLINE_RGBA = "rgba(199, 214, 236, 0.78)";
const COMPOSER_DEFAULT_ROLL_RAD = Math.PI * 1.5;
const COMPOSER_DEFAULT_OPEN_MIN_VIEWPORT_HEIGHT_RATIO = 0.75;
const COMPOSER_DEFAULT_OPEN_TIME_MS = Date.UTC(2026, 3, 6, 23, 27, 0);
const COMPOSER_RENDER_EXPOSURE = 1.0;
const COMPOSER_SKY_STARMAP_OPACITY_CAP = 0.05;
const COMPOSER_SKY_CONSTELLATION_OPACITY_CAP = 0.0;
const COMPOSER_CAMERA_EXPOSURE = 0.98;
const COMPOSER_CAMERA_SKY_STARMAP_OPACITY_CAP = 0.03;
const COMPOSER_CAMERA_SKY_CONSTELLATION_OPACITY_CAP = 0.0;
const COMPOSER_OPTICS_STRENGTH_MIN = 0;
const COMPOSER_OPTICS_STRENGTH_MAX = 2.4;
const COMPOSER_OPTICS_STRENGTH_DEFAULT = 1.0;
const COMPOSER_OPTICS_ADVANCED_MIN = 0;
const COMPOSER_OPTICS_ADVANCED_MAX = 2.5;
const COMPOSER_OPTICS_ADVANCED_DEFAULT = 1.0;
const COMPOSER_RA_DEC_GRID_RA_STEP_DEG = 30;
const COMPOSER_RA_DEC_GRID_DEC_STEP_DEG = 15;
const COMPOSER_BRIGHT_STAR_LABEL_MAX_MAGNITUDE = 2.0;
const COMPOSER_BRIGHT_STAR_LABEL_MAX_COUNT = 36;
const COMPOSER_SKY_LABEL_EDGE_MARGIN_PX = 10;
const COMPOSER_AUTO_FOV_TARGET_DIAMETER_FRACTION = 0.5;
const KM_TO_MILES = 0.621371192237334;
const FLYBY_EVENT_PILL_SPECS = Object.freeze([
    {
        id: "lunarSoiEntry",
        title: "Lunar SOI In",
        matchKeys: ["lunarsoientry", "lunarsoiin", "moonsoientry", "moonsoiin"],
        matchLabels: ["lunar soi in", "lunar soi entry", "moon soi in", "moon soi entry"],
    },
    {
        id: "earthSet",
        title: "Earthset",
        matchKeys: ["earthset", "earth_set"],
        matchLabels: ["earthset", "earth set"],
    },
    {
        id: "closestApproach",
        title: "Closest Approach",
        matchKeys: ["closestapproach", "closest_approach", "lunarflyby", "lunar_flyby"],
        matchLabels: ["closest approach", "lunar flyby", "flyby"],
    },
    {
        id: "maxDistanceEarth",
        title: "Max Distance",
        matchKeys: ["maxdistanceearth", "max_distance_earth", "maxdistance"],
        matchLabels: ["max distance"],
    },
    {
        id: "earthRise",
        title: "Earthrise",
        matchKeys: ["earthrise", "earth_rise"],
        matchLabels: ["earthrise", "earth rise"],
    },
    {
        id: "eclipseStart",
        title: "Eclipse Start",
        matchKeys: ["eclipsestart", "eclipse_start", "eclipsein", "eclipse_in"],
        matchLabels: ["eclipse in", "eclipse start", "enters solar eclipse"],
    },
    {
        id: "eclipseEnd",
        title: "Eclipse End",
        matchKeys: ["eclipseend", "eclipse_end", "eclipseout", "eclipse_out"],
        matchLabels: ["eclipse out", "eclipse end", "exits solar eclipse"],
    },
    {
        id: "lunarSoiExit",
        title: "Lunar SOI Out",
        matchKeys: ["lunarsoiexit", "lunarsoiout", "moonsoiexit", "moonsoiout"],
        matchLabels: ["lunar soi out", "lunar soi exit", "moon soi out", "moon soi exit"],
    },
]);

function safeParseJson(text, fallbackValue) {
    try {
        return JSON.parse(text);
    } catch {
        return fallbackValue;
    }
}

function isDesktopViewport() {
    return window.innerWidth > 600;
}

function shouldEnableEarthriseComposer(missionConfig) {
    const ui = missionConfig?.ui;
    if (!ui || typeof ui !== "object") {
        return false;
    }
    if (ui.earthriseComposerEnabled === true) {
        return true;
    }
    const features = ui.features;
    return !!(features && typeof features === "object" && features.earthriseComposer === true);
}

function shouldEnableAuxiliaryPanels(missionConfig) {
    const ui = missionConfig?.ui;
    if (!ui || typeof ui !== "object") {
        return false;
    }
    if (ui.auxiliaryPanelsEnabled === true) {
        return true;
    }
    const features = ui.features;
    return !!(features && typeof features === "object" && features.auxiliaryPanels === true);
}

function resolveEventStartTimeMs(eventInfo) {
    const startTime = eventInfo?.startTime;
    if (startTime instanceof Date) {
        const timeMs = startTime.getTime();
        return Number.isFinite(timeMs) ? timeMs : Number.NaN;
    }
    if (typeof startTime === "string") {
        const parsed = Date.parse(startTime);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    const numeric = Number(startTime);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function resolveLunarFlybyTimeMs(eventInfos) {
    if (!Array.isArray(eventInfos) || eventInfos.length === 0) {
        return Number.NaN;
    }
    let best = null;
    for (const eventInfo of eventInfos) {
        const timeMs = resolveEventStartTimeMs(eventInfo);
        if (!Number.isFinite(timeMs)) {
            continue;
        }
        const key = eventInfo?.key || "";
        const label = eventInfo?.label || "";
        const hoverText = eventInfo?.hoverText || "";
        const infoText = eventInfo?.infoText || "";
        const burnFlag = eventInfo?.burnFlag === true;
        const keyLabelCorpus = `${key} ${label}`.toLowerCase();
        const narrativeCorpus = `${hoverText} ${infoText}`.toLowerCase();

        const hasMoonKeyLabel = /\b(moon|lunar)\b/.test(keyLabelCorpus);
        const hasFlybyKeyLabel = /\bflyby\b/.test(keyLabelCorpus);
        const hasClosestKeyLabel = /\b(closest approach|closestapproach|perilune|periselene|pericynthion)\b/.test(keyLabelCorpus);
        const explicitLunarFlybyKeyLabel = /\b(lunar flyby|moon flyby)\b/.test(keyLabelCorpus);
        const keySuggestsClosest = /\bclosest\b/.test(key.toLowerCase()) && /\b(approach|peri)\b/.test(key.toLowerCase());
        const hasMoonNarrative = /\b(moon|lunar)\b/.test(narrativeCorpus);
        const hasFlybyNarrative = /\bflyby\b/.test(narrativeCorpus);
        const hasClosestNarrative = /\b(closest approach|perilune|periselene|pericynthion)\b/.test(narrativeCorpus);
        let score = 0;
        if (keySuggestsClosest || hasClosestKeyLabel) {
            score = 220;
        } else if (explicitLunarFlybyKeyLabel) {
            score = 210;
        } else if (hasMoonKeyLabel && hasFlybyKeyLabel) {
            score = 200;
        } else if (!burnFlag && hasMoonNarrative && hasClosestNarrative) {
            score = 120;
        } else if (!burnFlag && hasMoonNarrative && hasFlybyNarrative) {
            score = 110;
        }
        if (score <= 0) {
            continue;
        }
        if (
            !best ||
            score > best.score ||
            (score === best.score && burnFlag === false && best.burnFlag === true) ||
            (score === best.score && burnFlag === best.burnFlag && timeMs < best.timeMs)
        ) {
            best = {
                score,
                timeMs,
                burnFlag,
            };
        }
    }
    return best ? best.timeMs : Number.NaN;
}

function resolveLunarSoiBoundaryTimeMs(eventInfos, boundary) {
    if (!Array.isArray(eventInfos) || eventInfos.length === 0) {
        return Number.NaN;
    }
    const wantEntry = boundary === "entry";
    const boundaryWords = wantEntry
        ? /\b(in|entry|enter|ingress)\b/
        : /\b(out|exit|leave|egress)\b/;
    const explicitKeyPattern = wantEntry
        ? /(?:lunar|moon)soi(?:entry|in)|soi(?:entry|in)(?:lunar|moon)?/
        : /(?:lunar|moon)soi(?:exit|out)|soi(?:exit|out)(?:lunar|moon)?/;
    const explicitLabelPattern = wantEntry
        ? /\b(?:lunar|moon)\s+soi\s+(?:in|entry)\b/
        : /\b(?:lunar|moon)\s+soi\s+(?:out|exit)\b/;
    const boundaryNarrativePattern = wantEntry
        ? /\b(?:enters?|entry|ingress)\b/
        : /\b(?:exits?|leave|egress)\b/;

    let best = null;
    for (const eventInfo of eventInfos) {
        const timeMs = resolveEventStartTimeMs(eventInfo);
        if (!Number.isFinite(timeMs)) {
            continue;
        }
        const key = String(eventInfo?.key || "");
        const label = String(eventInfo?.label || "");
        const hoverText = String(eventInfo?.hoverText || "");
        const infoText = String(eventInfo?.infoText || "");
        const keyLabelCorpus = `${key} ${label}`.toLowerCase();
        const narrativeCorpus = `${hoverText} ${infoText}`.toLowerCase();
        const compactKeyLabel = keyLabelCorpus.replace(/[^a-z0-9]+/g, "");

        const hasMoonKeyLabel = /\b(moon|lunar)\b/.test(keyLabelCorpus);
        const hasMoonNarrative = /\b(moon|lunar)\b/.test(narrativeCorpus);
        const hasSoiKeyLabel = /\bsoi\b/.test(keyLabelCorpus);
        const hasSoiNarrative = /\b(soi|sphere of influence)\b/.test(narrativeCorpus);

        let score = 0;
        if (explicitKeyPattern.test(compactKeyLabel)) {
            score = 320;
        } else if (explicitLabelPattern.test(keyLabelCorpus)) {
            score = 300;
        } else if (hasMoonKeyLabel && hasSoiKeyLabel && boundaryWords.test(keyLabelCorpus)) {
            score = 260;
        } else if (hasMoonNarrative && hasSoiNarrative && boundaryNarrativePattern.test(narrativeCorpus)) {
            score = 220;
        }

        if (score <= 0) {
            continue;
        }
        if (
            !best ||
            score > best.score ||
            (score === best.score && wantEntry && timeMs < best.timeMs) ||
            (score === best.score && !wantEntry && timeMs > best.timeMs)
        ) {
            best = { score, timeMs };
        }
    }
    return best ? best.timeMs : Number.NaN;
}

function resolveLunarFlybyWindowMs(eventInfos) {
    const startMs = resolveLunarSoiBoundaryTimeMs(eventInfos, "entry");
    const endMs = resolveLunarSoiBoundaryTimeMs(eventInfos, "exit");
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return { startMs: Number.NaN, endMs: Number.NaN };
    }
    return {
        startMs: startMs - COMPOSER_FLYBY_WINDOW_PADDING_MS,
        endMs: endMs + COMPOSER_FLYBY_WINDOW_PADDING_MS,
    };
}

function resolveFlybyPlannerEvents(eventInfos) {
    if (!Array.isArray(eventInfos) || eventInfos.length === 0) {
        return [];
    }
    const indexedEvents = eventInfos
        .map((eventInfo) => {
            const timeMs = resolveEventStartTimeMs(eventInfo);
            if (!Number.isFinite(timeMs)) {
                return null;
            }
            return {
                key: String(eventInfo?.key || "").toLowerCase(),
                label: String(eventInfo?.label || "").toLowerCase(),
                timeMs,
                rawLabel: String(eventInfo?.label || "").trim(),
            };
        })
        .filter(Boolean);
    const resolved = [];
    for (const spec of FLYBY_EVENT_PILL_SPECS) {
        const match = indexedEvents.find((eventInfo) => {
            const compactKey = eventInfo.key.replace(/[^a-z0-9]+/g, "");
            const hasKeyMatch = spec.matchKeys.some((candidate) => compactKey === candidate);
            if (hasKeyMatch) {
                return true;
            }
            return spec.matchLabels.some((needle) => eventInfo.label.includes(needle));
        });
        if (!match) {
            continue;
        }
        resolved.push({
            id: spec.id,
            title: spec.title,
            timeMs: match.timeMs,
            sourceLabel: match.rawLabel,
        });
    }
    return resolved;
}

class AuxiliaryCameraViewsManager {
    constructor({ THREE, overlayHost, requestRender }) {
        this.THREE = THREE;
        this.overlayHost = overlayHost || document.body;
        this.requestRender = typeof requestRender === "function" ? requestRender : null;
        this.root = null;
        this.chipDock = null;
        this.chipDockLeft = null;
        this.chipDockRight = null;
        this.panels = [];
        this.panelsEnabled = true;
        this.zIndexCounter = 1;
        this.dragState = null;
        this.handleResizeBound = this.handleResize.bind(this);
        this.panelStateByElement = new WeakMap();
        this.pendingResizePanelStates = new Set();
        this.pendingResizeRaf = null;
        this.handlePanelResizeEntriesBound = this.handlePanelResizeEntries.bind(this);
        this.persistedPanelState = this.readPersistedPanelState();
        this.persistStateTimeout = null;
        this.missionPanelsEnabled = false;
        this.composerEnabled = false;

        this.craftWorld = new THREE.Vector3();
        this.anchorWorld = new THREE.Vector3();
        this.targetWorld = new THREE.Vector3();
        this.earthWorld = new THREE.Vector3();
        this.moonWorld = new THREE.Vector3();
        this.sunWorld = new THREE.Vector3();
        this.sunDirectionWorld = new THREE.Vector3();
        this.sunDirectionEarthWorld = new THREE.Vector3(1, 0, 0);
        this.sunDirectionMoonWorld = new THREE.Vector3(1, 0, 0);
        this.sunDirectionCraftWorld = new THREE.Vector3(1, 0, 0);
        this.sunDirectionFromEarth = new THREE.Vector3();
        this.craftFromMoonDir = new THREE.Vector3();
        this.earthFromMoonDir = new THREE.Vector3();
        this.sunFromMoonDir = new THREE.Vector3();
        this.tmpVectorA = new THREE.Vector3();
        this.tmpVectorB = new THREE.Vector3();
        this.tmpVectorC = new THREE.Vector3();
        this.tmpVectorD = new THREE.Vector3();
        this.tmpVectorE = new THREE.Vector3();
        this.tmpVectorF = new THREE.Vector3();
        this.viewDir = new THREE.Vector3();
        this.projectedUp = new THREE.Vector3();
        this.targetUp = new THREE.Vector3();
        this.composerWorldUp = new THREE.Vector3(0, 0, 1);
        this.composerBaseUp = new THREE.Vector3();
        this.composerRotatedUp = new THREE.Vector3();
        this.targetQuat = new THREE.Quaternion();
        this.tmpQuatA = new THREE.Quaternion();
        this.tmpQuatB = new THREE.Quaternion();
        this.panelCameraWorldQuat = new THREE.Quaternion();
        this.panelCameraWorldQuatInv = new THREE.Quaternion();
        this.earthDirInCamera = new THREE.Vector3();
        this.cameraOffset = new THREE.Vector3();
        this.composerLookWorld = new THREE.Vector3();
        this.composerLookAtWorld = new THREE.Vector3();
        this.boundingBox = new THREE.Box3();
        this.boundingSphere = new THREE.Sphere();
        this.originalSkyPosition = new THREE.Vector3();
        this.originalSunReference = new THREE.Vector3();
        this.panelCameraWorldPosition = new THREE.Vector3();
        this.panelSkyLocalPosition = new THREE.Vector3();
        this.panelSunLocalPosition = new THREE.Vector3();
        this.moonElongationPrevious = null;
        this.moonElongationTrend = 1;
        this.moonVisibilitySamples = this.createFibonacciSphereSamples(720);
        this.analyticsLastUpdateMs = -Infinity;
        this.cachedMoonPhaseInfo = null;
        this.cachedMoonVisibilityInfo = null;
        this.composerEarthMoonDistanceReference = Number.NaN;
        this.composerFlybyTimeMs = Number.NaN;
        this.composerFlybyWindowStartMs = Number.NaN;
        this.composerFlybyWindowEndMs = Number.NaN;
        this.composerFlybyEvents = [];
        this.composerBrightStarCatalogRef = null;
        this.composerBrightStarLabelDescriptors = [];

        if (!isDesktopViewport()) {
            return;
        }

        this.createDom();
        window.addEventListener("resize", this.handleResizeBound, { passive: true });
    }

    getPanelResizeObserver() {
        if (typeof ResizeObserver === "undefined") {
            return null;
        }
        if (!this.panelResizeObserver) {
            this.panelResizeObserver = new ResizeObserver(this.handlePanelResizeEntriesBound);
        }
        return this.panelResizeObserver;
    }

    createDom() {
        this.root = document.createElement("div");
        this.root.id = "aux-camera-views";
        this.root.className = "aux-camera-views";
        this.overlayHost.appendChild(this.root);

        this.chipDockLeft = document.createElement("div");
        this.chipDockLeft.className = "aux-camera-chip-dock aux-camera-chip-dock--left";
        this.root.appendChild(this.chipDockLeft);

        this.chipDockRight = document.createElement("div");
        this.chipDockRight.className = "aux-camera-chip-dock aux-camera-chip-dock--right";
        this.root.appendChild(this.chipDockRight);
        this.chipDock = this.chipDockRight;

        PANEL_SPECS.forEach((spec, index) => {
            this.createPanel(spec, index);
        });

        this.applyDefaultPanelLayout();
    }

    readPersistedPanelState() {
        const storage = globalThis?.localStorage;
        if (!storage) {
            return {};
        }
        let raw = null;
        try {
            raw = storage.getItem(PANEL_STATE_STORAGE_KEY);
        } catch {
            return {};
        }
        if (!raw) {
            return {};
        }
        const parsed = safeParseJson(raw, {});
        return parsed && typeof parsed === "object" ? parsed : {};
    }

    queuePersistPanelState() {
        if (this.persistStateTimeout != null) {
            clearTimeout(this.persistStateTimeout);
        }
        this.persistStateTimeout = setTimeout(() => {
            this.persistStateTimeout = null;
            this.persistPanelState();
        }, 120);
    }

    persistPanelState() {
        const storage = globalThis?.localStorage;
        if (!storage) {
            return;
        }
        const payload = {};
        for (const panelState of this.panels) {
            payload[panelState.id] = {
                fov: Number.isFinite(panelState.camera?.fov) ? Number(panelState.camera.fov) : null,
                autoFovEnabled: panelState.autoFovEnabled === true,
            };
        }
        try {
            storage.setItem(PANEL_STATE_STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // Ignore persistence failures (privacy mode/quota).
        }
    }

    resolveComposerBrightStarLabelDescriptors() {
        const catalog = Array.isArray(CROSS_INDEX_BRIGHT_STARS) ? CROSS_INDEX_BRIGHT_STARS : null;
        if (!catalog || catalog.length === 0) {
            this.composerBrightStarCatalogRef = null;
            this.composerBrightStarLabelDescriptors = [];
            return this.composerBrightStarLabelDescriptors;
        }
        if (this.composerBrightStarCatalogRef === catalog && this.composerBrightStarLabelDescriptors.length > 0) {
            return this.composerBrightStarLabelDescriptors;
        }

        const descriptors = [];
        const seenLabels = new Set();
        for (let i = 0; i < catalog.length; i += 1) {
            const star = catalog[i];
            const magnitude = Number(star?.vmag);
            const label = String(star?.name || "").trim();
            const raDeg = Number(star?.raDeg);
            const decDeg = Number(star?.decDeg);
            if (!Number.isFinite(magnitude) || magnitude > COMPOSER_BRIGHT_STAR_LABEL_MAX_MAGNITUDE) {
                continue;
            }
            if (!label || !Number.isFinite(raDeg) || !Number.isFinite(decDeg)) {
                continue;
            }
            const dedupeKey = label.toLowerCase();
            if (seenLabels.has(dedupeKey)) {
                continue;
            }
            seenLabels.add(dedupeKey);
            const raRad = this.THREE.MathUtils.degToRad(raDeg);
            const decRad = this.THREE.MathUtils.degToRad(decDeg);
            const cosDec = Math.cos(decRad);
            descriptors.push({
                text: label,
                magnitude,
                localDirection: {
                    x: cosDec * Math.cos(raRad),
                    y: -cosDec * Math.sin(raRad),
                    z: Math.sin(decRad),
                },
            });
        }
        descriptors.sort((a, b) => (a.magnitude - b.magnitude) || a.text.localeCompare(b.text));
        this.composerBrightStarCatalogRef = catalog;
        this.composerBrightStarLabelDescriptors = descriptors.slice(0, COMPOSER_BRIGHT_STAR_LABEL_MAX_COUNT);
        return this.composerBrightStarLabelDescriptors;
    }

    readTimelineDockOffset() {
        const cssValue = getComputedStyle(document.documentElement)
            .getPropertyValue("--timeline-dock-offset")
            .trim();
        const parsed = Number.parseFloat(cssValue);
        return Number.isFinite(parsed) ? parsed : PANEL_MARGIN_PX;
    }

    clampPanelRect({ x, y, width, height }) {
        const viewportWidth = Math.max(window.innerWidth, 1);
        const viewportHeight = Math.max(window.innerHeight, 1);
        const maxX = Math.max(PANEL_MARGIN_PX, viewportWidth - width - PANEL_MARGIN_PX);
        const maxY = Math.max(PANEL_MARGIN_PX, viewportHeight - height - PANEL_MARGIN_PX);
        return {
            x: Math.min(Math.max(Math.round(x), PANEL_MARGIN_PX), maxX),
            y: Math.min(Math.max(Math.round(y), PANEL_MARGIN_PX), maxY),
        };
    }

    getDefaultPanelPosition(panel, index) {
        const width = Math.max(120, Math.round(panel.offsetWidth || 280));
        const height = Math.max(80, Math.round(panel.offsetHeight || 192));
        const dockOffset = this.readTimelineDockOffset();
        const x = window.innerWidth - width - dockOffset;
        const y = dockOffset + PANEL_TOP_OFFSET_PX + index * (height + PANEL_GAP_PX);
        return this.clampPanelRect({
            x,
            y,
            width,
            height,
        });
    }

    resolveComposerRequiredPanelHeight(panelState) {
        if (!panelState || panelState.mode !== "composer" || !panelState.panel) {
            return Number.NaN;
        }
        const header = panelState.panel.querySelector(".aux-camera-view__header");
        const controls = panelState.panel.querySelector(".aux-camera-view__composer-control-matrix");
        if (!header || !controls) {
            return Number.NaN;
        }
        const headerHeight = Math.ceil(header.getBoundingClientRect().height || 0);
        const controlsHeight = Math.ceil(controls.scrollHeight || 0);
        if (headerHeight <= 0 || controlsHeight <= 0) {
            return Number.NaN;
        }
        return headerHeight + controlsHeight + PANEL_GAP_PX;
    }

    applyDefaultPanelLayout() {
        if (!this.panels.length) {
            return;
        }
        const viewportWidth = Math.max(window.innerWidth, 1);
        const viewportHeight = Math.max(window.innerHeight, 1);
        const headerEl = document.querySelector(".header");
        const timelineEl = document.querySelector(".timeline-dock");
        const headerRect = headerEl?.getBoundingClientRect?.() || null;
        const timelineRect = timelineEl?.getBoundingClientRect?.() || null;
        const headerSpace = Number.isFinite(headerRect?.height) ? headerRect.height : 0;
        const controlSpace = Number.isFinite(timelineRect?.height) ? timelineRect.height : 0;
        const h = Math.max(0, viewportHeight - headerSpace - controlSpace);
        const dockOffset = this.readTimelineDockOffset();
        const topY = Number.isFinite(headerRect?.bottom)
            ? (headerRect.bottom + PANEL_GAP_PX)
            : (dockOffset + PANEL_TOP_OFFSET_PX);
        const maxSideFromWidth = Math.max(PANEL_MIN_SIDE_DEFAULT, viewportWidth - dockOffset - PANEL_MARGIN_PX * 2);
        const maxPanelWidth = Math.max(PANEL_MIN_SIDE_DEFAULT, viewportWidth - (PANEL_MARGIN_PX * 2));
        const maxPanelHeight = Math.max(PANEL_MIN_SIDE_DEFAULT, viewportHeight - (PANEL_MARGIN_PX * 2));
        const panelRects = this.panels.map((panelState) => {
            const isComposer = panelState.mode === "composer";
            const ratio = isComposer ? PANEL_SIDE_RATIO_COMPOSER : PANEL_SIDE_RATIO_DEFAULT;
            const sideFromFormula = ratio * h;
            const minSideTarget = isComposer ? PANEL_MIN_SIDE_COMPOSER : PANEL_MIN_SIDE_DEFAULT;
            const minSide = Math.min(minSideTarget, maxSideFromWidth);
            let width = Math.round(this.THREE.MathUtils.clamp(sideFromFormula, minSide, maxSideFromWidth));
            let height = width;
            if (isComposer) {
                const minComposerHeight = Math.round(viewportHeight * COMPOSER_DEFAULT_OPEN_MIN_VIEWPORT_HEIGHT_RATIO);
                let preferredWidth = Math.max(width, minSideTarget);
                let preferredHeight = Math.round(preferredWidth / COMPOSER_DEFAULT_ASPECT_RATIO);

                if (preferredHeight > maxPanelHeight) {
                    preferredHeight = maxPanelHeight;
                    preferredWidth = Math.round(preferredHeight * COMPOSER_DEFAULT_ASPECT_RATIO);
                }
                if (preferredWidth > maxPanelWidth) {
                    preferredWidth = maxPanelWidth;
                    preferredHeight = Math.round(preferredWidth / COMPOSER_DEFAULT_ASPECT_RATIO);
                }

                width = Math.max(minSideTarget, Math.min(preferredWidth, maxPanelWidth));
                height = Math.max(minSideTarget, Math.min(preferredHeight, maxPanelHeight));

                const heightFloor = Math.max(minSideTarget, minComposerHeight);
                const boundedHeightFloor = Math.min(heightFloor, maxPanelHeight);
                if (height < boundedHeightFloor) {
                    height = boundedHeightFloor;
                    width = Math.round(height * COMPOSER_DEFAULT_ASPECT_RATIO);
                    if (width > maxPanelWidth) {
                        width = maxPanelWidth;
                        height = Math.round(width / COMPOSER_DEFAULT_ASPECT_RATIO);
                    }
                }

                // Ensure controls column fits without vertical scroll whenever viewport allows.
                panelState.panel.style.width = `${width}px`;
                const requiredHeight = this.resolveComposerRequiredPanelHeight(panelState);
                if (Number.isFinite(requiredHeight) && requiredHeight > 0 && requiredHeight > height) {
                    height = Math.min(maxPanelHeight, Math.ceil(requiredHeight));
                    width = Math.round(height * COMPOSER_DEFAULT_ASPECT_RATIO);
                    if (width > maxPanelWidth) {
                        width = maxPanelWidth;
                        height = Math.round(width / COMPOSER_DEFAULT_ASPECT_RATIO);
                    }
                }
            }
            panelState.panel.style.width = `${width}px`;
            panelState.panel.style.height = `${height}px`;
            return { panelState, width, height };
        });

        let rightY = topY;
        let leftY = topY;
        for (const item of panelRects) {
            const onLeft = item.panelState.side === "left";
            let x = onLeft
                ? dockOffset
                : (viewportWidth - item.width - dockOffset);
            let y = onLeft ? leftY : rightY;
            if (item.panelState.mode === "composer") {
                x = Math.round((viewportWidth - item.width) * 0.5);
                y = Math.round((viewportHeight - item.height) * 0.5);
            }
            this.applyPanelPosition(item.panelState, x, y);
            if (item.panelState.mode !== "composer") {
                if (onLeft) {
                    leftY += item.height + PANEL_GAP_PX;
                } else {
                    rightY += item.height + PANEL_GAP_PX;
                }
            }
        }
    }

    applyPanelPosition(panelState, x, y) {
        const width = Math.max(120, Math.round(panelState.panel.offsetWidth || panelState.width || 280));
        const height = Math.max(80, Math.round(panelState.panel.offsetHeight || panelState.height || 192));
        const clamped = this.clampPanelRect({ x, y, width, height });
        panelState.x = clamped.x;
        panelState.y = clamped.y;
        panelState.panel.style.left = `${panelState.x}px`;
        panelState.panel.style.top = `${panelState.y}px`;
    }

    clampPanelPosition(panelState) {
        const currentX = Number.isFinite(panelState.x) ? panelState.x : panelState.panel.offsetLeft;
        const currentY = Number.isFinite(panelState.y) ? panelState.y : panelState.panel.offsetTop;
        this.applyPanelPosition(panelState, currentX, currentY);
    }

    bringPanelToFront(panelState) {
        this.zIndexCounter += 1;
        panelState.panel.style.zIndex = String(this.zIndexCounter);
    }

    setPanelMinimized(panelState, minimized, { persist = true, requestRender = true } = {}) {
        const nextMinimized = minimized === true;
        panelState.minimized = nextMinimized;
        panelState.panel.classList.toggle("is-minimized", nextMinimized);
        panelState.panel.hidden = nextMinimized;
        if (panelState.chipButton) {
            panelState.chipButton.hidden = !nextMinimized;
            panelState.chipButton.setAttribute("aria-pressed", nextMinimized ? "true" : "false");
            panelState.chipButton.title = nextMinimized
                ? `Restore ${panelState.title}`
                : `Minimize ${panelState.title}`;
        }
        if (nextMinimized) {
            this.clearPanelOverlay(panelState);
        }
        if (persist) {
            this.queuePersistPanelState();
        }
        if (requestRender) {
            this.requestRender?.();
        }
    }

    updateComposerChipPresentation(panelState) {
        if (!panelState || panelState.mode !== "composer" || !panelState.chipButton) {
            return;
        }
        const chip = panelState.chipButton;
        chip.classList.remove("aux-camera-chip--composer-teaser");
        chip.classList.add("aux-camera-chip--composer-tab");
        chip.replaceChildren();
        chip.textContent = "Flyby";
        chip.setAttribute("aria-label", `Open ${panelState.title}`);
    }

    shouldStartDrag(event) {
        if (event.button !== 0) return false;
        if (!(event.target instanceof Element)) return false;
        return !event.target.closest("input, button, select, option, label, output");
    }

    bindPanelDragging(panelState, header) {
        const onPointerDown = (event) => {
            if (!this.shouldStartDrag(event)) return;
            this.bringPanelToFront(panelState);
            this.dragState = {
                panelState,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                panelX: Number.isFinite(panelState.x) ? panelState.x : panelState.panel.offsetLeft,
                panelY: Number.isFinite(panelState.y) ? panelState.y : panelState.panel.offsetTop,
            };
            header.setPointerCapture(event.pointerId);
            event.preventDefault();
        };

        const onPointerMove = (event) => {
            if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;
            const dx = event.clientX - this.dragState.startX;
            const dy = event.clientY - this.dragState.startY;
            this.applyPanelPosition(
                this.dragState.panelState,
                this.dragState.panelX + dx,
                this.dragState.panelY + dy,
            );
        };

        const releaseDrag = (event) => {
            if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;
            if (header.hasPointerCapture(event.pointerId)) {
                header.releasePointerCapture(event.pointerId);
            }
            this.dragState = null;
            this.queuePersistPanelState();
        };

        header.addEventListener("pointerdown", onPointerDown);
        header.addEventListener("pointermove", onPointerMove);
        header.addEventListener("pointerup", releaseDrag);
        header.addEventListener("pointercancel", releaseDrag);
        panelState.onPointerDown = onPointerDown;
        panelState.onPointerMove = onPointerMove;
        panelState.onPointerUp = releaseDrag;
        panelState.onPointerCancel = releaseDrag;
    }

    createPanel(spec, index) {
        const panel = document.createElement("section");
        panel.className = "aux-camera-view";
        panel.dataset.target = spec.targetKey;

        const header = document.createElement("div");
        header.className = "aux-camera-view__header";

        const title = document.createElement("div");
        title.className = "aux-camera-view__title";
        title.textContent = spec.title;
        header.appendChild(title);

        const headerControls = document.createElement("div");
        headerControls.className = "aux-camera-view__header-controls";

        const fovControls = document.createElement("div");
        fovControls.className = "aux-camera-view__fov-controls";

        const fovLabel = document.createElement("label");
        fovLabel.className = "aux-camera-view__fov-label";
        fovLabel.textContent = "FoV";
        fovControls.appendChild(fovLabel);

        const autoToggle = document.createElement("button");
        autoToggle.className = "aux-camera-view__auto-toggle";
        autoToggle.type = "button";
        autoToggle.textContent = "Auto";
        autoToggle.setAttribute("aria-label", `${spec.title} automatic field of view`);
        fovControls.appendChild(autoToggle);

        const fovSlider = document.createElement("input");
        fovSlider.className = "aux-camera-view__fov-slider";
        fovSlider.type = "range";
        fovSlider.min = String(AUTO_FOV_MIN_DEGREES);
        fovSlider.max = String(AUTO_FOV_MAX_DEGREES);
        fovSlider.step = "1";
        fovSlider.value = String(spec.defaultFov);
        fovSlider.setAttribute("aria-label", `${spec.title} field of view`);
        fovControls.appendChild(fovSlider);

        const fovValue = document.createElement("output");
        fovValue.className = "aux-camera-view__fov-value";
        fovControls.appendChild(fovValue);

        const minimizeButton = document.createElement("button");
        minimizeButton.className = "aux-camera-view__minimize-button";
        minimizeButton.type = "button";
        minimizeButton.textContent = "x";
        minimizeButton.setAttribute("aria-label", `Collapse ${spec.title}`);

        headerControls.appendChild(fovControls);
        headerControls.appendChild(minimizeButton);
        header.appendChild(headerControls);
        panel.appendChild(header);

        const panelMode = spec.mode || "target";
        const panelSide = spec.side === "left" ? "left" : "right";
        panel.dataset.mode = panelMode;
        panel.dataset.side = panelSide;
        if (panelMode === "composer") {
            panel.classList.add("aux-camera-view--composer");
        }

        let info = null;
        let infoPrimary = null;
        let infoPrimaryText = null;
        let infoPill = null;
        let infoSecondary = null;
        let composerPresetWrap = null;
        let composerLookFreeButton = null;
        let composerLookEarthButton = null;
        let composerLookMoonButton = null;
        let composerControlMatrix = null;
        let composerInfoRow = null;
        let composerFovWrap = null;
        let composerTimelineWrap = null;
        let composerTransportRow = null;
        let composerTransportPlayButton = null;
        let composerTransportMinusMinuteButton = null;
        let composerTransportPlusMinuteButton = null;
        let composerTransportSlowerButton = null;
        let composerTransportSpeedButton = null;
        let composerTransportFasterButton = null;
        let composerTimelineSlider = null;
        let composerTimelineLabel = null;
        let composerTimelineLocalValue = null;
        let composerFlybyEventsWrap = null;
        let composerControlsWrap = null;
        let composerEarthAmbientSlider = null;
        let composerEarthAmbientValue = null;
        let composerMoonAmbientSlider = null;
        let composerMoonAmbientValue = null;
        let composerMoonOutlineWrap = null;
        let composerMoonOutlineCheckbox = null;
        let composerOpticsWrap = null;
        let composerOpticsBody = null;
        let composerOpticsPhysicalButton = null;
        let composerOpticsCameraButton = null;
        let composerOpticsStrengthSlider = null;
        let composerOpticsStrengthValue = null;
        let composerOpticsAdvancedPanel = null;
        let composerOpticsHaloSlider = null;
        let composerOpticsHaloValue = null;
        let composerOpticsStarburstSlider = null;
        let composerOpticsStarburstValue = null;
        let composerOpticsFlareSlider = null;
        let composerOpticsFlareValue = null;
        let composerRollWrap = null;
        let composerRollSlider = null;
        let composerRollValue = null;
        let composerInfoOverlayWrap = null;
        let composerInfoOverlayCheckbox = null;
        let composerRaDecGridWrap = null;
        let composerRaDecGridCheckbox = null;
        let composerSkyLabelsWrap = null;
        let composerSkyLabelsCheckbox = null;
        let composerMetricsStrip = null;
        let composerMetricFovHValue = null;
        let composerMetricFovVValue = null;
        let composerMetricDistanceMoonValue = null;
        let composerMetricAngleValue = null;
        let composerDisabledOverlay = null;
        if (panelMode === "composer") {
            if (headerControls.contains(fovControls)) {
                headerControls.removeChild(fovControls);
            }
            composerControlMatrix = document.createElement("div");
            composerControlMatrix.className = "aux-camera-view__composer-control-matrix";

            const createSectionLabel = (text) => {
                const sectionLabel = document.createElement("div");
                sectionLabel.className = "aux-camera-view__composer-section-label";
                sectionLabel.textContent = text;
                return sectionLabel;
            };
            const basicSectionLabel = createSectionLabel("Basic Settings");
            const sunSectionLabel = createSectionLabel("Sun Related");
            const timelineSectionLabel = createSectionLabel("Timeline");

            composerInfoRow = document.createElement("div");
            composerInfoRow.className = "aux-camera-view__composer-info-row";
            const composerInfoLabel = document.createElement("span");
            composerInfoLabel.className = "aux-camera-view__composer-label aux-camera-view__composer-row-label";
            composerInfoLabel.textContent = "Overlays";
            composerInfoRow.appendChild(composerInfoLabel);

            const composerInfoToggles = document.createElement("div");
            composerInfoToggles.className = "aux-camera-view__composer-lock-buttons";

            composerInfoOverlayWrap = document.createElement("label");
            composerInfoOverlayWrap.className = "aux-camera-view__composer-grid-toggle";
            composerInfoOverlayCheckbox = document.createElement("input");
            composerInfoOverlayCheckbox.type = "checkbox";
            composerInfoOverlayCheckbox.setAttribute("aria-label", "Toggle composer info overlay");
            const composerInfoOverlayText = document.createElement("span");
            composerInfoOverlayText.textContent = "Info";
            composerInfoOverlayWrap.appendChild(composerInfoOverlayCheckbox);
            composerInfoOverlayWrap.appendChild(composerInfoOverlayText);
            composerInfoToggles.appendChild(composerInfoOverlayWrap);

            composerRaDecGridWrap = document.createElement("label");
            composerRaDecGridWrap.className = "aux-camera-view__composer-grid-toggle";
            composerRaDecGridCheckbox = document.createElement("input");
            composerRaDecGridCheckbox.type = "checkbox";
            composerRaDecGridCheckbox.setAttribute("aria-label", "Toggle composer RA/Dec overlay");
            const composerRaDecGridText = document.createElement("span");
            composerRaDecGridText.textContent = "Ra/Dec";
            composerRaDecGridWrap.appendChild(composerRaDecGridCheckbox);
            composerRaDecGridWrap.appendChild(composerRaDecGridText);
            composerInfoToggles.appendChild(composerRaDecGridWrap);

            composerSkyLabelsWrap = document.createElement("label");
            composerSkyLabelsWrap.className = "aux-camera-view__composer-grid-toggle";
            composerSkyLabelsCheckbox = document.createElement("input");
            composerSkyLabelsCheckbox.type = "checkbox";
            composerSkyLabelsCheckbox.setAttribute("aria-label", "Toggle composer bright star and planet labels");
            const composerSkyLabelsText = document.createElement("span");
            composerSkyLabelsText.textContent = "Sky Labels";
            composerSkyLabelsWrap.appendChild(composerSkyLabelsCheckbox);
            composerSkyLabelsWrap.appendChild(composerSkyLabelsText);
            composerInfoToggles.appendChild(composerSkyLabelsWrap);
            composerInfoRow.appendChild(composerInfoToggles);

            composerPresetWrap = document.createElement("div");
            composerPresetWrap.className = "aux-camera-view__composer-presets";
            const presetLabel = document.createElement("span");
            presetLabel.className = "aux-camera-view__composer-label aux-camera-view__composer-row-label";
            presetLabel.textContent = "Lock";
            composerPresetWrap.appendChild(presetLabel);

            const lockButtonStrip = document.createElement("div");
            lockButtonStrip.className = "aux-camera-view__composer-lock-buttons";

            composerLookFreeButton = document.createElement("button");
            composerLookFreeButton.type = "button";
            composerLookFreeButton.className = "aux-camera-view__composer-button";
            composerLookFreeButton.textContent = "Free";
            composerLookFreeButton.setAttribute("aria-label", "Flyby Planner unlock camera");
            lockButtonStrip.appendChild(composerLookFreeButton);

            composerLookEarthButton = document.createElement("button");
            composerLookEarthButton.type = "button";
            composerLookEarthButton.className = "aux-camera-view__composer-button";
            composerLookEarthButton.textContent = "Earth";
            composerLookEarthButton.setAttribute("aria-label", "Flyby Planner lock to Earth");
            lockButtonStrip.appendChild(composerLookEarthButton);

            composerLookMoonButton = document.createElement("button");
            composerLookMoonButton.type = "button";
            composerLookMoonButton.className = "aux-camera-view__composer-button";
            composerLookMoonButton.textContent = "Moon";
            composerLookMoonButton.setAttribute("aria-label", "Flyby Planner lock to Moon");
            lockButtonStrip.appendChild(composerLookMoonButton);
            composerPresetWrap.appendChild(lockButtonStrip);

            composerFovWrap = document.createElement("div");
            composerFovWrap.className = "aux-camera-view__composer-fov";
            composerFovWrap.appendChild(fovControls);
            composerControlMatrix.appendChild(composerFovWrap);

            composerTimelineWrap = document.createElement("div");
            composerTimelineWrap.className = "aux-camera-view__composer-timeline";

            composerTransportRow = document.createElement("div");
            composerTransportRow.className = "aux-camera-view__composer-transport-row";

            const composerTransportCluster = document.createElement("div");
            composerTransportCluster.className = "controls-cluster controls-cluster--transport";

            const composerPlaybackGroup = document.createElement("div");
            composerPlaybackGroup.className = "controls-subgroup controls-subgroup--playback";

            composerTransportPlayButton = document.createElement("button");
            composerTransportPlayButton.type = "button";
            composerTransportPlayButton.className = "button button--primary";
            composerTransportPlayButton.textContent = "Play";
            composerTransportPlayButton.setAttribute("aria-label", "Play or pause animation");
            composerPlaybackGroup.appendChild(composerTransportPlayButton);

            composerTransportMinusMinuteButton = document.createElement("button");
            composerTransportMinusMinuteButton.type = "button";
            composerTransportMinusMinuteButton.className = "button";
            composerTransportMinusMinuteButton.textContent = "-1m";
            composerTransportMinusMinuteButton.setAttribute("aria-label", "Step timeline backward by one minute");
            composerPlaybackGroup.appendChild(composerTransportMinusMinuteButton);

            composerTransportPlusMinuteButton = document.createElement("button");
            composerTransportPlusMinuteButton.type = "button";
            composerTransportPlusMinuteButton.className = "button";
            composerTransportPlusMinuteButton.textContent = "+1m";
            composerTransportPlusMinuteButton.setAttribute("aria-label", "Step timeline forward by one minute");
            composerPlaybackGroup.appendChild(composerTransportPlusMinuteButton);

            composerTransportCluster.appendChild(composerPlaybackGroup);
            composerTransportRow.appendChild(composerTransportCluster);

            const composerSpeedCluster = document.createElement("div");
            composerSpeedCluster.className = "controls-cluster controls-cluster--speed";

            composerTransportSlowerButton = document.createElement("button");
            composerTransportSlowerButton.type = "button";
            composerTransportSlowerButton.className = "button button--icon";
            composerTransportSlowerButton.textContent = "−";
            composerTransportSlowerButton.setAttribute("aria-label", "Slower");
            composerSpeedCluster.appendChild(composerTransportSlowerButton);

            composerTransportSpeedButton = document.createElement("button");
            composerTransportSpeedButton.type = "button";
            composerTransportSpeedButton.className = "button button--realtime";
            composerTransportSpeedButton.textContent = "1 sec/sec";
            composerTransportSpeedButton.setAttribute("aria-label", "Current speed. Click to set realtime");
            composerSpeedCluster.appendChild(composerTransportSpeedButton);

            composerTransportFasterButton = document.createElement("button");
            composerTransportFasterButton.type = "button";
            composerTransportFasterButton.className = "button button--icon";
            composerTransportFasterButton.textContent = "+";
            composerTransportFasterButton.setAttribute("aria-label", "Faster");
            composerSpeedCluster.appendChild(composerTransportFasterButton);

            composerTransportRow.appendChild(composerSpeedCluster);
            composerTimelineWrap.appendChild(composerTransportRow);

            composerTimelineLabel = document.createElement("span");
            composerTimelineLabel.className = "aux-camera-view__composer-label aux-camera-view__composer-row-label";
            composerTimelineLabel.textContent = "Time";
            composerTimelineWrap.appendChild(composerTimelineLabel);
            composerTimelineSlider = document.createElement("input");
            composerTimelineSlider.type = "range";
            composerTimelineSlider.className = "aux-camera-view__composer-timeline-slider";
            composerTimelineSlider.min = "0";
            composerTimelineSlider.max = String(COMPOSER_TIMELINE_RESOLUTION);
            composerTimelineSlider.step = "1";
            composerTimelineSlider.value = String(Math.round(COMPOSER_TIMELINE_RESOLUTION * 0.5));
            composerTimelineSlider.setAttribute("aria-label", "Flyby Planner short timeline scrub");
            composerTimelineWrap.appendChild(composerTimelineSlider);
            const composerTimelineValue = document.createElement("span");
            composerTimelineValue.className = "aux-camera-view__composer-value-slot";
            composerTimelineWrap.appendChild(composerTimelineValue);
            composerTimelineLocalValue = document.createElement("span");
            composerTimelineLocalValue.className = "aux-camera-view__composer-timeline-local";
            composerTimelineLocalValue.textContent = "Local: --";
            composerTimelineWrap.appendChild(composerTimelineLocalValue);
            composerFlybyEventsWrap = document.createElement("div");
            composerFlybyEventsWrap.className = "aux-camera-view__composer-event-pills";
            composerTimelineWrap.appendChild(composerFlybyEventsWrap);
            composerControlMatrix.appendChild(composerTimelineWrap);

            composerControlsWrap = document.createElement("div");
            composerControlsWrap.className = "aux-camera-view__composer-controls";

            const buildAmbientRow = (labelText, ariaLabel, defaultValue) => {
                const row = document.createElement("div");
                row.className = "aux-camera-view__composer-optics-row";

                const label = document.createElement("span");
                label.className = "aux-camera-view__composer-label";
                label.textContent = labelText;
                row.appendChild(label);

                const slider = document.createElement("input");
                slider.type = "range";
                slider.className = "aux-camera-view__composer-ambient-slider";
                slider.min = String(COMPOSER_MIN_AMBIENT);
                slider.max = String(COMPOSER_MAX_AMBIENT);
                slider.step = "0.01";
                slider.value = String(defaultValue);
                slider.setAttribute("aria-label", ariaLabel);
                row.appendChild(slider);

                const value = document.createElement("output");
                value.className = "aux-camera-view__composer-ambient-value";
                value.value = `${defaultValue.toFixed(2)}`;
                value.textContent = value.value;
                row.appendChild(value);

                composerControlsWrap.appendChild(row);
                return { slider, value };
            };

            ({
                slider: composerEarthAmbientSlider,
                value: composerEarthAmbientValue,
            } = buildAmbientRow(
                "Earth Ambient",
                "Flyby Planner Earth night-side ambient",
                COMPOSER_DEFAULT_EARTH_AMBIENT,
            ));
            ({
                slider: composerMoonAmbientSlider,
                value: composerMoonAmbientValue,
            } = buildAmbientRow(
                "Moon Ambient",
                "Flyby Planner Moon night-side ambient",
                COMPOSER_DEFAULT_MOON_AMBIENT,
            ));

            const composerMoonOutlineRow = document.createElement("div");
            composerMoonOutlineRow.className = "aux-camera-view__composer-optics-row aux-camera-view__composer-boolean-row";
            const composerMoonOutlineLabel = document.createElement("span");
            composerMoonOutlineLabel.className = "aux-camera-view__composer-label";
            composerMoonOutlineLabel.textContent = "Moon Outline";
            composerMoonOutlineRow.appendChild(composerMoonOutlineLabel);
            composerMoonOutlineWrap = document.createElement("label");
            composerMoonOutlineWrap.className = "aux-camera-view__composer-grid-toggle";
            composerMoonOutlineCheckbox = document.createElement("input");
            composerMoonOutlineCheckbox.type = "checkbox";
            composerMoonOutlineCheckbox.checked = false;
            composerMoonOutlineCheckbox.setAttribute("aria-label", "Toggle Moon outline in Flyby Planner");
            const composerMoonOutlineText = document.createElement("span");
            composerMoonOutlineText.textContent = "Show";
            composerMoonOutlineWrap.appendChild(composerMoonOutlineCheckbox);
            composerMoonOutlineWrap.appendChild(composerMoonOutlineText);
            composerMoonOutlineRow.appendChild(composerMoonOutlineWrap);
            const composerMoonOutlineValue = document.createElement("span");
            composerMoonOutlineValue.className = "aux-camera-view__composer-value-slot";
            composerMoonOutlineRow.appendChild(composerMoonOutlineValue);
            composerControlsWrap.appendChild(composerMoonOutlineRow);
            composerControlMatrix.appendChild(composerControlsWrap);

            composerOpticsWrap = document.createElement("div");
            composerOpticsWrap.className = "aux-camera-view__composer-optics";

            const composerOpticsToggleRow = document.createElement("div");
            composerOpticsToggleRow.className = "aux-camera-view__composer-optics-toggle-row";
            const composerOpticsToggleLabel = document.createElement("span");
            composerOpticsToggleLabel.className = "aux-camera-view__composer-label";
            composerOpticsToggleLabel.textContent = "Sun";
            composerOpticsToggleRow.appendChild(composerOpticsToggleLabel);
            composerOpticsWrap.appendChild(composerOpticsToggleRow);

            composerOpticsBody = document.createElement("div");
            composerOpticsBody.className = "aux-camera-view__composer-optics-body";

            const composerOpticsHeader = document.createElement("div");
            composerOpticsHeader.className = "aux-camera-view__composer-optics-header";
            const composerOpticsLabel = document.createElement("span");
            composerOpticsLabel.className = "aux-camera-view__composer-label aux-camera-view__composer-row-label";
            composerOpticsLabel.textContent = "Optics";
            composerOpticsHeader.appendChild(composerOpticsLabel);

            composerOpticsPhysicalButton = document.createElement("button");
            composerOpticsPhysicalButton.type = "button";
            composerOpticsPhysicalButton.className = "aux-camera-view__composer-button";
            composerOpticsPhysicalButton.textContent = "Physical";
            composerOpticsPhysicalButton.setAttribute("aria-label", "Use physical sun optics profile");
            composerOpticsHeader.appendChild(composerOpticsPhysicalButton);

            composerOpticsCameraButton = document.createElement("button");
            composerOpticsCameraButton.type = "button";
            composerOpticsCameraButton.className = "aux-camera-view__composer-button";
            composerOpticsCameraButton.textContent = "Camera";
            composerOpticsCameraButton.setAttribute("aria-label", "Use camera optics profile");
            composerOpticsHeader.appendChild(composerOpticsCameraButton);
            composerOpticsBody.appendChild(composerOpticsHeader);

            const composerOpticsStrengthRow = document.createElement("div");
            composerOpticsStrengthRow.className = "aux-camera-view__composer-optics-row";
            const composerOpticsStrengthLabel = document.createElement("span");
            composerOpticsStrengthLabel.className = "aux-camera-view__composer-label";
            composerOpticsStrengthLabel.textContent = "Strength";
            composerOpticsStrengthRow.appendChild(composerOpticsStrengthLabel);
            composerOpticsStrengthSlider = document.createElement("input");
            composerOpticsStrengthSlider.type = "range";
            composerOpticsStrengthSlider.className = "aux-camera-view__composer-ambient-slider";
            composerOpticsStrengthSlider.min = String(COMPOSER_OPTICS_STRENGTH_MIN);
            composerOpticsStrengthSlider.max = String(COMPOSER_OPTICS_STRENGTH_MAX);
            composerOpticsStrengthSlider.step = "0.01";
            composerOpticsStrengthSlider.value = String(COMPOSER_OPTICS_STRENGTH_DEFAULT);
            composerOpticsStrengthSlider.setAttribute("aria-label", "Flyby Planner optics strength");
            composerOpticsStrengthRow.appendChild(composerOpticsStrengthSlider);
            composerOpticsStrengthValue = document.createElement("output");
            composerOpticsStrengthValue.className = "aux-camera-view__composer-ambient-value";
            composerOpticsStrengthValue.value = `${COMPOSER_OPTICS_STRENGTH_DEFAULT.toFixed(2)}`;
            composerOpticsStrengthValue.textContent = composerOpticsStrengthValue.value;
            composerOpticsStrengthRow.appendChild(composerOpticsStrengthValue);
            composerOpticsBody.appendChild(composerOpticsStrengthRow);

            composerOpticsAdvancedPanel = document.createElement("div");
            composerOpticsAdvancedPanel.className = "aux-camera-view__composer-optics-advanced";
            composerOpticsAdvancedPanel.hidden = true;

            const buildAdvancedRow = (labelText) => {
                const row = document.createElement("div");
                row.className = "aux-camera-view__composer-optics-row";
                const label = document.createElement("span");
                label.className = "aux-camera-view__composer-label";
                label.textContent = labelText;
                row.appendChild(label);
                const slider = document.createElement("input");
                slider.type = "range";
                slider.className = "aux-camera-view__composer-ambient-slider";
                slider.min = String(COMPOSER_OPTICS_ADVANCED_MIN);
                slider.max = String(COMPOSER_OPTICS_ADVANCED_MAX);
                slider.step = "0.01";
                slider.value = String(COMPOSER_OPTICS_ADVANCED_DEFAULT);
                row.appendChild(slider);
                const value = document.createElement("output");
                value.className = "aux-camera-view__composer-ambient-value";
                value.value = `${COMPOSER_OPTICS_ADVANCED_DEFAULT.toFixed(2)}`;
                value.textContent = value.value;
                row.appendChild(value);
                composerOpticsAdvancedPanel.appendChild(row);
                return { slider, value };
            };
            ({ slider: composerOpticsHaloSlider, value: composerOpticsHaloValue } = buildAdvancedRow("Halo"));
            ({ slider: composerOpticsStarburstSlider, value: composerOpticsStarburstValue } = buildAdvancedRow("Star"));
            ({ slider: composerOpticsFlareSlider, value: composerOpticsFlareValue } = buildAdvancedRow("Flare"));
            composerOpticsBody.appendChild(composerOpticsAdvancedPanel);
            composerOpticsWrap.appendChild(composerOpticsBody);

            composerControlMatrix.appendChild(composerOpticsWrap);

            composerRollWrap = document.createElement("div");
            composerRollWrap.className = "aux-camera-view__composer-roll-wrap";
            const composerRollLabel = document.createElement("span");
            composerRollLabel.className = "aux-camera-view__composer-label aux-camera-view__composer-row-label";
            composerRollLabel.textContent = "Rotation";
            composerRollWrap.appendChild(composerRollLabel);
            composerRollSlider = document.createElement("input");
            composerRollSlider.type = "range";
            composerRollSlider.className = "aux-camera-view__composer-ambient-slider aux-camera-view__composer-roll-slider";
            composerRollSlider.min = "0";
            composerRollSlider.max = "359";
            composerRollSlider.step = "1";
            composerRollSlider.value = String(Math.round(this.THREE.MathUtils.radToDeg(COMPOSER_DEFAULT_ROLL_RAD)) % 360);
            composerRollSlider.setAttribute("aria-label", "Flyby Planner rotation");
            composerRollWrap.appendChild(composerRollSlider);
            composerRollValue = document.createElement("output");
            composerRollValue.className = "aux-camera-view__composer-roll-value";
            composerRollWrap.appendChild(composerRollValue);
            composerControlMatrix.replaceChildren(
                basicSectionLabel,
                composerInfoRow,
                composerPresetWrap,
                composerControlsWrap,
                composerFovWrap,
                composerRollWrap,
                sunSectionLabel,
                composerOpticsWrap,
                timelineSectionLabel,
                composerTimelineWrap,
            );
            panel.appendChild(composerControlMatrix);
        } else {
            info = document.createElement("div");
            info.className = "aux-camera-view__info";
            info.hidden = spec.infoMode === "none";
            infoPrimary = document.createElement("div");
            infoPrimary.className = "aux-camera-view__info-line aux-camera-view__info-line--primary";
            infoPrimaryText = document.createElement("span");
            infoPrimaryText.className = "aux-camera-view__info-primary-text";
            infoPill = document.createElement("button");
            infoPill.type = "button";
            infoPill.className = "aux-camera-view__pill";
            infoPill.hidden = true;
            infoPrimary.appendChild(infoPrimaryText);
            infoPrimary.appendChild(infoPill);
            infoSecondary = document.createElement("div");
            infoSecondary.className = "aux-camera-view__info-line aux-camera-view__info-line--secondary";
            info.appendChild(infoPrimary);
            info.appendChild(infoSecondary);
            panel.appendChild(info);
        }

        const viewport = document.createElement("div");
        viewport.className = "aux-camera-view__viewport";
        panel.appendChild(viewport);
        if (panelMode === "composer") {
            composerDisabledOverlay = document.createElement("div");
            composerDisabledOverlay.className = "aux-camera-view__composer-disabled-overlay";
            composerDisabledOverlay.textContent = "Outside Flyby Window";
            composerDisabledOverlay.hidden = true;
            viewport.appendChild(composerDisabledOverlay);

            composerMetricsStrip = document.createElement("div");
            composerMetricsStrip.className = "aux-camera-view__composer-metrics-strip";
            composerMetricsStrip.setAttribute("aria-hidden", "true");

            const createMetricCell = (labelText) => {
                const cell = document.createElement("div");
                cell.className = "aux-camera-view__composer-metric-cell";
                const key = document.createElement("span");
                key.className = "aux-camera-view__composer-metric-key";
                key.textContent = labelText;
                const value = document.createElement("span");
                value.className = "aux-camera-view__composer-metric-value";
                value.textContent = "--";
                cell.appendChild(key);
                cell.appendChild(value);
                composerMetricsStrip.appendChild(cell);
                return value;
            };

            composerMetricFovHValue = createMetricCell("FoV H");
            composerMetricFovVValue = createMetricCell("FoV V");
            composerMetricDistanceMoonValue = createMetricCell("Distance To Moon");
            composerMetricAngleValue = createMetricCell("Angle");
            viewport.appendChild(composerMetricsStrip);
        }

        let renderer = null;
        try {
            renderer = new this.THREE.WebGLRenderer({
                antialias: true,
            });
            if ("outputColorSpace" in renderer && this.THREE.SRGBColorSpace) {
                renderer.outputColorSpace = this.THREE.SRGBColorSpace;
            } else {
                renderer.outputEncoding = this.THREE.sRGBEncoding;
            }
            renderer.toneMapping = this.THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.14;
            renderer.shadowMap.enabled = true;
            if (this.THREE.PCFShadowMap) {
                renderer.shadowMap.type = this.THREE.PCFShadowMap;
            } else if (this.THREE.PCFSoftShadowMap) {
                renderer.shadowMap.type = this.THREE.PCFSoftShadowMap;
            }
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.setSize(1, 1);
            renderer.domElement.className = "aux-camera-view__canvas";
            renderer.domElement.setAttribute("aria-hidden", "true");
            viewport.appendChild(renderer.domElement);
        } catch (err) {
            panel.remove();
            return;
        }

        const overlayCanvas = document.createElement("canvas");
        overlayCanvas.className = "aux-camera-view__overlay-canvas";
        overlayCanvas.setAttribute("aria-hidden", "true");
        viewport.appendChild(overlayCanvas);
        const overlayCtx = overlayCanvas.getContext("2d");

        const chipButton = document.createElement("button");
        chipButton.className = "aux-camera-chip";
        chipButton.type = "button";
        chipButton.textContent = spec.chipLabel || spec.title;
        chipButton.setAttribute("aria-label", `Restore ${spec.title}`);
        chipButton.hidden = true;
        const chipDock = panelSide === "left" ? this.chipDockLeft : this.chipDockRight;
        chipDock?.appendChild(chipButton);

        const camera = new this.THREE.PerspectiveCamera(spec.defaultFov, 1, 0.0001, 100000);
        camera.up.set(0, 0, 1);

        const panelState = {
            id: spec.id,
            title: spec.title,
            anchorKey: spec.anchorKey || "craft",
            targetKey: spec.targetKey,
            infoMode: spec.infoMode || "none",
            mode: panelMode,
            side: panelSide,
            panel,
            viewport,
            renderer,
            camera,
            info,
            infoPrimary,
            infoPrimaryText,
            infoSecondary,
            infoPill,
            composerPresetWrap,
            composerLookFreeButton,
            composerLookEarthButton,
            composerLookMoonButton,
            composerFovWrap,
            composerTimelineWrap,
            composerTransportRow,
            composerTransportPlayButton,
            composerTransportMinusMinuteButton,
            composerTransportPlusMinuteButton,
            composerTransportSlowerButton,
            composerTransportSpeedButton,
            composerTransportFasterButton,
            composerTimelineSlider,
            composerTimelineLabel,
            composerTimelineLocalValue,
            composerFlybyEventsWrap,
            composerControlsWrap,
            composerEarthAmbientSlider,
            composerEarthAmbientValue,
            composerMoonAmbientSlider,
            composerMoonAmbientValue,
            composerMoonOutlineWrap,
            composerMoonOutlineCheckbox,
            composerOpticsWrap,
            composerOpticsBody,
            composerOpticsPhysicalButton,
            composerOpticsCameraButton,
            composerOpticsStrengthSlider,
            composerOpticsStrengthValue,
            composerOpticsAdvancedPanel,
            composerOpticsHaloSlider,
            composerOpticsHaloValue,
            composerOpticsStarburstSlider,
            composerOpticsStarburstValue,
            composerOpticsFlareSlider,
            composerOpticsFlareValue,
            composerRollSlider,
            composerRollValue,
            composerInfoOverlayWrap,
            composerInfoOverlayCheckbox,
            composerRaDecGridWrap,
            composerRaDecGridCheckbox,
            composerSkyLabelsWrap,
            composerSkyLabelsCheckbox,
            composerMetricsStrip,
            composerMetricFovHValue,
            composerMetricFovVValue,
            composerMetricDistanceMoonValue,
            composerMetricAngleValue,
            composerDisabledOverlay,
            overlayCanvas,
            overlayCtx,
            farSideTintEnabled: spec.infoMode === "moon-visibility",
            overlayDirty: true,
            lastOverlayUpdateMs: -Infinity,
            width: 0,
            height: 0,
            onFovInput: null,
            fovSlider,
            fovValue,
            autoToggle,
            minimizeButton,
            chipButton,
            autoFovEnabled: true,
            onAutoToggleClick: null,
            onMinimizeClick: null,
            onChipClick: null,
            onInfoPillClick: null,
            onComposerLookFreeClick: null,
            onComposerLookEarthClick: null,
            onComposerLookMoonClick: null,
            onComposerEarthAmbientInput: null,
            onComposerMoonAmbientInput: null,
            onComposerMoonOutlineToggle: null,
            onComposerOpticsPhysicalClick: null,
            onComposerOpticsCameraClick: null,
            onComposerOpticsStrengthInput: null,
            onComposerOpticsHaloInput: null,
            onComposerOpticsStarburstInput: null,
            onComposerOpticsFlareInput: null,
            onComposerTimelineInput: null,
            onComposerTimelinePointerDown: null,
            onComposerTimelinePointerUp: null,
            onComposerTransportPlayClick: null,
            onComposerTransportMinusMinuteClick: null,
            onComposerTransportPlusMinuteClick: null,
            onComposerTransportSlowerClick: null,
            onComposerTransportSpeedClick: null,
            onComposerTransportFasterClick: null,
            onComposerInfoOverlayToggle: null,
            onComposerRollInput: null,
            onComposerRaDecGridToggle: null,
            onComposerSkyLabelsToggle: null,
            onComposerViewportWheel: null,
            onComposerViewportPointerDown: null,
            onComposerViewportPointerMove: null,
            onComposerViewportPointerUp: null,
            onComposerPanelGatePointerDown: null,
            onPointerDown: null,
            onPointerMove: null,
            onPointerUp: null,
            onPointerCancel: null,
            x: 0,
            y: 0,
            onPanelPointerDown: null,
            minimized: false,
            composerOnboarded: true,
            composerLockTarget: "moon",
            composerYawRad: 0,
            composerPitchRad: 0,
            composerRollRad: COMPOSER_DEFAULT_ROLL_RAD,
            composerEarthAmbient: panelMode === "composer" ? COMPOSER_DEFAULT_EARTH_AMBIENT : 0,
            composerMoonAmbient: panelMode === "composer" ? COMPOSER_DEFAULT_MOON_AMBIENT : 0,
            composerMoonOutlineEnabled: false,
            composerSunProfile: "camera",
            composerSunStrength: COMPOSER_OPTICS_STRENGTH_DEFAULT,
            composerSunHaloGain: COMPOSER_OPTICS_ADVANCED_DEFAULT,
            composerSunStarburstGain: COMPOSER_OPTICS_ADVANCED_DEFAULT,
            composerSunFlareGain: COMPOSER_OPTICS_ADVANCED_DEFAULT,
            composerTimelineDragging: false,
            composerTimelineWindowMs: COMPOSER_TIMELINE_WINDOW_MS,
            composerTimelineStartMs: Number.NaN,
            composerTimelineEndMs: Number.NaN,
            composerFlybyEventsSignature: "",
            composerFlybyEventNodes: [],
            composerFlybySelectedEventTimeMs: Number.NaN,
            composerInteractionEnabled: true,
            composerInfoOverlayEnabled: true,
            composerRaDecGridEnabled: false,
            composerSkyLabelsEnabled: false,
            composerViewportPointer: null,
            missionEnabled: panelMode === "composer"
                ? this.composerEnabled
                : this.missionPanelsEnabled,
        };

        const syncAutoToggleUi = () => {
            const enabled = panelState.autoFovEnabled === true;
            fovSlider.disabled = enabled;
            autoToggle.classList.toggle("is-active", enabled);
            autoToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
            autoToggle.title = enabled ? "Auto FoV enabled" : "Auto FoV disabled";
        };

        const onFovInput = () => {
            const fov = Number(fovSlider.value);
            camera.fov = fov;
            camera.updateProjectionMatrix();
            fovValue.value = `${Math.round(fov)}°`;
            fovValue.textContent = fovValue.value;
            panelState.overlayDirty = true;
            this.requestRender?.();
            this.queuePersistPanelState();
        };
        const onAutoToggleClick = () => {
            panelState.autoFovEnabled = !panelState.autoFovEnabled;
            syncAutoToggleUi();
            if (panelState.autoFovEnabled) {
                this.requestRender?.();
            } else {
                onFovInput();
            }
            this.queuePersistPanelState();
        };
        const onMinimizeClick = () => {
            this.setPanelMinimized(panelState, true);
        };
        let syncComposerLockUi = null;
        const onChipClick = () => {
            if (panelState.mode === "composer") {
                panelState.composerLockTarget = "moon";
                syncComposerLockUi?.();
                panelState.autoFovEnabled = false;
                syncAutoToggleUi();
                this.setPanelFov(panelState, 50);
                this.seekMainTimelineTime(COMPOSER_DEFAULT_OPEN_TIME_MS, true);
            }
            this.setPanelMinimized(panelState, false);
            this.bringPanelToFront(panelState);
            if (panelState.mode === "composer" && panelState.composerInteractionEnabled !== true) {
                this.activateComposerWindow(panelState, { finalize: true });
            }
        };
        fovSlider.addEventListener("input", onFovInput, { passive: true });
        autoToggle.addEventListener("click", onAutoToggleClick);
        minimizeButton.addEventListener("click", onMinimizeClick);
        chipButton.addEventListener("click", onChipClick);
        panelState.onAutoToggleClick = onAutoToggleClick;
        panelState.onFovInput = onFovInput;
        panelState.onMinimizeClick = onMinimizeClick;
        panelState.onChipClick = onChipClick;

        if (panelState.mode === "composer") {
            syncComposerLockUi = () => {
                const lockTarget = panelState.composerLockTarget || "none";
                panelState.composerLookFreeButton?.classList.toggle("is-active", lockTarget === "none");
                panelState.composerLookEarthButton?.classList.toggle("is-active", lockTarget === "earth");
                panelState.composerLookMoonButton?.classList.toggle("is-active", lockTarget === "moon");
            };
            const syncComposerAmbientUi = () => {
                const syncOne = (slider, valueNode, ambientValue) => {
                    if (!slider || !valueNode) {
                        return;
                    }
                    slider.value = String(ambientValue);
                    const ambientText = ambientValue.toFixed(2);
                    valueNode.value = ambientText;
                    valueNode.textContent = ambientText;
                };
                syncOne(
                    panelState.composerEarthAmbientSlider,
                    panelState.composerEarthAmbientValue,
                    panelState.composerEarthAmbient,
                );
                syncOne(
                    panelState.composerMoonAmbientSlider,
                    panelState.composerMoonAmbientValue,
                    panelState.composerMoonAmbient,
                );
                if (panelState.composerMoonOutlineCheckbox) {
                    panelState.composerMoonOutlineCheckbox.checked = panelState.composerMoonOutlineEnabled === true;
                }
            };
            const syncComposerOpticsUi = () => {
                const profile = panelState.composerSunProfile === "physical" ? "physical" : "camera";
                panelState.composerOpticsPhysicalButton?.classList.toggle("is-active", profile === "physical");
                panelState.composerOpticsCameraButton?.classList.toggle("is-active", profile === "camera");
                if (panelState.composerOpticsStrengthSlider && panelState.composerOpticsStrengthValue) {
                    panelState.composerOpticsStrengthSlider.value = String(panelState.composerSunStrength);
                    const text = panelState.composerSunStrength.toFixed(2);
                    panelState.composerOpticsStrengthValue.value = text;
                    panelState.composerOpticsStrengthValue.textContent = text;
                }
                if (panelState.composerOpticsAdvancedPanel) {
                    panelState.composerOpticsAdvancedPanel.hidden = false;
                }
                const syncGain = (slider, valueNode, gain) => {
                    if (!slider || !valueNode) return;
                    slider.value = String(gain);
                    const text = gain.toFixed(2);
                    valueNode.value = text;
                    valueNode.textContent = text;
                };
                syncGain(panelState.composerOpticsHaloSlider, panelState.composerOpticsHaloValue, panelState.composerSunHaloGain);
                syncGain(panelState.composerOpticsStarburstSlider, panelState.composerOpticsStarburstValue, panelState.composerSunStarburstGain);
                syncGain(panelState.composerOpticsFlareSlider, panelState.composerOpticsFlareValue, panelState.composerSunFlareGain);
            };
            const setComposerOpticsProfile = (nextProfile) => {
                panelState.composerSunProfile = nextProfile === "physical" ? "physical" : "camera";
                syncComposerOpticsUi();
                this.requestRender?.();
            };
            const setComposerOpticsStrength = (nextStrength) => {
                const bounded = this.THREE.MathUtils.clamp(
                    Number(nextStrength),
                    COMPOSER_OPTICS_STRENGTH_MIN,
                    COMPOSER_OPTICS_STRENGTH_MAX,
                );
                if (!Number.isFinite(bounded)) {
                    return;
                }
                panelState.composerSunStrength = bounded;
                syncComposerOpticsUi();
                this.requestRender?.();
            };
            const setComposerOpticsGain = (key, nextValue) => {
                const bounded = this.THREE.MathUtils.clamp(
                    Number(nextValue),
                    COMPOSER_OPTICS_ADVANCED_MIN,
                    COMPOSER_OPTICS_ADVANCED_MAX,
                );
                if (!Number.isFinite(bounded)) {
                    return;
                }
                panelState[key] = bounded;
                syncComposerOpticsUi();
                this.requestRender?.();
            };
            const setComposerAmbient = (ambientKey, nextAmbient, { persist = false } = {}) => {
                const bounded = this.THREE.MathUtils.clamp(
                    Number(nextAmbient),
                    COMPOSER_MIN_AMBIENT,
                    COMPOSER_MAX_AMBIENT,
                );
                if (!Number.isFinite(bounded)) {
                    return;
                }
                panelState[ambientKey] = bounded;
                syncComposerAmbientUi();
                if (persist) {
                    this.queuePersistPanelState();
                }
                this.requestRender?.();
            };
            const syncComposerRollUi = () => {
                if (!panelState.composerRollSlider || !panelState.composerRollValue) {
                    return;
                }
                const normalizedRoll = ((panelState.composerRollRad % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
                panelState.composerRollRad = normalizedRoll;
                const degrees = Math.round(this.THREE.MathUtils.radToDeg(normalizedRoll)) % 360;
                panelState.composerRollSlider.value = String(degrees);
                const text = `${degrees}°`;
                panelState.composerRollValue.value = text;
                panelState.composerRollValue.textContent = text;
            };
            const onComposerRollInput = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                if (!panelState.composerRollSlider) {
                    return;
                }
                const degrees = Number(panelState.composerRollSlider.value);
                if (!Number.isFinite(degrees)) {
                    return;
                }
                panelState.composerRollRad = this.THREE.MathUtils.degToRad(degrees);
                syncComposerRollUi();
                this.requestRender?.();
            };
            const onComposerRaDecGridToggle = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                panelState.composerRaDecGridEnabled = !!panelState.composerRaDecGridCheckbox?.checked;
                panelState.overlayDirty = true;
                this.requestRender?.();
            };
            const onComposerSkyLabelsToggle = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                panelState.composerSkyLabelsEnabled = !!panelState.composerSkyLabelsCheckbox?.checked;
                panelState.overlayDirty = true;
                this.requestRender?.();
            };
            const setComposerLockTarget = (target) => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                }
                panelState.composerLockTarget = target;
                syncComposerLockUi();
                this.requestRender?.();
            };
            const onComposerLookFreeClick = () => {
                setComposerLockTarget("none");
            };
            const onComposerLookEarthClick = () => {
                setComposerLockTarget("earth");
            };
            const onComposerLookMoonClick = () => {
                setComposerLockTarget("moon");
            };
            const onComposerEarthAmbientInput = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                setComposerAmbient("composerEarthAmbient", panelState.composerEarthAmbientSlider?.value, { persist: true });
            };
            const onComposerMoonAmbientInput = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                setComposerAmbient("composerMoonAmbient", panelState.composerMoonAmbientSlider?.value, { persist: true });
            };
            const onComposerMoonOutlineToggle = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                panelState.composerMoonOutlineEnabled = !!panelState.composerMoonOutlineCheckbox?.checked;
                panelState.overlayDirty = true;
                this.requestRender?.();
            };
            const onComposerOpticsPhysicalClick = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                setComposerOpticsProfile("physical");
            };
            const onComposerOpticsCameraClick = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                setComposerOpticsProfile("camera");
            };
            const onComposerOpticsStrengthInput = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                setComposerOpticsStrength(panelState.composerOpticsStrengthSlider?.value);
            };
            const onComposerOpticsHaloInput = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                setComposerOpticsGain("composerSunHaloGain", panelState.composerOpticsHaloSlider?.value);
            };
            const onComposerOpticsStarburstInput = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                setComposerOpticsGain("composerSunStarburstGain", panelState.composerOpticsStarburstSlider?.value);
            };
            const onComposerOpticsFlareInput = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                setComposerOpticsGain("composerSunFlareGain", panelState.composerOpticsFlareSlider?.value);
            };
            const onComposerInfoOverlayToggle = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                panelState.composerInfoOverlayEnabled = !!panelState.composerInfoOverlayCheckbox?.checked;
                panelState.overlayDirty = true;
                this.requestRender?.();
            };
            const onComposerTimelineInput = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                if (!panelState.composerTimelineSlider) {
                    return;
                }
                const localMin = panelState.composerTimelineStartMs;
                const localMax = panelState.composerTimelineEndMs;
                if (!Number.isFinite(localMin) || !Number.isFinite(localMax) || localMax <= localMin) {
                    return;
                }
                const sliderValue = Number(panelState.composerTimelineSlider.value);
                const ratio = this.THREE.MathUtils.clamp(
                    sliderValue / COMPOSER_TIMELINE_RESOLUTION,
                    0,
                    1,
                );
                const targetMs = localMin + ((localMax - localMin) * ratio);
                this.seekMainTimelineTime(targetMs, false);
            };
            const onComposerTimelinePointerDown = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                panelState.composerTimelineDragging = true;
            };
            const onComposerTimelinePointerUp = () => {
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                panelState.composerTimelineDragging = false;
                if (!panelState.composerTimelineSlider) {
                    return;
                }
                const localMin = panelState.composerTimelineStartMs;
                const localMax = panelState.composerTimelineEndMs;
                if (!Number.isFinite(localMin) || !Number.isFinite(localMax) || localMax <= localMin) {
                    return;
                }
                const sliderValue = Number(panelState.composerTimelineSlider.value);
                const ratio = this.THREE.MathUtils.clamp(
                    sliderValue / COMPOSER_TIMELINE_RESOLUTION,
                    0,
                    1,
                );
                const targetMs = localMin + ((localMax - localMin) * ratio);
                this.seekMainTimelineTime(targetMs, true);
            };
            const REPEAT_PRESS_BUTTON_IDS = new Set(["slower", "faster", "realtime"]);
            const dispatchSyntheticPress = (target) => {
                if (!(target instanceof HTMLButtonElement) || target.disabled) {
                    return false;
                }
                if (typeof window !== "undefined" && typeof window.PointerEvent === "function") {
                    target.dispatchEvent(new PointerEvent("pointerdown", {
                        bubbles: true,
                        cancelable: true,
                        pointerId: 1,
                        pointerType: "mouse",
                        isPrimary: true,
                        button: 0,
                    }));
                    target.dispatchEvent(new PointerEvent("pointerup", {
                        bubbles: true,
                        cancelable: true,
                        pointerId: 1,
                        pointerType: "mouse",
                        isPrimary: true,
                        button: 0,
                    }));
                    return true;
                }
                target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
                target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                return true;
            };
            const clickMainControlButton = (id) => {
                const button = document.getElementById(id);
                if (!(button instanceof HTMLButtonElement)) {
                    return false;
                }
                if (button.disabled || button.getAttribute("aria-disabled") === "true") {
                    return false;
                }
                if (REPEAT_PRESS_BUTTON_IDS.has(id)) {
                    return dispatchSyntheticPress(button);
                }
                button.click();
                return true;
            };
            const onComposerTransportPlayClick = () => {
                clickMainControlButton("animate");
            };
            const onComposerTransportMinusMinuteClick = () => {
                const timelineState = this.readMainTimelineState();
                if (!timelineState) {
                    return;
                }
                this.seekMainTimelineTime(timelineState.value - 60000, true);
            };
            const onComposerTransportPlusMinuteClick = () => {
                const timelineState = this.readMainTimelineState();
                if (!timelineState) {
                    return;
                }
                this.seekMainTimelineTime(timelineState.value + 60000, true);
            };
            const onComposerTransportSlowerClick = () => {
                clickMainControlButton("slower");
            };
            const onComposerTransportSpeedClick = () => {
                clickMainControlButton("realtime");
            };
            const onComposerTransportFasterClick = () => {
                clickMainControlButton("faster");
            };
            const onComposerViewportWheel = (event) => {
                if (!(event instanceof WheelEvent)) {
                    return;
                }
                event.preventDefault();
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    return;
                }
                if (panelState.autoFovEnabled) {
                    panelState.autoFovEnabled = false;
                    syncAutoToggleUi();
                }
                const zoomScale = Math.exp(event.deltaY * 0.0015);
                const nextFov = this.THREE.MathUtils.clamp(
                    panelState.camera.fov * zoomScale,
                    AUTO_FOV_MIN_DEGREES,
                    AUTO_FOV_MAX_DEGREES,
                );
                panelState.fovSlider.value = String(Math.round(nextFov));
                onFovInput();
            };
            const onComposerViewportPointerDown = (event) => {
                if (event.button !== 0) {
                    return;
                }
                if (!panelState.composerInteractionEnabled) {
                    this.activateComposerWindow(panelState, { finalize: true });
                    event.preventDefault();
                    return;
                }
                panelState.composerViewportPointer = {
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY,
                };
                panelState.composerLockTarget = "none";
                syncComposerLockUi();
                panelState.viewport.setPointerCapture(event.pointerId);
                event.preventDefault();
            };
            const onComposerViewportPointerMove = (event) => {
                const drag = panelState.composerViewportPointer;
                if (!drag || drag.pointerId !== event.pointerId) {
                    return;
                }
                const dx = event.clientX - drag.clientX;
                const dy = event.clientY - drag.clientY;
                drag.clientX = event.clientX;
                drag.clientY = event.clientY;
                const look = this.tmpVectorE.copy(this.getComposerLookDirection(panelState));
                const up = this.tmpVectorF.copy(this.getComposerCameraUp(panelState, look));
                const yawAngle = dx * COMPOSER_DRAG_SENSITIVITY;
                this.tmpQuatA.setFromAxisAngle(up, yawAngle);
                look.applyQuaternion(this.tmpQuatA);
                up.applyQuaternion(this.tmpQuatA);

                const right = this.tmpVectorD.copy(look).cross(up);
                if (right.lengthSq() > 1e-12) {
                    right.normalize();
                    const pitchAngle = dy * COMPOSER_DRAG_SENSITIVITY;
                    this.tmpQuatB.setFromAxisAngle(right, pitchAngle);
                    look.applyQuaternion(this.tmpQuatB);
                    up.applyQuaternion(this.tmpQuatB);
                }
                this.setComposerOrientationFromLookUp(panelState, look, up);
                syncComposerRollUi();
                this.requestRender?.();
                event.preventDefault();
            };
            const releaseComposerViewport = (event) => {
                const drag = panelState.composerViewportPointer;
                if (!drag || drag.pointerId !== event.pointerId) {
                    return;
                }
                if (panelState.viewport.hasPointerCapture(event.pointerId)) {
                    panelState.viewport.releasePointerCapture(event.pointerId);
                }
                panelState.composerViewportPointer = null;
            };
            const onComposerPanelGatePointerDown = (event) => {
                if (panelState.composerInteractionEnabled) {
                    return;
                }
                if (!(event.target instanceof Element)) {
                    return;
                }
                if (event.target.closest(".aux-camera-view__composer-button")) {
                    return;
                }
                if (event.target.closest(".aux-camera-view__header")) {
                    return;
                }
                const jumped = this.activateComposerWindow(panelState, { finalize: true });
                if (jumped) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            };

            panelState.composerLookFreeButton?.addEventListener("click", onComposerLookFreeClick);
            panelState.composerLookEarthButton?.addEventListener("click", onComposerLookEarthClick);
            panelState.composerLookMoonButton?.addEventListener("click", onComposerLookMoonClick);
            panelState.composerEarthAmbientSlider?.addEventListener("input", onComposerEarthAmbientInput, { passive: true });
            panelState.composerMoonAmbientSlider?.addEventListener("input", onComposerMoonAmbientInput, { passive: true });
            panelState.composerMoonOutlineCheckbox?.addEventListener("change", onComposerMoonOutlineToggle);
            panelState.composerOpticsPhysicalButton?.addEventListener("click", onComposerOpticsPhysicalClick);
            panelState.composerOpticsCameraButton?.addEventListener("click", onComposerOpticsCameraClick);
            panelState.composerOpticsStrengthSlider?.addEventListener("input", onComposerOpticsStrengthInput, { passive: true });
            panelState.composerOpticsHaloSlider?.addEventListener("input", onComposerOpticsHaloInput, { passive: true });
            panelState.composerOpticsStarburstSlider?.addEventListener("input", onComposerOpticsStarburstInput, { passive: true });
            panelState.composerOpticsFlareSlider?.addEventListener("input", onComposerOpticsFlareInput, { passive: true });
            panelState.composerTimelineSlider?.addEventListener("input", onComposerTimelineInput, { passive: true });
            panelState.composerTimelineSlider?.addEventListener("pointerdown", onComposerTimelinePointerDown);
            panelState.composerTimelineSlider?.addEventListener("pointerup", onComposerTimelinePointerUp);
            panelState.composerTimelineSlider?.addEventListener("change", onComposerTimelinePointerUp);
            panelState.composerTransportPlayButton?.addEventListener("click", onComposerTransportPlayClick);
            panelState.composerTransportMinusMinuteButton?.addEventListener("click", onComposerTransportMinusMinuteClick);
            panelState.composerTransportPlusMinuteButton?.addEventListener("click", onComposerTransportPlusMinuteClick);
            panelState.composerTransportSlowerButton?.addEventListener("click", onComposerTransportSlowerClick);
            panelState.composerTransportSpeedButton?.addEventListener("click", onComposerTransportSpeedClick);
            panelState.composerTransportFasterButton?.addEventListener("click", onComposerTransportFasterClick);
            panelState.composerInfoOverlayCheckbox?.addEventListener("change", onComposerInfoOverlayToggle);
            panelState.composerRollSlider?.addEventListener("input", onComposerRollInput, { passive: true });
            panelState.composerRaDecGridCheckbox?.addEventListener("change", onComposerRaDecGridToggle);
            panelState.composerSkyLabelsCheckbox?.addEventListener("change", onComposerSkyLabelsToggle);
            panelState.viewport.addEventListener("wheel", onComposerViewportWheel, { passive: false });
            panelState.viewport.addEventListener("pointerdown", onComposerViewportPointerDown);
            panelState.viewport.addEventListener("pointermove", onComposerViewportPointerMove);
            panelState.viewport.addEventListener("pointerup", releaseComposerViewport);
            panelState.viewport.addEventListener("pointercancel", releaseComposerViewport);
            panelState.panel.addEventListener("pointerdown", onComposerPanelGatePointerDown, true);

            panelState.onComposerLookFreeClick = onComposerLookFreeClick;
            panelState.onComposerLookEarthClick = onComposerLookEarthClick;
            panelState.onComposerLookMoonClick = onComposerLookMoonClick;
            panelState.onComposerEarthAmbientInput = onComposerEarthAmbientInput;
            panelState.onComposerMoonAmbientInput = onComposerMoonAmbientInput;
            panelState.onComposerMoonOutlineToggle = onComposerMoonOutlineToggle;
            panelState.onComposerOpticsPhysicalClick = onComposerOpticsPhysicalClick;
            panelState.onComposerOpticsCameraClick = onComposerOpticsCameraClick;
            panelState.onComposerOpticsStrengthInput = onComposerOpticsStrengthInput;
            panelState.onComposerOpticsHaloInput = onComposerOpticsHaloInput;
            panelState.onComposerOpticsStarburstInput = onComposerOpticsStarburstInput;
            panelState.onComposerOpticsFlareInput = onComposerOpticsFlareInput;
            panelState.onComposerTimelineInput = onComposerTimelineInput;
            panelState.onComposerTimelinePointerDown = onComposerTimelinePointerDown;
            panelState.onComposerTimelinePointerUp = onComposerTimelinePointerUp;
            panelState.onComposerTransportPlayClick = onComposerTransportPlayClick;
            panelState.onComposerTransportMinusMinuteClick = onComposerTransportMinusMinuteClick;
            panelState.onComposerTransportPlusMinuteClick = onComposerTransportPlusMinuteClick;
            panelState.onComposerTransportSlowerClick = onComposerTransportSlowerClick;
            panelState.onComposerTransportSpeedClick = onComposerTransportSpeedClick;
            panelState.onComposerTransportFasterClick = onComposerTransportFasterClick;
            panelState.onComposerInfoOverlayToggle = onComposerInfoOverlayToggle;
            panelState.onComposerRollInput = onComposerRollInput;
            panelState.onComposerRaDecGridToggle = onComposerRaDecGridToggle;
            panelState.onComposerSkyLabelsToggle = onComposerSkyLabelsToggle;
            panelState.onComposerViewportWheel = onComposerViewportWheel;
            panelState.onComposerViewportPointerDown = onComposerViewportPointerDown;
            panelState.onComposerViewportPointerMove = onComposerViewportPointerMove;
            panelState.onComposerViewportPointerUp = releaseComposerViewport;
            panelState.onComposerPanelGatePointerDown = onComposerPanelGatePointerDown;
            setComposerAmbient("composerEarthAmbient", panelState.composerEarthAmbient, { persist: false });
            setComposerAmbient("composerMoonAmbient", panelState.composerMoonAmbient, { persist: false });
            syncComposerLockUi();
            syncComposerOpticsUi();
            syncComposerRollUi();
        }

        const persisted = this.persistedPanelState?.[spec.id];
        if (persisted && typeof persisted === "object") {
            if (panelState.mode !== "composer") {
                if (typeof persisted.autoFovEnabled === "boolean") {
                    panelState.autoFovEnabled = persisted.autoFovEnabled;
                }
                const persistedFov = Number(persisted.fov);
                if (Number.isFinite(persistedFov)) {
                    const boundedFov = this.THREE.MathUtils.clamp(
                        persistedFov,
                        AUTO_FOV_MIN_DEGREES,
                        AUTO_FOV_MAX_DEGREES,
                    );
                    fovSlider.value = String(Math.round(boundedFov));
                    camera.fov = boundedFov;
                    camera.updateProjectionMatrix();
                }
            }
        }
        if (panelState.mode === "composer") {
            panelState.autoFovEnabled = false;
            fovSlider.value = String(Math.round(spec.defaultFov));
            camera.fov = spec.defaultFov;
            camera.updateProjectionMatrix();
            panelState.composerEarthAmbient = COMPOSER_DEFAULT_EARTH_AMBIENT;
            panelState.composerMoonAmbient = COMPOSER_DEFAULT_MOON_AMBIENT;
            panelState.composerMoonOutlineEnabled = false;
            panelState.composerSunProfile = "camera";
            panelState.composerSunStrength = COMPOSER_OPTICS_STRENGTH_DEFAULT;
            panelState.composerSunHaloGain = COMPOSER_OPTICS_ADVANCED_DEFAULT;
            panelState.composerSunStarburstGain = COMPOSER_OPTICS_ADVANCED_DEFAULT;
            panelState.composerSunFlareGain = COMPOSER_OPTICS_ADVANCED_DEFAULT;
            panelState.composerInfoOverlayEnabled = true;
            panelState.composerRaDecGridEnabled = false;
            panelState.composerSkyLabelsEnabled = false;
            if (panelState.composerInfoOverlayCheckbox) {
                panelState.composerInfoOverlayCheckbox.checked = true;
            }
            if (panelState.composerEarthAmbientSlider && panelState.composerEarthAmbientValue) {
                panelState.composerEarthAmbientSlider.value = String(panelState.composerEarthAmbient);
                const ambientText = panelState.composerEarthAmbient.toFixed(2);
                panelState.composerEarthAmbientValue.value = ambientText;
                panelState.composerEarthAmbientValue.textContent = ambientText;
            }
            if (panelState.composerMoonAmbientSlider && panelState.composerMoonAmbientValue) {
                panelState.composerMoonAmbientSlider.value = String(panelState.composerMoonAmbient);
                const ambientText = panelState.composerMoonAmbient.toFixed(2);
                panelState.composerMoonAmbientValue.value = ambientText;
                panelState.composerMoonAmbientValue.textContent = ambientText;
            }
            if (panelState.composerMoonOutlineCheckbox) {
                panelState.composerMoonOutlineCheckbox.checked = panelState.composerMoonOutlineEnabled;
            }
            if (panelState.composerRaDecGridCheckbox) {
                panelState.composerRaDecGridCheckbox.checked = false;
            }
            if (panelState.composerSkyLabelsCheckbox) {
                panelState.composerSkyLabelsCheckbox.checked = false;
            }
        }
        syncAutoToggleUi();
        onFovInput();
        if (panelState.mode === "composer") {
            this.updateComposerChipPresentation(panelState);
        }

        if (panelState.infoMode === "moon-visibility" && infoPill) {
            const onInfoPillClick = () => {
                panelState.farSideTintEnabled = !panelState.farSideTintEnabled;
                panelState.overlayDirty = true;
                this.requestRender?.();
            };
            infoPill.addEventListener("click", onInfoPillClick);
            panelState.onInfoPillClick = onInfoPillClick;
        } else if (infoPill) {
            infoPill.disabled = true;
        }

        this.root.appendChild(panel);
        this.panels.push(panelState);
        this.bindPanelDragging(panelState, header);
        panelState.onPanelPointerDown = () => {
            this.bringPanelToFront(panelState);
        };
        panel.addEventListener("pointerdown", panelState.onPanelPointerDown);
        const defaultPosition = this.getDefaultPanelPosition(panel, index);
        this.applyPanelPosition(panelState, defaultPosition.x, defaultPosition.y);
        this.bringPanelToFront(panelState);

        this.panelStateByElement.set(panel, panelState);
        const resizeObserver = this.getPanelResizeObserver();
        resizeObserver?.observe(panel);
        this.syncPanelSize(panelState);
        // Startup behavior: open all enabled panels, including composer.
        const startMinimized = false;
        this.setPanelMinimized(panelState, startMinimized, {
            persist: false,
            requestRender: false,
        });
        this.setPanelMissionEnabled(panelState, panelState.missionEnabled);
    }

    handlePanelResizeEntries(entries) {
        for (const entry of entries || []) {
            const panelState = this.panelStateByElement.get(entry.target);
            if (panelState) {
                this.pendingResizePanelStates.add(panelState);
            }
        }

        if (this.pendingResizeRaf != null) {
            return;
        }
        this.pendingResizeRaf = requestAnimationFrame(() => {
            this.pendingResizeRaf = null;
            for (const panelState of this.pendingResizePanelStates) {
                this.syncPanelSize(panelState);
            }
            this.pendingResizePanelStates.clear();
            this.queuePersistPanelState();
            this.requestRender?.();
        });
    }

    handleResize() {
        if (!this.root) {
            return;
        }
        const visible = this.panelsEnabled && isDesktopViewport();
        this.root.hidden = !visible;
        if (!visible) return;
        this.applyDefaultPanelLayout();
        for (const panelState of this.panels) {
            this.syncPanelSize(panelState);
        }
        this.queuePersistPanelState();
    }

    setPanelVisible(panelState, visible) {
        if (panelState?.missionEnabled === false) {
            panelState.panel.hidden = true;
            if (panelState.chipButton) {
                panelState.chipButton.hidden = true;
            }
            this.clearPanelOverlay(panelState);
            return;
        }
        const shouldShowPanel = visible && panelState.minimized !== true;
        panelState.panel.hidden = !shouldShowPanel;
        if (panelState.chipButton) {
            panelState.chipButton.hidden = panelState.minimized !== true;
        }
        if (!shouldShowPanel) {
            this.clearPanelOverlay(panelState);
        }
    }

    setPanelInfo(panelState, primary = "", secondary = "", options = {}) {
        if (!panelState?.info || !panelState?.infoPrimaryText || !panelState?.infoSecondary || !panelState?.infoPill) {
            return;
        }
        const hasInfoMode = panelState.infoMode && panelState.infoMode !== "none";
        if (!hasInfoMode) {
            panelState.info.hidden = true;
            return;
        }
        panelState.info.hidden = false;
        panelState.infoPrimaryText.textContent = primary || "";
        panelState.infoSecondary.textContent = secondary || "";
        panelState.infoSecondary.hidden = !secondary;

        const pillText = typeof options.pillText === "string" ? options.pillText.trim() : "";
        const pillVariant = typeof options.pillVariant === "string" ? options.pillVariant.trim() : "";
        panelState.infoPill.hidden = pillText.length === 0;
        panelState.infoPill.textContent = pillText;
        panelState.infoPill.className = "aux-camera-view__pill";
        if (pillText.length > 0 && pillVariant.length > 0) {
            panelState.infoPill.classList.add(`aux-camera-view__pill--${pillVariant}`);
        }

        const pillInteractive = options.pillInteractive === true;
        panelState.infoPill.disabled = !pillInteractive;
        if (pillInteractive) {
            panelState.infoPill.classList.add("aux-camera-view__pill--button");
            const pressed = options.pillOn === true;
            panelState.infoPill.setAttribute("aria-pressed", pressed ? "true" : "false");
            panelState.infoPill.classList.toggle("is-on", pressed);
            panelState.infoPill.classList.toggle("is-off", !pressed);
            panelState.infoPill.title = pressed ? "Disable far-side overlay" : "Enable far-side overlay";
        } else {
            panelState.infoPill.removeAttribute("aria-pressed");
            panelState.infoPill.classList.remove("aux-camera-view__pill--button", "is-on", "is-off");
            panelState.infoPill.title = "";
        }
    }

    setComposerInteractionEnabled(panelState, enabled) {
        if (!panelState || panelState.mode !== "composer") {
            return;
        }
        const isEnabled = enabled === true;
        panelState.composerInteractionEnabled = isEnabled;
        panelState.panel.classList.toggle("aux-camera-view--composer-disabled", !isEnabled);

        const disableControls = !isEnabled;
        if (panelState.autoToggle) {
            panelState.autoToggle.disabled = disableControls;
        }
        if (panelState.fovSlider) {
            panelState.fovSlider.disabled = disableControls || panelState.autoFovEnabled;
        }
        panelState.composerLookFreeButton && (panelState.composerLookFreeButton.disabled = false);
        panelState.composerLookEarthButton && (panelState.composerLookEarthButton.disabled = false);
        panelState.composerLookMoonButton && (panelState.composerLookMoonButton.disabled = false);
        panelState.composerEarthAmbientSlider && (panelState.composerEarthAmbientSlider.disabled = disableControls);
        panelState.composerMoonAmbientSlider && (panelState.composerMoonAmbientSlider.disabled = disableControls);
        panelState.composerMoonOutlineCheckbox && (panelState.composerMoonOutlineCheckbox.disabled = disableControls);
        panelState.composerOpticsPhysicalButton && (panelState.composerOpticsPhysicalButton.disabled = disableControls);
        panelState.composerOpticsCameraButton && (panelState.composerOpticsCameraButton.disabled = disableControls);
        panelState.composerOpticsStrengthSlider && (panelState.composerOpticsStrengthSlider.disabled = disableControls);
        panelState.composerOpticsHaloSlider && (panelState.composerOpticsHaloSlider.disabled = disableControls);
        panelState.composerOpticsStarburstSlider && (panelState.composerOpticsStarburstSlider.disabled = disableControls);
        panelState.composerOpticsFlareSlider && (panelState.composerOpticsFlareSlider.disabled = disableControls);
        panelState.composerRollSlider && (panelState.composerRollSlider.disabled = disableControls);
        panelState.composerRaDecGridCheckbox && (panelState.composerRaDecGridCheckbox.disabled = disableControls);
        panelState.composerSkyLabelsCheckbox && (panelState.composerSkyLabelsCheckbox.disabled = disableControls);
        if (panelState.composerTimelineSlider) {
            panelState.composerTimelineSlider.disabled = disableControls;
        }
        if (panelState.composerDisabledOverlay) {
            panelState.composerDisabledOverlay.hidden = isEnabled;
        }
    }

    setPanelMissionEnabled(panelState, enabled) {
        panelState.missionEnabled = enabled === true;
        if (panelState.missionEnabled) {
            if (panelState.minimized === true) {
                panelState.panel.hidden = true;
                if (panelState.chipButton) panelState.chipButton.hidden = false;
            } else {
                panelState.panel.hidden = false;
                if (panelState.chipButton) panelState.chipButton.hidden = true;
            }
            return;
        }
        panelState.panel.hidden = true;
        if (panelState.chipButton) {
            panelState.chipButton.hidden = true;
        }
        this.clearPanelOverlay(panelState);
    }

    syncMissionPanelPolicy(missionConfig) {
        const nextPanelsEnabled = shouldEnableAuxiliaryPanels(missionConfig);
        const nextComposerEnabled = nextPanelsEnabled && shouldEnableEarthriseComposer(missionConfig);
        if (
            this.missionPanelsEnabled === nextPanelsEnabled &&
            this.composerEnabled === nextComposerEnabled
        ) {
            return;
        }
        this.missionPanelsEnabled = nextPanelsEnabled;
        this.composerEnabled = nextComposerEnabled;
        for (const panelState of this.panels) {
            const enabled = panelState.mode === "composer"
                ? this.composerEnabled
                : this.missionPanelsEnabled;
            this.setPanelMissionEnabled(panelState, enabled);
        }
    }

    activateComposerWindow(panelState, { finalize = true } = {}) {
        if (!panelState || panelState.mode !== "composer") {
            return false;
        }
        const startMs = panelState.composerTimelineStartMs;
        const endMs = panelState.composerTimelineEndMs;
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
            return false;
        }
        const targetMs = startMs + ((endMs - startMs) * 0.5);
        this.seekMainTimelineTime(targetMs, finalize);
        return true;
    }

    readMainTimelineState() {
        const slider = document.getElementById("timeline-slider");
        if (!(slider instanceof HTMLInputElement)) {
            return null;
        }
        const min = Number(slider.min);
        const max = Number(slider.max);
        const value = Number(slider.value);
        const step = Number(slider.step);
        if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(value)) {
            return null;
        }
        return {
            slider,
            min: Math.min(min, max),
            max: Math.max(min, max),
            value: this.THREE.MathUtils.clamp(value, Math.min(min, max), Math.max(min, max)),
            stepMs: Number.isFinite(step) && step > 0 ? step : 1,
        };
    }

    seekMainTimelineTime(timeMs, finalize = false) {
        const timelineState = this.readMainTimelineState();
        if (!timelineState) {
            return;
        }
        const clamped = this.THREE.MathUtils.clamp(timeMs, timelineState.min, timelineState.max);
        timelineState.slider.value = String(clamped);
        timelineState.slider.dispatchEvent(new Event("input", { bubbles: true }));
        if (finalize) {
            timelineState.slider.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    formatComposerWindowLabel(windowMs) {
        const safeMs = Math.max(0, windowMs);
        const totalMinutes = Math.round(safeMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours <= 0) {
            return `+/-${Math.max(1, minutes)}m`;
        }
        if (minutes <= 0) {
            return `+/-${hours}h`;
        }
        return `+/-${hours}h ${minutes}m`;
    }

    formatLocalDateTime(timeMs) {
        if (!Number.isFinite(timeMs)) {
            return "--";
        }
        try {
            const datePart = new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "2-digit",
            }).format(timeMs);
            const timePart = new Intl.DateTimeFormat(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZoneName: "short",
            }).format(timeMs);
            return `${datePart} ${timePart}`;
        } catch {
            return new Date(timeMs).toLocaleString();
        }
    }

    setComposerTimelineLocalText(panelState, timeMs) {
        const localValue = panelState?.composerTimelineLocalValue;
        if (!localValue) {
            return;
        }
        localValue.textContent = `Local: ${this.formatLocalDateTime(timeMs)}`;
    }

    syncComposerTransportUi(panelState, timelineState = null) {
        const playButton = panelState?.composerTransportPlayButton;
        const minusMinuteButton = panelState?.composerTransportMinusMinuteButton;
        const plusMinuteButton = panelState?.composerTransportPlusMinuteButton;
        const slowerButton = panelState?.composerTransportSlowerButton;
        const speedButton = panelState?.composerTransportSpeedButton;
        const fasterButton = panelState?.composerTransportFasterButton;
        if (!playButton || !minusMinuteButton || !plusMinuteButton || !slowerButton || !speedButton || !fasterButton) {
            return;
        }

        const mainPlayButton = document.getElementById("animate");
        if (mainPlayButton instanceof HTMLButtonElement) {
            playButton.textContent = mainPlayButton.textContent || "Play";
            playButton.disabled = mainPlayButton.disabled || mainPlayButton.getAttribute("aria-disabled") === "true";
            const mainPlayTitle = mainPlayButton.getAttribute("title");
            if (mainPlayTitle) {
                playButton.setAttribute("title", mainPlayTitle);
            }
        } else {
            playButton.textContent = "Play";
            playButton.disabled = true;
        }

        const mainSlowerButton = document.getElementById("slower");
        if (mainSlowerButton instanceof HTMLButtonElement) {
            slowerButton.disabled =
                mainSlowerButton.disabled || mainSlowerButton.getAttribute("aria-disabled") === "true";
        } else {
            slowerButton.disabled = true;
        }

        const mainSpeedButton = document.getElementById("realtime");
        if (mainSpeedButton instanceof HTMLButtonElement) {
            speedButton.textContent = (mainSpeedButton.textContent || "1 sec/sec").trim();
            speedButton.disabled =
                mainSpeedButton.disabled || mainSpeedButton.getAttribute("aria-disabled") === "true";
            const mainSpeedTitle = mainSpeedButton.getAttribute("title");
            if (mainSpeedTitle) {
                speedButton.setAttribute("title", mainSpeedTitle);
            }
        } else {
            speedButton.textContent = "1 sec/sec";
            speedButton.disabled = true;
        }

        const mainFasterButton = document.getElementById("faster");
        if (mainFasterButton instanceof HTMLButtonElement) {
            fasterButton.disabled =
                mainFasterButton.disabled || mainFasterButton.getAttribute("aria-disabled") === "true";
        } else {
            fasterButton.disabled = true;
        }

        const activeTimelineState = timelineState || this.readMainTimelineState();
        if (!activeTimelineState) {
            minusMinuteButton.disabled = true;
            plusMinuteButton.disabled = true;
            return;
        }
        minusMinuteButton.disabled = activeTimelineState.value <= activeTimelineState.min;
        plusMinuteButton.disabled = activeTimelineState.value >= activeTimelineState.max;
    }

    syncComposerFlybyEventPills(panelState, currentTimeMs) {
        const wrap = panelState?.composerFlybyEventsWrap;
        if (!wrap) {
            return;
        }
        const flybyEvents = Array.isArray(this.composerFlybyEvents) ? this.composerFlybyEvents : [];
        const signature = flybyEvents.map((eventInfo) => `${eventInfo.id}:${eventInfo.timeMs}`).join("|");
        if (panelState.composerFlybyEventsSignature !== signature) {
            wrap.replaceChildren();
            panelState.composerFlybyEventNodes = [];
            panelState.composerFlybyEventsSignature = signature;
            panelState.composerFlybySelectedEventTimeMs = Number.NaN;
            for (const eventInfo of flybyEvents) {
                const pill = document.createElement("button");
                pill.type = "button";
                pill.className = "aux-camera-view__composer-event-pill";
                pill.setAttribute("aria-label", `Jump timeline to ${eventInfo.title}`);
                const title = document.createElement("span");
                title.className = "aux-camera-view__composer-event-pill-title";
                title.textContent = eventInfo.title || eventInfo.sourceLabel || "Event";
                const time = document.createElement("span");
                time.className = "aux-camera-view__composer-event-pill-time";
                time.textContent = this.formatLocalDateTime(eventInfo.timeMs);
                pill.appendChild(title);
                pill.appendChild(time);
                pill.addEventListener("click", () => {
                    panelState.composerFlybySelectedEventTimeMs = eventInfo.timeMs;
                    this.seekMainTimelineTime(eventInfo.timeMs, true);
                    this.syncComposerFlybyEventPills(panelState, eventInfo.timeMs);
                    this.requestRender?.();
                });
                wrap.appendChild(pill);
                panelState.composerFlybyEventNodes.push({
                    element: pill,
                    id: eventInfo.id,
                    timeMs: eventInfo.timeMs,
                });
            }
        }
        const eventNodes = Array.isArray(panelState.composerFlybyEventNodes)
            ? panelState.composerFlybyEventNodes
            : [];
        if (eventNodes.length === 0) {
            return;
        }
        let activeIndex = -1;
        const selectedEventTimeMs = panelState.composerFlybySelectedEventTimeMs;
        const selectedEventIndex = Number.isFinite(selectedEventTimeMs)
            ? eventNodes.findIndex((eventNode) => eventNode.timeMs === selectedEventTimeMs)
            : -1;
        if (selectedEventIndex >= 0 && Number.isFinite(currentTimeMs)) {
            const timelineStepMs = Math.max(
                1,
                Math.round(this.readMainTimelineState()?.stepMs || 1),
            );
            const selectionToleranceMs = Math.max(1000, timelineStepMs + 1);
            if (Math.abs(currentTimeMs - selectedEventTimeMs) <= selectionToleranceMs) {
                activeIndex = selectedEventIndex;
            } else {
                panelState.composerFlybySelectedEventTimeMs = Number.NaN;
            }
        }
        if (Number.isFinite(currentTimeMs)) {
            if (activeIndex < 0) {
                for (let i = 0; i < eventNodes.length; i += 1) {
                    if (currentTimeMs >= eventNodes[i].timeMs) {
                        activeIndex = i;
                    } else {
                        break;
                    }
                }
            }
            if (activeIndex < 0) {
                activeIndex = 0;
            }
        }
        for (let i = 0; i < eventNodes.length; i += 1) {
            eventNodes[i].element.classList.toggle("is-active", i === activeIndex);
        }
    }

    resolveLunarFlybyTimeMs(eventInfos) {
        return resolveLunarFlybyTimeMs(eventInfos);
    }

    setComposerLookFromDirection(panelState, directionVector) {
        const len = directionVector?.length?.() || 0;
        if (!Number.isFinite(len) || len <= 1e-9) {
            return false;
        }
        this.composerLookWorld.copy(directionVector).multiplyScalar(1 / len);
        const planar = Math.hypot(this.composerLookWorld.x, this.composerLookWorld.y);
        panelState.composerYawRad = Math.atan2(this.composerLookWorld.y, this.composerLookWorld.x);
        panelState.composerPitchRad = Math.atan2(this.composerLookWorld.z, Math.max(planar, 1e-9));
        panelState.composerPitchRad = this.THREE.MathUtils.clamp(
            panelState.composerPitchRad,
            -COMPOSER_MAX_PITCH_RAD,
            COMPOSER_MAX_PITCH_RAD,
        );
        return true;
    }

    applyComposerPreset(panelState, presetKey, { craftWorld, earthWorld, moonWorld }) {
        const preset = presetKey === "moon" ? "moon" : "earth";
        const source = preset === "moon" ? moonWorld : earthWorld;
        if (!source || !craftWorld) {
            return false;
        }
        this.tmpVectorA.subVectors(source, craftWorld);
        return this.setComposerLookFromDirection(panelState, this.tmpVectorA);
    }

    syncComposerTimelineUi(panelState) {
        const slider = panelState.composerTimelineSlider;
        if (!slider) {
            return;
        }
        const timelineState = this.readMainTimelineState();
        this.syncComposerTransportUi(panelState, timelineState);
        if (!timelineState) {
            panelState.composerTimelineLabel.textContent = "Time unavailable";
            this.setComposerTimelineLocalText(panelState, Number.NaN);
            this.syncComposerFlybyEventPills(panelState, Number.NaN);
            this.setComposerInteractionEnabled(panelState, false);
            return;
        }
        const fullSpan = Math.max(0, timelineState.max - timelineState.min);
        const hasFlybyWindow =
            Number.isFinite(this.composerFlybyWindowStartMs) &&
            Number.isFinite(this.composerFlybyWindowEndMs) &&
            this.composerFlybyWindowEndMs > this.composerFlybyWindowStartMs;
        let startMs;
        let endMs;
        if (hasFlybyWindow) {
            startMs = this.THREE.MathUtils.clamp(
                this.composerFlybyWindowStartMs,
                timelineState.min,
                timelineState.max,
            );
            endMs = this.THREE.MathUtils.clamp(
                this.composerFlybyWindowEndMs,
                timelineState.min,
                timelineState.max,
            );
        } else {
            const hasFlybyAnchor = Number.isFinite(this.composerFlybyTimeMs);
            const anchorMs = hasFlybyAnchor ? this.composerFlybyTimeMs : timelineState.value;
            const windowSpan = Math.min(fullSpan, panelState.composerTimelineWindowMs);
            const halfSpan = windowSpan * 0.5;
            startMs = anchorMs - halfSpan;
            endMs = anchorMs + halfSpan;
            if (startMs < timelineState.min) {
                endMs += timelineState.min - startMs;
                startMs = timelineState.min;
            }
            if (endMs > timelineState.max) {
                startMs -= endMs - timelineState.max;
                endMs = timelineState.max;
            }
            startMs = Math.max(timelineState.min, startMs);
            endMs = Math.min(timelineState.max, endMs);
        }
        if (endMs <= startMs) {
            endMs = Math.min(timelineState.max, startMs + 1);
        }

        panelState.composerTimelineStartMs = startMs;
        panelState.composerTimelineEndMs = endMs;
        const inFlybyWindow = timelineState.value >= startMs && timelineState.value <= endMs;
        this.setComposerInteractionEnabled(panelState, inFlybyWindow);
        panelState.composerTimelineLabel.textContent = "Time";
        this.setComposerTimelineLocalText(panelState, timelineState.value);
        this.syncComposerFlybyEventPills(panelState, timelineState.value);

        if (!panelState.composerTimelineDragging) {
            const ratio = this.THREE.MathUtils.clamp((timelineState.value - startMs) / Math.max(endMs - startMs, 1), 0, 1);
            slider.value = String(Math.round(ratio * COMPOSER_TIMELINE_RESOLUTION));
        }
    }

    getComposerLookDirection(panelState) {
        const cosPitch = Math.cos(panelState.composerPitchRad);
        this.composerLookWorld.set(
            Math.cos(panelState.composerYawRad) * cosPitch,
            Math.sin(panelState.composerYawRad) * cosPitch,
            Math.sin(panelState.composerPitchRad),
        );
        const len = this.composerLookWorld.length();
        if (len <= 1e-9) {
            this.composerLookWorld.set(1, 0, 0);
        } else {
            this.composerLookWorld.multiplyScalar(1 / len);
        }
        return this.composerLookWorld;
    }

    updateComposerRollUi(panelState) {
        const slider = panelState?.composerRollSlider;
        const valueNode = panelState?.composerRollValue;
        if (!slider || !valueNode) {
            return;
        }
        const rawRoll = Number.isFinite(panelState.composerRollRad) ? panelState.composerRollRad : 0;
        const roll = ((rawRoll % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
        panelState.composerRollRad = roll;
        const degrees = Math.round(this.THREE.MathUtils.radToDeg(roll)) % 360;
        slider.value = String(degrees);
        const text = `${degrees}°`;
        valueNode.value = text;
        valueNode.textContent = text;
    }

    getComposerCameraUp(panelState, lookDirWorld) {
        this.composerBaseUp.copy(this.composerWorldUp);
        this.tmpVectorD.copy(lookDirWorld).multiplyScalar(this.composerBaseUp.dot(lookDirWorld));
        this.composerBaseUp.sub(this.tmpVectorD);
        if (this.composerBaseUp.lengthSq() <= 1e-10) {
            this.composerBaseUp.set(0, 1, 0);
            this.tmpVectorD.copy(lookDirWorld).multiplyScalar(this.composerBaseUp.dot(lookDirWorld));
            this.composerBaseUp.sub(this.tmpVectorD);
        }
        if (this.composerBaseUp.lengthSq() <= 1e-10) {
            this.composerBaseUp.set(1, 0, 0);
        } else {
            this.composerBaseUp.normalize();
        }
        const roll = Number.isFinite(panelState.composerRollRad) ? panelState.composerRollRad : 0;
        this.composerRotatedUp.copy(this.composerBaseUp).applyAxisAngle(lookDirWorld, roll).normalize();
        return this.composerRotatedUp;
    }

    setComposerOrientationFromLookUp(panelState, lookDirWorld, upDirWorld) {
        const look = this.tmpVectorE.copy(lookDirWorld);
        if (!Number.isFinite(look.x) || !Number.isFinite(look.y) || !Number.isFinite(look.z) || look.lengthSq() <= 1e-12) {
            return false;
        }
        look.normalize();
        const planar = Math.hypot(look.x, look.y);
        panelState.composerYawRad = Math.atan2(look.y, look.x);
        panelState.composerPitchRad = Math.atan2(look.z, Math.max(planar, 1e-9));
        panelState.composerPitchRad = this.THREE.MathUtils.clamp(
            panelState.composerPitchRad,
            -COMPOSER_MAX_PITCH_RAD,
            COMPOSER_MAX_PITCH_RAD,
        );
        // If pitch was clamped, keep orientation stable by rebuilding look from yaw/pitch.
        const cosPitch = Math.cos(panelState.composerPitchRad);
        look.set(
            Math.cos(panelState.composerYawRad) * cosPitch,
            Math.sin(panelState.composerYawRad) * cosPitch,
            Math.sin(panelState.composerPitchRad),
        ).normalize();

        const targetUp = this.tmpVectorF.copy(upDirWorld);
        if (!Number.isFinite(targetUp.x) || !Number.isFinite(targetUp.y) || !Number.isFinite(targetUp.z) || targetUp.lengthSq() <= 1e-12) {
            targetUp.copy(this.composerWorldUp);
        }
        // Orthonormalize up against look.
        targetUp.sub(this.tmpVectorD.copy(look).multiplyScalar(targetUp.dot(look)));
        if (targetUp.lengthSq() <= 1e-12) {
            targetUp.copy(this.getComposerCameraUp(panelState, look));
        } else {
            targetUp.normalize();
        }

        this.composerBaseUp.copy(this.composerWorldUp);
        this.tmpVectorD.copy(look).multiplyScalar(this.composerBaseUp.dot(look));
        this.composerBaseUp.sub(this.tmpVectorD);
        if (this.composerBaseUp.lengthSq() <= 1e-12) {
            this.composerBaseUp.set(0, 1, 0);
            this.tmpVectorD.copy(look).multiplyScalar(this.composerBaseUp.dot(look));
            this.composerBaseUp.sub(this.tmpVectorD);
        }
        if (this.composerBaseUp.lengthSq() <= 1e-12) {
            this.composerBaseUp.set(1, 0, 0);
        } else {
            this.composerBaseUp.normalize();
        }

        const sin = look.dot(this.tmpVectorD.copy(this.composerBaseUp).cross(targetUp));
        const cos = this.composerBaseUp.dot(targetUp);
        panelState.composerRollRad = Math.atan2(sin, cos);
        if (!Number.isFinite(panelState.composerRollRad)) {
            panelState.composerRollRad = 0;
        }
        return true;
    }

    resolveComposerMoonlightFactor({ earthWorld, moonWorld, sun = null }) {
        if (!earthWorld || !moonWorld) {
            return 0;
        }
        this.tmpVectorA.subVectors(moonWorld, earthWorld);
        const moonDistance = this.tmpVectorA.length();
        if (!Number.isFinite(moonDistance) || moonDistance <= 1e-9) {
            return 0;
        }
        this.tmpVectorA.multiplyScalar(1 / moonDistance);

        if (!Number.isFinite(this.composerEarthMoonDistanceReference) || this.composerEarthMoonDistanceReference <= 1e-9) {
            this.composerEarthMoonDistanceReference = moonDistance;
        }

        let sunAvailable = this.vectorFromSunDirection(this.tmpVectorB);
        if (!sunAvailable && sun && this.getObjectWorldPosition(sun, this.sunWorld)) {
            this.tmpVectorB.subVectors(this.sunWorld, earthWorld);
            const sunDistance = this.tmpVectorB.length();
            if (Number.isFinite(sunDistance) && sunDistance > 1e-9) {
                this.tmpVectorB.multiplyScalar(1 / sunDistance);
                sunAvailable = true;
            }
        }
        if (!sunAvailable) {
            return 0;
        }

        const sunMoonDot = this.THREE.MathUtils.clamp(this.tmpVectorA.dot(this.tmpVectorB), -1, 1);
        const moonIlluminationFactor = (1 - sunMoonDot) * 0.5;
        const referenceDistance = Math.max(this.composerEarthMoonDistanceReference, 1e-9);
        const inverseSquareDistanceFactor = this.THREE.MathUtils.clamp(
            (referenceDistance * referenceDistance) / Math.max(moonDistance * moonDistance, 1e-9),
            0.72,
            1.35,
        );
        const weightedDistanceFactor = (1 - COMPOSER_MOONLIGHT_DISTANCE_WEIGHT) + (COMPOSER_MOONLIGHT_DISTANCE_WEIGHT * inverseSquareDistanceFactor);
        const moonlightFactor = moonIlluminationFactor * weightedDistanceFactor;
        return this.THREE.MathUtils.clamp(moonlightFactor, 0, 1.4);
    }

    applyComposerBodyAmbientLighting({
        panelState,
        earth = null,
        moon = null,
        earthWorld = null,
        moonWorld = null,
        sun = null,
    }) {
        const earthAmbient = this.THREE.MathUtils.clamp(
            Number(panelState?.composerEarthAmbient),
            COMPOSER_MIN_AMBIENT,
            COMPOSER_MAX_AMBIENT,
        );
        const moonAmbient = this.THREE.MathUtils.clamp(
            Number(panelState?.composerMoonAmbient),
            COMPOSER_MIN_AMBIENT,
            COMPOSER_MAX_AMBIENT,
        );

        const moonlightFactor = this.resolveComposerMoonlightFactor({ earthWorld, moonWorld, sun });
        const earthNightsideLift = Number.isFinite(earthAmbient)
            ? (earthAmbient * COMPOSER_MOONLIGHT_AMBIENT_SCALE * moonlightFactor)
            : 0;
        const moonShadowLift = this.THREE.MathUtils.clamp(
            COMPOSER_MOON_SHADOW_LIFT_BASE + ((Number.isFinite(moonAmbient) ? moonAmbient : 0) * COMPOSER_MOON_SHADOW_LIFT_SCALE),
            0,
            0.95,
        );

        const touchedMaterials = new Set();
        const restoreRecords = [];
        const applyToBodyEmissive = (bodyObject, intensity, emissiveHex) => {
            if (!bodyObject || !Number.isFinite(intensity) || intensity <= 1e-6) {
                return;
            }
            bodyObject.traverse((node) => {
                if (!node?.isMesh) {
                    return;
                }
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                for (const material of materials) {
                    if (!material || touchedMaterials.has(material)) {
                        continue;
                    }
                    if (!material.map || !material.emissive || !Number.isFinite(material.emissiveIntensity)) {
                        continue;
                    }
                    touchedMaterials.add(material);
                    restoreRecords.push({
                        material,
                        emissiveIntensity: material.emissiveIntensity,
                        emissiveHex: material.emissive.getHex(),
                    });
                    material.emissive.setHex(emissiveHex);
                    material.emissiveIntensity = intensity;
                }
            });
        };
        const applyEarthNightsideLift = (bodyObject, liftValue) => {
            if (!bodyObject || !Number.isFinite(liftValue)) {
                return false;
            }
            let applied = false;
            bodyObject.traverse((node) => {
                if (!node?.isMesh) {
                    return;
                }
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                for (const material of materials) {
                    if (!material || touchedMaterials.has(material) || !material.map) {
                        continue;
                    }
                    if (!material.userData || !Object.prototype.hasOwnProperty.call(material.userData, "earthNightsideLift")) {
                        continue;
                    }
                    touchedMaterials.add(material);
                    restoreRecords.push({
                        material,
                        earthNightsideLift: material.userData.earthNightsideLift,
                    });
                    material.userData.earthNightsideLift = liftValue;
                    applied = true;
                }
            });
            return applied;
        };
        const applyMoonShadowLift = (bodyObject, shadowLiftValue) => {
            if (!bodyObject || !Number.isFinite(shadowLiftValue)) {
                return false;
            }
            let applied = false;
            bodyObject.traverse((node) => {
                if (!node?.isMesh) {
                    return;
                }
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                for (const material of materials) {
                    if (!material || touchedMaterials.has(material) || !material.map) {
                        continue;
                    }
                    if (!material.userData || !Object.prototype.hasOwnProperty.call(material.userData, "moonShadowLift")) {
                        continue;
                    }
                    touchedMaterials.add(material);
                    restoreRecords.push({
                        material,
                        moonShadowLift: material.userData.moonShadowLift,
                    });
                    material.userData.moonShadowLift = shadowLiftValue;
                    applied = true;
                }
            });
            return applied;
        };

        // Earth ambient follows moonlight (phase + distance) and drives the nightside-lift shader.
        const earthLiftApplied = applyEarthNightsideLift(earth, earthNightsideLift);
        if (!earthLiftApplied) {
            applyToBodyEmissive(earth, earthNightsideLift, 0x6c86a6);
        }
        // Moon ambient adjusts nightside shadow lift while preserving crater texture contrast.
        const moonLiftApplied = applyMoonShadowLift(moon, moonShadowLift);
        if (!moonLiftApplied) {
            const fallbackMoonEmissive = Number.isFinite(moonAmbient) ? (moonAmbient * 0.2) : 0;
            applyToBodyEmissive(moon, fallbackMoonEmissive, 0x9aa8bf);
        }

        return () => {
            for (const record of restoreRecords) {
                if (Object.prototype.hasOwnProperty.call(record, "earthNightsideLift")) {
                    record.material.userData.earthNightsideLift = record.earthNightsideLift;
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(record, "moonShadowLift")) {
                    record.material.userData.moonShadowLift = record.moonShadowLift;
                    continue;
                }
                record.material.emissiveIntensity = record.emissiveIntensity;
                record.material.emissive.setHex(record.emissiveHex);
            }
        };
    }

    computeComposerAutoFovDegrees({
        panelState,
        craftWorld,
        earthWorld,
        moonWorld,
        earthRadius,
        moonRadius,
        lockTarget = "none",
    }) {
        const targetKind = lockTarget === "moon" ? "moon" : "earth";
        const targetWorld = targetKind === "moon" ? moonWorld : earthWorld;
        if (!targetWorld || !craftWorld) {
            return panelState.camera.fov;
        }

        this.tmpVectorA.subVectors(targetWorld, craftWorld);
        const distance = this.tmpVectorA.length();
        if (!Number.isFinite(distance) || distance <= 1e-6) {
            return panelState.camera.fov;
        }

        const targetRadius = targetKind === "moon"
            ? (Number.isFinite(moonRadius) && moonRadius > 0 ? moonRadius : 1)
            : (Number.isFinite(earthRadius) && earthRadius > 0 ? earthRadius : 1);
        const safeDistance = Math.max(distance, targetRadius + 1e-9);
        const ratio = this.THREE.MathUtils.clamp(targetRadius / safeDistance, 0, 0.999999);
        const angularRadius = Math.asin(ratio);
        const safeAspect = Math.max(panelState.camera.aspect || 1, 1e-3);
        const halfFrameFraction = Math.max(COMPOSER_AUTO_FOV_TARGET_DIAMETER_FRACTION * 0.5, 1e-3);
        const tanAngularRadius = Math.tan(angularRadius);
        const verticalHalfFromHeight = Math.atan(tanAngularRadius / halfFrameFraction);
        const verticalHalfFromWidth = Math.atan(tanAngularRadius / (halfFrameFraction * safeAspect));
        const requiredHalfVertical = Math.max(verticalHalfFromHeight, verticalHalfFromWidth);
        return this.THREE.MathUtils.radToDeg(requiredHalfVertical * 2);
    }

    syncPanelSize(panelState) {
        // Keep target panels square; composer can use a wider rectangular layout.
        const isComposer = panelState.mode === "composer";
        const minSize = isComposer ? PANEL_MIN_SIDE_COMPOSER : PANEL_MIN_SIDE_DEFAULT;
        const panelWidth = Math.max(minSize, Math.floor(panelState.panel.clientWidth || 0));
        const panelHeight = Math.max(minSize, Math.floor(panelState.panel.clientHeight || 0));
        if (!isComposer && panelWidth > 0 && Math.abs(panelWidth - panelHeight) > 1) {
            panelState.panel.style.height = `${panelWidth}px`;
        }

        const width = Math.max(120, Math.floor(panelState.viewport.clientWidth));
        const height = Math.max(80, Math.floor(panelState.viewport.clientHeight));
        const changed = width !== panelState.width || height !== panelState.height;
        if (changed) {
            panelState.width = width;
            panelState.height = height;
            panelState.renderer.setSize(width, height, true);
            if (panelState.overlayCanvas) {
                panelState.overlayCanvas.width = width;
                panelState.overlayCanvas.height = height;
            }
            panelState.camera.aspect = width / height;
            panelState.camera.updateProjectionMatrix();
            panelState.overlayDirty = true;
        }
        this.clampPanelPosition(panelState);
    }

    renderLayers(renderer, scene, camera, { renderSkyLayer = true } = {}) {
        if (renderSkyLayer) {
            renderer.autoClear = true;
            camera.layers.set(2);
            renderer.render(scene, camera);

            renderer.autoClear = false;
            renderer.clearDepth();
        } else {
            renderer.autoClear = true;
        }

        camera.layers.set(0);
        renderer.render(scene, camera);
        renderer.autoClear = false;
        camera.layers.set(1);
        renderer.render(scene, camera);
    }

    resolveComposerSunOpticsProfile(panelState) {
        const profile = panelState?.composerSunProfile === "physical" ? "physical" : "camera";
        if (profile === "physical") {
            return {
                exposure: COMPOSER_RENDER_EXPOSURE,
                skyStarmapOpacityCap: COMPOSER_SKY_STARMAP_OPACITY_CAP,
                skyConstellationOpacityCap: COMPOSER_SKY_CONSTELLATION_OPACITY_CAP,
                sunVisualState: {
                    coreOpacity: 1.0,
                    coreScaleMul: 1.0,
                    haloOpacity: 0.36,
                    haloScaleMul: 4.8,
                    starburstOpacity: 0.0,
                    starburstScaleMul: 16.0,
                    flareOpacity: 0.0,
                    flareScaleXMul: 26.0,
                    flareScaleYMul: 2.4,
                },
            };
        }

        const clamp = this.THREE.MathUtils.clamp;
        const strength = clamp(
            Number(panelState?.composerSunStrength),
            COMPOSER_OPTICS_STRENGTH_MIN,
            COMPOSER_OPTICS_STRENGTH_MAX,
        );
        const haloGain = clamp(
            Number(panelState?.composerSunHaloGain),
            COMPOSER_OPTICS_ADVANCED_MIN,
            COMPOSER_OPTICS_ADVANCED_MAX,
        );
        const starburstGain = clamp(
            Number(panelState?.composerSunStarburstGain),
            COMPOSER_OPTICS_ADVANCED_MIN,
            COMPOSER_OPTICS_ADVANCED_MAX,
        );
        const flareGain = clamp(
            Number(panelState?.composerSunFlareGain),
            COMPOSER_OPTICS_ADVANCED_MIN,
            COMPOSER_OPTICS_ADVANCED_MAX,
        );

        const haloOpacity = clamp((0.20 + (0.20 * strength)) * haloGain, 0, 0.85);
        const haloScaleMul = 4.8 + (5.5 * strength);
        const starburstOpacity = clamp((0.12 + (0.14 * strength)) * starburstGain, 0, 0.92);
        const starburstScaleMul = 16.0 + (10.0 * strength);
        const flareOpacity = clamp((0.05 + (0.11 * strength)) * flareGain, 0, 0.78);
        const flareScaleXMul = 26.0 + (18.0 * strength);
        const flareScaleYMul = 2.4 + (1.1 * strength);

        return {
            exposure: COMPOSER_CAMERA_EXPOSURE,
            skyStarmapOpacityCap: COMPOSER_CAMERA_SKY_STARMAP_OPACITY_CAP,
            skyConstellationOpacityCap: COMPOSER_CAMERA_SKY_CONSTELLATION_OPACITY_CAP,
            sunVisualState: {
                coreOpacity: 1.0,
                coreScaleMul: 1.0,
                haloOpacity,
                haloScaleMul,
                starburstOpacity,
                starburstScaleMul,
                flareOpacity,
                flareScaleXMul,
                flareScaleYMul,
            },
        };
    }

    applyComposerExposureProfile(scene, panelState, sunRenderer) {
        if (panelState?.mode !== "composer") {
            return () => {};
        }

        const profile = this.resolveComposerSunOpticsProfile(panelState);
        const renderer = panelState.renderer;
        const originalExposure = renderer.toneMappingExposure;
        renderer.toneMappingExposure = profile.exposure;

        const skyMaterial = scene?.skyRenderer?.skyMesh?.material || null;
        const constellationMaterial = scene?.skyRenderer?.constellationMesh?.material || null;
        const originalSunVisualState = sunRenderer?.getVisualState?.() || null;

        const originalSkyOpacity = Number.isFinite(skyMaterial?.opacity)
            ? skyMaterial.opacity
            : null;
        const originalConstellationOpacity = Number.isFinite(constellationMaterial?.opacity)
            ? constellationMaterial.opacity
            : null;

        if (originalSkyOpacity != null) {
            skyMaterial.opacity = Math.min(originalSkyOpacity, profile.skyStarmapOpacityCap);
        }
        if (originalConstellationOpacity != null) {
            constellationMaterial.opacity = Math.min(
                originalConstellationOpacity,
                profile.skyConstellationOpacityCap,
            );
        }
        if (sunRenderer?.setVisualState) {
            sunRenderer.setVisualState(profile.sunVisualState);
        }

        return () => {
            renderer.toneMappingExposure = originalExposure;
            if (originalSkyOpacity != null && skyMaterial) {
                skyMaterial.opacity = originalSkyOpacity;
            }
            if (originalConstellationOpacity != null && constellationMaterial) {
                constellationMaterial.opacity = originalConstellationOpacity;
            }
            if (sunRenderer?.setVisualState && originalSunVisualState) {
                sunRenderer.setVisualState(originalSunVisualState);
            }
        };
    }

    clearPanelOverlay(panelState) {
        if (!panelState?.overlayCtx || !panelState?.overlayCanvas) {
            return;
        }
        panelState.overlayCtx.clearRect(0, 0, panelState.overlayCanvas.width, panelState.overlayCanvas.height);
    }

    renderComposerRaDecGridOverlay(panelState) {
        if (!panelState?.overlayCtx || !panelState?.overlayCanvas) {
            return;
        }
        if (panelState.composerRaDecGridEnabled !== true) {
            return;
        }
        const canvas = panelState.overlayCanvas;
        const ctx = panelState.overlayCtx;
        const width = canvas.width;
        const height = canvas.height;
        if (width <= 1 || height <= 1) {
            return;
        }
        const verticalFovDeg = Number.isFinite(panelState?.camera?.fov) ? panelState.camera.fov : 50;
        const resolveGridDensity = () => {
            let raStepDeg = COMPOSER_RA_DEC_GRID_RA_STEP_DEG;
            let decStepDeg = COMPOSER_RA_DEC_GRID_DEC_STEP_DEG;
            let sampleStepDeg = 3;
            let raLabelEvery = 1;
            let decLabelEvery = 1;
            let raLabelMargin = 22;
            let decLabelMargin = 20;

            if (verticalFovDeg <= 8) {
                raStepDeg = 15;
                decStepDeg = 5;
                sampleStepDeg = 1;
                raLabelEvery = 2;
                decLabelEvery = 2;
                raLabelMargin = 16;
                decLabelMargin = 16;
            } else if (verticalFovDeg <= 16) {
                raStepDeg = 30;
                decStepDeg = 10;
                sampleStepDeg = 2;
                raLabelEvery = 2;
                decLabelEvery = 2;
                raLabelMargin = 18;
                decLabelMargin = 18;
            } else if (verticalFovDeg <= 32) {
                raStepDeg = 45;
                decStepDeg = 10;
                sampleStepDeg = 2;
                raLabelEvery = 1;
                decLabelEvery = 2;
                raLabelMargin = 20;
                decLabelMargin = 18;
            } else if (verticalFovDeg <= 60) {
                raStepDeg = 60;
                decStepDeg = 15;
                sampleStepDeg = 3;
            } else if (verticalFovDeg <= 95) {
                raStepDeg = 90;
                decStepDeg = 30;
                sampleStepDeg = 4;
                raLabelMargin = 18;
                decLabelMargin = 18;
            } else {
                raStepDeg = 120;
                decStepDeg = 45;
                sampleStepDeg = 5;
                raLabelMargin = 14;
                decLabelMargin = 14;
            }

            // Keep at least ~4 lines visible in view for both RA/Dec.
            // We derive spacing from FoV coverage, then snap to "nice" angular steps.
            const aspect = Math.max(1e-6, Number.isFinite(panelState?.camera?.aspect) ? panelState.camera.aspect : (width / Math.max(1, height)));
            const verticalFovRad = this.THREE.MathUtils.degToRad(verticalFovDeg);
            const horizontalFovDeg = this.THREE.MathUtils.radToDeg(Math.atan(Math.tan(verticalFovRad * 0.5) * aspect) * 2);
            const minVisibleLines = 4;
            const maxSpacingFromCoverage = Math.max(1, verticalFovDeg / Math.max(1, minVisibleLines - 1));
            const maxSpacingFromCoverageRa = Math.max(1, horizontalFovDeg / Math.max(1, minVisibleLines - 1));
            const niceSteps = [120, 90, 60, 45, 30, 20, 15, 12, 10, 6, 5, 4, 3, 2, 1];
            const snapStep = (maxAllowedStep, minStep, fallbackStep) => {
                for (const step of niceSteps) {
                    if (step <= maxAllowedStep && step >= minStep) {
                        return step;
                    }
                }
                return fallbackStep;
            };
            const minDecStep = 3;
            const minRaStep = 5;
            const targetDecStep = snapStep(maxSpacingFromCoverage, minDecStep, minDecStep);
            const targetRaStep = snapStep(maxSpacingFromCoverageRa, minRaStep, minRaStep);

            decStepDeg = Math.max(minDecStep, Math.min(decStepDeg, targetDecStep));
            raStepDeg = Math.max(minRaStep, Math.min(raStepDeg, targetRaStep));

            // As line density increases, back off label density to prevent clutter.
            decLabelEvery = Math.max(1, Math.round(18 / Math.max(decStepDeg, 1)));
            raLabelEvery = Math.max(1, Math.round(24 / Math.max(raStepDeg, 1)));
            sampleStepDeg = Math.max(1, Math.min(sampleStepDeg, Math.max(1, Math.floor(Math.min(decStepDeg, raStepDeg) / 2))));

            return {
                raStepDeg,
                decStepDeg,
                sampleStepDeg,
                raLabelEvery,
                decLabelEvery,
                raLabelMargin,
                decLabelMargin,
            };
        };
        const gridDensity = resolveGridDensity();
        const occupiedLabelBoxes = [];

        panelState.camera.getWorldQuaternion(this.panelCameraWorldQuat);
        this.panelCameraWorldQuatInv.copy(this.panelCameraWorldQuat).invert();
        const tanHalfY = Math.tan(this.THREE.MathUtils.degToRad(panelState.camera.fov * 0.5));
        const tanHalfX = tanHalfY * Math.max(panelState.camera.aspect, 1e-6);

        const projectDirection = (x, y, z) => {
            this.tmpVectorA.set(x, y, z).applyQuaternion(this.panelCameraWorldQuatInv);
            const cz = this.tmpVectorA.z;
            if (cz <= 1e-4) {
                return null;
            }
            const ndcX = (this.tmpVectorA.x / cz) / Math.max(tanHalfX, 1e-9);
            const ndcY = (this.tmpVectorA.y / cz) / Math.max(tanHalfY, 1e-9);
            if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) {
                return null;
            }
            if (Math.abs(ndcX) > 1.35 || Math.abs(ndcY) > 1.35) {
                return null;
            }
            return {
                x: ((ndcX * 0.5) + 0.5) * width,
                y: (1 - ((ndcY * 0.5) + 0.5)) * height,
            };
        };

        const drawCurve = (samples, strokeStyle, lineWidth) => {
            let penDown = false;
            const visiblePoints = [];
            ctx.beginPath();
            for (const sample of samples) {
                const projected = projectDirection(sample.x, sample.y, sample.z);
                if (!projected) {
                    penDown = false;
                    continue;
                }
                visiblePoints.push(projected);
                if (!penDown) {
                    ctx.moveTo(projected.x, projected.y);
                    penDown = true;
                } else {
                    ctx.lineTo(projected.x, projected.y);
                }
            }
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            return visiblePoints;
        };

        const drawGridLabel = (text, point, {
            offsetX = 4,
            offsetY = -4,
            align = "left",
            relaxed = false,
            zone = null,
            capture = null,
            key = "",
        } = {}) => {
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                return false;
            }
            const font = "600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            ctx.save();
            ctx.font = font;
            const textWidth = ctx.measureText(text).width;
            ctx.restore();
            const textHeight = 11;
            const paddingX = 4;
            const paddingY = 3;

            const offsets = [
                { dx: offsetX, dy: offsetY, textAlign: align },
                { dx: offsetX + 12, dy: offsetY - 10, textAlign: align },
                { dx: offsetX - 12, dy: offsetY + 10, textAlign: align },
                { dx: offsetX + 8, dy: offsetY + 12, textAlign: align },
                { dx: offsetX - 14, dy: offsetY - 12, textAlign: "right" },
                { dx: offsetX + 14, dy: offsetY + 14, textAlign: "left" },
                { dx: offsetX, dy: offsetY - 16, textAlign: "center" },
                { dx: offsetX, dy: offsetY + 16, textAlign: "center" },
            ];

            const computeBox = (x, y, textAlign) => {
                let left;
                let right;
                if (textAlign === "right") {
                    left = x - textWidth - paddingX;
                    right = x + paddingX;
                } else if (textAlign === "center") {
                    left = x - (textWidth * 0.5) - paddingX;
                    right = x + (textWidth * 0.5) + paddingX;
                } else {
                    left = x - paddingX;
                    right = x + textWidth + paddingX;
                }
                const top = y - (textHeight * 0.5) - paddingY;
                const bottom = y + (textHeight * 0.5) + paddingY;
                return { left, right, top, bottom };
            };

            const intersects = (a, b) => !(
                a.right < b.left ||
                a.left > b.right ||
                a.bottom < b.top ||
                a.top > b.bottom
            );

            for (const candidate of offsets) {
                const x = Math.round((point.x + candidate.dx) * 2) / 2;
                const y = Math.round((point.y + candidate.dy) * 2) / 2;
                const box = computeBox(x, y, candidate.textAlign);
                const allowOverflowPx = relaxed ? 8 : 0;
                if (box.left < (6 - allowOverflowPx) || box.right > ((width - 6) + allowOverflowPx) || box.top < (8 - allowOverflowPx) || box.bottom > ((height - 6) + allowOverflowPx)) {
                    continue;
                }
                if (zone === "top-bottom" && !relaxed) {
                    const bandTop = height * 0.36;
                    const bandBottom = height * 0.64;
                    if (!(box.bottom <= bandTop || box.top >= bandBottom)) {
                        continue;
                    }
                }
                if (zone === "left-right" && !relaxed) {
                    const bandLeft = width * 0.36;
                    const bandRight = width * 0.64;
                    if (!(box.right <= bandLeft || box.left >= bandRight)) {
                        continue;
                    }
                }
                if (occupiedLabelBoxes.some((existing) => intersects(existing, box))) {
                    continue;
                }
                ctx.save();
                ctx.font = font;
                ctx.textAlign = candidate.textAlign;
                ctx.textBaseline = "middle";
                ctx.lineJoin = "round";
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = "rgba(7, 14, 24, 0.7)";
                ctx.fillStyle = "rgba(180, 194, 214, 0.62)";
                ctx.strokeText(text, x, y);
                ctx.fillText(text, x, y);
                ctx.restore();
                occupiedLabelBoxes.push(box);
                if (capture && typeof capture.push === "function") {
                    capture.push({
                        key,
                        text,
                        x,
                        y,
                        align: candidate.textAlign,
                    });
                }
                return true;
            }

            return false;
        };

        const getFovReadout = () => {
            const verticalFovDeg = Number.isFinite(panelState?.camera?.fov) ? panelState.camera.fov : Number.NaN;
            if (!Number.isFinite(verticalFovDeg)) {
                return null;
            }
            const aspect = Math.max(1e-6, Number.isFinite(panelState?.camera?.aspect) ? panelState.camera.aspect : (width / Math.max(1, height)));
            const verticalFovRad = this.THREE.MathUtils.degToRad(verticalFovDeg);
            const horizontalFovRad = Math.atan(Math.tan(verticalFovRad * 0.5) * aspect) * 2;
            const horizontalFovDeg = this.THREE.MathUtils.radToDeg(horizontalFovRad);

            const fovText = `FoV H ${horizontalFovDeg.toFixed(1)}°  V ${verticalFovDeg.toFixed(1)}°`;
            return { fovText, x: 12, y: 16 };
        };

        const reserveFovReadoutBox = () => {
            const fov = getFovReadout();
            if (!fov) {
                return;
            }
            ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            const textWidth = ctx.measureText(fov.fovText).width;
            occupiedLabelBoxes.push({
                left: fov.x - 4,
                right: fov.x + textWidth + 4,
                top: fov.y - 9,
                bottom: fov.y + 9,
            });
        };

        const drawFovReadout = () => {
            const fov = getFovReadout();
            if (!fov) {
                return;
            }
            ctx.save();
            ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.lineJoin = "round";
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = "rgba(7, 14, 24, 0.72)";
            ctx.fillStyle = "rgba(180, 194, 214, 0.66)";
            ctx.strokeText(fov.fovText, fov.x, fov.y);
            ctx.fillText(fov.fovText, fov.x, fov.y);
            ctx.restore();
        };

        const drawPlacedLabel = (placedLabel) => {
            if (!placedLabel || !Number.isFinite(placedLabel.x) || !Number.isFinite(placedLabel.y)) {
                return;
            }
            ctx.save();
            ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            ctx.textAlign = placedLabel.align || "left";
            ctx.textBaseline = "middle";
            ctx.lineJoin = "round";
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = "rgba(7, 14, 24, 0.7)";
            ctx.fillStyle = "rgba(180, 194, 214, 0.62)";
            ctx.strokeText(placedLabel.text, placedLabel.x, placedLabel.y);
            ctx.fillText(placedLabel.text, placedLabel.x, placedLabel.y);
            ctx.restore();
        };

        const labelCache = panelState.composerGridLabelCache || (panelState.composerGridLabelCache = Object.create(null));
        const nowMs = performance.now();
        const inLabelBounds = (point, marginPx) => (
            !!point &&
            point.x >= marginPx &&
            point.x <= (width - marginPx) &&
            point.y >= marginPx &&
            point.y <= (height - marginPx)
        );
        const chooseStableLabelPoint = (key, directionCandidates, {
            marginPx = 18,
            holdMs = 260,
        } = {}) => {
            if (!Array.isArray(directionCandidates) || directionCandidates.length === 0) {
                return null;
            }
            const prev = labelCache[key] || null;
            const order = [];
            if (Number.isInteger(prev?.index) && prev.index >= 0 && prev.index < directionCandidates.length) {
                order.push(prev.index);
            }
            for (let i = 0; i < directionCandidates.length; i += 1) {
                if (!order.includes(i)) {
                    order.push(i);
                }
            }

            let relaxedCandidate = null;
            for (const index of order) {
                const dir = directionCandidates[index];
                const projected = projectDirection(dir.x, dir.y, dir.z);
                if (!projected) {
                    continue;
                }
                if (inLabelBounds(projected, marginPx)) {
                    labelCache[key] = { index, point: projected, ts: nowMs };
                    return projected;
                }
                if (!relaxedCandidate) {
                    relaxedCandidate = { index, point: projected };
                }
            }

            if (prev?.point && Number.isFinite(prev.ts) && (nowMs - prev.ts) <= holdMs) {
                return prev.point;
            }
            if (relaxedCandidate) {
                labelCache[key] = { index: relaxedCandidate.index, point: relaxedCandidate.point, ts: nowMs };
                return relaxedCandidate.point;
            }
            return null;
        };

        const buildDirection = (raDeg, decDeg) => {
            const ra = this.THREE.MathUtils.degToRad(raDeg);
            const dec = this.THREE.MathUtils.degToRad(decDeg);
            const cosDec = Math.cos(dec);
            return {
                x: cosDec * Math.cos(ra),
                y: cosDec * Math.sin(ra),
                z: Math.sin(dec),
            };
        };

        const baseLineColor = "rgba(146, 186, 244, 0.34)";
        const accentLineColor = "rgba(188, 218, 255, 0.52)";
        const decDescriptors = [];
        const raDescriptors = [];
        let visibleDecLines = 0;
        let visibleRaLines = 0;
        reserveFovReadoutBox();

        // Dec lines (parallels).
        for (let dec = -75; dec <= 75; dec += gridDensity.decStepDeg) {
            const samples = [];
            for (let ra = 0; ra <= 360; ra += gridDensity.sampleStepDeg) {
                samples.push(buildDirection(ra, dec));
            }
            const isEquator = dec === 0;
            const visiblePoints = drawCurve(samples, isEquator ? accentLineColor : baseLineColor, isEquator ? 1.1 : 0.8);
            const onScreenVisiblePoints = visiblePoints.filter((p) => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height);
            if (onScreenVisiblePoints.length >= 2) {
                visibleDecLines += 1;
            }
            const decSign = dec > 0 ? "+" : "";
            const text = `Dec ${decSign}${dec}°`;
            if (onScreenVisiblePoints.length > 0) {
                let minX = onScreenVisiblePoints[0];
                let maxX = onScreenVisiblePoints[0];
                for (const screenPoint of onScreenVisiblePoints) {
                    if (screenPoint.x < minX.x) {
                        minX = screenPoint;
                    }
                    if (screenPoint.x > maxX.x) {
                        maxX = screenPoint;
                    }
                }
                decDescriptors.push({
                    key: `dec:${dec}`,
                    text,
                    leftPoint: minX,
                    rightPoint: maxX,
                    points: onScreenVisiblePoints,
                });
            }
        }

        // RA lines (meridians).
        for (let ra = 0; ra < 360; ra += gridDensity.raStepDeg) {
            const samples = [];
            for (let dec = -87; dec <= 87; dec += gridDensity.sampleStepDeg) {
                samples.push(buildDirection(ra, dec));
            }
            const isPrime = ra === 0;
            const visiblePoints = drawCurve(samples, isPrime ? accentLineColor : baseLineColor, isPrime ? 1.1 : 0.8);
            const onScreenVisiblePoints = visiblePoints.filter((p) => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height);
            if (onScreenVisiblePoints.length >= 2) {
                visibleRaLines += 1;
            }
            const raHours = Math.round((ra % 360) / 15);
            const text = `RA ${raHours}h`;
            if (onScreenVisiblePoints.length > 0) {
                let minY = onScreenVisiblePoints[0];
                let maxY = onScreenVisiblePoints[0];
                for (const screenPoint of onScreenVisiblePoints) {
                    if (screenPoint.y < minY.y) {
                        minY = screenPoint;
                    }
                    if (screenPoint.y > maxY.y) {
                        maxY = screenPoint;
                    }
                }
                raDescriptors.push({
                    key: `ra:${ra}`,
                    text,
                    topPoint: minY,
                    bottomPoint: maxY,
                    points: onScreenVisiblePoints,
                });
            }
        }

        const pickSpread = (items, targetCount) => {
            if (!Array.isArray(items) || items.length === 0 || targetCount <= 0) {
                return [];
            }
            if (items.length <= targetCount) {
                return items.slice();
            }
            if (targetCount === 1) {
                return [items[Math.floor(items.length * 0.5)]];
            }
            const picked = [];
            const used = new Set();
            for (let i = 0; i < targetCount; i += 1) {
                const rawIndex = Math.round((i * (items.length - 1)) / (targetCount - 1));
                const boundedIndex = Math.max(0, Math.min(items.length - 1, rawIndex));
                if (used.has(boundedIndex)) {
                    continue;
                }
                used.add(boundedIndex);
                picked.push(items[boundedIndex]);
            }
            return picked;
        };

        const composerGridPlacementState = panelState.composerGridPlacementState || (panelState.composerGridPlacementState = {
            ra: { activeKeys: [], anchors: Object.create(null) },
            dec: { activeKeys: [], anchors: Object.create(null) },
        });
        const composerGridTemporalState = panelState.composerGridTemporalState || (panelState.composerGridTemporalState = {
            hasPose: false,
            quatX: 0,
            quatY: 0,
            quatZ: 0,
            quatW: 1,
            fov: Number.NaN,
            aspect: Number.NaN,
            cachedPlacedRa: [],
            cachedPlacedDec: [],
        });
        const currentQuat = panelState.camera.quaternion;
        const quantize = (value, step) => Math.round(value / step) * step;
        const pose = {
            quatX: quantize(currentQuat.x, 1e-4),
            quatY: quantize(currentQuat.y, 1e-4),
            quatZ: quantize(currentQuat.z, 1e-4),
            quatW: quantize(currentQuat.w, 1e-4),
            fov: quantize(panelState.camera.fov, 0.05),
            aspect: quantize(panelState.camera.aspect, 1e-3),
        };
        const shouldReusePlacement =
            composerGridTemporalState.hasPose === true &&
            pose.quatX === composerGridTemporalState.quatX &&
            pose.quatY === composerGridTemporalState.quatY &&
            pose.quatZ === composerGridTemporalState.quatZ &&
            pose.quatW === composerGridTemporalState.quatW &&
            pose.fov === composerGridTemporalState.fov &&
            pose.aspect === composerGridTemporalState.aspect &&
            Array.isArray(composerGridTemporalState.cachedPlacedRa) &&
            Array.isArray(composerGridTemporalState.cachedPlacedDec) &&
            (composerGridTemporalState.cachedPlacedRa.length > 0 || composerGridTemporalState.cachedPlacedDec.length > 0);
        const placedLabelsRa = [];
        const placedLabelsDec = [];

        const placeDeterministicLabels = (descriptors, kind) => {
            if (!Array.isArray(descriptors) || descriptors.length === 0) {
                return 0;
            }
            const familyState = composerGridPlacementState[kind] || (composerGridPlacementState[kind] = {
                activeKeys: [],
                anchors: Object.create(null),
            });
            const descriptorByKey = new Map(descriptors.map((descriptor) => [descriptor.key, descriptor]));
            const targetCount = descriptors.length >= 4 ? 4 : descriptors.length;
            const keptKeys = familyState.activeKeys.filter((key) => descriptorByKey.has(key));
            const keptDescriptors = keptKeys.map((key) => descriptorByKey.get(key)).filter(Boolean);
            const remainingDescriptors = descriptors.filter((descriptor) => !keptKeys.includes(descriptor.key));
            const fillCount = Math.max(0, targetCount - keptDescriptors.length);
            const spreadFill = pickSpread(remainingDescriptors, fillCount);
            const selected = [...keptDescriptors, ...spreadFill];
            const selectedKeySet = new Set(selected.map((descriptor) => descriptor.key));
            const backups = descriptors.filter((descriptor) => !selectedKeySet.has(descriptor.key));
            let placed = 0;

            const buildCandidates = (descriptor) => {
                if (kind === "ra") {
                    const topDistance = Number.isFinite(descriptor?.topPoint?.y) ? descriptor.topPoint.y : Infinity;
                    const bottomDistance = Number.isFinite(descriptor?.bottomPoint?.y) ? (height - descriptor.bottomPoint.y) : Infinity;
                    const preferTop = topDistance <= bottomDistance;
                    return preferTop
                        ? [
                            { id: "top-center", point: descriptor.topPoint, offsetX: 0, offsetY: 12, align: "center" },
                            { id: "bottom-center", point: descriptor.bottomPoint, offsetX: 0, offsetY: -12, align: "center" },
                            { id: "top-left", point: descriptor.topPoint, offsetX: 10, offsetY: 12, align: "left" },
                            { id: "bottom-right", point: descriptor.bottomPoint, offsetX: -10, offsetY: -12, align: "right" },
                        ]
                        : [
                            { id: "bottom-center", point: descriptor.bottomPoint, offsetX: 0, offsetY: -12, align: "center" },
                            { id: "top-center", point: descriptor.topPoint, offsetX: 0, offsetY: 12, align: "center" },
                            { id: "bottom-left", point: descriptor.bottomPoint, offsetX: 10, offsetY: -12, align: "left" },
                            { id: "top-right", point: descriptor.topPoint, offsetX: -10, offsetY: 12, align: "right" },
                        ];
                }
                const leftDistance = Number.isFinite(descriptor?.leftPoint?.x) ? descriptor.leftPoint.x : Infinity;
                const rightDistance = Number.isFinite(descriptor?.rightPoint?.x) ? (width - descriptor.rightPoint.x) : Infinity;
                const preferLeft = leftDistance <= rightDistance;
                return preferLeft
                    ? [
                        { id: "left-high", point: descriptor.leftPoint, offsetX: 8, offsetY: -6, align: "left" },
                        { id: "right-high", point: descriptor.rightPoint, offsetX: -8, offsetY: -6, align: "right" },
                        { id: "left-low", point: descriptor.leftPoint, offsetX: 8, offsetY: 10, align: "left" },
                        { id: "right-low", point: descriptor.rightPoint, offsetX: -8, offsetY: 10, align: "right" },
                    ]
                    : [
                        { id: "right-high", point: descriptor.rightPoint, offsetX: -8, offsetY: -6, align: "right" },
                        { id: "left-high", point: descriptor.leftPoint, offsetX: 8, offsetY: -6, align: "left" },
                        { id: "right-low", point: descriptor.rightPoint, offsetX: -8, offsetY: 10, align: "right" },
                        { id: "left-low", point: descriptor.leftPoint, offsetX: 8, offsetY: 10, align: "left" },
                    ];
            };

            const tryPlace = (descriptor) => {
                if (!descriptor) {
                    return false;
                }
                const candidates = buildCandidates(descriptor);
                const previousAnchorId = familyState.anchors[descriptor.key];
                if (typeof previousAnchorId === "string" && previousAnchorId.length > 0) {
                    candidates.sort((a, b) => {
                        if (a.id === previousAnchorId) {
                            return -1;
                        }
                        if (b.id === previousAnchorId) {
                            return 1;
                        }
                        return 0;
                    });
                }
                for (const candidate of candidates) {
                    if (drawGridLabel(descriptor.text, candidate.point, {
                        offsetX: candidate.offsetX,
                        offsetY: candidate.offsetY,
                        align: candidate.align,
                        relaxed: false,
                        capture: kind === "ra" ? placedLabelsRa : placedLabelsDec,
                        key: descriptor.key,
                    })) {
                        familyState.anchors[descriptor.key] = candidate.id;
                        return true;
                    }
                }
                return false;
            };

            for (const descriptor of selected) {
                if (tryPlace(descriptor)) {
                    placed += 1;
                }
            }
            if (placed < targetCount) {
                for (const descriptor of backups) {
                    if (tryPlace(descriptor)) {
                        placed += 1;
                        if (placed >= targetCount) {
                            break;
                        }
                    }
                }
            }
            familyState.activeKeys = selected.map((descriptor) => descriptor.key);
            const visibleKeys = new Set(descriptors.map((descriptor) => descriptor.key));
            for (const anchorKey of Object.keys(familyState.anchors)) {
                if (!visibleKeys.has(anchorKey)) {
                    delete familyState.anchors[anchorKey];
                }
            }
            return placed;
        };

        if (shouldReusePlacement) {
            for (const placed of composerGridTemporalState.cachedPlacedRa) {
                drawPlacedLabel(placed);
            }
            for (const placed of composerGridTemporalState.cachedPlacedDec) {
                drawPlacedLabel(placed);
            }
        } else {
            placeDeterministicLabels(raDescriptors, "ra");
            placeDeterministicLabels(decDescriptors, "dec");
            composerGridTemporalState.cachedPlacedRa = placedLabelsRa.map((label) => ({ ...label }));
            composerGridTemporalState.cachedPlacedDec = placedLabelsDec.map((label) => ({ ...label }));
            composerGridTemporalState.quatX = pose.quatX;
            composerGridTemporalState.quatY = pose.quatY;
            composerGridTemporalState.quatZ = pose.quatZ;
            composerGridTemporalState.quatW = pose.quatW;
            composerGridTemporalState.fov = pose.fov;
            composerGridTemporalState.aspect = pose.aspect;
            composerGridTemporalState.hasPose = true;
        }
        // Safety net: if extreme framing still gives sparse coverage, draw denser center-aligned helpers.
        if (visibleDecLines < 4 || visibleRaLines < 4) {
            const denserDecStep = Math.max(3, Math.min(gridDensity.decStepDeg, 5));
            const denserRaStep = Math.max(5, Math.min(gridDensity.raStepDeg, 15));
            if (visibleDecLines < 4) {
                for (let dec = -45; dec <= 45; dec += denserDecStep) {
                    const samples = [];
                    for (let ra = 0; ra <= 360; ra += 2) {
                        samples.push(buildDirection(ra, dec));
                    }
                    drawCurve(samples, baseLineColor, 0.7);
                }
            }
            if (visibleRaLines < 4) {
                for (let ra = 0; ra < 360; ra += denserRaStep) {
                    const samples = [];
                    for (let dec = -75; dec <= 75; dec += 2) {
                        samples.push(buildDirection(ra, dec));
                    }
                    drawCurve(samples, baseLineColor, 0.7);
                }
            }
        }

        drawFovReadout();
    }

    renderComposerSkyLabelOverlay(panelState, { scene = null, skyContainer = null, skyRenderer = null } = {}) {
        if (!panelState?.overlayCtx || !panelState?.overlayCanvas) {
            return;
        }
        if (panelState.composerSkyLabelsEnabled !== true) {
            return;
        }

        const canvas = panelState.overlayCanvas;
        const ctx = panelState.overlayCtx;
        const width = canvas.width;
        const height = canvas.height;
        if (width <= 1 || height <= 1) {
            return;
        }

        const resolvedSkyRenderer = skyRenderer || scene?.skyRenderer || null;
        const activeSkyContainer = skyContainer || scene?.skyContainer || resolvedSkyRenderer?.container || null;
        const planetRenderer = resolvedSkyRenderer?.planetRenderer || null;
        if (!activeSkyContainer?.getWorldQuaternion) {
            return;
        }

        const occupied = [];
        const edge = COMPOSER_SKY_LABEL_EDGE_MARGIN_PX;
        activeSkyContainer.getWorldQuaternion(this.tmpQuatA);
        const projectSkyPointFromLocal = (x, y, z) => {
            this.tmpVectorB.set(x, y, z);
            if (activeSkyContainer?.matrixWorld) {
                this.tmpVectorB.applyMatrix4(activeSkyContainer.matrixWorld);
            } else {
                this.tmpVectorB.applyQuaternion(this.tmpQuatA);
            }
            this.tmpVectorC.copy(this.tmpVectorB).project(panelState.camera);
            if (
                !Number.isFinite(this.tmpVectorC.x) ||
                !Number.isFinite(this.tmpVectorC.y) ||
                !Number.isFinite(this.tmpVectorC.z)
            ) {
                return null;
            }
            if (this.tmpVectorC.z < -1 || this.tmpVectorC.z > 1) {
                return null;
            }
            return {
                x: ((this.tmpVectorC.x * 0.5) + 0.5) * width,
                y: (1 - ((this.tmpVectorC.y * 0.5) + 0.5)) * height,
            };
        };

        const intersects = (a, b) => !(
            a.right < b.left ||
            a.left > b.right ||
            a.bottom < b.top ||
            a.top > b.bottom
        );

        const drawLabel = (text, point, style = "star") => {
            if (!text || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                return false;
            }
            const font = "600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            ctx.save();
            ctx.font = font;
            const textWidth = ctx.measureText(text).width;
            ctx.restore();

            const textHeight = 11;
            const padX = 4;
            const padY = 3;
            const preferLeft = point.x < (width * 0.5);
            const preferTop = point.y < (height * 0.5);
            const baseOffsetX = preferLeft ? 8 : -8;
            const baseOffsetY = preferTop ? -8 : 10;
            const baseAlign = preferLeft ? "left" : "right";
            const candidates = [
                { dx: baseOffsetX, dy: baseOffsetY, align: baseAlign },
                { dx: baseOffsetX, dy: -baseOffsetY, align: baseAlign },
                { dx: 0, dy: preferTop ? -12 : 12, align: "center" },
                { dx: -baseOffsetX, dy: baseOffsetY, align: preferLeft ? "right" : "left" },
                { dx: baseOffsetX + 10, dy: baseOffsetY + 8, align: baseAlign },
                { dx: baseOffsetX - 10, dy: baseOffsetY - 8, align: baseAlign },
            ];

            const computeBox = (x, y, align) => {
                let left;
                let right;
                if (align === "right") {
                    left = x - textWidth - padX;
                    right = x + padX;
                } else if (align === "center") {
                    left = x - (textWidth * 0.5) - padX;
                    right = x + (textWidth * 0.5) + padX;
                } else {
                    left = x - padX;
                    right = x + textWidth + padX;
                }
                return {
                    left,
                    right,
                    top: y - (textHeight * 0.5) - padY,
                    bottom: y + (textHeight * 0.5) + padY,
                };
            };

            for (const candidate of candidates) {
                const x = Math.round((point.x + candidate.dx) * 2) / 2;
                const y = Math.round((point.y + candidate.dy) * 2) / 2;
                const box = computeBox(x, y, candidate.align);
                if (
                    box.left < edge ||
                    box.right > (width - edge) ||
                    box.top < edge ||
                    box.bottom > (height - edge)
                ) {
                    continue;
                }
                if (occupied.some((existing) => intersects(existing, box))) {
                    continue;
                }

                ctx.save();
                ctx.font = font;
                ctx.textAlign = candidate.align;
                ctx.textBaseline = "middle";
                ctx.lineJoin = "round";
                ctx.lineWidth = 2.4;
                ctx.strokeStyle = "rgba(7, 14, 24, 0.74)";
                ctx.fillStyle = style === "planet"
                    ? "rgba(226, 238, 255, 0.92)"
                    : "rgba(205, 220, 242, 0.86)";
                ctx.strokeText(text, x, y);
                ctx.fillText(text, x, y);
                ctx.restore();
                occupied.push(box);
                return true;
            }
            return false;
        };

        const planetPositionAttr = planetRenderer?.geometry?.getAttribute?.("position") || null;
        const planetAlphaAttr = planetRenderer?.geometry?.getAttribute?.("aAlpha") || null;
        const planetBodySlots = Array.isArray(planetRenderer?.bodySlots) ? planetRenderer.bodySlots : [];
        const planetPositionArray = planetPositionAttr?.array || null;
        const planetAlphaArray = planetAlphaAttr?.array || null;
        if (planetPositionArray && planetAlphaArray && planetBodySlots.length > 0) {
            const planetCount = Math.min(
                planetBodySlots.length,
                planetPositionAttr.count || 0,
                planetAlphaAttr.count || 0,
            );
            for (let i = 0; i < planetCount; i += 1) {
                const label = String(planetBodySlots[i] || "").trim();
                if (!label) {
                    continue;
                }
                // In Flyby panel these are already represented by foreground bodies
                // and can be visually misleading when treated as sky markers.
                if (label === "Moon" || label === "Sun") {
                    continue;
                }
                const alpha = Number(planetAlphaArray[i]);
                if (!Number.isFinite(alpha) || alpha <= 0.001) {
                    continue;
                }
                const idx3 = i * 3;
                const point = projectSkyPointFromLocal(
                    Number(planetPositionArray[idx3]),
                    Number(planetPositionArray[idx3 + 1]),
                    Number(planetPositionArray[idx3 + 2]),
                );
                if (!point) {
                    continue;
                }
                drawLabel(label, point, "planet");
            }
        }

        const brightStarDescriptors = this.resolveComposerBrightStarLabelDescriptors();
        if (brightStarDescriptors.length > 0) {
            for (const descriptor of brightStarDescriptors) {
                const localDirection = descriptor?.localDirection;
                if (!localDirection) {
                    continue;
                }
                const point = projectSkyPointFromLocal(
                    Number(localDirection.x),
                    Number(localDirection.y),
                    Number(localDirection.z),
                );
                if (!point) {
                    continue;
                }
                drawLabel(descriptor.text, point, "star");
            }
        }
    }

    renderMoonFarSideOverlay(panelState, { distanceToTarget, targetRadius, earthDirectionWorld }) {
        if (!panelState?.overlayCtx || !panelState?.overlayCanvas) {
            return;
        }
        const nowMs = performance.now();
        const shouldRefresh = panelState.overlayDirty || (nowMs - panelState.lastOverlayUpdateMs) >= 90;
        if (!shouldRefresh) {
            return;
        }
        panelState.lastOverlayUpdateMs = nowMs;
        panelState.overlayDirty = false;

        const canvas = panelState.overlayCanvas;
        const ctx = panelState.overlayCtx;
        const width = canvas.width;
        const height = canvas.height;
        if (width <= 1 || height <= 1) {
            return;
        }
        ctx.clearRect(0, 0, width, height);

        if (!panelState.farSideTintEnabled) {
            return;
        }
        if (!Number.isFinite(distanceToTarget) || !Number.isFinite(targetRadius) || targetRadius <= 0) {
            return;
        }

        const ratio = this.THREE.MathUtils.clamp(targetRadius / Math.max(distanceToTarget, targetRadius + 1e-9), 0, 0.999999);
        const angularRadius = Math.asin(ratio);
        const vFov = this.THREE.MathUtils.degToRad(panelState.camera.fov);
        const radiusPx = (Math.tan(angularRadius) / Math.max(Math.tan(vFov * 0.5), 1e-9)) * (height * 0.5);
        if (!Number.isFinite(radiusPx) || radiusPx < 2) {
            return;
        }

        panelState.camera.getWorldQuaternion(this.panelCameraWorldQuat);
        this.panelCameraWorldQuatInv.copy(this.panelCameraWorldQuat).invert();
        this.earthDirInCamera.copy(earthDirectionWorld).applyQuaternion(this.panelCameraWorldQuatInv);
        const earthDirLen = this.earthDirInCamera.length();
        if (!Number.isFinite(earthDirLen) || earthDirLen <= 1e-9) {
            return;
        }
        this.earthDirInCamera.multiplyScalar(1 / earthDirLen);

        const ex = this.earthDirInCamera.x;
        const ey = this.earthDirInCamera.y;
        const ez = this.earthDirInCamera.z;
        const cx = width * 0.5;
        const cy = height * 0.5;
        const left = Math.max(0, Math.floor(cx - radiusPx - 1));
        const top = Math.max(0, Math.floor(cy - radiusPx - 1));
        const right = Math.min(width - 1, Math.ceil(cx + radiusPx + 1));
        const bottom = Math.min(height - 1, Math.ceil(cy + radiusPx + 1));
        const w = right - left + 1;
        const h = bottom - top + 1;
        if (w <= 0 || h <= 0) {
            return;
        }

        const img = ctx.createImageData(w, h);
        const data = img.data;
        const baseR = 124;
        const baseG = 84;
        const baseB = 224;
        // Keep far-side tint readable but highly transparent (~80% transparent).
        const baseAlpha = 52;
        const edgeR = 193;
        const edgeG = 170;
        const edgeB = 255;
        const edgeAlpha = 108;
        const terminatorBand = 0.06;
        const limbBand = 0.035;

        let idx = 0;
        for (let py = top; py <= bottom; py += 1) {
            const ny = (cy - (py + 0.5)) / radiusPx;
            for (let px = left; px <= right; px += 1) {
                const nx = ((px + 0.5) - cx) / radiusPx;
                const rr = nx * nx + ny * ny;
                if (rr <= 1) {
                    const nz = Math.sqrt(Math.max(0, 1 - rr));
                    const dot = nx * ex + ny * ey + nz * ez;
                    if (dot < 0) {
                        const intensity = Math.min(1, Math.max(0.2, -dot * 1.3));
                        const limbFade = 0.6 + nz * 0.4;
                        let r = baseR;
                        let g = baseG;
                        let b = baseB;
                        let a = Math.round(baseAlpha * intensity * limbFade);

                        // Crisp glass-like edge at the far/near divider.
                        const absDot = Math.abs(dot);
                        if (absDot < terminatorBand) {
                            const edgeMix = 1 - (absDot / terminatorBand);
                            r = Math.round(baseR * (1 - edgeMix) + edgeR * edgeMix);
                            g = Math.round(baseG * (1 - edgeMix) + edgeG * edgeMix);
                            b = Math.round(baseB * (1 - edgeMix) + edgeB * edgeMix);
                            a = Math.max(a, Math.round(edgeAlpha * edgeMix));
                        }

                        // Slight perimeter reinforcement for a clearer "panel".
                        const rim = 1 - Math.sqrt(rr);
                        if (rim < limbBand) {
                            const rimMix = 1 - (rim / limbBand);
                            r = Math.round(r * (1 - rimMix * 0.35) + edgeR * rimMix * 0.35);
                            g = Math.round(g * (1 - rimMix * 0.35) + edgeG * rimMix * 0.35);
                            b = Math.round(b * (1 - rimMix * 0.35) + edgeB * rimMix * 0.35);
                            a = Math.max(a, Math.round(170 * rimMix));
                        }

                        data[idx] = r;
                        data[idx + 1] = g;
                        data[idx + 2] = b;
                        data[idx + 3] = Math.min(255, a);
                    }
                }
                idx += 4;
            }
        }
        ctx.putImageData(img, left, top);
    }

    renderComposerMoonOutlineOverlay(panelState, { moonWorld, moonRadius }) {
        if (!panelState?.overlayCtx || !panelState?.overlayCanvas || panelState.composerMoonOutlineEnabled !== true) {
            return;
        }
        if (!moonWorld || !Number.isFinite(moonRadius) || moonRadius <= 0) {
            return;
        }
        const canvas = panelState.overlayCanvas;
        const ctx = panelState.overlayCtx;
        const width = canvas.width;
        const height = canvas.height;
        if (width <= 1 || height <= 1) {
            return;
        }

        this.tmpVectorA.copy(moonWorld).project(panelState.camera);
        if (!Number.isFinite(this.tmpVectorA.x) || !Number.isFinite(this.tmpVectorA.y) || !Number.isFinite(this.tmpVectorA.z)) {
            return;
        }
        if (this.tmpVectorA.z < -1 || this.tmpVectorA.z > 1) {
            return;
        }

        const cx = (this.tmpVectorA.x * 0.5 + 0.5) * width;
        const cy = (1 - (this.tmpVectorA.y * 0.5 + 0.5)) * height;
        const distanceToMoon = panelState.camera.position.distanceTo(moonWorld);
        if (!Number.isFinite(distanceToMoon) || distanceToMoon <= moonRadius + 1e-9) {
            return;
        }
        const angularRadius = Math.asin(this.THREE.MathUtils.clamp(moonRadius / distanceToMoon, 0, 0.999999));
        const verticalFovRad = this.THREE.MathUtils.degToRad(panelState.camera.fov);
        const radiusPx = (Math.tan(angularRadius) / Math.max(Math.tan(verticalFovRad * 0.5), 1e-9)) * (height * 0.5);
        if (!Number.isFinite(radiusPx) || radiusPx < 2) {
            return;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
        ctx.strokeStyle = COMPOSER_MOON_OUTLINE_RGBA;
        ctx.lineWidth = COMPOSER_MOON_OUTLINE_THICKNESS_PX;
        ctx.shadowColor = "rgba(13, 24, 40, 0.62)";
        ctx.shadowBlur = 2;
        ctx.stroke();
        ctx.restore();
    }

    renderComposerBottomMetricsOverlay(panelState, { craftWorld, moonWorld, earthWorld, telemetry = null }) {
        if (!panelState?.camera) {
            return;
        }
        const strip = panelState?.composerMetricsStrip;
        if (!(strip instanceof HTMLElement)) {
            return;
        }
        strip.hidden = panelState.composerInfoOverlayEnabled !== true;
        if (strip.hidden) {
            return;
        }
        if (!craftWorld || !moonWorld || !earthWorld) {
            if (panelState.composerMetricFovHValue) panelState.composerMetricFovHValue.textContent = "--";
            if (panelState.composerMetricFovVValue) panelState.composerMetricFovVValue.textContent = "--";
            if (panelState.composerMetricDistanceMoonValue) panelState.composerMetricDistanceMoonValue.textContent = "--";
            if (panelState.composerMetricAngleValue) panelState.composerMetricAngleValue.textContent = "--";
            return;
        }

        const verticalFovDeg = Number.isFinite(panelState.camera.fov) ? panelState.camera.fov : Number.NaN;
        const aspect = Math.max(1e-6, Number.isFinite(panelState.camera.aspect) ? panelState.camera.aspect : 1);
        const verticalFovRad = this.THREE.MathUtils.degToRad(verticalFovDeg);
        const horizontalFovDeg = Number.isFinite(verticalFovDeg)
            ? this.THREE.MathUtils.radToDeg(Math.atan(Math.tan(verticalFovRad * 0.5) * aspect) * 2)
            : Number.NaN;

        const telemetryDistanceMoon = Number.isFinite(telemetry?.distanceMoon)
            ? telemetry.distanceMoon
            : (Number.isFinite(telemetry?.distancePrimary) ? telemetry.distancePrimary : Number.NaN);
        const distanceToMoonKm = Number.isFinite(telemetryDistanceMoon)
            ? telemetryDistanceMoon
            : Number.NaN;
        this.tmpVectorA.subVectors(craftWorld, moonWorld);
        this.tmpVectorB.subVectors(earthWorld, moonWorld);
        const lenA = this.tmpVectorA.length();
        const lenB = this.tmpVectorB.length();
        let craftMoonEarthDeg = Number.NaN;
        if (lenA > 1e-9 && lenB > 1e-9) {
            this.tmpVectorA.multiplyScalar(1 / lenA);
            this.tmpVectorB.multiplyScalar(1 / lenB);
            const dot = this.THREE.MathUtils.clamp(this.tmpVectorA.dot(this.tmpVectorB), -1, 1);
            craftMoonEarthDeg = this.THREE.MathUtils.radToDeg(Math.acos(dot));
        }

        const safeFovH = Number.isFinite(horizontalFovDeg) ? `${horizontalFovDeg.toFixed(1)}°` : "--";
        const safeFovV = Number.isFinite(verticalFovDeg) ? `${verticalFovDeg.toFixed(1)}°` : "--";
        const safeDistance = Number.isFinite(distanceToMoonKm)
            ? `${Math.round(distanceToMoonKm).toLocaleString()} km / ${Math.round(distanceToMoonKm * KM_TO_MILES).toLocaleString()} mi`
            : "--";
        const safeAngle = Number.isFinite(craftMoonEarthDeg) ? `${craftMoonEarthDeg.toFixed(1)}°` : "--";

        if (panelState.composerMetricFovHValue) panelState.composerMetricFovHValue.textContent = safeFovH;
        if (panelState.composerMetricFovVValue) panelState.composerMetricFovVValue.textContent = safeFovV;
        if (panelState.composerMetricDistanceMoonValue) panelState.composerMetricDistanceMoonValue.textContent = safeDistance;
        if (panelState.composerMetricAngleValue) panelState.composerMetricAngleValue.textContent = safeAngle;
    }

    suppressLinePrimitives(scene) {
        const hiddenEntries = [];
        scene?.traverse?.((object) => {
            if (!object?.visible) {
                return;
            }
            if (!object.isLine && !object.isLineLoop && !object.isLineSegments) {
                return;
            }
            hiddenEntries.push({
                object,
                visible: object.visible,
            });
            object.visible = false;
        });
        return hiddenEntries;
    }

    suppressCraftVisuals({ activeCraft, craftsById, dronesById } = {}) {
        const hiddenEntries = [];
        const seen = new Set();
        const hideObject = (object) => {
            if (!object || seen.has(object)) {
                return;
            }
            seen.add(object);
            if (!object.visible) {
                return;
            }
            hiddenEntries.push({ object, visible: object.visible });
            object.visible = false;
        };

        hideObject(activeCraft);
        for (const craft of Object.values(craftsById || {})) {
            hideObject(craft);
        }
        for (const drone of Object.values(dronesById || {})) {
            hideObject(drone);
        }

        return hiddenEntries;
    }

    restoreVisibility(entries) {
        for (const entry of entries || []) {
            entry.object.visible = entry.visible;
        }
    }

    estimateCraftRadius(activeCraft) {
        if (!activeCraft) {
            return 1;
        }

        this.boundingBox.setFromObject(activeCraft);
        if (this.boundingBox.isEmpty()) {
            return 1;
        }

        this.boundingBox.getBoundingSphere(this.boundingSphere);
        const radius = this.boundingSphere.radius;
        return Number.isFinite(radius) && radius > 0 ? radius : 1;
    }

    estimateObjectRadius(object, fallbackRadius = 1) {
        if (!object) {
            return fallbackRadius;
        }
        this.boundingBox.setFromObject(object);
        if (this.boundingBox.isEmpty()) {
            return fallbackRadius;
        }
        this.boundingBox.getBoundingSphere(this.boundingSphere);
        const radius = this.boundingSphere.radius;
        return Number.isFinite(radius) && radius > 0 ? radius : fallbackRadius;
    }

    computeAutoFovDegrees({ distanceToTarget, targetRadius, aspect }) {
        if (!Number.isFinite(distanceToTarget) || distanceToTarget <= 0) {
            return null;
        }

        const radius = Number.isFinite(targetRadius) && targetRadius > 0 ? targetRadius : 1;
        const fitRadius = radius * AUTO_FOV_MARGIN_SCALE;
        const safeDistance = Math.max(distanceToTarget, fitRadius + 1e-9);
        const ratio = Math.min(fitRadius / safeDistance, 0.999999);
        const angularRadius = Math.asin(ratio);
        const safeAspect = Math.max(aspect || 1, 1e-3);
        const verticalFromHeight = 2 * angularRadius;
        const verticalFromWidth = 2 * Math.atan(Math.tan(angularRadius) / safeAspect);
        const requiredVerticalRadians = Math.max(verticalFromHeight, verticalFromWidth);
        return this.THREE.MathUtils.radToDeg(requiredVerticalRadians);
    }

    applyEclipticNorthUp(camera, lookTarget) {
        if (!camera || !lookTarget) return;
        const worldNorth = this.viewDir.set(0, 0, 1);
        const cameraToTarget = this.cameraOffset.copy(lookTarget).sub(camera.position);
        if (cameraToTarget.lengthSq() < 1e-18) {
            camera.up.set(0, 0, 1);
            return;
        }
        cameraToTarget.normalize();
        this.projectedUp
            .copy(worldNorth)
            .addScaledVector(cameraToTarget, -worldNorth.dot(cameraToTarget));
        if (this.projectedUp.lengthSq() < 1e-8) {
            camera.up.set(1, 0, 0);
            return;
        }
        camera.up.copy(this.projectedUp.normalize());
    }

    createFibonacciSphereSamples(count = 720) {
        const sampleCount = Math.max(64, Math.floor(count));
        const points = new Float32Array(sampleCount * 3);
        const golden = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < sampleCount; i += 1) {
            const y = 1 - (2 * (i + 0.5)) / sampleCount;
            const radius = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = golden * i;
            points[i * 3] = Math.cos(theta) * radius;
            points[i * 3 + 1] = y;
            points[i * 3 + 2] = Math.sin(theta) * radius;
        }
        return points;
    }

    getObjectWorldPosition(object, outVector) {
        if (!object || !outVector) return false;
        object.getWorldPosition(outVector);
        return Number.isFinite(outVector.x) && Number.isFinite(outVector.y) && Number.isFinite(outVector.z);
    }

    resolvePositionForKey(key, context, outVector) {
        if (!outVector) return false;
        if (key === "craft") {
            return this.getObjectWorldPosition(context.activeCraft, outVector);
        }
        if (key === "earth") {
            return this.getObjectWorldPosition(context.earth, outVector);
        }
        if (key === "moon") {
            return this.getObjectWorldPosition(context.moon, outVector);
        }
        if (key === "sun") {
            return this.getObjectWorldPosition(context.sun, outVector);
        }
        return false;
    }

    vectorFromSunDirection(outVector, mode = "earth") {
        const pickSource = () => {
            if (mode === "moon") {
                return this.sunDirectionMoonWorld;
            }
            if (mode === "craft") {
                return this.sunDirectionCraftWorld;
            }
            return this.sunDirectionEarthWorld;
        };
        const source = pickSource();
        if (
            Number.isFinite(source?.x) &&
            Number.isFinite(source?.y) &&
            Number.isFinite(source?.z)
        ) {
            const len = source.length();
            if (len > 1e-12) {
                outVector.copy(source).multiplyScalar(1 / len);
                return true;
            }
        }
        return false;
    }

    resolveSunDirectionForPanel(panelState) {
        if (!panelState) {
            return this.sunDirectionEarthWorld;
        }
        if (panelState.anchorKey === "craft" || panelState.mode === "composer") {
            return this.sunDirectionCraftWorld;
        }
        if (panelState.targetKey === "moon" || panelState.anchorKey === "moon") {
            return this.sunDirectionMoonWorld;
        }
        return this.sunDirectionEarthWorld;
    }

    computeMoonPhaseInfo({ earth, moon, sun }) {
        if (!earth || !moon) {
            return null;
        }
        if (!this.getObjectWorldPosition(earth, this.earthWorld)) {
            return null;
        }
        if (!this.getObjectWorldPosition(moon, this.moonWorld)) {
            return null;
        }

        this.tmpVectorA.subVectors(this.moonWorld, this.earthWorld);
        const moonDistance = this.tmpVectorA.length();
        if (!Number.isFinite(moonDistance) || moonDistance <= 1e-12) {
            return null;
        }
        this.tmpVectorA.multiplyScalar(1 / moonDistance);

        let sunAvailable = this.vectorFromSunDirection(this.tmpVectorB);
        if (!sunAvailable && sun && this.getObjectWorldPosition(sun, this.sunWorld)) {
            this.tmpVectorB.subVectors(this.sunWorld, this.earthWorld);
            const sunDistance = this.tmpVectorB.length();
            if (Number.isFinite(sunDistance) && sunDistance > 1e-12) {
                this.tmpVectorB.multiplyScalar(1 / sunDistance);
                sunAvailable = true;
            }
        }
        if (!sunAvailable) {
            return null;
        }

        const dot = this.THREE.MathUtils.clamp(this.tmpVectorA.dot(this.tmpVectorB), -1, 1);
        const elongationDeg = this.THREE.MathUtils.radToDeg(Math.acos(dot));

        if (Number.isFinite(this.moonElongationPrevious)) {
            const delta = elongationDeg - this.moonElongationPrevious;
            if (Math.abs(delta) > 0.03) {
                this.moonElongationTrend = delta >= 0 ? 1 : -1;
            }
        }
        this.moonElongationPrevious = elongationDeg;

        const phaseName = this.resolveMoonPhaseName(elongationDeg, this.moonElongationTrend);
        return {
            phaseName,
            elongationDeg,
        };
    }

    resolveMoonPhaseName(elongationDeg, trend) {
        const waxing = trend >= 0;
        if (elongationDeg < 10) {
            return "New Moon";
        }
        if (elongationDeg < 84) {
            return waxing ? "Waxing Crescent" : "Waning Crescent";
        }
        if (elongationDeg <= 96) {
            return waxing ? "First Quarter" : "Last Quarter";
        }
        if (elongationDeg < 170) {
            return waxing ? "Waxing Gibbous" : "Waning Gibbous";
        }
        return "Full Moon";
    }

    roundPercentParts(parts) {
        const floors = parts.map((value) => Math.floor(Math.max(0, value)));
        let sum = floors.reduce((acc, value) => acc + value, 0);
        let remaining = Math.max(0, 100 - sum);
        const remainders = parts
            .map((value, index) => ({ index, remainder: Math.max(0, value) - floors[index] }))
            .sort((a, b) => b.remainder - a.remainder);
        let cursor = 0;
        while (remaining > 0 && remainders.length > 0) {
            floors[remainders[cursor % remainders.length].index] += 1;
            remaining -= 1;
            cursor += 1;
        }
        sum = floors.reduce((acc, value) => acc + value, 0);
        if (sum !== 100 && floors.length > 0) {
            floors[0] += 100 - sum;
        }
        return floors;
    }

    computeCraftMoonVisibilityInfo({ activeCraft, earth, moon, sun }) {
        if (!activeCraft || !earth || !moon) {
            return null;
        }
        if (!this.getObjectWorldPosition(activeCraft, this.craftWorld)) {
            return null;
        }
        if (!this.getObjectWorldPosition(earth, this.earthWorld)) {
            return null;
        }
        if (!this.getObjectWorldPosition(moon, this.moonWorld)) {
            return null;
        }

        this.craftFromMoonDir.subVectors(this.craftWorld, this.moonWorld);
        this.earthFromMoonDir.subVectors(this.earthWorld, this.moonWorld);
        let craftLen = this.craftFromMoonDir.length();
        let earthLen = this.earthFromMoonDir.length();
        if (craftLen <= 1e-12 || earthLen <= 1e-12) {
            return null;
        }
        this.craftFromMoonDir.multiplyScalar(1 / craftLen);
        this.earthFromMoonDir.multiplyScalar(1 / earthLen);

        let sunAvailable = this.vectorFromSunDirection(this.sunFromMoonDir, "moon");
        if (!sunAvailable && sun && this.getObjectWorldPosition(sun, this.sunWorld)) {
            this.sunFromMoonDir.subVectors(this.sunWorld, this.moonWorld);
            const sunLen = this.sunFromMoonDir.length();
            if (sunLen > 1e-12) {
                this.sunFromMoonDir.multiplyScalar(1 / sunLen);
                sunAvailable = true;
            }
        }
        if (!sunAvailable) {
            return null;
        }

        let visibleCount = 0;
        let nearDay = 0;
        let nearNight = 0;
        let farDay = 0;
        let farNight = 0;
        const samples = this.moonVisibilitySamples;
        for (let i = 0; i < samples.length; i += 3) {
            const nx = samples[i];
            const ny = samples[i + 1];
            const nz = samples[i + 2];
            const visibleDot = nx * this.craftFromMoonDir.x + ny * this.craftFromMoonDir.y + nz * this.craftFromMoonDir.z;
            if (visibleDot <= 0) continue;
            visibleCount += 1;

            const near = (nx * this.earthFromMoonDir.x + ny * this.earthFromMoonDir.y + nz * this.earthFromMoonDir.z) >= 0;
            const day = (nx * this.sunFromMoonDir.x + ny * this.sunFromMoonDir.y + nz * this.sunFromMoonDir.z) >= 0;

            if (near) {
                if (day) nearDay += 1;
                else nearNight += 1;
            } else if (day) {
                farDay += 1;
            } else {
                farNight += 1;
            }
        }

        if (visibleCount <= 0) {
            return null;
        }

        const rawParts = [
            (nearDay * 100) / visibleCount,
            (nearNight * 100) / visibleCount,
            (farDay * 100) / visibleCount,
            (farNight * 100) / visibleCount,
        ];
        const [nearDayPct, nearNightPct, farDayPct, farNightPct] = this.roundPercentParts(rawParts);
        const nearPct = nearDayPct + nearNightPct;
        const farPct = farDayPct + farNightPct;

        return {
            nearPct,
            farPct,
            nearDayPct,
            nearNightPct,
            farDayPct,
            farNightPct,
        };
    }

    setPanelFov(panelState, requestedDegrees) {
        if (!Number.isFinite(requestedDegrees)) {
            return;
        }

        const sliderMin = Number(panelState.fovSlider.min);
        const sliderMax = Number(panelState.fovSlider.max);
        const minDegrees = Number.isFinite(sliderMin) ? sliderMin : AUTO_FOV_MIN_DEGREES;
        const maxDegrees = Number.isFinite(sliderMax) ? sliderMax : AUTO_FOV_MAX_DEGREES;
        const fovDegrees = this.THREE.MathUtils.clamp(requestedDegrees, minDegrees, maxDegrees);

        if (Math.abs(panelState.camera.fov - fovDegrees) > 1e-4) {
            panelState.camera.fov = fovDegrees;
            panelState.camera.updateProjectionMatrix();
            panelState.overlayDirty = true;
        }

        const rounded = Math.round(fovDegrees);
        panelState.fovSlider.value = String(rounded);
        panelState.fovValue.value = `${rounded}°`;
        panelState.fovValue.textContent = panelState.fovValue.value;
    }

    renderComposerPanel(panelState, {
        scene,
        latestSceneState = null,
        activeCraft,
        earth,
        moon,
        sun = null,
        sunRenderer,
        skyRenderer = null,
        earthRadius,
        moonRadius,
        referenceCamera,
        hasSkyContainer,
        skyContainer,
    }) {
        if (!activeCraft || !earth || !moon) {
            this.setPanelVisible(panelState, false);
            return false;
        }
        if (!this.getObjectWorldPosition(activeCraft, this.craftWorld)) {
            this.setPanelVisible(panelState, false);
            return false;
        }
        if (!this.getObjectWorldPosition(earth, this.earthWorld) || !this.getObjectWorldPosition(moon, this.moonWorld)) {
            this.setPanelVisible(panelState, false);
            return false;
        }
        const composerEarthRadius = (Number.isFinite(earthRadius) && earthRadius > 0)
            ? earthRadius
            : this.estimateObjectRadius(earth, 1);
        const composerMoonRadius = (Number.isFinite(moonRadius) && moonRadius > 0)
            ? moonRadius
            : this.estimateObjectRadius(moon, 1);

        this.setPanelVisible(panelState, true);
        this.syncPanelSize(panelState);
        this.syncComposerTimelineUi(panelState);

        if (referenceCamera) {
            if (
                Math.abs(panelState.camera.near - referenceCamera.near) > 1e-9 ||
                Math.abs(panelState.camera.far - referenceCamera.far) > 1e-9
            ) {
                panelState.camera.near = referenceCamera.near;
                panelState.camera.far = referenceCamera.far;
                panelState.camera.updateProjectionMatrix();
            }
        }

        const lockTarget = panelState.composerLockTarget || "none";
        if (lockTarget === "earth" || lockTarget === "moon") {
            this.applyComposerPreset(panelState, lockTarget, {
                craftWorld: this.craftWorld,
                earthWorld: this.earthWorld,
                moonWorld: this.moonWorld,
            });
        } else if (!Number.isFinite(panelState.composerYawRad) || !Number.isFinite(panelState.composerPitchRad)) {
            this.applyComposerPreset(panelState, "earth", {
                craftWorld: this.craftWorld,
                earthWorld: this.earthWorld,
                moonWorld: this.moonWorld,
            });
        }
        this.updateComposerRollUi(panelState);

        panelState.camera.position.copy(this.craftWorld);
        let distanceForFov = Number.NaN;
        let radiusForFov = Number.NaN;
        const disabledAsCraftToEarth = panelState.composerInteractionEnabled !== true;
        if (disabledAsCraftToEarth) {
            this.composerLookAtWorld.copy(this.earthWorld);
            this.viewDir.subVectors(this.earthWorld, this.craftWorld).normalize();
            this.targetUp.set(0, 0, 1);
            earth.getWorldQuaternion(this.targetQuat);
            this.targetUp.applyQuaternion(this.targetQuat).normalize();
            if (Math.abs(this.targetUp.dot(this.viewDir)) > 0.98) {
                panelState.camera.up.set(0, 0, 1);
            } else {
                panelState.camera.up.copy(this.targetUp);
            }
            panelState.camera.lookAt(this.composerLookAtWorld);
            distanceForFov = panelState.camera.position.distanceTo(this.earthWorld);
            radiusForFov = composerEarthRadius;
        } else {
            const lookDir = this.getComposerLookDirection(panelState);
            panelState.camera.up.copy(this.getComposerCameraUp(panelState, lookDir));
            this.composerLookAtWorld.copy(this.craftWorld).add(lookDir);
            panelState.camera.lookAt(this.composerLookAtWorld);
            // Keep previous auto-FoV behavior when enabled.
            if (lockTarget === "earth") {
                distanceForFov = panelState.camera.position.distanceTo(this.earthWorld);
                radiusForFov = composerEarthRadius;
            } else if (lockTarget === "moon") {
                distanceForFov = panelState.camera.position.distanceTo(this.moonWorld);
                radiusForFov = composerMoonRadius;
            }
        }

        if (!disabledAsCraftToEarth && panelState.autoFovEnabled) {
            const autoFov = this.computeComposerAutoFovDegrees({
                panelState,
                craftWorld: this.craftWorld,
                earthWorld: this.earthWorld,
                moonWorld: this.moonWorld,
                earthRadius: composerEarthRadius,
                moonRadius: composerMoonRadius,
                lockTarget,
            });
            this.setPanelFov(panelState, autoFov);
        }

        if (hasSkyContainer) {
            panelState.camera.getWorldPosition(this.panelCameraWorldPosition);
            if (skyContainer.parent?.worldToLocal) {
                this.panelSkyLocalPosition.copy(this.panelCameraWorldPosition);
                skyContainer.parent.worldToLocal(this.panelSkyLocalPosition);
                skyContainer.position.copy(this.panelSkyLocalPosition);
            } else {
                skyContainer.position.copy(this.panelCameraWorldPosition);
            }
        }
        if (sunRenderer?.setReferencePosition) {
            panelState.camera.getWorldPosition(this.panelCameraWorldPosition);
            const sunParent = sunRenderer.group?.parent;
            if (sunParent?.worldToLocal) {
                this.panelSunLocalPosition.copy(this.panelCameraWorldPosition);
                sunParent.worldToLocal(this.panelSunLocalPosition);
                sunRenderer.setReferencePosition(
                    this.panelSunLocalPosition.x,
                    this.panelSunLocalPosition.y,
                    this.panelSunLocalPosition.z,
                );
            } else {
                sunRenderer.setReferencePosition(
                    this.panelCameraWorldPosition.x,
                    this.panelCameraWorldPosition.y,
                    this.panelCameraWorldPosition.z,
                );
            }
        }
        const restoreComposerBodyAmbient = this.applyComposerBodyAmbientLighting({
            panelState,
            earth,
            moon,
            earthWorld: this.earthWorld,
            moonWorld: this.moonWorld,
            sun,
        });
        const restoreComposerExposureProfile = this.applyComposerExposureProfile(scene, panelState, sunRenderer);
        try {
            this.renderLayers(panelState.renderer, scene, panelState.camera, {
                renderSkyLayer: hasSkyContainer && skyContainer?.visible !== false,
            });
        } finally {
            restoreComposerExposureProfile();
            restoreComposerBodyAmbient();
        }
        this.clearPanelOverlay(panelState);
        this.renderComposerRaDecGridOverlay(panelState);
        this.renderComposerSkyLabelOverlay(panelState, { scene, skyContainer, skyRenderer });
        this.renderComposerMoonOutlineOverlay(panelState, {
            moonWorld: this.moonWorld,
            moonRadius: composerMoonRadius,
        });
        this.renderComposerBottomMetricsOverlay(panelState, {
            craftWorld: this.craftWorld,
            moonWorld: this.moonWorld,
            earthWorld: this.earthWorld,
            telemetry: latestSceneState?.telemetry || null,
        });
        return true;
    }

    render({
        scene,
        skyRenderer = null,
        latestSceneState = null,
        activeCraft,
        craftsById = null,
        dronesById = null,
        earth,
        moon,
        sun = null,
        sunRenderer = null,
        sunDirection = null,
        sunDirections = null,
        skyContainer = null,
        earthRadius = null,
        moonRadius = null,
        timelineEventInfos = null,
        referenceCamera,
        panelsVisible = true,
        missionConfig = null,
    }) {
        if (!this.root) {
            return;
        }

        this.syncMissionPanelPolicy(missionConfig);
        this.panelsEnabled = panelsVisible !== false;
        if (!this.panelsEnabled || !isDesktopViewport()) {
            this.root.hidden = true;
            return;
        }

        if (!scene || !activeCraft) {
            this.root.hidden = true;
            return;
        }

        this.root.hidden = false;
        this.composerFlybyTimeMs = this.resolveLunarFlybyTimeMs(timelineEventInfos);
        const flybyWindow = resolveLunarFlybyWindowMs(timelineEventInfos);
        this.composerFlybyWindowStartMs = flybyWindow.startMs;
        this.composerFlybyWindowEndMs = flybyWindow.endMs;
        this.composerFlybyEvents = resolveFlybyPlannerEvents(timelineEventInfos);
        activeCraft.getWorldPosition(this.craftWorld);
        const normalizeSunDirection = (target, candidate) => {
            if (candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z)) {
                target.set(candidate.x, candidate.y, candidate.z);
            }
            const len = target.length();
            if (Number.isFinite(len) && len > 1e-12) {
                target.multiplyScalar(1 / len);
                return true;
            }
            target.set(1, 0, 0);
            return false;
        };

        const fallbackSun = (
            sunDirection &&
            Number.isFinite(sunDirection.x) &&
            Number.isFinite(sunDirection.y) &&
            Number.isFinite(sunDirection.z)
        )
            ? sunDirection
            : { x: 1, y: 0, z: 0 };
        this.sunDirectionWorld.set(fallbackSun.x, fallbackSun.y, fallbackSun.z);
        normalizeSunDirection(this.sunDirectionEarthWorld, sunDirections?.earthCentered || fallbackSun);
        normalizeSunDirection(this.sunDirectionMoonWorld, sunDirections?.moonCentered || sunDirections?.earthCentered || fallbackSun);
        normalizeSunDirection(this.sunDirectionCraftWorld, sunDirections?.craftCenteredLightTime || sunDirections?.craftCentered || sunDirections?.earthCentered || fallbackSun);
        const nowMs = performance.now();
        const refreshAnalytics = !Number.isFinite(this.analyticsLastUpdateMs) || (nowMs - this.analyticsLastUpdateMs) >= 120;
        if (refreshAnalytics) {
            this.cachedMoonPhaseInfo = this.computeMoonPhaseInfo({ earth, moon, sun });
            this.cachedMoonVisibilityInfo = this.computeCraftMoonVisibilityInfo({ activeCraft, earth, moon, sun });
            this.analyticsLastUpdateMs = nowMs;
        }
        // Keep auxiliary craft views physically faithful: camera sits at the
        // craft origin (no artificial standoff), so body occultations such as
        // Earth-rise behind the Moon remain geometrically correct.
        const standoffDistance = 0;

        let visiblePanels = 0;
        const suppressedLines = this.suppressLinePrimitives(scene);
        const suppressedCrafts = this.suppressCraftVisuals({ activeCraft, craftsById, dronesById });
        const hasSkyContainer = !!skyContainer?.position;
        if (hasSkyContainer) {
            this.originalSkyPosition.copy(skyContainer.position);
        }
        const hasSunRenderer = !!(sunRenderer?.setReferencePosition);
        if (hasSunRenderer) {
            sunRenderer.getReferencePosition?.(this.originalSunReference);
        }

        try {
            for (const panelState of this.panels) {
                if (panelState.missionEnabled !== true) {
                    this.setPanelMissionEnabled(panelState, false);
                    continue;
                }
                const context = { activeCraft, earth, moon, sun };
                if (panelState.mode === "composer") {
                    if (panelState.minimized === true) {
                        this.setPanelVisible(panelState, false);
                        visiblePanels += 1;
                        continue;
                    }
                    if (sunRenderer?.setDirection) {
                        const panelSunDirection = this.resolveSunDirectionForPanel(panelState);
                        sunRenderer.setDirection(panelSunDirection.x, panelSunDirection.y, panelSunDirection.z);
                    }
                    const rendered = this.renderComposerPanel(panelState, {
                        scene,
                        skyRenderer,
                        latestSceneState,
                        activeCraft,
                        earth,
                        moon,
                        sun,
                        sunRenderer,
                        earthRadius,
                        moonRadius,
                        referenceCamera,
                        hasSkyContainer,
                        skyContainer,
                    });
                    if (rendered) {
                        visiblePanels += 1;
                    }
                    continue;
                }
                const hasAnchor = this.resolvePositionForKey(panelState.anchorKey, context, this.anchorWorld);
                const targetObject = panelState.targetKey === "earth"
                    ? earth
                    : (panelState.targetKey === "moon" ? moon : null);
                const hasTarget = this.resolvePositionForKey(panelState.targetKey, context, this.targetWorld);
                if (!hasAnchor || !targetObject || !hasTarget) {
                    this.setPanelVisible(panelState, false);
                    continue;
                }
                if (panelState.minimized === true) {
                    this.setPanelVisible(panelState, false);
                    visiblePanels += 1; // keep root visible while minimized chips are shown
                    continue;
                }

                const distanceSq = this.anchorWorld.distanceToSquared(this.targetWorld);
                if (!Number.isFinite(distanceSq) || distanceSq <= 1e-14) {
                    this.setPanelVisible(panelState, false);
                    continue;
                }

                this.setPanelVisible(panelState, true);
                visiblePanels += 1;
                this.syncPanelSize(panelState);

                if (referenceCamera) {
                    if (
                        Math.abs(panelState.camera.near - referenceCamera.near) > 1e-9 ||
                        Math.abs(panelState.camera.far - referenceCamera.far) > 1e-9
                    ) {
                        panelState.camera.near = referenceCamera.near;
                        panelState.camera.far = referenceCamera.far;
                        panelState.camera.updateProjectionMatrix();
                    }
                }

                this.viewDir.subVectors(this.targetWorld, this.anchorWorld).normalize();
                panelState.camera.position.copy(this.anchorWorld);
                if (standoffDistance > 0) {
                    this.cameraOffset.copy(this.viewDir).multiplyScalar(-standoffDistance);
                    panelState.camera.position.add(this.cameraOffset);
                }

                this.applyEclipticNorthUp(panelState.camera, this.targetWorld);

                const radiusHint = panelState.targetKey === "earth" ? earthRadius : moonRadius;
                const targetRadius = Number.isFinite(radiusHint) && radiusHint > 0
                    ? radiusHint
                    : this.estimateObjectRadius(targetObject, 1);
                const distanceToTarget = panelState.camera.position.distanceTo(this.targetWorld);

                if (panelState.autoFovEnabled) {
                    const autoFovDegrees = this.computeAutoFovDegrees({
                        distanceToTarget,
                        targetRadius,
                        aspect: panelState.camera.aspect,
                    });
                    this.setPanelFov(panelState, autoFovDegrees);
                }
                panelState.camera.lookAt(this.targetWorld);

                if (hasSkyContainer) {
                    panelState.camera.getWorldPosition(this.panelCameraWorldPosition);
                    if (skyContainer.parent?.worldToLocal) {
                        this.panelSkyLocalPosition.copy(this.panelCameraWorldPosition);
                        skyContainer.parent.worldToLocal(this.panelSkyLocalPosition);
                        skyContainer.position.copy(this.panelSkyLocalPosition);
                    } else {
                        skyContainer.position.copy(this.panelCameraWorldPosition);
                    }
                }
                if (hasSunRenderer) {
                    panelState.camera.getWorldPosition(this.panelCameraWorldPosition);
                    const sunParent = sunRenderer.group?.parent;
                    if (sunParent?.worldToLocal) {
                        this.panelSunLocalPosition.copy(this.panelCameraWorldPosition);
                        sunParent.worldToLocal(this.panelSunLocalPosition);
                        sunRenderer.setReferencePosition(
                            this.panelSunLocalPosition.x,
                            this.panelSunLocalPosition.y,
                            this.panelSunLocalPosition.z,
                        );
                    } else {
                        sunRenderer.setReferencePosition(
                            this.panelCameraWorldPosition.x,
                            this.panelCameraWorldPosition.y,
                            this.panelCameraWorldPosition.z,
                        );
                    }
                }
                if (sunRenderer?.setDirection) {
                    const panelSunDirection = this.resolveSunDirectionForPanel(panelState);
                    sunRenderer.setDirection(panelSunDirection.x, panelSunDirection.y, panelSunDirection.z);
                }

                this.renderLayers(panelState.renderer, scene, panelState.camera, {
                    renderSkyLayer: hasSkyContainer && skyContainer?.visible !== false,
                });

                if (panelState.infoMode === "moon-phase") {
                    const phase = this.cachedMoonPhaseInfo;
                    if (phase) {
                        this.setPanelInfo(
                            panelState,
                            `Phase: ${phase.phaseName}`,
                            `Sun separation: ${phase.elongationDeg.toFixed(1)}°`,
                        );
                    } else {
                        this.setPanelInfo(panelState, "Phase: --", "Sun separation: --");
                    }
                } else if (panelState.infoMode === "moon-visibility") {
                    const visibility = this.cachedMoonVisibilityInfo;
                    if (visibility) {
                        const hasEarthWorld = this.getObjectWorldPosition(earth, this.earthWorld);
                        if (!hasEarthWorld) {
                            this.clearPanelOverlay(panelState);
                        }
                        if (hasEarthWorld) {
                            this.tmpVectorC.subVectors(this.earthWorld, this.targetWorld);
                            if (this.tmpVectorC.lengthSq() > 1e-18) {
                                this.tmpVectorC.normalize();
                            } else {
                                this.tmpVectorC.set(1, 0, 0);
                            }
                        } else {
                            this.tmpVectorC.set(1, 0, 0);
                        }
                        this.renderMoonFarSideOverlay(panelState, {
                            distanceToTarget,
                            targetRadius,
                            earthDirectionWorld: this.tmpVectorC,
                        });
                        this.setPanelInfo(
                            panelState,
                            "Visible lunar surface",
                            `${visibility.nearPct}% near (${visibility.nearDayPct}% day; ${visibility.nearNightPct}% night) ${visibility.farPct}% far (${visibility.farDayPct}% day; ${visibility.farNightPct}% night)`,
                            {
                                pillText: panelState.farSideTintEnabled ? "Far Side: ON" : "Far Side: OFF",
                                pillVariant: "far",
                                pillInteractive: true,
                                pillOn: panelState.farSideTintEnabled === true,
                            },
                        );
                    } else {
                        this.clearPanelOverlay(panelState);
                        this.setPanelInfo(panelState, "Visible lunar surface", "No visibility data");
                    }
                } else {
                    this.clearPanelOverlay(panelState);
                    this.setPanelInfo(panelState, "", "");
                }
            }
        } finally {
            if (hasSkyContainer) {
                skyContainer.position.copy(this.originalSkyPosition);
            }
            if (hasSunRenderer) {
                sunRenderer.setReferencePosition(
                    this.originalSunReference.x,
                    this.originalSunReference.y,
                    this.originalSunReference.z,
                );
                sunRenderer.setDirection(
                    this.sunDirectionEarthWorld.x,
                    this.sunDirectionEarthWorld.y,
                    this.sunDirectionEarthWorld.z,
                );
            }
            this.restoreVisibility(suppressedCrafts);
            this.restoreVisibility(suppressedLines);
        }

        const hasMinimizedPanels = this.panels.some(
            (panelState) => panelState.missionEnabled !== false && panelState.minimized === true,
        );
        this.root.hidden = visiblePanels === 0 && !hasMinimizedPanels;
    }

    dispose() {
        if (!this.root) {
            return;
        }

        window.removeEventListener("resize", this.handleResizeBound);
        if (this.panelResizeObserver) {
            this.panelResizeObserver.disconnect();
            this.panelResizeObserver = null;
        }
        if (this.pendingResizeRaf != null) {
            cancelAnimationFrame(this.pendingResizeRaf);
            this.pendingResizeRaf = null;
        }
        if (this.persistStateTimeout != null) {
            clearTimeout(this.persistStateTimeout);
            this.persistStateTimeout = null;
        }
        this.pendingResizePanelStates.clear();
        this.dragState = null;
        for (const panelState of this.panels) {
            panelState.fovSlider.removeEventListener("input", panelState.onFovInput);
            panelState.autoToggle.removeEventListener("click", panelState.onAutoToggleClick);
            panelState.minimizeButton.removeEventListener("click", panelState.onMinimizeClick);
            panelState.chipButton.removeEventListener("click", panelState.onChipClick);
            if (panelState.onInfoPillClick) {
                panelState.infoPill.removeEventListener("click", panelState.onInfoPillClick);
            }
            if (panelState.onComposerLookFreeClick) {
                panelState.composerLookFreeButton?.removeEventListener("click", panelState.onComposerLookFreeClick);
            }
            if (panelState.onComposerLookEarthClick) {
                panelState.composerLookEarthButton?.removeEventListener("click", panelState.onComposerLookEarthClick);
            }
            if (panelState.onComposerLookMoonClick) {
                panelState.composerLookMoonButton?.removeEventListener("click", panelState.onComposerLookMoonClick);
            }
            if (panelState.onComposerTimelineInput) {
                panelState.composerTimelineSlider?.removeEventListener("input", panelState.onComposerTimelineInput);
            }
            if (panelState.onComposerEarthAmbientInput) {
                panelState.composerEarthAmbientSlider?.removeEventListener("input", panelState.onComposerEarthAmbientInput);
            }
            if (panelState.onComposerMoonAmbientInput) {
                panelState.composerMoonAmbientSlider?.removeEventListener("input", panelState.onComposerMoonAmbientInput);
            }
            if (panelState.onComposerMoonOutlineToggle) {
                panelState.composerMoonOutlineCheckbox?.removeEventListener("change", panelState.onComposerMoonOutlineToggle);
            }
            if (panelState.onComposerOpticsPhysicalClick) {
                panelState.composerOpticsPhysicalButton?.removeEventListener("click", panelState.onComposerOpticsPhysicalClick);
            }
            if (panelState.onComposerOpticsCameraClick) {
                panelState.composerOpticsCameraButton?.removeEventListener("click", panelState.onComposerOpticsCameraClick);
            }
            if (panelState.onComposerOpticsStrengthInput) {
                panelState.composerOpticsStrengthSlider?.removeEventListener("input", panelState.onComposerOpticsStrengthInput);
            }
            if (panelState.onComposerOpticsHaloInput) {
                panelState.composerOpticsHaloSlider?.removeEventListener("input", panelState.onComposerOpticsHaloInput);
            }
            if (panelState.onComposerOpticsStarburstInput) {
                panelState.composerOpticsStarburstSlider?.removeEventListener("input", panelState.onComposerOpticsStarburstInput);
            }
            if (panelState.onComposerOpticsFlareInput) {
                panelState.composerOpticsFlareSlider?.removeEventListener("input", panelState.onComposerOpticsFlareInput);
            }
            if (panelState.onComposerTimelinePointerDown) {
                panelState.composerTimelineSlider?.removeEventListener("pointerdown", panelState.onComposerTimelinePointerDown);
            }
            if (panelState.onComposerTimelinePointerUp) {
                panelState.composerTimelineSlider?.removeEventListener("pointerup", panelState.onComposerTimelinePointerUp);
                panelState.composerTimelineSlider?.removeEventListener("change", panelState.onComposerTimelinePointerUp);
            }
            if (panelState.onComposerTransportPlayClick) {
                panelState.composerTransportPlayButton?.removeEventListener("click", panelState.onComposerTransportPlayClick);
            }
            if (panelState.onComposerTransportMinusMinuteClick) {
                panelState.composerTransportMinusMinuteButton?.removeEventListener("click", panelState.onComposerTransportMinusMinuteClick);
            }
            if (panelState.onComposerTransportPlusMinuteClick) {
                panelState.composerTransportPlusMinuteButton?.removeEventListener("click", panelState.onComposerTransportPlusMinuteClick);
            }
            if (panelState.onComposerTransportSlowerClick) {
                panelState.composerTransportSlowerButton?.removeEventListener("click", panelState.onComposerTransportSlowerClick);
            }
            if (panelState.onComposerTransportSpeedClick) {
                panelState.composerTransportSpeedButton?.removeEventListener("click", panelState.onComposerTransportSpeedClick);
            }
            if (panelState.onComposerTransportFasterClick) {
                panelState.composerTransportFasterButton?.removeEventListener("click", panelState.onComposerTransportFasterClick);
            }
            if (panelState.onComposerInfoOverlayToggle) {
                panelState.composerInfoOverlayCheckbox?.removeEventListener("change", panelState.onComposerInfoOverlayToggle);
            }
            if (panelState.onComposerRollInput) {
                panelState.composerRollSlider?.removeEventListener("input", panelState.onComposerRollInput);
            }
            if (panelState.onComposerRaDecGridToggle) {
                panelState.composerRaDecGridCheckbox?.removeEventListener("change", panelState.onComposerRaDecGridToggle);
            }
            if (panelState.onComposerSkyLabelsToggle) {
                panelState.composerSkyLabelsCheckbox?.removeEventListener("change", panelState.onComposerSkyLabelsToggle);
            }
            if (panelState.onComposerViewportPointerDown) {
                panelState.viewport.removeEventListener("pointerdown", panelState.onComposerViewportPointerDown);
            }
            if (panelState.onComposerViewportPointerMove) {
                panelState.viewport.removeEventListener("pointermove", panelState.onComposerViewportPointerMove);
            }
            if (panelState.onComposerViewportPointerUp) {
                panelState.viewport.removeEventListener("pointerup", panelState.onComposerViewportPointerUp);
                panelState.viewport.removeEventListener("pointercancel", panelState.onComposerViewportPointerUp);
            }
            if (panelState.onComposerViewportWheel) {
                panelState.viewport.removeEventListener("wheel", panelState.onComposerViewportWheel);
            }
            if (panelState.onComposerPanelGatePointerDown) {
                panelState.panel.removeEventListener("pointerdown", panelState.onComposerPanelGatePointerDown, true);
            }
            const header = panelState.panel.querySelector(".aux-camera-view__header");
            if (header) {
                if (panelState.onPointerDown) {
                    header.removeEventListener("pointerdown", panelState.onPointerDown);
                }
                if (panelState.onPointerMove) {
                    header.removeEventListener("pointermove", panelState.onPointerMove);
                }
                if (panelState.onPointerUp) {
                    header.removeEventListener("pointerup", panelState.onPointerUp);
                }
                if (panelState.onPointerCancel) {
                    header.removeEventListener("pointercancel", panelState.onPointerCancel);
                }
            }
            if (panelState.onPanelPointerDown) {
                panelState.panel.removeEventListener("pointerdown", panelState.onPanelPointerDown);
            }
            panelState.renderer.dispose();
            panelState.chipButton.remove();
        }
        this.panels.length = 0;
        this.root.remove();
        this.root = null;
        this.chipDock = null;
        this.chipDockLeft = null;
        this.chipDockRight = null;
    }
}

export {
    AuxiliaryCameraViewsManager,
    AUXILIARY_VIEW_CAMERA_PRESETS,
    resolveLunarFlybyTimeMs,
    resolveLunarFlybyWindowMs,
};
