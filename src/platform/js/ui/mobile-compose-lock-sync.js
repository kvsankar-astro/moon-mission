import { resolveMobileComposeLockState } from "../core/domain/mobile-compose-lock-state.js";

function createMobileComposeLockSync(deps) {
    const {
        documentRef = globalThis?.document,
        mobileComposeLockButtons = [],
        mobileComposePresetById,
        readCameraPositionMode = () => "manual",
        readCameraLookMode = () => "manual",
        commitCameraPair = () => {},
        resolveActiveScene,
        getActivePresetId,
        setActivePresetId,
        onAfterApply = () => {},
        onAfterButtonClick = () => {},
    } = deps;

    const buttons = Array.from(mobileComposeLockButtons);

    function readButtonPresetIds() {
        return buttons
            .map((button) => button.dataset.mobileComposeLock || "")
            .filter(Boolean);
    }

    function renderButtonState(composeLockState) {
        buttons.forEach((button) => {
            const presetId = button.dataset.mobileComposeLock || "";
            const isActive = presetId !== "" && presetId === composeLockState.selectedPresetId;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", isActive ? "true" : "false");
        });
    }

    function syncState() {
        if (!buttons.length) return;
        const composeLockState = resolveMobileComposeLockState({
            buttonPresetIds: readButtonPresetIds(),
            presetById: mobileComposePresetById,
            activePresetId: getActivePresetId(),
            positionMode: String(readCameraPositionMode() || "").trim(),
            lookMode: String(readCameraLookMode() || "").trim(),
        });
        setActivePresetId(composeLockState.selectedPresetId);
        renderButtonState(composeLockState);
    }

    function applyPreset(presetId) {
        const preset = mobileComposePresetById.get(presetId);
        if (!preset) return;
        const scene = resolveActiveScene();
        scene?.cameraController?.mountOffset?.set?.(0, 0, 0);
        setActivePresetId(presetId);
        commitCameraPair(preset.positionMode, preset.lookMode);
        syncState();
        onAfterApply();
    }

    function bind() {
        buttons.forEach((button) => {
            button.addEventListener("click", function () {
                const presetId = button.dataset.mobileComposeLock || "free";
                applyPreset(presetId);
                onAfterButtonClick();
            });
        });

        documentRef?.addEventListener?.("camera-from-to-ui-updated", syncState);
    }

    return {
        applyPreset,
        bind,
        syncState,
    };
}

export { createMobileComposeLockSync };
