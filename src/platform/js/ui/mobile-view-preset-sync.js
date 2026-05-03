import {
    resolveMobileViewPresetState,
    shouldEnforceMobileViewPreset,
} from "../core/domain/mobile-view-preset-state.js";

function createMobileViewPresetSync(deps) {
    const {
        documentRef = globalThis?.document,
        mobileViewButtons = [],
        mobileViewPresetById,
        readCameraPositionMode = () => "manual",
        readCameraLookMode = () => "manual",
        commitCameraPair = () => {},
        getActivePresetId,
        setActivePresetId,
        getEnforceInProgress = () => false,
        setEnforceInProgress = () => {},
        isMobileViewport = () => false,
        getActiveTab = () => "",
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
        const preset = mobileViewPresetById.get(presetId);
        if (!preset) return;

        setActivePresetId(presetId);
        commitCameraPair(preset.positionMode, preset.lookMode);
        onAfterApply();
    }

    function syncState() {
        if (!buttons.length) return;

        const positionMode = String(readCameraPositionMode() || "").trim();
        const lookMode = String(readCameraLookMode() || "").trim();
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

        documentRef?.addEventListener?.("camera-from-to-ui-updated", () => {
            syncState();
            onAfterDesktopChange();
        });
    }

    return {
        applyPreset,
        bind,
        syncState,
    };
}

export { createMobileViewPresetSync };
