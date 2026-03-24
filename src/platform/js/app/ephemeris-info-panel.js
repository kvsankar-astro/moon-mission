const UI_FEATURE_FLAGS = {
    showMissionInfoPanel: true,
};

function createEphemerisInfoPanelActions(deps) {
    const {
        getGlobalConfig,
        getEphemerisSource,
        getEphemerisRecords,
        getEphemerisStatuses,
        getBodyEphemerisSources,
        resolveBodySource,
    } = deps;

    function isMissionInfoPanelEnabled() {
        const override = window?.CY3_UI_FLAGS?.showMissionInfoPanel;
        if (typeof override === "boolean") {
            return override;
        }
        return UI_FEATURE_FLAGS.showMissionInfoPanel;
    }

    function bindInfoPanelControls() {
        const wrapper = document.getElementById("info-panel-wrapper");
        const enabled = isMissionInfoPanelEnabled();
        if (wrapper) {
            wrapper.style.display = enabled ? "" : "none";
        }
        if (!enabled) return;

        const toggle = document.getElementById("info-panel-toggle");
        const panel = document.getElementById("info-panel");
        const close = document.getElementById("info-panel-close");
        if (!toggle || !panel || !close) return;

        const show = () => {
            panel.classList.remove("info-panel--hidden");
            toggle.classList.add("hidden");
        };
        const hide = () => {
            panel.classList.add("info-panel--hidden");
            toggle.classList.remove("hidden");
        };

        toggle.addEventListener("click", show);
        close.addEventListener("click", hide);
    }

    function updateEphemerisPanel() {
        const panel = document.getElementById("info-panel-body");
        if (!panel) return;

        const globalConfig = getGlobalConfig();
        if (!globalConfig) {
            panel.innerHTML = "Mission configuration has not loaded yet.";
            return;
        }

        const ephemerisSource = getEphemerisSource();
        const ephemerisRecords = getEphemerisRecords();
        const ephemerisStatuses = getEphemerisStatuses();
        const bodyEphemerisSources = getBodyEphemerisSources();
        const missionName = globalConfig?.mission_name || "Mission";
        const sc = globalConfig?.spacecraft_mnemonic || "SC";
        const epSrc = ephemerisSource.toUpperCase();
        const phases = globalConfig?.phases || [];

        const statusBadge = (cfg, source) => {
            const s = ephemerisStatuses[cfg]?.[source]?.status || "pending";
            const msg = ephemerisStatuses[cfg]?.[source]?.message || "";
            const cls =
                s === "ok"
                    ? "info-panel__status--ok"
                    : s === "error"
                      ? "info-panel__status--err"
                      : s === "loading"
                        ? "info-panel__status--warn"
                        : "info-panel__status--pending";
            return `<span class="info-panel__status ${cls}">${s.toUpperCase()}</span>${msg ? ` <span>${msg}</span>` : ""}`;
        };

        const bodySourceRows = ["SC", "MOON", "EARTH", "SUN"]
            .map((bodyId) => {
                const source = resolveBodySource({
                    bodyId,
                    bodySources: bodyEphemerisSources,
                    defaultSpacecraftSource: ephemerisSource,
                });
                return `<div class="info-panel__kv"><span>${bodyId}</span><span>${source.toUpperCase()}</span></div>`;
            })
            .join("");

        const phaseRows = phases
            .map((cfg) => {
                const phaseConfig = globalConfig?.[cfg] || {};
                const phaseStatus = ephemerisStatuses[cfg] || {};
                const phaseRecords = ephemerisRecords[cfg] || {};
                const phaseSources = Array.from(
                    new Set(["chebyshev", ...Object.keys(phaseStatus), ...Object.keys(phaseRecords)]),
                ).filter((source) => source === "chebyshev" || source === "npz");

                const sourceRows = phaseSources
                    .map((source) => {
                        const record = ephemerisRecords[cfg]?.[source];
                        const file = record?.url ? record.url.split("/").pop() : "—";
                        return `
                        <div class="info-panel__subrow">
                            <div class="info-panel__kv">
                                <span>${source.toUpperCase()}</span>
                                <span>${file}</span>
                            </div>
                            <div>${statusBadge(cfg, source)}</div>
                        </div>
                    `;
                    })
                    .join("");

                const timeWindow =
                    [phaseConfig.start_year, phaseConfig.start_month, phaseConfig.start_day].every(Boolean)
                        ? `${phaseConfig.start_year}-${phaseConfig.start_month}-${phaseConfig.start_day} ${phaseConfig.start_hour || "00"}:${phaseConfig.start_minute || "00"} -> ${phaseConfig.stop_year || "—"}-${phaseConfig.stop_month || "—"}-${phaseConfig.stop_day || "—"} ${phaseConfig.stop_hour || "00"}:${phaseConfig.stop_minute || "00"}`
                        : "—";

                return `
                <section class="info-panel__section">
                    <div class="info-panel__section-title">${cfg.toUpperCase()}</div>
                    <div class="info-panel__kv"><span>Center</span><span>${phaseConfig.center || "—"}</span></div>
                    <div class="info-panel__kv"><span>Planets</span><span>${(phaseConfig.planets || []).join(", ") || "—"}</span></div>
                    <div class="info-panel__kv"><span>Orbit File</span><span>${phaseConfig.orbits_file || "—"}</span></div>
                    <div class="info-panel__kv"><span>Step</span><span>${phaseConfig.step_size_in_seconds || "—"} s</span></div>
                    <div class="info-panel__kv"><span>Window</span><span>${timeWindow}</span></div>
                    <div class="info-panel__subsection-title">Ephemeris Files</div>
                    ${sourceRows}
                </section>`;
            })
            .join("");

        panel.innerHTML = `
        <section class="info-panel__section">
            <div class="info-panel__section-title">Mission</div>
            <div class="info-panel__kv"><span>Name</span><span>${missionName}</span></div>
            <div class="info-panel__kv"><span>Short Name</span><span>${globalConfig?.mission_name_short || "—"}</span></div>
            <div class="info-panel__kv"><span>Spacecraft</span><span>${sc}</span></div>
            <div class="info-panel__kv"><span>Default Source</span><span>${epSrc}</span></div>
            <div class="info-panel__kv"><span>Phases</span><span>${phases.join(", ") || "—"}</span></div>
            <div class="info-panel__kv"><span>Landing</span><span>${globalConfig?.landing?.enabled ? "Enabled" : "Disabled"}</span></div>
            <div class="info-panel__kv"><span>Events</span><span>${Object.keys(globalConfig?.events || {}).length}</span></div>
            <div class="info-panel__kv"><span>Landing Sites</span><span>${(globalConfig?.landingSites || []).length}</span></div>
        </section>
        <section class="info-panel__section">
            <div class="info-panel__section-title">Body Sources</div>
            ${bodySourceRows}
        </section>
        ${phaseRows || '<section class="info-panel__section">No ephemeris requests yet.</section>'}
    `;
    }

    return {
        isMissionInfoPanelEnabled,
        bindInfoPanelControls,
        updateEphemerisPanel,
    };
}

export { createEphemerisInfoPanelActions };
