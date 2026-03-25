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
        const origins = (globalConfig?.origins || []).filter(
            (originKey) => originKey !== "landing",
        );
        const landingOriginKeys = (() => {
            const explicit = globalConfig?.landing?.origin_sources || globalConfig?.landing?.originSources;
            const candidates = Array.isArray(explicit)
                ? explicit
                : origins;
            return candidates.filter(
                (originKey) =>
                    typeof originKey === "string" &&
                    originKey.length > 0 &&
                    originKey !== "landing",
            );
        })();

        const statusBadge = (cfg, source, fallbackStatus = "pending") => {
            const s = ephemerisStatuses[cfg]?.[source]?.status || fallbackStatus;
            const cls =
                s === "ok"
                    ? "info-panel__status--ok"
                    : s === "error"
                      ? "info-panel__status--err"
                      : s === "loading"
                        ? "info-panel__status--warn"
                        : "info-panel__status--pending";
            return `<span class="info-panel__status ${cls}">${s.toUpperCase()}</span>`;
        };

        const sourceLabel = (source) => {
            const labels = {
                chebyshev: "CHEBYSHEV",
                npz: "NPZ",
                "landing-chebyshev": "CHEBYSHEV",
                "landing-npz": "NPZ",
            };
            return labels[source] || source.replace(/-/g, " ").toUpperCase();
        };

        const sourceOrder = ["chebyshev", "npz", "landing-chebyshev", "landing-npz"];
        const sourceScopeLabel = (source) =>
            source.startsWith("landing-") ? "LANDING SLICE" : "ORBIT";

        const bodySourceRows = ["SC", "MOON", "EARTH", "SUN"]
            .map((bodyId) => {
                const source = resolveBodySource({
                    bodyId,
                    bodySources: bodyEphemerisSources,
                    defaultSpacecraftSource: ephemerisSource,
                });
                return `
                    <tr>
                        <td>${bodyId}</td>
                        <td>${source.toUpperCase()}</td>
                    </tr>
                `;
            })
            .join("");

        const originRows = origins
            .map((originKey) => {
                const originConfig = globalConfig?.[originKey] || {};
                const timeWindow =
                    [originConfig.start_year, originConfig.start_month, originConfig.start_day].every(Boolean)
                        ? `${originConfig.start_year}-${originConfig.start_month}-${originConfig.start_day} ${originConfig.start_hour || "00"}:${originConfig.start_minute || "00"} -> ${originConfig.stop_year || "—"}-${originConfig.stop_month || "—"}-${originConfig.stop_day || "—"} ${originConfig.stop_hour || "00"}:${originConfig.stop_minute || "00"}`
                        : "—";

                return `
                <tr>
                    <td>${originKey.toUpperCase()}</td>
                    <td>${originConfig.center || "—"}</td>
                    <td>${(originConfig.planets || []).join(", ") || "—"}</td>
                    <td>${originConfig.orbits_file || "—"}</td>
                    <td>${originConfig.step_size_in_seconds || "—"}</td>
                    <td>${timeWindow}</td>
                </tr>`;
            })
            .join("");

        const landingConfig = globalConfig?.landing || {};
        const landingWindow =
            [landingConfig.start_year, landingConfig.start_month, landingConfig.start_day].every(Boolean)
                ? `${landingConfig.start_year}-${landingConfig.start_month}-${landingConfig.start_day} ${landingConfig.start_hour || "00"}:${landingConfig.start_minute || "00"} -> ${landingConfig.stop_year || "—"}-${landingConfig.stop_month || "—"}-${landingConfig.stop_day || "—"} ${landingConfig.stop_hour || "00"}:${landingConfig.stop_minute || "00"}`
                : "—";

        function getExpectedOrbitSources(originKey) {
            const originConfig = globalConfig?.[originKey] || {};
            const requiredBodies = [...(originConfig?.planets || []), "SUN"];
            const expected = new Set();
            for (const bodyId of requiredBodies) {
                const source = resolveBodySource({
                    bodyId,
                    bodySources: bodyEphemerisSources,
                    defaultSpacecraftSource: ephemerisSource,
                });
                if (source === "npz" || source === "chebyshev") {
                    expected.add(source);
                }
            }
            return expected;
        }

        const ephemerisRows = origins
            .map((originKey) => {
                const originStatus = ephemerisStatuses[originKey] || {};
                const originRecords = ephemerisRecords[originKey] || {};
                const expectedOrbitSources = getExpectedOrbitSources(originKey);
                const expectedLandingSources =
                    globalConfig?.landing?.enabled && landingOriginKeys.includes(originKey)
                        ? new Set(["landing-chebyshev", "landing-npz"])
                        : new Set();

                const sourceKeys = Array.from(
                    new Set([
                        ...expectedOrbitSources,
                        ...expectedLandingSources,
                        ...Object.keys(originStatus),
                        ...Object.keys(originRecords),
                    ]),
                ).sort((left, right) => {
                    const leftIndex = sourceOrder.indexOf(left);
                    const rightIndex = sourceOrder.indexOf(right);
                    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
                    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
                    if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
                    return left.localeCompare(right);
                });

                if (sourceKeys.length === 0) {
                    return `
                        <tr>
                            <td>${originKey.toUpperCase()}</td>
                            <td>—</td>
                            <td>—</td>
                            <td>—</td>
                            <td><span class="info-panel__status info-panel__status--pending">N/A</span></td>
                            <td>No ephemeris requests yet.</td>
                        </tr>
                    `;
                }

                return sourceKeys
                    .map((source) => {
                        const record = originRecords?.[source];
                        const hasStatus = !!originStatus?.[source];
                        const hasRecord = !!record;
                        const message = originStatus?.[source]?.message || (hasRecord ? "—" : "Not requested yet.");
                        const file = record?.url ? record.url.split("/").pop() : "—";
                        return `
                            <tr>
                                <td>${originKey.toUpperCase()}</td>
                                <td>${sourceScopeLabel(source)}</td>
                                <td>${sourceLabel(source)}</td>
                                <td>${file}</td>
                                <td>${statusBadge(originKey, source, hasStatus ? "pending" : "n/a")}</td>
                                <td>${message}</td>
                            </tr>
                        `;
                    })
                    .join("");
            })
            .join("");

        panel.innerHTML = `
        <section class="info-panel__section">
            <div class="info-panel__section-title">Mission Summary</div>
            <div class="info-panel__table-wrap">
                <table class="info-panel__table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Short</th>
                            <th>Spacecraft</th>
                            <th>Default Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${missionName}</td>
                            <td>${globalConfig?.mission_name_short || "—"}</td>
                            <td>${sc}</td>
                            <td>${epSrc}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="info-panel__table-wrap">
                <table class="info-panel__table">
                    <thead>
                        <tr>
                            <th>Origins</th>
                            <th>Landing Slice</th>
                            <th>Events</th>
                            <th>Landing Sites</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${origins.join(", ") || "—"}</td>
                            <td>${globalConfig?.landing?.enabled ? "Enabled" : "Disabled"}</td>
                            <td>${Object.keys(globalConfig?.events || {}).length}</td>
                            <td>${(globalConfig?.landingSites || []).length}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
        <section class="info-panel__section">
            <div class="info-panel__section-title">Body Sources</div>
            <div class="info-panel__table-wrap">
                <table class="info-panel__table">
                    <thead>
                        <tr>
                            <th>Body</th>
                            <th>Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bodySourceRows}
                    </tbody>
                </table>
            </div>
        </section>
        <section class="info-panel__section">
            <div class="info-panel__section-title">Origin Config</div>
            <div class="info-panel__table-wrap">
                <table class="info-panel__table">
                    <thead>
                        <tr>
                            <th>Origin</th>
                            <th>Center</th>
                            <th>Planets</th>
                            <th>Orbit File</th>
                            <th>Step (s)</th>
                            <th>Window</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${originRows || `<tr><td colspan="6">No origins configured.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </section>
        <section class="info-panel__section">
            <div class="info-panel__section-title">Landing Slice Config</div>
            <div class="info-panel__table-wrap">
                <table class="info-panel__table">
                    <thead>
                        <tr>
                            <th>Enabled</th>
                            <th>Center</th>
                            <th>Planets</th>
                            <th>Orbit File</th>
                            <th>Step (s)</th>
                            <th>Window</th>
                            <th>Data Origins</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${landingConfig.enabled ? "Yes" : "No"}</td>
                            <td>${landingConfig.center || "—"}</td>
                            <td>${(landingConfig.planets || []).join(", ") || "—"}</td>
                            <td>${landingConfig.orbits_file || "—"}</td>
                            <td>${landingConfig.step_size_in_seconds || "—"}</td>
                            <td>${landingWindow}</td>
                            <td>${landingOriginKeys.join(", ") || "—"}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
        <section class="info-panel__section">
            <div class="info-panel__section-title">Ephemeris Files by Origin</div>
            <div class="info-panel__table-wrap">
                <table class="info-panel__table">
                    <thead>
                        <tr>
                            <th>Origin</th>
                            <th>Scope</th>
                            <th>Source</th>
                            <th>File</th>
                            <th>Status</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ephemerisRows || `<tr><td colspan="6">No ephemeris records available.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </section>
    `;
    }

    return {
        isMissionInfoPanelEnabled,
        bindInfoPanelControls,
        updateEphemerisPanel,
    };
}

export { createEphemerisInfoPanelActions };
