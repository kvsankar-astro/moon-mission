import { resolveMobileComposeLockState } from "../core/domain/mobile-compose-lock-state.js";

function createMobileComposeLockSync(deps) {
    const {
        mobileComposeLockButtons = [],
        mobileComposePresetById,
        desktopPosition,
        desktopLook,
        resolveActiveScene,
        getActivePresetId,
        setActivePresetId,
        createChangeEvent = () => new Event("change", { bubbles: true }),
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
        if (!desktopPosition || !desktopLook || !buttons.length) return;
        const composeLockState = resolveMobileComposeLockState({
            buttonPresetIds: readButtonPresetIds(),
            presetById: mobileComposePresetById,
            activePresetId: getActivePresetId(),
            positionMode: (desktopPosition.value || "").trim(),
            lookMode: (desktopLook.value || "").trim(),
        });
        setActivePresetId(composeLockState.selectedPresetId);
        renderButtonState(composeLockState);
    }

    function applyPreset(presetId) {
        if (!desktopPosition || !desktopLook) return;
        const preset = mobileComposePresetById.get(presetId);
        if (!preset) return;
        const scene = resolveActiveScene();
        scene?.cameraController?.mountOffset?.set?.(0, 0, 0);
        setActivePresetId(presetId);
        desktopPosition.value = preset.positionMode;
        desktopLook.value = preset.lookMode;
        desktopPosition.dispatchEvent(createChangeEvent());
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
    }

    return {
        applyPreset,
        bind,
        syncState,
    };
}

export { createMobileComposeLockSync };
