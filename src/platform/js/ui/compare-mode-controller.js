import { isCompareRuntimeMode } from "../core/domain/runtime-mode.js";

function asTrimmedString(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeKey(value) {
    return asTrimmedString(value).toLowerCase();
}

function parseCurrentMissionFolder(dataPath) {
    const normalizedDataPath = asTrimmedString(dataPath).replace(/\\/g, "/");
    const match = normalizedDataPath.match(/assets\/([^/]+)\/data\/?$/i);
    return normalizeKey(match?.[1]);
}

function resolveCurrentMissionKeys(windowRef) {
    const params = new URLSearchParams(windowRef?.location?.search || "");
    const currentMissionParam = normalizeKey(params.get("mission"));
    const currentMissionFolder = parseCurrentMissionFolder(windowRef?.missionConfig?.dataPath);
    return new Set(
        [currentMissionParam, currentMissionFolder].filter(Boolean),
    );
}

function resolveMissionQueryValue(entry) {
    return normalizeKey(
        entry?.queryValue ||
        entry?.key ||
        entry?.folder,
    );
}

function resolveMissionLabel(entry) {
    return asTrimmedString(
        entry?.card?.title ||
        entry?.missionName ||
        entry?.folder ||
        entry?.key,
        "Mission",
    );
}

function resolveCanonicalMissionQueryValue(windowRef, missionKey) {
    const normalizedMissionKey = normalizeKey(missionKey);
    if (!normalizedMissionKey) {
        return "";
    }

    const catalog = windowRef?.missionCatalog;
    if (catalog && typeof catalog.resolveMission === "function") {
        const resolvedMission = catalog.resolveMission(normalizedMissionKey);
        const canonicalQueryValue = resolveMissionQueryValue(resolvedMission);
        if (canonicalQueryValue) {
            return canonicalQueryValue;
        }
    }

    return normalizedMissionKey;
}

function createCompareModeController(deps = {}) {
    const documentRef = deps.documentRef || document;
    const windowRef = deps.windowRef || window;
    const toggleCompareMode = deps.toggleCompareMode;
    const changeCompareMission = deps.changeCompareMission;

    let bound = false;

    function getElement(id) {
        return documentRef?.getElementById?.(id) || null;
    }

    function createOption(value, label, selected = false) {
        if (typeof documentRef?.createElement === "function") {
            const option = documentRef.createElement("option");
            option.value = value;
            option.textContent = label;
            option.selected = selected;
            return option;
        }

        return {
            selected,
            textContent: label,
            value,
        };
    }

    function replaceSelectOptions(select, options) {
        if (!select) return;

        if (typeof select.replaceChildren === "function") {
            select.replaceChildren(...options);
        } else {
            select.options = [];
            select.children = [];
            if (typeof select.appendChild === "function") {
                options.forEach((option) => select.appendChild(option));
            } else {
                select.options.push(...options);
            }
        }
    }

    function getMissionEntries() {
        const catalog = windowRef?.missionCatalog;
        if (!catalog || typeof catalog.getEntries !== "function") {
            return [];
        }
        const currentMissionKeys = resolveCurrentMissionKeys(windowRef);
        const seen = new Set();
        const entries = [];

        for (const entry of catalog.getEntries() || []) {
            const queryValue = resolveMissionQueryValue(entry);
            const folderKey = normalizeKey(entry?.folder);
            if (!queryValue || seen.has(queryValue)) continue;
            if (currentMissionKeys.has(queryValue) || currentMissionKeys.has(folderKey)) {
                continue;
            }
            seen.add(queryValue);
            entries.push({
                label: resolveMissionLabel(entry),
                value: queryValue,
            });
        }

        return entries;
    }

    function getSelectedCompareMission() {
        const select = getElement("compare-mission-select");
        return asTrimmedString(select?.value);
    }

    function sync() {
        const toggle = getElement("compare-mode-toggle");
        const select = getElement("compare-mission-select");
        if (!toggle || !select) {
            return;
        }

        const params = new URLSearchParams(windowRef?.location?.search || "");
        const compareMissionParam = resolveCanonicalMissionQueryValue(
            windowRef,
            params.get("compareMission"),
        );
        const compareModeActive = isCompareRuntimeMode(params.get("mode"));
        const entries = getMissionEntries();
        const selectedMission =
            entries.find((entry) => entry.value === compareMissionParam)?.value ||
            entries[0]?.value ||
            "";

        replaceSelectOptions(
            select,
            entries.map((entry) => createOption(
                entry.value,
                entry.label,
                entry.value === selectedMission,
            )),
        );

        select.value = selectedMission;
        select.disabled = entries.length === 0;
        toggle.disabled = entries.length === 0;
        toggle.checked = compareModeActive;
        toggle.title = entries.length === 0
            ? "No alternate missions available for comparison"
            : "Enable orbit comparison mode";
    }

    function bind() {
        if (bound) return;
        bound = true;

        const toggle = getElement("compare-mode-toggle");
        const select = getElement("compare-mission-select");

        sync();

        toggle?.addEventListener("change", function (event) {
            toggleCompareMode?.({
                compareMission: getSelectedCompareMission(),
                enabled: !!event?.target?.checked,
            });
        });

        select?.addEventListener("change", function (event) {
            changeCompareMission?.({
                compareMission: asTrimmedString(event?.target?.value),
                compareEnabled: !!getElement("compare-mode-toggle")?.checked,
            });
        });
    }

    return {
        bind,
        getMissionEntries,
        getSelectedCompareMission,
        sync,
    };
}

export { createCompareModeController };
