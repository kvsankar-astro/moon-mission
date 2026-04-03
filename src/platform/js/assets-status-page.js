(function() {
    var DATA_URL = "assets/assets-status.json";
    var collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

    var state = {
        missions: [],
        sharedAssets: { groups: [] },
        totals: {},
        sources: {},
        search: "",
        sortKey: "totalChebyshevBytes",
        sortType: "number",
        sortDir: "desc",
        availability: "",
    };

    var refs = {
        summary: document.getElementById("assets-summary"),
        tableBody: document.getElementById("assets-table-body"),
        sharedRoot: document.getElementById("assets-shared-root"),
        search: document.getElementById("assets-search"),
        availability: document.getElementById("assets-availability"),
        dataRepoLink: document.getElementById("assets-data-repo-link"),
        sortButtons: Array.prototype.slice.call(document.querySelectorAll(".assets-table-sort")),
    };

    function escapeHtml(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatBytes(bytes) {
        var value = Number(bytes || 0);
        if (!Number.isFinite(value) || value <= 0) return "0 B";
        var units = ["B", "KB", "MB", "GB", "TB"];
        var idx = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
        var scaled = value / Math.pow(1024, idx);
        var precision = scaled >= 100 || idx === 0 ? 0 : (scaled >= 10 ? 1 : 2);
        return scaled.toFixed(precision) + " " + units[idx];
    }

    function formatDays(days) {
        var value = Number(days);
        if (!Number.isFinite(value) || value < 0) return "N/A";
        return value.toFixed(2);
    }

    function formatBytesPerDay(bytesPerDay) {
        var value = Number(bytesPerDay);
        if (!Number.isFinite(value) || value <= 0) return "N/A";
        return formatBytes(value) + "/day";
    }

    function badgeHtml(hasDataDir) {
        if (hasDataDir) {
            return '<span class="assets-badge assets-badge--ok">Present</span>';
        }
        return '<span class="assets-badge">Missing</span>';
    }

    function originCellHtml(origin) {
        if (!origin || !origin.fileCount) {
            return '<div class="assets-origin-total">0 files | 0 B</div><div class="assets-mission-meta">No Chebyshev assets found.</div>';
        }

        var filesHtml = origin.files.map(function(file) {
            return (
                '<div class="assets-file-row">' +
                    '<span class="assets-file-name">' + escapeHtml(file.name) + '</span>' +
                    '<span class="assets-mission-meta">' + escapeHtml(formatBytes(file.sizeBytes)) + '</span>' +
                    '<a class="assets-link" href="' + escapeHtml(file.urls.blob) + '" target="_blank" rel="noreferrer">blob</a>' +
                    '<a class="assets-link" href="' + escapeHtml(file.urls.raw) + '" target="_blank" rel="noreferrer">raw</a>' +
                "</div>"
            );
        }).join("");

        return (
            '<div class="assets-origin-total">' + escapeHtml(origin.fileCount + " files | " + formatBytes(origin.totalBytes)) + "</div>" +
            '<div class="assets-file-links">' + filesHtml + "</div>"
        );
    }

    function missionMatches(mission) {
        if (state.availability === "with" && !mission.hasDataDir) return false;
        if (state.availability === "without" && mission.hasDataDir) return false;
        if (!state.search) return true;
        var text = [
            mission.missionName,
            mission.missionFolder,
        ].join(" ").toLowerCase();
        return text.indexOf(state.search) !== -1;
    }

    function missionSortValue(mission, key) {
        if (key === "missionName") return String(mission.missionName || "");
        if (key === "missionFolder") return String(mission.missionFolder || "");
        if (key === "geoBytes") return Number(mission && mission.origins && mission.origins.geo && mission.origins.geo.totalBytes || 0);
        if (key === "moonBytes") return Number(mission && mission.origins && mission.origins.moon && mission.origins.moon.totalBytes || 0);
        if (key === "relativeBytes") return Number(mission && mission.origins && mission.origins.relative && mission.origins.relative.totalBytes || 0);
        if (key === "totalChebyshevBytes") return Number(mission && mission.totals && mission.totals.chebyshevBytes || 0);
        if (key === "hasDataDir") return mission && mission.hasDataDir ? 1 : 0;
        if (key === "durationDays") return Number(mission && mission.dataSpan && mission.dataSpan.durationDays || 0);
        if (key === "bytesPerDay") return Number(mission && mission.totals && mission.totals.chebyshevBytesPerDay || 0);
        return String(mission.missionName || "");
    }

    function sortedMissions(missions) {
        var copy = missions.slice();
        copy.sort(function(a, b) {
            var av = missionSortValue(a, state.sortKey);
            var bv = missionSortValue(b, state.sortKey);
            var comparison = 0;
            if (state.sortType === "number" || state.sortType === "boolean") {
                comparison = Number(av) - Number(bv);
            } else {
                comparison = collator.compare(String(av), String(bv));
            }
            if (comparison === 0) {
                comparison = collator.compare(a.missionName, b.missionName);
            }
            return state.sortDir === "asc" ? comparison : -comparison;
        });
        return copy;
    }

    function updateSortIndicators() {
        refs.sortButtons.forEach(function(button) {
            var isActive = button.getAttribute("data-sort-key") === state.sortKey;
            button.classList.toggle("is-active", isActive);
            var indicator = button.querySelector(".assets-table-sort__indicator");
            if (!indicator) return;
            if (!isActive) {
                indicator.textContent = "";
                return;
            }
            indicator.textContent = state.sortDir === "asc" ? "▲" : "▼";
        });
    }

    function renderSummary(filteredMissions) {
        var totalChebBytes = filteredMissions.reduce(function(sum, mission) {
            return sum + Number(mission && mission.totals && mission.totals.chebyshevBytes || 0);
        }, 0);
        var totalChebFiles = filteredMissions.reduce(function(sum, mission) {
            return sum + Number(mission && mission.totals && mission.totals.chebyshevFiles || 0);
        }, 0);
        var withData = filteredMissions.filter(function(m) { return !!m.hasDataDir; }).length;
        var missingData = filteredMissions.length - withData;

        refs.summary.innerHTML = [
            { label: "Visible Missions", value: filteredMissions.length },
            { label: "Compressed Chebyshev Files", value: totalChebFiles },
            { label: "Compressed Chebyshev Size", value: formatBytes(totalChebBytes) },
            { label: "With Data Folder", value: withData },
            { label: "Missing Data Folder", value: missingData },
            { label: "Shared Assets Size", value: formatBytes(state.sharedAssets.totalBytes || 0) }
        ].map(function(item) {
            return (
                '<div class="assets-kpi">' +
                    '<p class="assets-kpi__label">' + escapeHtml(item.label) + "</p>" +
                    '<p class="assets-kpi__value">' + escapeHtml(item.value) + "</p>" +
                "</div>"
            );
        }).join("");
    }

    function renderMissions() {
        var filtered = sortedMissions(state.missions.filter(missionMatches));
        updateSortIndicators();
        renderSummary(filtered);

        if (!filtered.length) {
            refs.tableBody.innerHTML = '<tr><td colspan="8" class="assets-empty">No missions matched the current filters.</td></tr>';
            return;
        }

        refs.tableBody.innerHTML = filtered.map(function(mission) {
            var geo = mission.origins && mission.origins.geo;
            var moon = mission.origins && mission.origins.moon;
            var relative = mission.origins && mission.origins.relative;
            var totalText = formatBytes(mission.totals.chebyshevBytes) + " | " + mission.totals.chebyshevFiles + " files";
            var durationText = formatDays(mission && mission.dataSpan && mission.dataSpan.durationDays);
            var perDayText = formatBytesPerDay(mission && mission.totals && mission.totals.chebyshevBytesPerDay);

            return (
                "<tr>" +
                    "<td>" +
                        '<div class="assets-mission-name">' + escapeHtml(mission.missionName) + "</div>" +
                        '<div class="assets-mission-meta">' + escapeHtml(mission.missionFolder) + "</div>" +
                    "</td>" +
                    "<td>" + originCellHtml(geo) + "</td>" +
                    "<td>" + originCellHtml(moon) + "</td>" +
                    "<td>" + originCellHtml(relative) + "</td>" +
                    "<td>" + escapeHtml(totalText) + "</td>" +
                    "<td>" + badgeHtml(mission.hasDataDir) + "</td>" +
                    "<td>" + escapeHtml(durationText) + "</td>" +
                    "<td>" + escapeHtml(perDayText) + "</td>" +
                "</tr>"
            );
        }).join("");
    }

    function renderSharedAssets() {
        var groups = state.sharedAssets && Array.isArray(state.sharedAssets.groups)
            ? state.sharedAssets.groups
            : [];
        if (!groups.length) {
            refs.sharedRoot.innerHTML = '<div class="assets-empty">No shared-asset groups found.</div>';
            return;
        }

        refs.sharedRoot.innerHTML = groups.map(function(group) {
            var filesHtml = group.files.length
                ? '<div class="assets-file-links">' + group.files.map(function(file) {
                    return (
                        '<div class="assets-file-row">' +
                            '<span class="assets-file-name">' + escapeHtml(file.path) + '</span>' +
                            '<span class="assets-mission-meta">' + escapeHtml(formatBytes(file.sizeBytes)) + '</span>' +
                            '<a class="assets-link" href="' + escapeHtml(file.urls.blob) + '" target="_blank" rel="noreferrer">blob</a>' +
                            '<a class="assets-link" href="' + escapeHtml(file.urls.raw) + '" target="_blank" rel="noreferrer">raw</a>' +
                        "</div>"
                    );
                }).join("") + "</div>"
                : '<div class="assets-mission-meta">No files in this group.</div>';

            return (
                '<div class="assets-shared-group">' +
                    '<div class="assets-shared-head">' +
                        '<p class="assets-shared-label">' + escapeHtml(group.label) + "</p>" +
                        '<div class="assets-shared-meta">' + escapeHtml(group.fileCount + " files | " + formatBytes(group.totalBytes)) + "</div>" +
                    "</div>" +
                    filesHtml +
                "</div>"
            );
        }).join("");
    }

    function bindControls() {
        refs.search.addEventListener("input", function(event) {
            state.search = String(event.target.value || "").trim().toLowerCase();
            renderMissions();
        });
        refs.availability.addEventListener("change", function(event) {
            state.availability = event.target.value || "";
            renderMissions();
        });

        refs.sortButtons.forEach(function(button) {
            button.addEventListener("click", function() {
                var key = button.getAttribute("data-sort-key") || "missionName";
                var type = button.getAttribute("data-sort-type") || "text";
                if (state.sortKey === key) {
                    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
                } else {
                    state.sortKey = key;
                    state.sortType = type;
                    state.sortDir = type === "text" ? "asc" : "desc";
                }
                renderMissions();
            });
        });
    }

    function init(payload) {
        state.missions = Array.isArray(payload && payload.missions) ? payload.missions : [];
        state.sharedAssets = payload && payload.sharedAssets ? payload.sharedAssets : { groups: [] };
        state.totals = payload && payload.totals ? payload.totals : {};
        state.sources = payload && payload.sources ? payload.sources : {};

        var dataRepoUrl = state.sources
            && state.sources.dataRepo
            && state.sources.dataRepo.githubUrl;
        if (dataRepoUrl && refs.dataRepoLink) {
            refs.dataRepoLink.href = dataRepoUrl;
        }

        bindControls();
        renderMissions();
        renderSharedAssets();
    }

    fetch(DATA_URL)
        .then(function(response) {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.json();
        })
        .then(init)
        .catch(function(error) {
            refs.tableBody.innerHTML = '<tr><td colspan="8" class="assets-empty">Failed to load ' + escapeHtml(DATA_URL) + ". " + escapeHtml(error.message) + "</td></tr>";
            refs.sharedRoot.innerHTML = '<div class="assets-empty">Shared assets unavailable because dataset failed to load.</div>';
        });
})();
