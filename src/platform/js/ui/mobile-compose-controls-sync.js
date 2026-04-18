import {
    buildMobileComposeEarthshineState,
    buildMobileComposeRollState,
    normalizeMobileComposeRollRad,
} from "../core/domain/mobile-compose-controls-state.js";
import { LIGHT_SETTINGS as LT } from "../core/constants.js";

const DEFAULT_EARTHSHINE_STORAGE_KEY = "moon-mission:mobile-earthshine-gain:v1";
const DEFAULT_EARTHSHINE_MIN = 0;
const DEFAULT_EARTHSHINE_MAX = 2.4;

function createMobileComposeControlsSync(deps) {
    const {
        mobileComposeEarthshineSlider,
        mobileComposeEarthshineValue,
        mobileComposeRollSlider,
        mobileComposeRollValue,
        mobileComposeFovAuto,
        desktopPosition,
        desktopLook,
        mobileComposePresetById,
        mobileComposeLockSync,
        mobileComposeTimelineSync,
        resolveActiveScene,
        resolveActiveCraft,
        resolveSceneObject,
        getActiveTab,
        isMobileViewport,
        getComposeFeatureEnabled,
        getActivePresetId,
        onComposeFovAutoToggle = () => {},
        createChangeEvent = () => new Event("change", { bubbles: true }),
        storage = globalThis?.localStorage,
        lightSettings = LT,
        earthshineStorageKey = DEFAULT_EARTHSHINE_STORAGE_KEY,
        earthshineGainMin = DEFAULT_EARTHSHINE_MIN,
        earthshineGainMax = DEFAULT_EARTHSHINE_MAX,
        initialRollRad = (250 * Math.PI) / 180,
    } = deps;

    const earthshineBaseIntensity = Number.isFinite(lightSettings?.EARTHSHINE_INTENSITY)
        ? lightSettings.EARTHSHINE_INTENSITY
        : 1;
    const earthshineBaseMin = Number.isFinite(lightSettings?.EARTHSHINE_MIN_INTENSITY)
        ? lightSettings.EARTHSHINE_MIN_INTENSITY
        : 0;
    const earthshineBaseMax = Number.isFinite(lightSettings?.EARTHSHINE_MAX_INTENSITY)
        ? lightSettings.EARTHSHINE_MAX_INTENSITY
        : 1;

    let earthshineGain = 1;
    let hiddenCraftState = null;
    let composeRollRad = initialRollRad;
    let freeStartupAligned = false;

    function shouldUseEarthrisePresentation() {
        return !!getComposeFeatureEnabled?.() &&
            !!isMobileViewport?.() &&
            getActiveTab?.() === "compose";
    }

    function renderEarthshineState() {
        const earthshineState = buildMobileComposeEarthshineState({
            value: earthshineGain,
            min: earthshineGainMin,
            max: earthshineGainMax,
        });
        earthshineGain = earthshineState.gain;
        if (mobileComposeEarthshineSlider) {
            mobileComposeEarthshineSlider.value = earthshineState.sliderValue;
        }
        if (mobileComposeEarthshineValue) {
            mobileComposeEarthshineValue.value = earthshineState.text;
            mobileComposeEarthshineValue.textContent = earthshineState.text;
        }
    }

    function applyEarthshineGain(value, { persist = true } = {}) {
        const earthshineState = buildMobileComposeEarthshineState({
            value,
            min: earthshineGainMin,
            max: earthshineGainMax,
        });
        earthshineGain = earthshineState.gain;
        if (lightSettings) {
            lightSettings.EARTHSHINE_INTENSITY = earthshineBaseIntensity * earthshineGain;
            lightSettings.EARTHSHINE_MIN_INTENSITY = earthshineBaseMin * earthshineGain;
            lightSettings.EARTHSHINE_MAX_INTENSITY = earthshineBaseMax * earthshineGain;
        }
        renderEarthshineState();
        if (persist) {
            try {
                storage?.setItem?.(earthshineStorageKey, String(earthshineGain));
            } catch {
                // Ignore localStorage write failures.
            }
        }
    }

    function syncRollUi() {
        const rollState = buildMobileComposeRollState({ rollRad: composeRollRad });
        composeRollRad = rollState.rollRad;
        if (mobileComposeRollSlider) {
            mobileComposeRollSlider.value = String(rollState.degrees);
        }
        if (mobileComposeRollValue) {
            mobileComposeRollValue.value = rollState.label;
            mobileComposeRollValue.textContent = rollState.label;
        }
    }

    function resolveComposeLookTarget(scene, controller) {
        const camera = scene?.camera;
        if (!camera?.position?.clone) return null;
        const lookMode = (controller?.lookMode || desktopLook?.value || "manual").trim();
        if (lookMode === "earth" || lookMode === "moon" || lookMode === "spacecraft") {
            const targetObject = resolveSceneObject?.(scene, lookMode);
            if (targetObject?.getWorldPosition) {
                const target = camera.position.clone();
                targetObject.getWorldPosition(target);
                return target;
            }
        }
        if (controller?.controls?.target?.clone) {
            return controller.controls.target.clone();
        }
        if (camera.getWorldDirection) {
            const target = camera.position.clone();
            const viewDir = camera.position.clone();
            camera.getWorldDirection(viewDir);
            return target.add(viewDir);
        }
        return null;
    }

    function applyComposeRoll() {
        if (!shouldUseEarthrisePresentation()) return;
        const scene = resolveActiveScene?.();
        const controller = scene?.cameraController;
        controller?.setMountedManualRollRad?.(composeRollRad);
        const camera = scene?.camera;
        if (!camera?.position?.clone) return;

        const lookTarget = resolveComposeLookTarget(scene, controller);
        if (!lookTarget?.clone) return;

        const viewDir = lookTarget.clone().sub(camera.position);
        if (viewDir.lengthSq?.() <= 1e-12) return;
        viewDir.normalize();

        const baseUp = camera.position.clone().set(0, 0, 1);
        baseUp.sub(viewDir.clone().multiplyScalar(baseUp.dot(viewDir)));
        if (baseUp.lengthSq() <= 1e-10) {
            baseUp.set(0, 1, 0);
            baseUp.sub(viewDir.clone().multiplyScalar(baseUp.dot(viewDir)));
        }
        if (baseUp.lengthSq() <= 1e-10) {
            baseUp.set(1, 0, 0);
            baseUp.sub(viewDir.clone().multiplyScalar(baseUp.dot(viewDir)));
        }
        if (baseUp.lengthSq() <= 1e-10) return;

        const rolledUp = baseUp.normalize().applyAxisAngle(viewDir, composeRollRad).normalize();
        camera.up.copy(rolledUp);
        camera.lookAt(lookTarget);
        if (controller?.controls?.target?.copy) {
            controller.controls.target.copy(lookTarget);
        }
    }

    function restoreCraftVisibility() {
        if (!hiddenCraftState?.craft) return;
        try {
            hiddenCraftState.craft.visible = hiddenCraftState.wasVisible;
        } catch {
            // Ignore stale object graph state.
        }
        hiddenCraftState = null;
    }

    function hideCraft() {
        const scene = resolveActiveScene?.();
        const craft = resolveActiveCraft?.(scene);
        if (!craft) {
            restoreCraftVisibility();
            return;
        }
        const existingCraft = hiddenCraftState?.craft || null;
        if (existingCraft && existingCraft !== craft) {
            restoreCraftVisibility();
        }
        if (!hiddenCraftState || hiddenCraftState.craft !== craft) {
            hiddenCraftState = {
                craft,
                wasVisible: craft.visible !== false,
            };
        }
        craft.visible = false;
    }

    function enforceCameraAtCraftCenter() {
        if (!shouldUseEarthrisePresentation()) return;
        const scene = resolveActiveScene?.();
        const controller = scene?.cameraController;
        if (!controller?.mountOffset?.set) return;
        if (controller.positionMode !== "spacecraft") return;
        controller.mountOffset.set(0, 0, 0);
    }

    function alignFreeLookToEarth() {
        if (!shouldUseEarthrisePresentation()) return false;
        const scene = resolveActiveScene?.();
        const controller = scene?.cameraController;
        const camera = scene?.camera;
        const earthObject = resolveSceneObject?.(scene, "earth");
        if (!camera?.position?.clone || !camera.lookAt || !earthObject?.getWorldPosition) {
            return false;
        }
        const target = camera.position.clone();
        earthObject.getWorldPosition(target);
        const view = target.clone().sub(camera.position);
        if (view.lengthSq?.() <= 1e-12) {
            return false;
        }
        camera.lookAt(target);
        if (controller?.controls?.target?.copy) {
            controller.controls.target.copy(target);
        }
        if (!controller?._freeFlyActive) {
            controller?.controls?.update?.();
            controller?.controls?.dispatchEvent?.({ type: "change" });
        }
        return true;
    }

    function syncPresentation() {
        if (!shouldUseEarthrisePresentation()) {
            restoreCraftVisibility();
            return;
        }
        hideCraft();
        enforceCameraAtCraftCenter();
        applyComposeRoll();
        syncRollUi();
    }

    function syncControls() {
        if (shouldUseEarthrisePresentation() && desktopPosition && desktopLook) {
            const desiredPreset = mobileComposePresetById?.get(getActivePresetId?.()) ||
                mobileComposePresetById?.get("free");
            if (
                desiredPreset &&
                (desktopPosition.value !== desiredPreset.positionMode || desktopLook.value !== desiredPreset.lookMode)
            ) {
                desktopPosition.value = desiredPreset.positionMode;
                desktopLook.value = desiredPreset.lookMode;
                desktopPosition.dispatchEvent(createChangeEvent());
            }
        }
        mobileComposeLockSync?.syncState?.();
        if (
            shouldUseEarthrisePresentation() &&
            !freeStartupAligned &&
            getActivePresetId?.() === "free"
        ) {
            freeStartupAligned = alignFreeLookToEarth();
        }
        mobileComposeTimelineSync?.sync?.();
        renderEarthshineState();
        syncRollUi();
        syncPresentation();
    }

    function initialize() {
        let initialEarthshineGain = 1;
        try {
            const storedGain = Number(storage?.getItem?.(earthshineStorageKey));
            if (Number.isFinite(storedGain)) {
                initialEarthshineGain = storedGain;
            }
        } catch {
            initialEarthshineGain = 1;
        }
        applyEarthshineGain(initialEarthshineGain, { persist: false });
    }

    function bind() {
        if (mobileComposeFovAuto) {
            mobileComposeFovAuto.addEventListener("click", function () {
                onComposeFovAutoToggle();
            });
        }

        if (mobileComposeEarthshineSlider) {
            const onComposeEarthshineInput = () => {
                applyEarthshineGain(mobileComposeEarthshineSlider.value, { persist: true });
            };
            mobileComposeEarthshineSlider.addEventListener("input", onComposeEarthshineInput, { passive: true });
            mobileComposeEarthshineSlider.addEventListener("change", onComposeEarthshineInput);
        }

        if (mobileComposeRollSlider) {
            const onComposeRollInput = () => {
                const degrees = Number(mobileComposeRollSlider.value);
                if (!Number.isFinite(degrees)) return;
                composeRollRad = normalizeMobileComposeRollRad((degrees * Math.PI) / 180);
                syncRollUi();
                applyComposeRoll();
            };
            mobileComposeRollSlider.addEventListener("input", onComposeRollInput, { passive: true });
            mobileComposeRollSlider.addEventListener("change", onComposeRollInput);
        }
    }

    return {
        applyEarthshineGain,
        bind,
        initialize,
        syncControls,
        syncPresentation,
        syncRollUi,
    };
}

export { createMobileComposeControlsSync };
