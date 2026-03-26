(function() {
    window.__landingCatalogV2 = true;

    var params = new URLSearchParams(window.location.search);
    if (params.has("mission")) {
        window.location.replace("mission.html?" + params.toString());
        return;
    }

    var CATALOG_URL = "assets/mission-catalog.json";
    var catalogModel = { views: {}, missions: [] };

    function asTrimmedString(value) {
        if (typeof value !== "string") return "";
        return value.trim();
    }

    function normalizeKey(value) {
        return asTrimmedString(value).toLowerCase();
    }

    function uniqStrings(values) {
        var seen = new Set();
        var result = [];
        (values || []).forEach(function(value) {
            var key = normalizeKey(value);
            if (!key || seen.has(key)) return;
            seen.add(key);
            result.push(key);
        });
        return result;
    }

    function parseYear(value) {
        var n = parseInt(value, 10);
        return Number.isFinite(n) ? n : null;
    }

    function parseEventDate(value) {
        var raw = asTrimmedString(value);
        if (!raw || raw === "dynamic") return null;
        var dt = new Date(raw);
        if (Number.isNaN(dt.getTime())) return null;
        return dt;
    }

    function parseConfigDateTime(section, prefix) {
        if (!section || typeof section !== "object") return null;
        var year = parseInt(section[prefix + "_year"], 10);
        var month = parseInt(section[prefix + "_month"], 10);
        var day = parseInt(section[prefix + "_day"], 10);
        var hour = parseInt(section[prefix + "_hour"], 10);
        var minute = parseInt(section[prefix + "_minute"], 10);
        if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
        return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    }

    function formatUtcDateTime(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "N/A";
        var yyyy = String(date.getUTCFullYear()).padStart(4, "0");
        var mm = String(date.getUTCMonth() + 1).padStart(2, "0");
        var dd = String(date.getUTCDate()).padStart(2, "0");
        var hh = String(date.getUTCHours()).padStart(2, "0");
        var mi = String(date.getUTCMinutes()).padStart(2, "0");
        return yyyy + "-" + mm + "-" + dd + " " + hh + ":" + mi;
    }

    function findFirstMatchingEventDate(events, predicate) {
        if (!events || typeof events !== "object") return null;
        var matches = [];
        Object.keys(events).forEach(function(eventKey) {
            var eventDef = events[eventKey];
            if (!eventDef || typeof eventDef !== "object") return;
            var eventDate = parseEventDate(eventDef.startTime);
            if (!eventDate) return;
            if (!predicate(eventKey, eventDef)) return;
            matches.push(eventDate);
        });
        if (!matches.length) return null;
        matches.sort(function(a, b) { return a.getTime() - b.getTime(); });
        return matches[0];
    }

    function findEarliestEventDate(events) {
        return findFirstMatchingEventDate(events, function() { return true; });
    }

    function toCatalogEntry(raw, index) {
        var folder = normalizeKey(raw && raw.folder);
        var key = normalizeKey((raw && raw.key) || folder);
        var dimensions = raw && raw.dimensions ? raw.dimensions : {};
        var missionType = asTrimmedString(dimensions.missionType || raw && raw.missionType) || "Unknown";
        var craftClass = asTrimmedString(dimensions.craftClass || missionType) || "Unknown";
        var crewProfile = asTrimmedString(dimensions.crewProfile || raw && raw.crewProfile) || "Robotic";
        return {
            order: Number.isFinite(raw && raw.order) ? raw.order : index,
            key: key || folder,
            folder: folder,
            queryValue: asTrimmedString(raw && raw.queryValue) || folder,
            aliases: uniqStrings([key, folder].concat(raw && raw.aliases ? raw.aliases : [])),
            card: {
                title: asTrimmedString(raw && raw.title) || folder,
                subtitle: asTrimmedString(raw && raw.subtitle) || "Moon Mission",
                description: asTrimmedString(raw && raw.description) || "Mission timeline",
                accent: asTrimmedString(raw && raw.accent) || "#4a90d9"
            },
            meta: {
                country: asTrimmedString(raw && raw.country) || "Unknown",
                lane: normalizeKey(raw && raw.lane),
                startYear: parseYear(raw && raw.startYear),
                endYear: parseYear(raw && raw.endYear),
                missionType: missionType,
                craftClass: craftClass,
                crewProfile: crewProfile
            }
        };
    }

    function loadCatalog() {
        return fetch(CATALOG_URL, { cache: "no-store" })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Failed to load mission catalog: " + response.status);
                }
                return response.json();
            })
            .then(function(raw) {
                var missions = Array.isArray(raw && raw.missions) ? raw.missions : [];
                catalogModel = {
                    defaultMissionFolder: normalizeKey(raw && raw.defaultMissionFolder),
                    views: raw && raw.views ? raw.views : {},
                    missions: missions.map(toCatalogEntry).sort(function(a, b) { return a.order - b.order; })
                };
                return catalogModel.missions;
            });
    }

    function getTimingFromConfig(config) {
        var events = config && typeof config.events === "object" ? config.events : {};

        var launchDate =
            findFirstMatchingEventDate(events, function(eventKey) {
                var k = normalizeKey(eventKey);
                return k === "missionstart" || k === "launch" || k === "trackingstart";
            }) || findEarliestEventDate(events);

        var tliDate = findFirstMatchingEventDate(events, function(eventKey, eventDef) {
            var keyText = normalizeKey(eventKey);
            var labelText = normalizeKey(eventDef.label);
            var infoText = normalizeKey(eventDef.infoText);
            return keyText.indexOf("tli") >= 0 || labelText.indexOf("tli") >= 0 || infoText.indexOf("trans-lunar") >= 0;
        });

        var loiDate = findFirstMatchingEventDate(events, function(eventKey, eventDef) {
            var keyText = normalizeKey(eventKey);
            var labelText = normalizeKey(eventDef.label);
            var infoText = normalizeKey(eventDef.infoText);
            return (
                keyText.indexOf("loi") >= 0 ||
                labelText.indexOf("loi") >= 0 ||
                keyText.indexOf("lunarorbit") >= 0 ||
                infoText.indexOf("lunar orbit insertion") >= 0
            );
        });

        var landingDate =
            findFirstMatchingEventDate(events, function(eventKey, eventDef) {
                var keyText = normalizeKey(eventKey);
                var labelText = normalizeKey(eventDef.label);
                return (
                    keyText.indexOf("landing") >= 0 ||
                    keyText.indexOf("touchdown") >= 0 ||
                    keyText.indexOf("softlanding") >= 0 ||
                    labelText.indexOf("landing") >= 0 ||
                    labelText.indexOf("touchdown") >= 0
                );
            }) ||
            findFirstMatchingEventDate(events, function(eventKey, eventDef) {
                var keyText = normalizeKey(eventKey);
                var labelText = normalizeKey(eventDef.label);
                return keyText.indexOf("impact") >= 0 || labelText.indexOf("impact") >= 0;
            });

        var geoStart = parseConfigDateTime(config && config.geo, "start");
        var lunarStart = parseConfigDateTime(config && config.lunar, "start");
        var geoEnd = parseConfigDateTime(config && config.geo, "stop");
        var lunarEnd = parseConfigDateTime(config && config.lunar, "stop");

        var startCandidates = [geoStart, lunarStart].filter(Boolean);
        var endCandidates = [geoEnd, lunarEnd].filter(Boolean);
        var dataStart = startCandidates.length
            ? startCandidates.sort(function(a, b) { return a.getTime() - b.getTime(); })[0]
            : null;
        var dataEnd = endCandidates.length
            ? endCandidates.sort(function(a, b) { return b.getTime() - a.getTime(); })[0]
            : null;

        return {
            launchDate: launchDate,
            tliDate: tliDate,
            loiDate: loiDate,
            landingDate: landingDate,
            dataStart: dataStart,
            dataEnd: dataEnd
        };
    }

    function hydrateRowWithConfigTiming(row) {
        var configUrl = "assets/" + row.entry.folder + "/data/config.json";
        return fetch(configUrl, { cache: "no-store" })
            .then(function(response) {
                if (!response.ok) throw new Error("missing config");
                return response.json();
            })
            .then(function(config) {
                var timing = getTimingFromConfig(config);
                return Object.assign({}, row, {
                    launchTime: formatUtcDateTime(timing.launchDate),
                    tliTime: formatUtcDateTime(timing.tliDate),
                    loiTime: formatUtcDateTime(timing.loiDate),
                    landingTime: formatUtcDateTime(timing.landingDate),
                    dataStartTime: formatUtcDateTime(timing.dataStart),
                    dataEndTime: formatUtcDateTime(timing.dataEnd),
                    launchSortKey: timing.launchDate ? timing.launchDate.getTime() : -Infinity,
                    tliSortKey: timing.tliDate ? timing.tliDate.getTime() : -Infinity,
                    loiSortKey: timing.loiDate ? timing.loiDate.getTime() : -Infinity,
                    landingSortKey: timing.landingDate ? timing.landingDate.getTime() : -Infinity,
                    dataStartSortKey: timing.dataStart ? timing.dataStart.getTime() : -Infinity,
                    dataEndSortKey: timing.dataEnd ? timing.dataEnd.getTime() : -Infinity
                });
            })
            .catch(function() {
                return row;
            });
    }

    function toRow(entry, index) {
        var startYear = entry.meta.startYear;
        var endYear = entry.meta.endYear || startYear;
        var range = startYear
            ? (endYear && endYear !== startYear ? (startYear + " - " + endYear) : String(startYear))
            : "Unknown";

        return {
            index: index,
            entry: entry,
            href: "mission.html?mission=" + encodeURIComponent(entry.queryValue || entry.folder),
            title: entry.card.title,
            description: entry.card.description,
            country: entry.meta.country || "Unknown",
            lane: entry.meta.lane || "",
            missionType: entry.meta.missionType || "Unknown",
            craftClass: entry.meta.craftClass || "Unknown",
            crewProfile: entry.meta.crewProfile || "Robotic",
            startYear: startYear,
            endYear: endYear,
            rangeLabel: range,
            spanYears: startYear && endYear ? Math.max(0, endYear - startYear) : 0,
            launchTime: "N/A",
            tliTime: "N/A",
            loiTime: "N/A",
            landingTime: "N/A",
            dataStartTime: "N/A",
            dataEndTime: "N/A",
            launchSortKey: -Infinity,
            tliSortKey: -Infinity,
            loiSortKey: -Infinity,
            landingSortKey: -Infinity,
            dataStartSortKey: -Infinity,
            dataEndSortKey: -Infinity,
            accent: entry.card.accent || "#4a90d9"
        };
    }

    function createCard(row) {
        var link = document.createElement("a");
        link.className = "landing-card";
        link.href = row.href;
        link.style.borderColor = row.accent + "66";

        var t = document.createElement("h3");
        t.className = "landing-card__title";
        var titleFlag = document.createElement("span");
        titleFlag.className = "landing-flag";
        titleFlag.textContent = flagForCountry(row.country);
        if (titleFlag.textContent) t.appendChild(titleFlag);
        t.appendChild(document.createTextNode(row.title));

        var m = document.createElement("p");
        m.className = "landing-card__meta";
        var cardCraftIcon = iconForCraftClass(row.craftClass);
        m.textContent =
            row.country +
            " • " +
            (cardCraftIcon ? (cardCraftIcon + " ") : "") +
            row.craftClass +
            " • " +
            row.rangeLabel;

        var d = document.createElement("p");
        d.className = "landing-card__desc";
        d.textContent = row.description;

        link.appendChild(t);
        link.appendChild(m);
        link.appendChild(d);
        return link;
    }

    function flagForCountry(country) {
        var key = normalizeKey(country);
        if (key === "india") return "🇮🇳";
        if (key === "united states") return "🇺🇸";
        if (key === "japan") return "🇯🇵";
        if (key === "south korea") return "🇰🇷";
        return "";
    }

    function iconForCraftClass(craftClass) {
        var key = normalizeKey(craftClass);
        if (key === "orbiter") return "🛰️";
        if (key === "lander") return "🛬";
        if (key === "impactor") return "☄️";
        if (key === "stage") return "🚀";
        if (key === "lunar module") return "🚀";
        if (key === "capsule") return "🛰️";
        if (key === "cubesat") return "🧊";
        if (key === "pathfinder") return "🧭";
        if (key === "propulsion module") return "🔥";
        return "";
    }

    function buildLanes(rows) {
        var defaultCfg = catalogModel.views && catalogModel.views.default ? catalogModel.views.default : {};
        var laneOrder = Array.isArray(defaultCfg.laneOrder)
            ? defaultCfg.laneOrder.map(normalizeKey)
            : ["chandrayaan", "artemis", "apollo", "other"];
        var laneLabels = defaultCfg.laneLabels || {};
        var laneMembership = defaultCfg.laneMembership || {};

        var rowsByFolder = new Map();
        rows.forEach(function(row) {
            rowsByFolder.set(normalizeKey(row.entry.folder), row);
        });

        var explicitLanes = {};
        var usedFolders = new Set();
        Object.keys(laneMembership).forEach(function(laneKey) {
            var normalizedLane = normalizeKey(laneKey);
            var folderList = Array.isArray(laneMembership[laneKey]) ? laneMembership[laneKey] : [];
            explicitLanes[normalizedLane] = folderList
                .map(function(folder) { return rowsByFolder.get(normalizeKey(folder)); })
                .filter(Boolean);
            explicitLanes[normalizedLane].forEach(function(row) {
                usedFolders.add(normalizeKey(row.entry.folder));
            });
        });

        var otherRows = rows
            .filter(function(row) { return !usedFolders.has(normalizeKey(row.entry.folder)); })
            .sort(function(a, b) {
                var ay = Number.isFinite(a.startYear) ? a.startYear : 99999;
                var by = Number.isFinite(b.startYear) ? b.startYear : 99999;
                if (ay !== by) return ay - by;
                return (a.title || "").localeCompare(b.title || "");
            });

        var lanes = [];
        laneOrder.forEach(function(laneKey) {
            if (!laneKey) return;
            var laneRows = laneKey === "other" ? otherRows : (explicitLanes[laneKey] || []);
            if (!laneRows.length) return;
            lanes.push({
                key: laneKey,
                label: asTrimmedString(laneLabels[laneKey]) || (laneKey === "other" ? "Other Missions" : laneKey),
                rows: laneRows
            });
        });

        if (laneOrder.indexOf("other") < 0 && otherRows.length) {
            lanes.push({ key: "other", label: "Other Missions", rows: otherRows });
        }

        return lanes;
    }

    document.addEventListener("DOMContentLoaded", function() {
        var viewRoot = document.getElementById("landing-view-root");
        var sortControls = document.getElementById("landing-sort-controls");
        var sortField = document.getElementById("landing-sort-field");
        var sortOrder = document.getElementById("landing-sort-order");
        var filterCraft = document.getElementById("landing-filter-craft");
        var filterCrew = document.getElementById("landing-filter-crew");
        var resetControls = document.getElementById("landing-controls-reset");
        var viewButtons = Array.from(document.querySelectorAll(".landing-view-button"));

        var currentView = "default";
        var missionRows = [];
        var defaultSortFieldValue = sortField ? sortField.value : "title";
        var defaultSortOrderValue = sortOrder ? sortOrder.value : "asc";

        function renderDefault(rows) {
            var knownYears = rows.filter(function(r) { return !!r.startYear; });
            var minYear = knownYears.length ? Math.min.apply(null, knownYears.map(function(r) { return r.startYear; })) : null;
            var maxYear = knownYears.length ? Math.max.apply(null, knownYears.map(function(r) { return r.endYear || r.startYear; })) : null;
            var countries = new Set(rows.map(function(r) { return r.country; }));

            var summary = document.createElement("div");
            summary.className = "landing-summary";
            [
                { label: "Missions", value: String(rows.length) },
                { label: "Countries", value: String(countries.size) },
                { label: "Timeline Span", value: minYear && maxYear ? (minYear + " - " + maxYear) : "N/A" }
            ].forEach(function(item) {
                var kpi = document.createElement("div");
                kpi.className = "landing-kpi";
                var l = document.createElement("p");
                l.className = "landing-kpi__label";
                l.textContent = item.label;
                var v = document.createElement("p");
                v.className = "landing-kpi__value";
                v.textContent = item.value;
                kpi.appendChild(l);
                kpi.appendChild(v);
                summary.appendChild(kpi);
            });
            viewRoot.appendChild(summary);

            var laneShell = document.createElement("div");
            laneShell.className = "landing-default-lanes";
            buildLanes(rows).forEach(function(lane) {
                var laneNode = document.createElement("section");
                laneNode.className = "landing-lane";

                var title = document.createElement("h3");
                title.className = "landing-lane__title";
                title.textContent = lane.label;
                laneNode.appendChild(title);

                var grid = document.createElement("div");
                grid.className = "landing-grid";
                lane.rows.forEach(function(row) { grid.appendChild(createCard(row)); });
                laneNode.appendChild(grid);
                laneShell.appendChild(laneNode);
            });
            viewRoot.appendChild(laneShell);
        }

        function renderTiles(rows) {
            var grid = document.createElement("div");
            grid.className = "landing-grid";
            rows.forEach(function(row) { grid.appendChild(createCard(row)); });
            viewRoot.appendChild(grid);
        }

        function renderTable(rows) {
            function setCellText(cell, text) {
                var value = typeof text === "string" ? text : String(text);
                cell.textContent = value;
                cell.title = value;
            }

            var wrap = document.createElement("div");
            wrap.className = "landing-table-wrap";
            var table = document.createElement("table");
            table.className = "landing-table";
            var head = document.createElement("thead");
            var hr = document.createElement("tr");
            [
                "Mission",
                "Country",
                "Craft",
                "Crew",
                "Launch (UTC)",
                "TLI (UTC)",
                "LOI (UTC)",
                "Landing (UTC)",
                "Data Start (UTC)",
                "Data End (UTC)",
                "Timeline",
                "Duration",
                "Link"
            ].forEach(function(label) {
                var th = document.createElement("th");
                th.textContent = label;
                hr.appendChild(th);
            });
            head.appendChild(hr);
            table.appendChild(head);

            var body = document.createElement("tbody");
            rows.forEach(function(row) {
                var tr = document.createElement("tr");
                var tdMission = document.createElement("td");
                setCellText(tdMission, row.title);
                var tdCountry = document.createElement("td");
                var countryFlag = flagForCountry(row.country);
                setCellText(tdCountry, countryFlag ? (countryFlag + " " + row.country) : row.country);
                var tdCraft = document.createElement("td");
                var tableCraftIcon = iconForCraftClass(row.craftClass);
                setCellText(tdCraft, tableCraftIcon ? (tableCraftIcon + " " + row.craftClass) : row.craftClass);
                var tdCrew = document.createElement("td");
                setCellText(tdCrew, row.crewProfile);
                var tdLaunch = document.createElement("td");
                setCellText(tdLaunch, row.launchTime);
                var tdTli = document.createElement("td");
                setCellText(tdTli, row.tliTime);
                var tdLoi = document.createElement("td");
                setCellText(tdLoi, row.loiTime);
                var tdLanding = document.createElement("td");
                setCellText(tdLanding, row.landingTime);
                var tdDataStart = document.createElement("td");
                setCellText(tdDataStart, row.dataStartTime);
                var tdDataEnd = document.createElement("td");
                setCellText(tdDataEnd, row.dataEndTime);
                var tdRange = document.createElement("td");
                setCellText(tdRange, row.rangeLabel);
                var tdSpan = document.createElement("td");
                setCellText(tdSpan, row.startYear ? String(row.spanYears) + "y" : "N/A");
                var tdLink = document.createElement("td");
                var a = document.createElement("a");
                a.href = row.href;
                a.textContent = "Open";
                a.title = "Open " + row.title;
                tdLink.appendChild(a);
                [
                    tdMission,
                    tdCountry,
                    tdCraft,
                    tdCrew,
                    tdLaunch,
                    tdTli,
                    tdLoi,
                    tdLanding,
                    tdDataStart,
                    tdDataEnd,
                    tdRange,
                    tdSpan,
                    tdLink
                ].forEach(function(td) { tr.appendChild(td); });
                body.appendChild(tr);
            });
            table.appendChild(body);
            wrap.appendChild(table);
            viewRoot.appendChild(wrap);
        }

        function renderTimeline(rows) {
            var groups = {};
            rows.forEach(function(row) {
                var year = row.startYear ? String(row.startYear) : "Unknown";
                groups[year] = groups[year] || [];
                groups[year].push(row);
            });

            var years = Object.keys(groups).sort(function(a, b) {
                if (a === "Unknown") return 1;
                if (b === "Unknown") return -1;
                return parseInt(a, 10) - parseInt(b, 10);
            });

            years.forEach(function(year) {
                var g = document.createElement("div");
                g.className = "landing-timeline-group";
                var h = document.createElement("h3");
                h.className = "landing-timeline-year";
                h.textContent = year;
                g.appendChild(h);

                var list = document.createElement("div");
                list.className = "landing-timeline-list";
                groups[year].forEach(function(row) {
                    var chip = document.createElement("a");
                    chip.className = "landing-timeline-chip";
                    chip.href = row.href;
                    var timelineFlag = flagForCountry(row.country);
                    var timelineCraft = iconForCraftClass(row.craftClass);
                    chip.textContent =
                        (timelineFlag ? (timelineFlag + " ") : "") +
                        (timelineCraft ? (timelineCraft + " ") : "") +
                        row.title +
                        " • " +
                        row.country;
                    list.appendChild(chip);
                });
                g.appendChild(list);
                viewRoot.appendChild(g);
            });
        }

        function setFilterOptions(selectEl, values, allLabel) {
            if (!selectEl) return;
            var previous = normalizeKey(selectEl.value);
            selectEl.innerHTML = "";

            var defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = allLabel;
            selectEl.appendChild(defaultOption);

            values.forEach(function(value) {
                var option = document.createElement("option");
                option.value = value;
                option.textContent = value;
                selectEl.appendChild(option);
            });
            if (previous && values.some(function(value) { return normalizeKey(value) === previous; })) {
                var restored = values.find(function(value) { return normalizeKey(value) === previous; });
                selectEl.value = restored;
            }
        }

        function populateTableFilters(rows) {
            var craftSet = new Set();
            var crewSet = new Set();
            rows.forEach(function(row) {
                if (asTrimmedString(row.craftClass)) craftSet.add(row.craftClass);
                if (asTrimmedString(row.crewProfile)) crewSet.add(row.crewProfile);
            });

            var craftOptions = Array.from(craftSet).sort(function(a, b) { return a.localeCompare(b); });
            var crewOptions = Array.from(crewSet).sort(function(a, b) { return a.localeCompare(b); });
            setFilterOptions(filterCraft, craftOptions, "All Craft Classes");
            setFilterOptions(filterCrew, crewOptions, "All Crew Profiles");
        }

        function rowsForActiveView() {
            var rows = missionRows.slice();
            if (currentView === "default") {
                return rows.sort(function(a, b) { return a.index - b.index; });
            }

            var craftFilter = normalizeKey(filterCraft && filterCraft.value);
            var crewFilter = normalizeKey(filterCrew && filterCrew.value);
            rows = rows.filter(function(row) {
                if (craftFilter && normalizeKey(row.craftClass) !== craftFilter) return false;
                if (crewFilter && normalizeKey(row.crewProfile) !== crewFilter) return false;
                return true;
            });

            var field = sortField.value;
            var dir = sortOrder.value === "desc" ? -1 : 1;
            return rows.sort(function(a, b) {
                var av = a[field];
                var bv = b[field];
                if (
                    field === "title" ||
                    field === "country" ||
                    field === "missionType" ||
                    field === "craftClass" ||
                    field === "crewProfile"
                ) {
                    av = (av || "").toLowerCase();
                    bv = (bv || "").toLowerCase();
                } else {
                    av = Number.isFinite(av) ? av : -Infinity;
                    bv = Number.isFinite(bv) ? bv : -Infinity;
                }
                if (av < bv) return -1 * dir;
                if (av > bv) return 1 * dir;
                return (a.index - b.index) * dir;
            });
        }

        function render() {
            viewButtons.forEach(function(btn) {
                btn.classList.toggle("landing-view-button--active", btn.dataset.view === currentView);
            });
            sortControls.style.display = currentView === "default" ? "none" : "flex";
            viewRoot.innerHTML = "";
            var rows = rowsForActiveView();
            if (currentView === "tiles") return renderTiles(rows);
            if (currentView === "table") return renderTable(rows);
            if (currentView === "timeline") return renderTimeline(rows);
            return renderDefault(rows);
        }

        viewButtons.forEach(function(button) {
            button.addEventListener("click", function() {
                currentView = button.dataset.view || "default";
                render();
            });
        });
        sortField.addEventListener("change", render);
        sortOrder.addEventListener("change", render);
        if (filterCraft) filterCraft.addEventListener("change", render);
        if (filterCrew) filterCrew.addEventListener("change", render);
        if (resetControls) {
            resetControls.addEventListener("click", function() {
                if (sortField) sortField.value = defaultSortFieldValue;
                if (sortOrder) sortOrder.value = defaultSortOrderValue;
                if (filterCraft) filterCraft.value = "";
                if (filterCrew) filterCrew.value = "";
                render();
            });
        }

        loadCatalog()
            .then(function(entries) {
                missionRows = entries.map(toRow);
                populateTableFilters(missionRows);
                var tableCfg = (catalogModel.views && catalogModel.views.table) || {};
                var defaultSortField = asTrimmedString(tableCfg.defaultSortField);
                var defaultSortOrder = asTrimmedString(tableCfg.defaultSortOrder);
                if (defaultSortField) sortField.value = defaultSortField;
                if (defaultSortOrder) sortOrder.value = defaultSortOrder;
                defaultSortFieldValue = sortField.value;
                defaultSortOrderValue = sortOrder.value;
                render();

                Promise.all(missionRows.map(hydrateRowWithConfigTiming))
                    .then(function(hydratedRows) {
                        missionRows = hydratedRows;
                        render();
                    })
                    .catch(function() {
                        /* keep baseline timing placeholders */
                    });
            })
            .catch(function(error) {
                console.error(error);
                viewRoot.innerHTML = "<p style=\"color:#ff9aa5;\">Mission catalog failed to load.</p>";
            });
    });
})();
