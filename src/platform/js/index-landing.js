(function() {
    window.__landingCatalogV2 = true;

    var params = new URLSearchParams(window.location.search);
    if (params.has("mission")) {
        window.location.replace("mission.html?" + params.toString());
        return;
    }

    var CATALOG_URL = "assets/mission-catalog.json";
    var catalogModel = { views: {}, missions: [] };
    var HORIZONS_METADATA_BY_FOLDER = {
        "apollo8-sivb": "apollo-8-s-ivb",
        "apollo9-sivb": "apollo-9-s-ivb",
        "apollo10-lm": "apollo-10-lm-snoopy",
        "apollo10-sivb": "apollo-10-s-ivb",
        "apollo11-sivb": "apollo-11-s-ivb",
        "apollo12-sivb": "apollo-12-s-ivb",
        "artemis1": "artemis-1-orion",
        "capstone": "capstone",
        "chandrayaan1": "chandrayaan-1",
        "chandrayaan2": "chandrayaan-2-orbiter",
        "chandrayaan3": "chandrayaan-3-propulsion-module",
        "clementine": "clementine",
        "grail": "grail-a-ebb",
        "grail-ss-stage": "grail-ss-stage",
        "kplo-danuri": "kplo-danuri",
        "ladee": "ladee",
        "lcross-centaur": "lcross-centaur",
        "lcross-shepherd": "lcross-shepherd",
        "lro": "lro",
        "lunar-flashlight": "lunar-flashlight",
        "lunar-prospector": "lunar-prospector",
        "lunar-trailblazer": "lunar-trailblazer",
        "slim": "slim"
    };
    var DEFAULT_BRIEF_IMAGES_BY_FOLDER = {
        "artemis1": [
            {
                url: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Kennedy_Space_Center%2C_Orion_Multi-Purpose_Crew_Vehicle.JPG",
                attribution: "Wikimedia Commons contributors",
                license: "CC BY-SA 4.0",
                sourceUrl: "https://commons.wikimedia.org/wiki/File:Kennedy_Space_Center,_Orion_Multi-Purpose_Crew_Vehicle.JPG",
                caption: "Orion Multi-Purpose Crew Vehicle at Kennedy Space Center."
            }
        ]
    };
    var missionBriefCache = new Map();
    var orbitPreviewCache = new Map();
    var missionBriefTextPromise = null;
    var missionImageTextPromise = null;

    function asTrimmedString(value) {
        if (typeof value !== "string") return "";
        return value.trim();
    }

    function normalizeKey(value) {
        return asTrimmedString(value).toLowerCase();
    }

    function escapeHtml(text) {
        var value = text === null || text === undefined ? "" : String(text);
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function ensureTrailingPeriod(text) {
        var t = asTrimmedString(text);
        if (!t) return "";
        if (/[.!?]$/.test(t)) return t;
        return t + ".";
    }

    function cleanMetadataText(text) {
        var raw = asTrimmedString(text);
        if (!raw) return "";
        return raw
            .replace(/\*{3,}/g, " ")
            .replace(/\s+/g, " ")
            .replace(/ +([,.;:!?])/g, "$1")
            .trim();
    }

    function sentenceSplit(text) {
        var cleaned = cleanMetadataText(text);
        if (!cleaned) return [];
        return cleaned
            .split(/(?<=[.!?])\s+/)
            .map(function(s) { return asTrimmedString(s); })
            .filter(Boolean);
    }

    function toJulianDate(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        return date.getTime() / 86400000 + 2440587.5;
    }

    function fromIsoToJulianDate(isoText) {
        var dt = parseEventDate(isoText);
        return dt ? toJulianDate(dt) : null;
    }

    function julianDateToDate(jd) {
        if (!Number.isFinite(jd)) return null;
        var ms = (jd - 2440587.5) * 86400000;
        var dt = new Date(ms);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function formatPreviewDateTimeUtc(jd) {
        var dt = julianDateToDate(jd);
        if (!dt) return "";
        var day = String(dt.getUTCDate()).padStart(2, "0");
        var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        var mon = monthNames[dt.getUTCMonth()];
        var year = dt.getUTCFullYear();
        var hh = String(dt.getUTCHours()).padStart(2, "0");
        var mm = String(dt.getUTCMinutes()).padStart(2, "0");
        return day + " " + mon + " " + year + " " + hh + ":" + mm + " UTC";
    }

    function evaluateCheb(coeffs, x) {
        if (!Array.isArray(coeffs) || !coeffs.length) return 0;
        if (coeffs.length === 1) return coeffs[0];
        var bK1 = 0;
        var bK2 = 0;
        for (var k = coeffs.length - 1; k >= 1; k -= 1) {
            var bK = coeffs[k] + 2 * x * bK1 - bK2;
            bK2 = bK1;
            bK1 = bK;
        }
        return coeffs[0] + x * bK1 - bK2;
    }

    function findChebSegment(segments, jd) {
        if (!Array.isArray(segments) || !segments.length) return null;
        var low = 0;
        var high = segments.length - 1;
        var eps = 1e-8;
        while (low <= high) {
            var mid = Math.floor((low + high) / 2);
            var seg = segments[mid];
            if (jd < seg.t_start - eps) {
                high = mid - 1;
            } else if (jd > seg.t_end + eps) {
                low = mid + 1;
            } else {
                return seg;
            }
        }
        return null;
    }

    function getChebPosition(series, jd) {
        var seg = findChebSegment(series && series.segments, jd);
        if (!seg) return null;
        var tSpan = seg.t_end - seg.t_start;
        var tNorm = 2 * (jd - seg.t_start) / tSpan - 1;
        if (tNorm < -1) tNorm = -1;
        if (tNorm > 1) tNorm = 1;
        return {
            x: evaluateCheb(seg.cx, tNorm),
            y: evaluateCheb(seg.cy, tNorm),
            z: evaluateCheb(seg.cz, tNorm)
        };
    }

    function pickSummaryFromMetadata(meta, fallback) {
        var rawSections = meta && meta.raw_sections ? meta.raw_sections : {};
        var sectionsToTry = [
            rawSections.BACKGROUND,
            rawSections.PURPOSE,
            rawSections["MISSION GOALS"],
            rawSections.MISSION
        ];
        for (var i = 0; i < sectionsToTry.length; i += 1) {
            var sectionText = cleanMetadataText(sectionsToTry[i]);
            if (!sectionText) continue;
            var sentences = sentenceSplit(sectionText);
            if (!sentences.length) continue;
            return ensureTrailingPeriod(sentences.slice(0, 2).join(" "));
        }
        return ensureTrailingPeriod(fallback || "Mission timeline from NASA JPL Horizons ephemeris metadata.");
    }

    function parseCatalogUtc(value) {
        var raw = asTrimmedString(value);
        if (!raw || raw === "N/A") return null;
        var dt = new Date(raw.replace(" ", "T") + "Z");
        if (Number.isNaN(dt.getTime())) return null;
        return dt;
    }

    function formatUtcHuman(value) {
        var dt = value instanceof Date ? value : parseCatalogUtc(value);
        if (!dt) return asTrimmedString(value);
        var datePart = dt.toLocaleDateString("en-US", {
            timeZone: "UTC",
            year: "numeric",
            month: "short",
            day: "numeric"
        });
        var hh = String(dt.getUTCHours()).padStart(2, "0");
        var mm = String(dt.getUTCMinutes()).padStart(2, "0");
        return datePart + " " + hh + ":" + mm + " UTC";
    }

    function parseMonthNameIndex(name) {
        var m = normalizeKey(name).slice(0, 3);
        var map = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        return Number.isFinite(map[m]) ? map[m] : null;
    }

    function parseHorizonsDateTime(value) {
        var raw = asTrimmedString(value);
        if (!raw) return null;
        var m = raw.match(/^(\d{4})[-\s]([A-Za-z]{3,})[-\s](\d{1,2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (!m) return null;
        var year = parseInt(m[1], 10);
        var month = parseMonthNameIndex(m[2]);
        var day = parseInt(m[3], 10);
        var hour = m[4] ? parseInt(m[4], 10) : 0;
        var minute = m[5] ? parseInt(m[5], 10) : 0;
        var second = m[6] ? parseInt(m[6], 10) : 0;
        if (!Number.isFinite(year) || month === null || !Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) {
            return null;
        }
        var dt = new Date(Date.UTC(year, month, day, hour, minute, second));
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function parseHorizonsDateWithFallbackYear(value, fallbackYear) {
        var raw = asTrimmedString(value);
        if (!raw) return null;
        var withYear = parseHorizonsDateTime(raw);
        if (withYear) return withYear;
        var m = raw.match(/^([A-Za-z]{3,})\s+(\d{1,2})(?:\s*@?\s*(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (!m || !Number.isFinite(fallbackYear)) return null;
        var month = parseMonthNameIndex(m[1]);
        var day = parseInt(m[2], 10);
        var hour = m[3] ? parseInt(m[3], 10) : 0;
        var minute = m[4] ? parseInt(m[4], 10) : 0;
        var second = m[5] ? parseInt(m[5], 10) : 0;
        if (month === null || !Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) {
            return null;
        }
        var dt = new Date(Date.UTC(fallbackYear, month, day, hour, minute, second));
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function extractApolloMissionBounds(meta, row) {
        var background = asTrimmedString(meta && meta.raw_sections && meta.raw_sections.BACKGROUND);
        if (!background) return null;
        var launchDate = asTrimmedString(meta && meta.launch_date);
        var launchYearMatch = launchDate.match(/(\d{4})/);
        var year = launchYearMatch ? parseInt(launchYearMatch[1], 10) : (row && row.startYear ? row.startYear : null);
        if (!Number.isFinite(year)) return null;

        var launchMatch = background.match(/Launch\s+([A-Za-z]+)\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})/i);
        var splashMatch = background.match(/Splashdown\s+([A-Za-z]+)\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})/i);
        if (!launchMatch || !splashMatch) return null;

        var launchMonth = parseMonthNameIndex(launchMatch[1]);
        var splashMonth = parseMonthNameIndex(splashMatch[1]);
        if (launchMonth === null || splashMonth === null) return null;

        var launchParts = launchMatch[3].split(":").map(function(v) { return parseInt(v, 10); });
        var splashParts = splashMatch[3].split(":").map(function(v) { return parseInt(v, 10); });
        if (launchParts.length !== 3 || splashParts.length !== 3) return null;

        var startDate = new Date(Date.UTC(year, launchMonth, parseInt(launchMatch[2], 10), launchParts[0], launchParts[1], launchParts[2]));
        var endDate = new Date(Date.UTC(year, splashMonth, parseInt(splashMatch[2], 10), splashParts[0], splashParts[1], splashParts[2]));
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;

        return {
            startDate: startDate,
            endDate: endDate,
            startLabel: formatUtcHuman(startDate),
            endLabel: formatUtcHuman(endDate)
        };
    }

    function inferMissionWindow(row, meta) {
        var apolloBounds = extractApolloMissionBounds(meta, row);
        if (apolloBounds) return apolloBounds;

        var missionEndDate = parseCatalogUtc(row && row.missionEndTime);
        var launchDate = parseCatalogUtc(row && row.launchTime);
        var dataStart = parseCatalogUtc(row && row.dataStartTime);
        var landingDate = parseCatalogUtc(row && row.landingTime);
        var dataEnd = parseCatalogUtc(row && row.dataEndTime);
        var startDate = launchDate && dataStart
            ? new Date(Math.min(launchDate.getTime(), dataStart.getTime()))
            : (launchDate || dataStart);
        var endCandidates = [missionEndDate, landingDate, dataEnd].filter(Boolean);
        var endDate = endCandidates.length
            ? new Date(Math.max.apply(null, endCandidates.map(function(dt) { return dt.getTime(); })))
            : null;

        return {
            startDate: startDate,
            endDate: endDate,
            startLabel: startDate ? formatUtcHuman(startDate) : "the mission start (UTC)",
            endLabel: endDate ? formatUtcHuman(endDate) : "the mission end (UTC)"
        };
    }

    function buildTimelineSegments(row, meta) {
        var missionWindow = inferMissionWindow(row, meta);
        var horizonsStart = parseHorizonsDateTime(meta && meta.trajectory_start);
        var horizonsEnd = parseHorizonsDateTime(meta && meta.trajectory_end);
        if ((!horizonsStart || !horizonsEnd) && meta) {
            var inferred = inferHorizonsRangeFromRawSections(meta);
            if (inferred) {
                if (!horizonsStart) horizonsStart = inferred.startDate;
                if (!horizonsEnd) horizonsEnd = inferred.endDate;
            }
        }
        var coverageStart = parseCatalogUtc(row && row.dataStartTime);
        var coverageEnd = parseCatalogUtc(row && row.dataEndTime);

        var segments = [
            {
                key: "mission",
                label: "Mission Timeline (config/events JSON)",
                color: "#7cb3ff",
                startDate: missionWindow.startDate,
                endDate: missionWindow.endDate
            },
            {
                key: "horizons",
                label: "HORIZONS Availability (metadata JSON)",
                color: "#8dcf8d",
                startDate: horizonsStart,
                endDate: horizonsEnd
            },
            {
                key: "coverage",
                label: "Animation Coverage (config JSON)",
                color: "#f4b55f",
                startDate: coverageStart,
                endDate: coverageEnd
            }
        ];

        var allDates = [];
        segments.forEach(function(segment) {
            if (segment.startDate) allDates.push(segment.startDate.getTime());
            if (segment.endDate) allDates.push(segment.endDate.getTime());
        });
        var domainMin = allDates.length ? Math.min.apply(null, allDates) : null;
        var domainMax = allDates.length ? Math.max.apply(null, allDates) : null;
        if (domainMin !== null && domainMax !== null && domainMax <= domainMin) {
            domainMax = domainMin + 1;
        }

        segments.forEach(function(segment) {
            segment.startLabel = segment.startDate ? formatUtcHuman(segment.startDate) : "Not available";
            segment.endLabel = segment.endDate ? formatUtcHuman(segment.endDate) : "Not available";
            segment.available = Boolean(segment.startDate && segment.endDate);
            if (!segment.available || domainMin === null || domainMax === null) {
                segment.leftPct = 0;
                segment.widthPct = 0;
                return;
            }
            var startMs = segment.startDate.getTime();
            var endMs = segment.endDate.getTime();
            if (endMs < startMs) {
                var tmp = startMs;
                startMs = endMs;
                endMs = tmp;
            }
            var left = ((startMs - domainMin) / (domainMax - domainMin)) * 100;
            var right = ((endMs - domainMin) / (domainMax - domainMin)) * 100;
            segment.leftPct = Math.max(0, Math.min(100, left));
            segment.widthPct = Math.max(1.2, Math.min(100 - segment.leftPct, right - left));
        });

        return segments;
    }

    function inferHorizonsRangeFromRawSections(meta) {
        var rawSections = meta && meta.raw_sections ? meta.raw_sections : {};
        var candidates = [
            rawSections["SPACECRAFT TRAJECTORY"],
            rawSections.TRAJECTORY
        ];
        var fromCandidates = candidates.filter(function(v) { return asTrimmedString(v); }).join("\n");
        var rawText = asTrimmedString(fromCandidates) || Object.keys(rawSections).map(function(key) {
            return asTrimmedString(rawSections[key]);
        }).filter(Boolean).join("\n");
        if (!rawText) return null;

        var dates = [];
        var fullTokenRegex = /(\d{4}[-\s][A-Za-z]{3,}[-\s]\d{1,2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/g;
        var fullMatch;
        while ((fullMatch = fullTokenRegex.exec(rawText)) !== null) {
            var dt = parseHorizonsDateTime(fullMatch[1]);
            if (dt) dates.push(dt);
        }

        var mixedRangeRegex = /(\d{4}-[A-Za-z]{3,}-\d{1,2}\s+\d{2}:\d{2}(?::\d{2})?)\s+to\s+([A-Za-z]{3,}\s+\d{1,2}\s*@?\s*\d{2}:\d{2}(?::\d{2})?)/gi;
        var mixedMatch;
        while ((mixedMatch = mixedRangeRegex.exec(rawText)) !== null) {
            var start = parseHorizonsDateTime(mixedMatch[1]);
            if (start) {
                dates.push(start);
                var end = parseHorizonsDateWithFallbackYear(mixedMatch[2], start.getUTCFullYear());
                if (end) dates.push(end);
            }
        }

        if (!dates.length) return null;
        dates.sort(function(a, b) { return a.getTime() - b.getTime(); });
        return {
            startDate: dates[0],
            endDate: dates[dates.length - 1]
        };
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

        var missionEndDate =
            findFirstMatchingEventDate(events, function(eventKey, eventDef) {
                var keyText = normalizeKey(eventKey);
                var labelText = normalizeKey(eventDef.label);
                return keyText === "missionend" || labelText.indexOf("mission end") >= 0;
            }) ||
            findFirstMatchingEventDate(events, function(eventKey, eventDef) {
                var keyText = normalizeKey(eventKey);
                var labelText = normalizeKey(eventDef.label);
                return keyText === "dataend" || labelText.indexOf("data end") >= 0;
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
            missionEndDate: missionEndDate,
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
                    missionEndTime: formatUtcDateTime(timing.missionEndDate),
                    dataStartTime: formatUtcDateTime(timing.dataStart),
                    dataEndTime: formatUtcDateTime(timing.dataEnd),
                    launchSortKey: timing.launchDate ? timing.launchDate.getTime() : -Infinity,
                    tliSortKey: timing.tliDate ? timing.tliDate.getTime() : -Infinity,
                    loiSortKey: timing.loiDate ? timing.loiDate.getTime() : -Infinity,
                    landingSortKey: timing.landingDate ? timing.landingDate.getTime() : -Infinity,
                    missionEndSortKey: timing.missionEndDate ? timing.missionEndDate.getTime() : -Infinity,
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
        var folder = normalizeKey(entry.folder);

        return {
            index: index,
            entry: entry,
            href: "mission.html?mission=" + encodeURIComponent(entry.queryValue || entry.folder),
            folder: folder,
            horizonsMetadataFile: HORIZONS_METADATA_BY_FOLDER[folder] || "",
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
            missionEndTime: "N/A",
            dataStartTime: "N/A",
            dataEndTime: "N/A",
            launchSortKey: -Infinity,
            tliSortKey: -Infinity,
            loiSortKey: -Infinity,
            landingSortKey: -Infinity,
            missionEndSortKey: -Infinity,
            dataStartSortKey: -Infinity,
            dataEndSortKey: -Infinity,
            accent: entry.card.accent || "#4a90d9"
        };
    }

    function fetchMissionBriefTextMap() {
        if (missionBriefTextPromise) return missionBriefTextPromise;
        missionBriefTextPromise = fetch("assets/mission-briefs.json", { cache: "no-store" })
            .then(function(response) {
                if (!response.ok) throw new Error("mission briefs missing");
                return response.json();
            })
            .catch(function() {
                missionBriefTextPromise = null;
                return {};
            });
        return missionBriefTextPromise;
    }

    function fetchMissionImageMap() {
        if (missionImageTextPromise) return missionImageTextPromise;
        missionImageTextPromise = fetch("assets/mission-images.json", { cache: "no-store" })
            .then(function(response) {
                if (!response.ok) throw new Error("mission images missing");
                return response.json();
            })
            .catch(function() {
                missionImageTextPromise = null;
                return {};
            });
        return missionImageTextPromise;
    }

    function getAuthoredBriefEntry(briefTextMap, row) {
        if (!briefTextMap || typeof briefTextMap !== "object") return null;
        var folder = normalizeKey(row && row.folder);
        if (!folder) return null;
        return briefTextMap[folder] || null;
    }

    function getAuthoredImageEntries(imageMap, row) {
        if (!imageMap || typeof imageMap !== "object") return null;
        var folder = normalizeKey(row && row.folder);
        if (!folder) return null;
        return imageMap[folder] || null;
    }

    function normalizeBriefImages(images, row) {
        if (!Array.isArray(images)) return [];
        var title = asTrimmedString(row && row.title) || "Mission";
        return images
            .filter(function(image) {
                return image && typeof image === "object" && asTrimmedString(image.url);
            })
            .map(function(image) {
                return {
                    url: asTrimmedString(image.url),
                    attribution: asTrimmedString(image.attribution) || "Wikimedia Commons contributors",
                    license: asTrimmedString(image.license) || "",
                    sourceUrl: asTrimmedString(image.sourceUrl),
                    caption: asTrimmedString(image.caption),
                    alt: asTrimmedString(image.alt) || (title + " image")
                };
            });
    }

    function buildBriefFromMetadata(row, meta, authoredEntry, authoredImages) {
        var summary = pickSummaryFromMetadata(meta, row.description);
        var authored = authoredEntry && typeof authoredEntry === "object" ? authoredEntry : {};
        var title = asTrimmedString(row && row.title) || "Mission";
        var missionText = asTrimmedString(authored.mission) || asTrimmedString(authored.missionStory) || (title + " mission details will be added.");
        var horizonsData = asTrimmedString(authored.horizonsData) || asTrimmedString(authored.horizonsScope) || "HORIZONS object coverage details for this mission entry will be added.";
        var timelinesNote = asTrimmedString(authored.timelines) || asTrimmedString(authored.missionTimeline) || "The timeline bars compare mission timeline, HORIZONS availability, and animation coverage.";
        var images = normalizeBriefImages(authoredImages || DEFAULT_BRIEF_IMAGES_BY_FOLDER[row.folder] || [], row);
        return {
            mission: missionText,
            horizonsData: horizonsData,
            timelines: timelinesNote,
            timelineSegments: buildTimelineSegments(row, meta),
            summary: summary,
            images: images,
            image: images[0] || null,
            sourceUrl: "docs/horizons-blurbs/metadata/" + row.horizonsMetadataFile + ".json",
            sourceLabel: "HORIZONS metadata"
        };
    }

    function buildFallbackBrief(row, authoredEntry, authoredImages) {
        var summary = ensureTrailingPeriod(row.description || "Mission timeline.");
        var authored = authoredEntry && typeof authoredEntry === "object" ? authoredEntry : {};
        var title = asTrimmedString(row && row.title) || "Mission";
        var missionText = asTrimmedString(authored.mission) || asTrimmedString(authored.missionStory) || (title + " mission details will be added.");
        var horizonsData = asTrimmedString(authored.horizonsData) || asTrimmedString(authored.horizonsScope) || "HORIZONS object coverage details for this mission entry will be added.";
        var timelinesNote = asTrimmedString(authored.timelines) || asTrimmedString(authored.missionTimeline) || "The timeline bars compare mission timeline, HORIZONS availability, and animation coverage.";
        var images = normalizeBriefImages(authoredImages || DEFAULT_BRIEF_IMAGES_BY_FOLDER[row.folder] || [], row);
        return {
            mission: missionText,
            horizonsData: horizonsData,
            timelines: timelinesNote,
            timelineSegments: buildTimelineSegments(row, null),
            summary: summary,
            images: images,
            image: images[0] || null,
            sourceUrl: "",
            sourceLabel: "Mission catalog"
        };
    }

    function fetchMissionBrief(row) {
        var key = row.folder || row.title;
        if (missionBriefCache.has(key)) {
            return Promise.resolve(missionBriefCache.get(key));
        }

        return Promise.all([fetchMissionBriefTextMap(), fetchMissionImageMap()]).then(function(results) {
            var briefTextMap = results[0];
            var imageMap = results[1];
            var authoredEntry = getAuthoredBriefEntry(briefTextMap, row);
            var authoredImages = getAuthoredImageEntries(imageMap, row);
            if (!row.horizonsMetadataFile) {
                var fallback = buildFallbackBrief(row, authoredEntry, authoredImages);
                missionBriefCache.set(key, fallback);
                return fallback;
            }

            var metadataUrl = "docs/horizons-blurbs/metadata/" + row.horizonsMetadataFile + ".json";
            return fetch(metadataUrl, { cache: "no-store" })
                .then(function(response) {
                    if (!response.ok) throw new Error("metadata missing");
                    return response.json();
                })
                .then(function(meta) {
                    var brief = buildBriefFromMetadata(row, meta, authoredEntry, authoredImages);
                    missionBriefCache.set(key, brief);
                    return brief;
                })
                .catch(function() {
                    var fallback = buildFallbackBrief(row, authoredEntry, authoredImages);
                    missionBriefCache.set(key, fallback);
                    return fallback;
                });
        });
    }

    function fetchOrbitPreviewData(row) {
        var key = row.folder || row.title;
        if (orbitPreviewCache.has(key)) {
            return Promise.resolve(orbitPreviewCache.get(key));
        }

        var folder = normalizeKey(row && (row.folder || (row.entry && row.entry.folder)));
        if (!folder) {
            orbitPreviewCache.set(key, null);
            return Promise.resolve(null);
        }

        var configUrl = "assets/" + folder + "/data/config.json";
        return fetch(configUrl, { cache: "no-store" })
            .then(function(response) {
                if (!response.ok) throw new Error("config unavailable");
                return response.json();
            })
            .then(function(config) {
                var geoBase = asTrimmedString(config && config.geo && config.geo.orbits_file);
                if (!geoBase) throw new Error("geo orbit file missing");
                var chebUrl = "assets/" + folder + "/data/" + geoBase + "-cheb.json";
                return fetch(chebUrl, { cache: "no-store" })
                    .then(function(response) {
                        if (!response.ok) throw new Error("Chebyshev unavailable");
                        return response.json();
                    })
                    .then(function(chebData) {
                        var scSeries = chebData && chebData.SC;
                        var moonSeries = chebData && chebData.MOON;
                        if (!scSeries || !moonSeries) {
                            throw new Error("Required SC/MOON series missing");
                        }

                        var rangeStart = Number(chebData.time_range && chebData.time_range.start);
                        var rangeEnd = Number(chebData.time_range && chebData.time_range.end);
                        if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) {
                            throw new Error("Invalid Chebyshev time range");
                        }

                        var scPoints = [];
                        var moonPoints = [];
                        var jdPoints = [];
                        var moonDistances = [];

                        // First pass: robust Earth-Moon scale estimate from coarse MOON-only sampling.
                        var coarseCount = 512;
                        for (var c = 0; c < coarseCount; c += 1) {
                            var coarseT = rangeStart + ((rangeEnd - rangeStart) * c) / (coarseCount - 1);
                            var coarseMoonPos = getChebPosition(moonSeries, coarseT);
                            if (coarseMoonPos) {
                                moonDistances.push(Math.hypot(coarseMoonPos.x, coarseMoonPos.y));
                            }
                        }

                        if (!moonDistances.length) {
                            throw new Error("Insufficient sampled points");
                        }

                        var sum = moonDistances.reduce(function(acc, value) { return acc + value; }, 0);
                        var meanMoonDistance = sum / moonDistances.length;
                        var durationSeconds = Math.max(1, Math.round((rangeEnd - rangeStart) * 86400));
                        var minStepSeconds = 30;
                        var maxStepSeconds = 480;
                        var earlyWindowSeconds = Math.min(durationSeconds, 7 * 86400);
                        var maxSamples = 45000;

                        // Second pass: adaptive time-step sampling to preserve tight early orbits
                        // while keeping point count manageable over full-mission spans.
                        var t = rangeStart;
                        var guard = 0;
                        while (t <= rangeEnd && guard < maxSamples) {
                            var scPos = getChebPosition(scSeries, t);
                            var moonPos = getChebPosition(moonSeries, t);
                            if (scPos && moonPos) {
                                scPoints.push(scPos);
                                moonPoints.push(moonPos);
                                jdPoints.push(t);
                            }

                            var elapsedSeconds = Math.max(0, (t - rangeStart) * 86400);
                            var scDistance = scPos ? Math.hypot(scPos.x, scPos.y) : meanMoonDistance;
                            var radiusRatio = scDistance / Math.max(1, meanMoonDistance);
                            radiusRatio = Math.max(0.015, Math.min(2.5, radiusRatio));
                            var nearEarthScale = Math.pow(Math.min(1, radiusRatio), 1.25);
                            var earlyProgress = earlyWindowSeconds > 0 ? Math.min(1, elapsedSeconds / earlyWindowSeconds) : 1;
                            var earlyStep = minStepSeconds + (150 - minStepSeconds) * nearEarthScale;
                            var lateStep = 180 + (maxStepSeconds - 180) * Math.min(1, radiusRatio);
                            var adaptiveStepSeconds = earlyStep * (1 - earlyProgress) + lateStep * earlyProgress;
                            adaptiveStepSeconds = Math.max(minStepSeconds, Math.min(maxStepSeconds, adaptiveStepSeconds));

                            var nextT = t + adaptiveStepSeconds / 86400;
                            if (!(nextT > t)) {
                                nextT = t + minStepSeconds / 86400;
                            }
                            t = nextT;
                            guard += 1;
                        }

                        if (jdPoints.length && jdPoints[jdPoints.length - 1] < rangeEnd) {
                            var scEnd = getChebPosition(scSeries, rangeEnd);
                            var moonEnd = getChebPosition(moonSeries, rangeEnd);
                            if (scEnd && moonEnd) {
                                scPoints.push(scEnd);
                                moonPoints.push(moonEnd);
                                jdPoints.push(rangeEnd);
                            }
                        }

                        if (!scPoints.length || !moonPoints.length || !jdPoints.length) {
                            throw new Error("Insufficient sampled points");
                        }

                        var halfSideKm = 1.3 * meanMoonDistance; // side = 2.6 * Earth-Moon radius

                        var payload = {
                            scPoints: scPoints,
                            moonPoints: moonPoints,
                            jdPoints: jdPoints,
                            halfSideKm: halfSideKm,
                            rangeStartJd: rangeStart,
                            rangeEndJd: rangeEnd
                        };
                        orbitPreviewCache.set(key, payload);
                        return payload;
                    });
            })
            .catch(function() {
                orbitPreviewCache.set(key, null);
                return null;
            });
    }

    function createLaunchButton(row, label) {
        var launch = document.createElement("a");
        launch.className = "landing-card__btn landing-card__btn--launch";
        launch.href = row.href;
        launch.textContent = label || "Launch";
        launch.title = "Open animation for " + row.title;
        return launch;
    }

    function createCard(row, onOpenBrief) {
        var card = document.createElement("article");
        card.className = "landing-card";
        card.style.borderColor = row.accent + "66";
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-label", "Open brief for " + row.title);
        card.addEventListener("click", function() {
            onOpenBrief(row);
        });
        card.addEventListener("keydown", function(event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenBrief(row);
            }
        });

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

        var actions = document.createElement("div");
        actions.className = "landing-card__actions";
        var briefBtn = document.createElement("button");
        briefBtn.type = "button";
        briefBtn.className = "landing-card__btn";
        briefBtn.textContent = "Brief";
        briefBtn.addEventListener("click", function(event) {
            event.preventDefault();
            event.stopPropagation();
            onOpenBrief(row);
        });
        var launchBtn = createLaunchButton(row, "Launch");
        launchBtn.addEventListener("click", function(event) {
            event.stopPropagation();
        });
        actions.appendChild(briefBtn);
        actions.appendChild(launchBtn);

        card.appendChild(t);
        card.appendChild(m);
        card.appendChild(d);
        card.appendChild(actions);
        return card;
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
        var briefOverlay = document.getElementById("landing-brief-overlay");
        var briefPanel = document.getElementById("landing-brief-panel");

        var currentView = "default";
        var missionRows = [];
        var defaultSortFieldValue = sortField ? sortField.value : "title";
        var defaultSortOrderValue = sortOrder ? sortOrder.value : "asc";
        var activeBriefRow = null;
        var activeBriefIndex = -1;
        var activeBriefSequence = [];
        var activeBriefRequestId = 0;
        var stopBriefOrbitAnimation = null;

        function rowIdentity(row) {
            return normalizeKey(
                (row && row.folder) ||
                (row && row.entry && row.entry.folder) ||
                (row && row.entry && row.entry.key) ||
                (row && row.title) ||
                ""
            );
        }

        function getBriefSequence() {
            return (missionRows || []).slice().sort(function(a, b) {
                return (a.index || 0) - (b.index || 0);
            });
        }

        function findBriefIndex(sequence, row) {
            if (!Array.isArray(sequence) || !sequence.length || !row) return -1;
            var id = rowIdentity(row);
            if (!id) return -1;
            for (var i = 0; i < sequence.length; i += 1) {
                if (rowIdentity(sequence[i]) === id) return i;
            }
            return -1;
        }

        function renderTimelineSegmentsHtml(segments) {
            if (!Array.isArray(segments) || !segments.length) return "";
            var html = "";
            html += "<div class=\"landing-brief-timeline-block\">";
            segments.forEach(function(segment) {
                var leftPct = Number.isFinite(segment.leftPct) ? segment.leftPct : 0;
                var widthPct = Number.isFinite(segment.widthPct) ? segment.widthPct : 0;
                html += "<div class=\"landing-brief-timeline-row\">";
                html += "<div class=\"landing-brief-timeline-head\">";
                html += "<span class=\"landing-brief-timeline-label\">" + escapeHtml(segment.label || "Timeline") + "</span>";
                html += "<span class=\"landing-brief-timeline-range\">" + escapeHtml((segment.startLabel || "N/A") + " → " + (segment.endLabel || "N/A")) + "</span>";
                html += "</div>";
                html += "<div class=\"landing-brief-timeline-bar" + (segment.available ? "" : " is-unavailable") + "\">";
                if (segment.available) {
                    html += "<span class=\"landing-brief-timeline-segment\" style=\"left:" + leftPct.toFixed(3) + "%;width:" + widthPct.toFixed(3) + "%;background:" + escapeHtml(segment.color || "#7cb3ff") + ";\"></span>";
                }
                html += "</div>";
                html += "</div>";
            });
            html += "</div>";
            return html;
        }

        function renderInlineRichText(text) {
            var escaped = escapeHtml(text || "");
            escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
            escaped = escaped.replace(/\[([^\]]+)\]\(((?:https?:\/\/|(?:\.{1,2}\/)?docs\/)[^\s)]+)\)/g, function(_, label, url) {
                return "<a href=\"" + escapeHtml(url) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + label + "</a>";
            });
            escaped = escaped.replace(/(^|[\s(])((?:https?:\/\/|(?:\.{1,2}\/)?docs\/)[^\s)]+)/g, function(_, prefix, url) {
                return prefix + "<a href=\"" + escapeHtml(url) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + escapeHtml(url) + "</a>";
            });
            return escaped;
        }

        function renderRichBlocks(text) {
            var raw = asTrimmedString(text);
            if (!raw) return "";
            var lines = raw.replace(/\r/g, "").split("\n");
            var html = "";
            var para = [];
            var listItems = [];

            function flushPara() {
                if (!para.length) return;
                html += "<p class=\"landing-brief-summary\">" + renderInlineRichText(para.join(" ")) + "</p>";
                para = [];
            }

            function flushList() {
                if (!listItems.length) return;
                html += "<ul class=\"landing-brief-list\">";
                for (var i = 0; i < listItems.length; i += 1) {
                    html += "<li>" + renderInlineRichText(listItems[i]) + "</li>";
                }
                html += "</ul>";
                listItems = [];
            }

            for (var i = 0; i < lines.length; i += 1) {
                var line = asTrimmedString(lines[i]);
                if (!line) {
                    flushPara();
                    flushList();
                    continue;
                }
                if (/^[-*]\s+/.test(line)) {
                    flushPara();
                    listItems.push(line.replace(/^[-*]\s+/, ""));
                    continue;
                }
                flushList();
                para.push(line);
            }
            flushPara();
            flushList();

            if (!html) {
                html = "<p class=\"landing-brief-summary\">" + renderInlineRichText(raw) + "</p>";
            }
            return html;
        }

        function buildBriefImageCarouselHtml(images, safeTitle) {
            if (!Array.isArray(images) || !images.length) {
                return "<p class=\"landing-brief-attribution\">CC BY-SA craft image not mapped yet for this mission.</p>";
            }
            var firstImage = images[0];
            var showControls = images.length > 1;
            var html = "";
            html += "<div class=\"landing-brief-carousel\" data-brief-carousel>";
            html += "<figure class=\"landing-brief-hero\">";
            html += "<img data-brief-carousel-image src=\"" + escapeHtml(firstImage.url) + "\" alt=\"" + escapeHtml(firstImage.alt || (safeTitle + " image")) + "\">";
            html += "</figure>";
            if (showControls) {
                html += "<div class=\"landing-brief-carousel-controls\">";
                html += "<button type=\"button\" class=\"landing-brief-carousel-btn\" data-brief-image-nav=\"-1\" aria-label=\"Previous image\">←</button>";
                html += "<span class=\"landing-brief-carousel-counter\" data-brief-image-counter>1 / " + images.length + "</span>";
                html += "<button type=\"button\" class=\"landing-brief-carousel-btn\" data-brief-image-nav=\"1\" aria-label=\"Next image\">→</button>";
                html += "</div>";
            }
            html += "<p class=\"landing-brief-summary landing-brief-summary--compact\" data-brief-image-caption>";
            html += escapeHtml(asTrimmedString(firstImage.caption) || "CC BY-SA mission image.");
            html += "</p>";
            html += "<p class=\"landing-brief-attribution\" data-brief-image-attribution></p>";
            html += "</div>";
            return html;
        }

        function buildBriefPanelContent(row, brief, currentIndex, totalCount) {
            var images = brief && Array.isArray(brief.images) ? brief.images : [];
            var missionText = asTrimmedString(brief && (brief.mission || brief.missionStory || brief.summary));
            var horizonsDataText = asTrimmedString(brief && (brief.horizonsData || brief.horizonsScope));
            var timelinesText = asTrimmedString(brief && (brief.timelines || brief.missionTimeline));
            var timelineSegments = brief && Array.isArray(brief.timelineSegments) ? brief.timelineSegments : [];
            var rawTitle = asTrimmedString(row.title);
            var safeTitle = escapeHtml(rawTitle);
            var safeCountry = escapeHtml(row.country);
            var safeRange = escapeHtml(row.rangeLabel);
            var safeCounter = (Number.isFinite(currentIndex) ? (currentIndex + 1) : 1) + " / " + (totalCount || 1);
            var html = "";
            html += "<div class=\"landing-brief-header\">";
            html += "<div class=\"landing-brief-header-left\">";
            html += "<h2 class=\"landing-brief-title\">" + safeTitle + "</h2>";
            html += "<p class=\"landing-brief-meta\">" + (flagForCountry(row.country) ? (flagForCountry(row.country) + " ") : "") + safeCountry + " • " + safeRange + "</p>";
            html += "</div>";
            html += "<div class=\"landing-brief-header-right\">";
            html += "<span class=\"landing-brief-counter\">" + escapeHtml(safeCounter) + "</span>";
            html += "<div class=\"landing-brief-nav\">";
            html += "<button type=\"button\" class=\"landing-brief-nav-btn\" data-brief-nav=\"-1\" aria-label=\"Previous mission\">← Prev</button>";
            html += "<button type=\"button\" class=\"landing-brief-nav-btn\" data-brief-nav=\"1\" aria-label=\"Next mission\">Next →</button>";
            html += "</div>";
            html += "<button type=\"button\" class=\"landing-brief-close\" id=\"landing-brief-close\" aria-label=\"Close brief\">×</button>";
            html += "</div>";
            html += "</div>";

            html += "<div class=\"landing-brief-body\">";
            html += "<section class=\"landing-brief-col landing-brief-col--text\">";

            html += "<p class=\"landing-brief-section-title\">Mission</p>";
            html += renderRichBlocks(missionText || ensureTrailingPeriod(row.description));
            html += "<p class=\"landing-brief-section-title\">HORIZONS Data</p>";
            html += renderRichBlocks(horizonsDataText || "HORIZONS object coverage details are being curated.");
            html += "<p class=\"landing-brief-section-title\">Timelines</p>";
            html += renderRichBlocks(timelinesText || "The timeline bars below show mission, HORIZONS, and animation coverage ranges.");
            html += renderTimelineSegmentsHtml(timelineSegments);

            html += "<p class=\"landing-brief-source\">Source: " + escapeHtml(brief.sourceLabel || "Mission metadata");
            if (asTrimmedString(brief.sourceUrl)) {
                html += " • <a href=\"" + escapeHtml(brief.sourceUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + escapeHtml(brief.sourceUrl) + "</a>";
            }
            html += "</p>";
            html += "</section>";

            html += "<section class=\"landing-brief-col landing-brief-col--viz\">";
            html += "<p class=\"landing-brief-section-title\">Orbit Preview (Pilot)</p>";
            html += "<div id=\"landing-brief-orbit-anim\" class=\"landing-brief-orbit-anim\">Loading 2D XY transfer preview...</div>";
            html += "<p class=\"landing-brief-section-title\">Images</p>";
            html += buildBriefImageCarouselHtml(images, rawTitle);
            html += "</section>";
            html += "</div>";

            html += "<div class=\"landing-brief-actions\">";
            html += "<div class=\"landing-brief-actions-left\">";
            html += "<button type=\"button\" class=\"landing-card__btn landing-brief-nav-btn\" data-brief-nav=\"-1\">← Prev</button>";
            html += "<button type=\"button\" class=\"landing-card__btn landing-brief-nav-btn\" data-brief-nav=\"1\">Next →</button>";
            html += "</div>";
            html += "<div class=\"landing-brief-actions-right\">";
            html += "<button type=\"button\" class=\"landing-card__btn\" id=\"landing-brief-close-footer\">Close</button>";
            html += "<a class=\"landing-card__btn landing-card__btn--launch\" href=\"" + escapeHtml(row.href) + "\">Launch Animation</a>";
            html += "</div>";
            html += "</div>";
            return html;
        }

        function mountBriefImageCarousel(images) {
            var carousel = briefPanel ? briefPanel.querySelector("[data-brief-carousel]") : null;
            if (!carousel || !Array.isArray(images) || !images.length) return;

            var imageEl = carousel.querySelector("[data-brief-carousel-image]");
            var captionEl = carousel.querySelector("[data-brief-image-caption]");
            var attributionEl = carousel.querySelector("[data-brief-image-attribution]");
            var counterEl = carousel.querySelector("[data-brief-image-counter]");
            var navButtons = Array.from(carousel.querySelectorAll("[data-brief-image-nav]"));
            var activeIndex = 0;

            function renderAttribution(image) {
                var html = "Image: " + escapeHtml(asTrimmedString(image.attribution) || "Wikimedia Commons contributors");
                if (asTrimmedString(image.license)) {
                    html += " • " + escapeHtml(image.license);
                }
                if (asTrimmedString(image.sourceUrl)) {
                    html += " • <a href=\"" + escapeHtml(image.sourceUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">Source</a>";
                }
                if (asTrimmedString(image.kind)) {
                    html += " • " + escapeHtml(image.kind);
                }
                return html;
            }

            function updateImage(nextIndex) {
                var image = images[nextIndex];
                if (!image || !imageEl || !captionEl || !attributionEl) return;
                activeIndex = nextIndex;
                imageEl.src = image.url;
                imageEl.alt = image.alt || "Mission image";
                captionEl.textContent = asTrimmedString(image.caption) || "CC BY-SA mission image.";
                attributionEl.innerHTML = renderAttribution(image);
                if (counterEl) {
                    counterEl.textContent = (activeIndex + 1) + " / " + images.length;
                }
            }

            navButtons.forEach(function(button) {
                button.addEventListener("click", function() {
                    var delta = parseInt(button.getAttribute("data-brief-image-nav"), 10);
                    if (delta !== -1 && delta !== 1) return;
                    updateImage((activeIndex + delta + images.length) % images.length);
                });
            });

            updateImage(0);
        }

        function mountBriefOrbitAnimation(row) {
            if (typeof stopBriefOrbitAnimation === "function") {
                stopBriefOrbitAnimation();
                stopBriefOrbitAnimation = null;
            }
            var host = document.getElementById("landing-brief-orbit-anim");
            if (!host) return;

            fetchOrbitPreviewData(row).then(function(preview) {
                if (!preview || !host.isConnected) {
                    if (host.isConnected) {
                        host.textContent = "Preview unavailable for this mission.";
                    }
                    return;
                }

                var size = 308;
                var center = size / 2;
                var halfSideKm = preview.halfSideKm;
                var earthRadiusKm = 6371;
                var moonRadiusKm = 1737.4;

                function toSvgXY(point) {
                    var x = center + (point.x / halfSideKm) * center;
                    var y = center - (point.y / halfSideKm) * center;
                    return { x: x, y: y };
                }

                var scPx = preview.scPoints.map(toSvgXY);
                var moonPx = preview.moonPoints.map(toSvgXY);
                var jdPoints = Array.isArray(preview.jdPoints) ? preview.jdPoints : null;
                var moonPathStr = moonPx.map(function(p) { return p.x.toFixed(2) + "," + p.y.toFixed(2); }).join(" ");
                var scPathStr = scPx.map(function(p) { return p.x.toFixed(2) + "," + p.y.toFixed(2); }).join(" ");
                var earthRadiusPx = Math.max(3, (earthRadiusKm / halfSideKm) * center);
                var moonRadiusPx = Math.max(4, (moonRadiusKm / halfSideKm) * center);

                host.innerHTML = "";
                var ns = "http://www.w3.org/2000/svg";
                var svg = document.createElementNS(ns, "svg");
                svg.setAttribute("viewBox", "0 0 " + size + " " + size);
                svg.setAttribute("width", String(size));
                svg.setAttribute("height", String(size));
                svg.setAttribute("aria-label", "Earth to Moon transfer XY preview");

                var bg = document.createElementNS(ns, "rect");
                bg.setAttribute("x", "0");
                bg.setAttribute("y", "0");
                bg.setAttribute("width", String(size));
                bg.setAttribute("height", String(size));
                bg.setAttribute("fill", "#090f1f");
                svg.appendChild(bg);

                var grid = document.createElementNS(ns, "g");
                grid.setAttribute("stroke", "#243657");
                grid.setAttribute("stroke-opacity", "0.5");
                grid.setAttribute("stroke-width", "0.7");
                [0.25, 0.5, 0.75].forEach(function(frac) {
                    var p = size * frac;
                    var v = document.createElementNS(ns, "line");
                    v.setAttribute("x1", p.toFixed(1));
                    v.setAttribute("y1", "0");
                    v.setAttribute("x2", p.toFixed(1));
                    v.setAttribute("y2", String(size));
                    grid.appendChild(v);
                    var h = document.createElementNS(ns, "line");
                    h.setAttribute("x1", "0");
                    h.setAttribute("y1", p.toFixed(1));
                    h.setAttribute("x2", String(size));
                    h.setAttribute("y2", p.toFixed(1));
                    grid.appendChild(h);
                });
                svg.appendChild(grid);

                var moonTrack = document.createElementNS(ns, "polyline");
                moonTrack.setAttribute("points", moonPathStr);
                moonTrack.setAttribute("fill", "none");
                moonTrack.setAttribute("stroke", "#7ea0cf");
                moonTrack.setAttribute("stroke-width", "1.2");
                moonTrack.setAttribute("stroke-dasharray", "4 4");
                moonTrack.setAttribute("stroke-opacity", "0.9");
                svg.appendChild(moonTrack);

                var scTrack = document.createElementNS(ns, "polyline");
                scTrack.setAttribute("points", scPathStr);
                scTrack.setAttribute("fill", "none");
                scTrack.setAttribute("stroke", "#f8b84b");
                scTrack.setAttribute("stroke-width", "1.3");
                scTrack.setAttribute("stroke-opacity", "0.28");
                svg.appendChild(scTrack);

                var scTrail = document.createElementNS(ns, "polyline");
                scTrail.setAttribute("fill", "none");
                scTrail.setAttribute("stroke", "#f8b84b");
                scTrail.setAttribute("stroke-width", "2.1");
                scTrail.setAttribute("stroke-linecap", "round");
                scTrail.setAttribute("stroke-linejoin", "round");
                svg.appendChild(scTrail);
                var scHeadTrail = document.createElementNS(ns, "polyline");
                scHeadTrail.setAttribute("fill", "none");
                scHeadTrail.setAttribute("stroke", "#ffd67a");
                scHeadTrail.setAttribute("stroke-width", "2.6");
                scHeadTrail.setAttribute("stroke-linecap", "round");
                scHeadTrail.setAttribute("stroke-linejoin", "round");
                svg.appendChild(scHeadTrail);

                var earth = document.createElementNS(ns, "circle");
                earth.setAttribute("cx", center.toFixed(2));
                earth.setAttribute("cy", center.toFixed(2));
                earth.setAttribute("r", earthRadiusPx.toFixed(2));
                earth.setAttribute("fill", "#4ea1ff");
                earth.setAttribute("stroke", "#9aceff");
                earth.setAttribute("stroke-width", "1");
                svg.appendChild(earth);

                var moon = document.createElementNS(ns, "circle");
                moon.setAttribute("r", moonRadiusPx.toFixed(2));
                moon.setAttribute("fill", "#cfd9ea");
                moon.setAttribute("stroke", "#f4f8ff");
                moon.setAttribute("stroke-width", "0.6");
                svg.appendChild(moon);

                var craft = document.createElementNS(ns, "circle");
                craft.setAttribute("r", "4");
                craft.setAttribute("fill", "#ffce64");
                craft.setAttribute("stroke", "#ffeec2");
                craft.setAttribute("stroke-width", "0.6");
                svg.appendChild(craft);

                host.appendChild(svg);
                var timeLabel = document.createElement("div");
                timeLabel.className = "landing-brief-orbit-time";
                host.appendChild(timeLabel);
                var timeline = document.createElement("div");
                timeline.className = "landing-brief-orbit-timeline";
                var timelineTrack = document.createElement("div");
                timelineTrack.className = "landing-brief-orbit-track";
                var timelineFill = document.createElement("div");
                timelineFill.className = "landing-brief-orbit-fill";
                var timelineThumb = document.createElement("div");
                timelineThumb.className = "landing-brief-orbit-thumb";
                timelineTrack.appendChild(timelineFill);
                timelineTrack.appendChild(timelineThumb);
                timeline.appendChild(timelineTrack);
                host.appendChild(timeline);

                var durationMs = Math.max(15000, Math.min(32000, Math.round(scPx.length * 0.95)));
                var gapDurationMs = 3000;
                var cycleDurationMs = durationMs + gapDurationMs;
                var startTs = Date.now();
                var timerId = 0;
                var tailWindow = Math.max(110, Math.min(720, Math.floor(scPx.length / 80)));
                var headWindow = Math.max(26, Math.min(130, Math.floor(tailWindow / 4)));

                function tick() {
                    var elapsed = (Date.now() - startTs) % cycleDurationMs;
                    var inActivePass = elapsed < durationMs;
                    var progress = inActivePass ? (elapsed / durationMs) : 1;
                    var idx = Math.min(scPx.length - 1, Math.floor(progress * (scPx.length - 1)));
                    var moonIdx = Math.min(moonPx.length - 1, idx);
                    var visualOpacity = 1;

                    if (inActivePass) {
                        var tailStart = Math.max(0, idx - tailWindow);
                        var pathPoints = scPx.slice(tailStart, idx + 1).map(function(p) {
                            return p.x.toFixed(2) + "," + p.y.toFixed(2);
                        }).join(" ");
                        scTrail.setAttribute("points", pathPoints);
                        var headStart = Math.max(0, idx - headWindow);
                        var headPoints = scPx.slice(headStart, idx + 1).map(function(p) {
                            return p.x.toFixed(2) + "," + p.y.toFixed(2);
                        }).join(" ");
                        scHeadTrail.setAttribute("points", headPoints);
                        craft.setAttribute("cx", scPx[idx].x.toFixed(2));
                        craft.setAttribute("cy", scPx[idx].y.toFixed(2));
                    } else {
                        // Gap phase: full fade-out/fade-in over 3s, with hidden restart in the middle.
                        var gapPhase = (elapsed - durationMs) / Math.max(1, gapDurationMs);
                        if (gapPhase < 0.5) {
                            idx = scPx.length - 1;
                            moonIdx = moonPx.length - 1;
                            progress = 1;
                            visualOpacity = 1 - (gapPhase / 0.5);
                            craft.setAttribute("cx", scPx[idx].x.toFixed(2));
                            craft.setAttribute("cy", scPx[idx].y.toFixed(2));
                        } else {
                            idx = 0;
                            moonIdx = 0;
                            progress = 0;
                            visualOpacity = (gapPhase - 0.5) / 0.5;
                            craft.setAttribute("cx", scPx[idx].x.toFixed(2));
                            craft.setAttribute("cy", scPx[idx].y.toFixed(2));
                        }
                        scTrail.setAttribute("points", "");
                        scHeadTrail.setAttribute("points", "");
                    }

                    moon.setAttribute("cx", moonPx[moonIdx].x.toFixed(2));
                    moon.setAttribute("cy", moonPx[moonIdx].y.toFixed(2));
                    scTrail.setAttribute("stroke-opacity", "0.55");
                    scHeadTrail.setAttribute("stroke-opacity", "0.86");
                    craft.setAttribute("opacity", (0.78 + 0.22 * Math.sin((elapsed / durationMs) * Math.PI * 8)).toFixed(3));

                    var clampedOpacity = Math.max(0, Math.min(1, visualOpacity));
                    var opacityText = clampedOpacity.toFixed(3);
                    svg.style.opacity = opacityText;
                    timeLabel.style.opacity = opacityText;
                    timeline.style.opacity = opacityText;

                    var jd = jdPoints && Number.isFinite(jdPoints[idx])
                        ? jdPoints[idx]
                        : preview.rangeStartJd + ((preview.rangeEndJd - preview.rangeStartJd) * idx) / Math.max(1, scPx.length - 1);
                    timeLabel.textContent = formatPreviewDateTimeUtc(jd);
                    var pct = Math.max(0, Math.min(100, progress * 100));
                    timelineFill.style.width = pct.toFixed(2) + "%";
                    timelineThumb.style.left = pct.toFixed(2) + "%";
                }

                tick();
                timerId = setInterval(tick, 33);
                stopBriefOrbitAnimation = function() {
                    if (timerId) {
                        clearInterval(timerId);
                        timerId = 0;
                    }
                };
            });
        }

        function updateBriefQuery(row) {
            var params = new URLSearchParams(window.location.search);
            if (row) {
                params.set("panel", "brief");
                params.set("brief", row.folder || row.entry.folder || "");
            } else {
                params.delete("panel");
                params.delete("brief");
            }
            var nextQuery = params.toString();
            var nextUrl = window.location.pathname + (nextQuery ? ("?" + nextQuery) : "");
            window.history.replaceState({}, "", nextUrl);
        }

        function closeMissionBrief(options) {
            var opts = options || {};
            activeBriefRow = null;
            activeBriefIndex = -1;
            activeBriefSequence = [];
            if (typeof stopBriefOrbitAnimation === "function") {
                stopBriefOrbitAnimation();
                stopBriefOrbitAnimation = null;
            }
            if (briefPanel) {
                briefPanel.classList.remove("is-open");
                briefPanel.setAttribute("aria-hidden", "true");
            }
            if (briefOverlay) {
                briefOverlay.classList.remove("is-open");
                briefOverlay.setAttribute("aria-hidden", "true");
            }
            document.body.style.overflow = "";
            if (!opts.keepQuery) {
                updateBriefQuery(null);
            }
        }

        function navigateBrief(delta) {
            if (!Array.isArray(activeBriefSequence) || !activeBriefSequence.length || !Number.isFinite(activeBriefIndex)) return;
            var total = activeBriefSequence.length;
            var nextIndex = (activeBriefIndex + delta + total) % total;
            var nextRow = activeBriefSequence[nextIndex];
            if (!nextRow) return;
            openMissionBrief(nextRow, { sequence: activeBriefSequence, index: nextIndex });
        }

        function bindBriefControls() {
            var closeBtn = document.getElementById("landing-brief-close");
            if (closeBtn) {
                closeBtn.addEventListener("click", function() { closeMissionBrief(); });
            }
            var closeFooterBtn = document.getElementById("landing-brief-close-footer");
            if (closeFooterBtn) {
                closeFooterBtn.addEventListener("click", function() { closeMissionBrief(); });
            }
            var navButtons = briefPanel ? Array.from(briefPanel.querySelectorAll("[data-brief-nav]")) : [];
            navButtons.forEach(function(button) {
                button.addEventListener("click", function() {
                    var delta = parseInt(button.getAttribute("data-brief-nav"), 10);
                    if (delta === -1 || delta === 1) navigateBrief(delta);
                });
            });
        }

        function openMissionBrief(row, options) {
            var opts = options || {};
            if (!row || !briefPanel || !briefOverlay) return;
            var sequence = Array.isArray(opts.sequence) && opts.sequence.length ? opts.sequence : getBriefSequence();
            var nextIndex = Number.isFinite(opts.index) ? opts.index : findBriefIndex(sequence, row);
            if (nextIndex < 0 && sequence.length) nextIndex = 0;
            var resolvedRow = sequence[nextIndex] || row;

            activeBriefSequence = sequence;
            activeBriefIndex = nextIndex;
            activeBriefRow = resolvedRow;
            var requestId = activeBriefRequestId + 1;
            activeBriefRequestId = requestId;

            briefOverlay.classList.add("is-open");
            briefPanel.classList.add("is-open");
            briefOverlay.setAttribute("aria-hidden", "false");
            briefPanel.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
            updateBriefQuery(resolvedRow);

            briefPanel.innerHTML = "<p class=\"landing-brief-summary\">Loading mission brief...</p>";
            fetchMissionBrief(resolvedRow).then(function(brief) {
                if (requestId !== activeBriefRequestId) return;
                briefPanel.innerHTML = buildBriefPanelContent(resolvedRow, brief, activeBriefIndex, activeBriefSequence.length || 1);
                mountBriefImageCarousel(brief && Array.isArray(brief.images) ? brief.images : []);
                mountBriefOrbitAnimation(resolvedRow);
                bindBriefControls();
            });
        }

        if (briefOverlay) {
            briefOverlay.addEventListener("click", function() {
                closeMissionBrief();
            });
        }
        document.addEventListener("keydown", function(event) {
            if (event.key === "Escape") {
                closeMissionBrief();
                return;
            }
            if (!briefPanel || !briefPanel.classList.contains("is-open")) return;
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                navigateBrief(-1);
                return;
            }
            if (event.key === "ArrowRight") {
                event.preventDefault();
                navigateBrief(1);
            }
        });

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
                lane.rows.forEach(function(row) { grid.appendChild(createCard(row, openMissionBrief)); });
                laneNode.appendChild(grid);
                laneShell.appendChild(laneNode);
            });
            viewRoot.appendChild(laneShell);
        }

        function renderTiles(rows) {
            var grid = document.createElement("div");
            grid.className = "landing-grid";
            rows.forEach(function(row) { grid.appendChild(createCard(row, openMissionBrief)); });
            viewRoot.appendChild(grid);
        }

        function renderTable(rows) {
            function createTableActionButton(text, onClick, launchHref) {
                var el;
                if (launchHref) {
                    el = document.createElement("a");
                    el.href = launchHref;
                } else {
                    el = document.createElement("button");
                    el.type = "button";
                }
                el.className = "landing-table-action";
                el.textContent = text;
                if (onClick) {
                    el.addEventListener("click", onClick);
                }
                return el;
            }

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
                "Actions"
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
                tdLink.className = "landing-table-actions-cell";
                var briefBtn = createTableActionButton("Brief", function() {
                    openMissionBrief(row);
                });
                var openBtn = createTableActionButton("Launch", null, row.href);
                openBtn.title = "Open animation for " + row.title;
                tdLink.appendChild(briefBtn);
                tdLink.appendChild(openBtn);
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
                    var chip = document.createElement("button");
                    chip.className = "landing-timeline-chip";
                    chip.type = "button";
                    var timelineFlag = flagForCountry(row.country);
                    var timelineCraft = iconForCraftClass(row.craftClass);
                    chip.textContent =
                        (timelineFlag ? (timelineFlag + " ") : "") +
                        (timelineCraft ? (timelineCraft + " ") : "") +
                        row.title +
                        " • " +
                        row.country;
                    chip.addEventListener("click", function() {
                        openMissionBrief(row);
                    });
                    var chipWrap = document.createElement("div");
                    chipWrap.className = "landing-timeline-chip-wrap";
                    var chipLaunch = document.createElement("a");
                    chipLaunch.className = "landing-timeline-chip-launch";
                    chipLaunch.href = row.href;
                    chipLaunch.textContent = "Open";
                    chipLaunch.title = "Open animation for " + row.title;
                    chipWrap.appendChild(chip);
                    chipWrap.appendChild(chipLaunch);
                    list.appendChild(chipWrap);
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

        function openBriefFromQueryIfPresent() {
            var params = new URLSearchParams(window.location.search);
            if (params.get("panel") !== "brief") return;
            var briefKey = normalizeKey(params.get("brief"));
            if (!briefKey) return;
            var row = missionRows.find(function(item) {
                var folderKey = normalizeKey(item.folder || "");
                var key = normalizeKey(item.entry && item.entry.key);
                var aliases = Array.isArray(item.entry && item.entry.aliases) ? item.entry.aliases : [];
                return (
                    briefKey === folderKey ||
                    briefKey === key ||
                    aliases.some(function(alias) { return normalizeKey(alias) === briefKey; })
                );
            });
            if (row) {
                openMissionBrief(row);
            }
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
                openBriefFromQueryIfPresent();

                Promise.all(missionRows.map(hydrateRowWithConfigTiming))
                    .then(function(hydratedRows) {
                        missionRows = hydratedRows;
                        render();
                        if (activeBriefRow) {
                            openMissionBrief(activeBriefRow);
                        } else {
                            openBriefFromQueryIfPresent();
                        }
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
