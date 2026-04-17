import { buildPhaseIndicatorModel } from "../core/domain/phase-indicator-state.js";

function createScenePhaseUiActions(deps) {
    const {
        d3,
        setMobileText,
    } = deps;

    function updatePhaseIndicator(sceneState, globalConfig) {
        const phaseIndicatorModel = buildPhaseIndicatorModel({
            phase: sceneState?.phase,
            isLunarMission: !!(globalConfig && globalConfig.is_lunar),
        });

        for (const phaseEntry of phaseIndicatorModel.desktopPhases) {
            d3.select(`#${phaseEntry.id}`).html(
                phaseEntry.isActive
                    ? `<b><u>${phaseEntry.label}</u></b>`
                    : phaseEntry.label,
            );
        }
        setMobileText("mobile-mission-phase", phaseIndicatorModel.mobilePhaseText);
    }

    return {
        updatePhaseIndicator,
    };
}

export { createScenePhaseUiActions };
