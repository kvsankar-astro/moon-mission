const LUNAR_PHASE_DEFINITIONS = [
    {
        id: "phase-1",
        phase: "earth-bound",
        label: "Earth Bound Phase",
        mobileLabel: "Earth Bound",
    },
    {
        id: "phase-2",
        phase: "lunar-bound",
        label: "Lunar Bound Phase",
        mobileLabel: "Lunar Bound",
    },
    {
        id: "phase-3",
        phase: "lunar-orbit",
        label: "Lunar Orbit Phase",
        mobileLabel: "Lunar Orbit",
    },
];

function normalizePhase(phase) {
    return typeof phase === "string" ? phase.trim().toLowerCase() : "";
}

function buildPhaseIndicatorModel({
    phase,
    isLunarMission,
}) {
    const normalizedPhase = normalizePhase(phase);
    const matchedPhase = LUNAR_PHASE_DEFINITIONS.find(
        (phaseDefinition) => phaseDefinition.phase === normalizedPhase,
    ) || null;

    return {
        desktopPhases: isLunarMission
            ? LUNAR_PHASE_DEFINITIONS.map((phaseDefinition) => ({
                id: phaseDefinition.id,
                label: phaseDefinition.label,
                isActive: phaseDefinition.phase === normalizedPhase,
            }))
            : [],
        mobilePhaseText: matchedPhase?.mobileLabel || "--",
    };
}

export { buildPhaseIndicatorModel };
