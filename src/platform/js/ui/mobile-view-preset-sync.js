import {
    resolveMobileViewPresetState,
    shouldEnforceMobileViewPreset,
} from "../core/domain/mobile-view-preset-state.js";

function createMobileViewPresetSync(deps) {
    const {
        mobileViewButtons = [],
        mobileViewPresetById,
        desktopPosition,
        desktopLook,
        getActivePresetId,
        setActivePresetId,
        getEnforceInProgress = () => false,
        setEnforceInProgress = () => {},
        isMobileViewport = () => false,
        getActiveTab = () => "",
        createChangeEvent = () => new Event("change", { bubbles: true }),
        onAfterApply = () => {},
        onAfterEnforcedSync = () => {},
        onAfterButtonClick = () => {},
        onAfterDesktopChange = () => {},
    } = deps;

    const buttons = Array.from(mobileViewButtons);

    function readButtonPresetIds() {
        return buttons
            .map((button) => button.dataset.mobileViewPreset || "")
            .filter(Boolean);
    }

    function renderButtonState(viewPresetState) {
        buttons.forEach((button) => {
            const presetId = button.dataset.mobileViewPreset || "";
            const isActive = presetId !== "" && presetId === viewPresetState.selectedPresetId;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", isActive ? "true" : "false");
        });
    }

    function applyPreset(presetId) {
        if (!desktopPosition || !desktopLook) return;
        const preset = mobileViewPresetById.get(presetId);
        if (!preset) return;

        setActivePresetId(presetId);
        desktopPosition.value = preset.positionMode;
        desktopLook.value = preset.lookMode;
        desktopPosition.dispatchEvent(createChangeEvent());
        onAfterApply();
    }

    function syncState() {
        if (!desktopPosition || !desktopLook || !buttons.length) return;

        const positionMode = (desktopPosition.value || "").trim();
        const lookMode = (desktopLook.value || "").trim();
        const viewPresetState = resolveMobileViewPresetState({
            buttonPresetIds: readButtonPresetIds(),
            presetById: mobileViewPresetById,
            activePresetId: getActivePresetId(),
            positionMode,
            lookMode,
        });
        if (!viewPresetState.selectedPresetId) return;

        setActivePresetId(viewPresetState.selectedPresetId);
        renderButtonState(viewPresetState);

        if (!shouldEnforceMobileViewPreset({
            selectedPreset: viewPresetState.selectedPreset,
            enforceInProgress: getEnforceInProgress(),
            isMobileViewport: isMobileViewport(),
            activeTab: getActiveTab(),
            positionMode,
            lookMode,
        })) {
            return;
        }

        setEnforceInProgress(true);
        try {
            applyPreset(viewPresetState.selectedPresetId);
        } finally {
            setEnforceInProgress(false);
        }
        onAfterEnforcedSync();
    }

    function bind() {
        buttons.forEach((button) => {
            button.addEventListener("click", function () {
                const presetId = button.dataset.mobileViewPreset || "";
                applyPreset(presetId);
                syncState();
                onAfterButtonClick();
            });
        });

        if (desktopPosition) {
            desktopPosition.addEventListener("change", () => {
                syncState();
                onAfterDesktopChange();
            });
        }
        if (desktopLook) {
            desktopLook.addEventListener("change", () => {
                syncState();
                onAfterDesktopChange();
            });
        }
    }

    return {
        applyPreset,
        bind,
        syncState,
    };
}

export { createMobileViewPresetSync };
