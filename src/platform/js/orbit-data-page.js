(function() {
    var DATA_URL = "assets/orbit-availability.json";
    var sectionOrder = {
        "20th century": 0,
        "21st century": 1,
        "Future missions": 2,
        "Proposed missions": 3
    };
    var statusClassMap = {
        "HORIZONS": "audit-badge--horizons",
        "HORIZONS partial": "audit-badge--horizons-partial",
        "NAIF/SPICE": "audit-badge--naif-spice",
        "NAIF/SPICE partial": "audit-badge--naif-spice-partial",
        "Other archive": "audit-badge--other-archive",
        "None verified": "audit-badge--none-verified",
        "Pre-launch": "audit-badge--pre-launch"
    };
    var collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

    var state = {
        missions: [],
        generatedAt: "",
        sourcePage: "",
        search: "",
        section: "",
        status: "",
        era: "",
        sort: "section-launch"
    };

    var refs = {
        search: document.getElementById("audit-search"),
        section: document.getElementById("audit-section"),
        status: document.getElementById("audit-status"),
        era: document.getElementById("audit-era"),
        sort: document.getElementById("audit-sort"),
        sourcePageLink: document.getElementById("audit-source-page"),
        sourcePageInlineLink: document.getElementById("audit-source-page-inline"),
        jsonLink: document.getElementById("audit-json-link"),
        summary: document.getElementById("audit-summary"),
        statusStrip: document.getElementById("audit-status-strip"),
        count: document.getElementById("audit-table-count"),
        updated: document.getElementById("audit-table-updated"),
        body: document.getElementById("audit-table-body")
    };

    function escapeHtml(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function monthIndexFromName(name) {
        var normalized = String(name || "").trim().slice(0, 3).toLowerCase();
        var monthMap = {
            jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
            jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
        };
        return monthMap[normalized] || 13;
    }

    function launchSortTuple(text) {
        var raw = String(text || "");
        var yearMatch = raw.match(/(19|20)\d{2}/);
        var year = yearMatch ? parseInt(yearMatch[0], 10) : 9999;
        var fullDateMatch = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+((19|20)\d{2})/);
        if (fullDateMatch) {
            return [year, monthIndexFromName(fullDateMatch[2]), parseInt(fullDateMatch[1], 10), raw];
        }

        var quarterMatch = raw.match(/\bQ([1-4])\s+((19|20)\d{2})/i);
        if (quarterMatch) {
            return [year, (parseInt(quarterMatch[1], 10) - 1) * 3 + 1, 1, raw];
        }

        var halfMatch = raw.match(/\bH([1-2])\s+((19|20)\d{2})/i);
        if (halfMatch) {
            return [year, halfMatch[1] === "1" ? 1 : 7, 1, raw];
        }

        var monthYearMatch = raw.match(/([A-Za-z]+)\s+((19|20)\d{2})/);
        if (monthYearMatch) {
            return [year, monthIndexFromName(monthYearMatch[1]), 1, raw];
        }

        return [year, 13, 32, raw];
    }

    function compareLaunch(a, b) {
        var aa = launchSortTuple(a.launchDate);
        var bb = launchSortTuple(b.launchDate);
        if (aa[0] !== bb[0]) return aa[0] - bb[0];
        if (aa[1] !== bb[1]) return aa[1] - bb[1];
        if (aa[2] !== bb[2]) return aa[2] - bb[2];
        return collator.compare(aa[3], bb[3]);
    }

    function statusSortValue(status) {
        var order = {
            "HORIZONS": 0,
            "HORIZONS partial": 1,
            "NAIF/SPICE": 2,
            "NAIF/SPICE partial": 3,
            "Other archive": 4,
            "None verified": 5,
            "Pre-launch": 6
        };
        return Object.prototype.hasOwnProperty.call(order, status) ? order[status] : 99;
    }

    function resolveMissionWikipediaUrl(entry) {
        if (!entry) return "";

        if (typeof entry.wikipediaUrl === "string" && entry.wikipediaUrl.trim()) {
            return entry.wikipediaUrl.trim();
        }

        if (Array.isArray(entry.sourceLinks)) {
            for (var i = 0; i < entry.sourceLinks.length; i += 1) {
                var url = (entry.sourceLinks[i] && entry.sourceLinks[i].url) ? String(entry.sourceLinks[i].url) : "";
                if (/^https?:\/\/([a-z]+\.)?wikipedia\.org\/wiki\//i.test(url)) {
                    return url;
                }
            }
        }

        // Fallback to Wikipedia search when no direct page URL is available.
        var query = String(entry.mission || entry.spacecraft || "").trim();
        if (!query) return "";
        return "https://en.wikipedia.org/wiki/Special:Search?search=" + encodeURIComponent(query);
    }

    function missionMatches(entry) {
        if (state.section && entry.section !== state.section) return false;
        if (state.status && entry.availabilityStatus !== state.status) return false;
        if (state.era && entry.era !== state.era) return false;
        if (!state.search) return true;

        var haystack = [
            entry.mission,
            entry.section,
            entry.launchDate,
            entry.operator,
            entry.missionType,
            entry.outcome,
            entry.spacecraft,
            entry.availabilityStatus,
            entry.availabilityNote,
            (entry.jplIds || []).join(" "),
            (entry.sourceLinks || []).map(function(link) { return link.label + " " + link.url; }).join(" ")
        ].join(" ").toLowerCase();

        return haystack.indexOf(state.search) !== -1;
    }

    function getFilteredMissions() {
        var filtered = state.missions.filter(missionMatches);
        filtered.sort(function(a, b) {
            if (state.sort === "mission") return collator.compare(a.mission, b.mission);
            if (state.sort === "launch") return compareLaunch(a, b);
            if (state.sort === "operator") {
                var operatorCompare = collator.compare(a.operator, b.operator);
                return operatorCompare || collator.compare(a.mission, b.mission);
            }
            if (state.sort === "status") {
                var statusCompare = statusSortValue(a.availabilityStatus) - statusSortValue(b.availabilityStatus);
                return statusCompare || collator.compare(a.mission, b.mission);
            }
            var sectionCompare = (sectionOrder[a.section] || 99) - (sectionOrder[b.section] || 99);
            if (sectionCompare) return sectionCompare;
            var launchCompare = compareLaunch(a, b);
            return launchCompare || collator.compare(a.mission, b.mission);
        });
        return filtered;
    }

    function renderSummary(missions) {
        var actualCount = missions.filter(function(entry) { return entry.era === "actual"; }).length;
        var futureCount = missions.filter(function(entry) { return entry.era === "future"; }).length;
        var proposedCount = missions.filter(function(entry) { return entry.era === "proposed"; }).length;
        var sourcedCount = missions.filter(function(entry) {
            return entry.availabilityStatus !== "None verified" && entry.availabilityStatus !== "Pre-launch";
        }).length;

        refs.summary.innerHTML = [
            { label: "Visible Missions", value: missions.length },
            { label: "Actual Missions", value: actualCount },
            { label: "Future Missions", value: futureCount },
            { label: "Proposed Missions", value: proposedCount },
            { label: "With Verified Orbit Source", value: sourcedCount }
        ].map(function(item) {
            return (
                '<div class="audit-kpi">' +
                    '<p class="audit-kpi__label">' + escapeHtml(item.label) + '</p>' +
                    '<p class="audit-kpi__value">' + escapeHtml(item.value) + '</p>' +
                '</div>'
            );
        }).join("");

        var counts = {};
        missions.forEach(function(entry) {
            counts[entry.availabilityStatus] = (counts[entry.availabilityStatus] || 0) + 1;
        });

        refs.statusStrip.innerHTML = Object.keys(counts)
            .sort(function(a, b) { return statusSortValue(a) - statusSortValue(b); })
            .map(function(status) {
                return (
                    '<span class="audit-pill">' +
                        '<span>' + escapeHtml(status) + '</span>' +
                        '<span class="audit-pill__count">' + escapeHtml(counts[status]) + '</span>' +
                    '</span>'
                );
            })
            .join("");
    }

    function renderTable(missions) {
        refs.count.textContent = missions.length + " missions shown";
        refs.updated.textContent = state.generatedAt ? ("Audit updated: " + state.generatedAt) : "";

        if (!missions.length) {
            refs.body.innerHTML = '<tr><td colspan="9" class="audit-empty">No missions matched the current filters.</td></tr>';
            return;
        }

        refs.body.innerHTML = missions.map(function(entry) {
            var badgeClass = statusClassMap[entry.availabilityStatus] || "audit-badge--none-verified";
            var wikiUrl = resolveMissionWikipediaUrl(entry);
            var missionTitle = escapeHtml(entry.mission);
            var missionTitleHtml = wikiUrl
                ? '<a class="audit-mission-link" href="' + escapeHtml(wikiUrl) + '" target="_blank" rel="noreferrer">' + missionTitle + "</a>"
                : missionTitle;
            var idsHtml = (entry.jplIds && entry.jplIds.length)
                ? '<div class="audit-ids">' + entry.jplIds.map(function(id) {
                    return '<span class="audit-id-chip">' + escapeHtml(id) + '</span>';
                }).join("") + '</div>'
                : '<span class="audit-mission-meta">None</span>';
            var linksHtml = (entry.sourceLinks && entry.sourceLinks.length)
                ? '<div class="audit-links">' + entry.sourceLinks.map(function(link) {
                    return '<a href="' + escapeHtml(link.url) + '" target="_blank" rel="noreferrer">' + escapeHtml(link.label) + '</a>';
                }).join("") + '</div>'
                : '<span class="audit-mission-meta">No verified source link</span>';

            var missionMetaParts = [];
            if (entry.spacecraft) missionMetaParts.push(entry.spacecraft);
            if (entry.era) missionMetaParts.push(entry.era);

            return (
                "<tr>" +
                    "<td>" +
                        '<div class="audit-mission-name">' + missionTitleHtml + "</div>" +
                        '<div class="audit-mission-meta">' + escapeHtml(missionMetaParts.join(" | ")) + "</div>" +
                    "</td>" +
                    "<td>" + escapeHtml(entry.section) + "</td>" +
                    "<td>" + escapeHtml(entry.launchDate || "N/A") + "</td>" +
                    "<td>" + escapeHtml(entry.operator || "N/A") + "</td>" +
                    "<td>" + escapeHtml(entry.missionType || "N/A") + "</td>" +
                    "<td>" + escapeHtml(entry.outcome || "N/A") + "</td>" +
                    "<td>" +
                        '<span class="audit-badge ' + badgeClass + '">' + escapeHtml(entry.availabilityStatus) + "</span>" +
                        '<div class="audit-note">' + escapeHtml(entry.availabilityNote || "") + "</div>" +
                    "</td>" +
                    "<td>" + idsHtml + "</td>" +
                    "<td>" + linksHtml + "</td>" +
                "</tr>"
            );
        }).join("");
    }

    function populateSelect(select, values) {
        values.forEach(function(value) {
            var option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
    }

    function render() {
        var filtered = getFilteredMissions();
        renderSummary(filtered);
        renderTable(filtered);
    }

    function bindControls() {
        refs.search.addEventListener("input", function(event) {
            state.search = String(event.target.value || "").trim().toLowerCase();
            render();
        });
        refs.section.addEventListener("change", function(event) {
            state.section = event.target.value || "";
            render();
        });
        refs.status.addEventListener("change", function(event) {
            state.status = event.target.value || "";
            render();
        });
        refs.era.addEventListener("change", function(event) {
            state.era = event.target.value || "";
            render();
        });
        refs.sort.addEventListener("change", function(event) {
            state.sort = event.target.value || "section-launch";
            render();
        });
    }

    function init(payload) {
        state.missions = Array.isArray(payload && payload.missions) ? payload.missions : [];
        state.generatedAt = payload && payload.generatedAt ? payload.generatedAt : "";
        state.sourcePage = payload && payload.sourcePage ? String(payload.sourcePage) : "";

        if (state.sourcePage) {
            if (refs.sourcePageLink) refs.sourcePageLink.href = state.sourcePage;
            if (refs.sourcePageInlineLink) refs.sourcePageInlineLink.href = state.sourcePage;
        }

        populateSelect(refs.section, Object.keys(sectionOrder).filter(function(section) {
            return state.missions.some(function(entry) { return entry.section === section; });
        }));
        populateSelect(refs.status, Object.keys(statusClassMap).filter(function(status) {
            return state.missions.some(function(entry) { return entry.availabilityStatus === status; });
        }));

        bindControls();
        render();
    }

    fetch(DATA_URL)
        .then(function(response) {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.json();
        })
        .then(init)
        .catch(function(error) {
            refs.count.textContent = "Unable to load orbit availability data";
            refs.body.innerHTML = '<tr><td colspan="9" class="audit-empty">Failed to load ' + escapeHtml(DATA_URL) + '. ' + escapeHtml(error.message) + '</td></tr>';
        });
})();
