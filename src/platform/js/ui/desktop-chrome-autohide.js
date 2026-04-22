const DESKTOP_CHROME_AUTO_HIDE_DELAY_MS = 10000;
const DEFAULT_HOVER_SELECTORS = [
    "#header-pill-strip",
    "#control-panel",
    "#timeline-dock",
    "#zoom-panel",
    "#info-panel",
    "#compare-panel",
    "#shortcut-panel",
    ".aux-camera-view",
    "#ground-track-panel",
    ".panel-manager-menu.is-open",
];

export function createDesktopChromeAutohideController(deps = {}) {
    const documentRef = deps.documentRef || document;
    const windowRef = deps.windowRef || window;
    const isMobileViewport = typeof deps.isMobileViewport === "function"
        ? deps.isMobileViewport
        : () => false;
    const isElementLayoutVisible = typeof deps.isElementLayoutVisible === "function"
        ? deps.isElementLayoutVisible
        : () => false;
    const getMissionDialogApi = typeof deps.getMissionDialogApi === "function"
        ? deps.getMissionDialogApi
        : () => null;
    const isInteractiveInputTarget = typeof deps.isInteractiveInputTarget === "function"
        ? deps.isInteractiveInputTarget
        : () => false;
    const isSettingsPanelOpen = typeof deps.isSettingsPanelOpen === "function"
        ? deps.isSettingsPanelOpen
        : () => false;
    const isComparePanelOpen = typeof deps.isComparePanelOpen === "function"
        ? deps.isComparePanelOpen
        : () => false;
    const setHeaderPillStripAutoCollapsedState =
        typeof deps.setHeaderPillStripAutoCollapsedState === "function"
            ? deps.setHeaderPillStripAutoCollapsedState
            : () => {};
    const setControlPanelCollapsedState = typeof deps.setControlPanelCollapsedState === "function"
        ? deps.setControlPanelCollapsedState
        : () => {};
    const meaningfulActivityKeys = deps.meaningfulActivityKeys || new Set();
    const hoverSelectors = deps.hoverSelectors || DEFAULT_HOVER_SELECTORS;
    const autoHideDelayMs = Number.isFinite(deps.autoHideDelayMs)
        ? deps.autoHideDelayMs
        : DESKTOP_CHROME_AUTO_HIDE_DELAY_MS;
    const requestAnimationFrameImpl = typeof deps.requestAnimationFrameImpl === "function"
        ? deps.requestAnimationFrameImpl
        : windowRef.requestAnimationFrame?.bind(windowRef) || ((callback) => callback());
    const elementCtor = windowRef.Element || globalThis.Element || null;

    let bound = false;
    let autoHideEnabled = true;
    let animationPlaying = false;
    let autoHideTimerId = null;

    function isElementLike(value) {
        if (!value) return false;
        if (elementCtor) return value instanceof elementCtor;
        return typeof value === "object";
    }

    function clearAutoHideTimer() {
        if (autoHideTimerId === null) return;
        windowRef.clearTimeout(autoHideTimerId);
        autoHideTimerId = null;
    }

    function isDesktopViewportActive() {
        return !isMobileViewport() &&
            !documentRef.body?.classList?.contains("mobile-shell-enabled") &&
            documentRef.visibilityState !== "hidden";
    }

    function isAnySelectorHovered(selector) {
        const elements = documentRef.querySelectorAll?.(selector) || [];
        return Array.from(elements).some((element) => {
            if (!isElementLike(element)) return false;
            if (!isElementLayoutVisible(element)) return false;
            if (typeof element.matches === "function" && element.matches(":hover")) return true;
            return !!element.querySelector?.(":hover");
        });
    }

    function isSettingsPanelHovered() {
        const dialogApi = getMissionDialogApi();
        const wrapper = dialogApi?.widgetElement?.("#settings-panel");
        if (wrapper && isElementLayoutVisible(wrapper)) {
            if (wrapper.matches?.(":hover")) return true;
            return !!wrapper.querySelector?.(":hover");
        }
        const panel = documentRef.getElementById("settings-panel");
        if (!isElementLayoutVisible(panel)) return false;
        if (panel.matches?.(":hover")) return true;
        return !!panel.querySelector?.(":hover");
    }

    function hasInteractiveFocus() {
        const active = documentRef.activeElement;
        if (!isElementLike(active)) return false;
        if (isInteractiveInputTarget(active)) return true;
        if (active.matches?.('[role="slider"]')) return true;
        return !!active.closest?.("#settings-panel, #compare-panel, #info-panel, #shortcut-panel, .panel-manager-menu");
    }

    function hasBlockingUiOpen() {
        if (isSettingsPanelOpen()) return true;
        if (isComparePanelOpen()) return true;
        const infoPanel = documentRef.getElementById("info-panel");
        if (
            infoPanel &&
            !infoPanel.classList.contains("info-panel--hidden") &&
            isElementLayoutVisible(infoPanel)
        ) {
            return true;
        }
        const shortcutPanel = documentRef.getElementById("shortcut-panel");
        if (
            shortcutPanel &&
            !shortcutPanel.classList.contains("shortcut-panel--hidden") &&
            isElementLayoutVisible(shortcutPanel)
        ) {
            return true;
        }
        const panelMenu = documentRef.querySelector?.(".panel-manager-menu.is-open");
        if (panelMenu && isElementLayoutVisible(panelMenu)) {
            return true;
        }
        return false;
    }

    function isChromeHovered() {
        return isSettingsPanelHovered() || hoverSelectors.some(isAnySelectorHovered);
    }

    function canAutoHideChrome() {
        return autoHideEnabled &&
            animationPlaying &&
            isDesktopViewportActive() &&
            !hasBlockingUiOpen() &&
            !hasInteractiveFocus() &&
            !isChromeHovered();
    }

    function revealChrome() {
        setHeaderPillStripAutoCollapsedState(false);
        setControlPanelCollapsedState(false);
    }

    function scheduleAutoHide() {
        clearAutoHideTimer();
        if (!canAutoHideChrome()) return;
        autoHideTimerId = windowRef.setTimeout(() => {
            if (!canAutoHideChrome()) {
                revealChrome();
                clearAutoHideTimer();
                return;
            }
            setHeaderPillStripAutoCollapsedState(true);
            setControlPanelCollapsedState(true);
            clearAutoHideTimer();
        }, autoHideDelayMs);
    }

    function syncChromeVisibility() {
        clearAutoHideTimer();
        if (!canAutoHideChrome()) {
            revealChrome();
            return;
        }
        revealChrome();
        scheduleAutoHide();
    }

    function handleUserActivity() {
        if (!isDesktopViewportActive()) {
            clearAutoHideTimer();
            revealChrome();
            return;
        }
        revealChrome();
        scheduleAutoHide();
    }

    function syncAnimationPlaying(isPlaying) {
        animationPlaying = isPlaying === true;
        syncChromeVisibility();
    }

    function readInitialPlayState() {
        const button = documentRef.getElementById("animate");
        return ((button?.textContent || "").trim().toLowerCase() === "pause");
    }

    function bind() {
        if (bound) return;
        bound = true;

        documentRef.addEventListener("animation-play-state-updated", (event) => {
            const customEvent = /** @type {CustomEvent | null} */ (event);
            syncAnimationPlaying(customEvent?.detail?.isPlaying === true);
        });

        documentRef.addEventListener("mission-ui-config-updated", (event) => {
            const configEvent = /** @type {CustomEvent | null} */ (event);
            autoHideEnabled = configEvent?.detail?.ui?.desktopChromeAutoHideEnabled !== false;
            syncChromeVisibility();
        });

        documentRef.addEventListener("pointermove", () => {
            handleUserActivity();
        }, { passive: true, capture: true });

        documentRef.addEventListener("pointerdown", () => {
            requestAnimationFrameImpl(handleUserActivity);
        }, true);

        documentRef.addEventListener("wheel", () => {
            handleUserActivity();
        }, { passive: true, capture: true });

        documentRef.addEventListener("focusin", () => {
            handleUserActivity();
        }, true);

        documentRef.addEventListener("keydown", (event) => {
            if (isInteractiveInputTarget(event.target)) {
                handleUserActivity();
                return;
            }
            if (!meaningfulActivityKeys.has(event.key)) return;
            handleUserActivity();
        }, true);

        documentRef.addEventListener("visibilitychange", () => {
            syncChromeVisibility();
        });

        windowRef.addEventListener("resize", () => {
            syncChromeVisibility();
        }, { passive: true });

        syncAnimationPlaying(readInitialPlayState());
    }

    return {
        bind,
    };
}
