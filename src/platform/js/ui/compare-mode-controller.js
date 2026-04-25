import { buildCompareAlignmentOptions } from "../core/domain/compare-alignment-options.js";
import { resolveCurrentMissionKeys as resolveWindowMissionKeys } from "../core/domain/current-mission.js";
import { isCompareRuntimeMode } from "../core/domain/runtime-mode.js";

function asTrimmedString(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeKey(value) {
    return asTrimmedString(value).toLowerCase();
}

function resolveCurrentMissionKeys(windowRef) {
    return resolveWindowMissionKeys(windowRef);
}

function resolveMissionSlug(entry) {
    return normalizeKey(entry?.folder);
}

function resolveMissionLabel(entry) {
    return asTrimmedString(
        entry?.card?.title ||
        entry?.missionName ||
        entry?.folder,
        "Mission",
    );
}

function createCompareModeController(deps = {}) {
    const documentRef = deps.documentRef || globalThis.document;
    const windowRef = deps.windowRef || globalThis.window;
    const toggleCompareMode = deps.toggleCompareMode;
    const changeCompareMission = deps.changeCompareMission;
    const changeCompareAlignment = deps.changeCompareAlignment;
    const getTimelineEventInfos = deps.getTimelineEventInfos;

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
            const missionSlug = resolveMissionSlug(entry);
            const folderKey = normalizeKey(entry?.folder);
            if (!missionSlug || seen.has(missionSlug)) continue;
            if (currentMissionKeys.has(missionSlug) || currentMissionKeys.has(folderKey)) {
                continue;
            }
            seen.add(missionSlug);
            entries.push({
                label: resolveMissionLabel(entry),
                value: missionSlug,
            });
        }

        return entries;
    }

    function getSelectedCompareMission() {
        const select = getElement("compare-mission-select");
        return asTrimmedString(select?.value);
    }

    function getSelectedAlignmentEventKey(selectId) {
        const select = getElement(selectId);
        return normalizeKey(select?.value);
    }

    function getRequestedAlignmentEventKey(selectId) {
        const select = getElement(selectId);
        if (!select || select.disabled) {
            return undefined;
        }
        return normalizeKey(select.value);
    }

    function getAlignmentEventKeyFromUrl(paramName) {
        const params = new URLSearchParams(windowRef?.location?.search || "");
        return normalizeKey(params.get(paramName));
    }

    function getAlignmentOptions() {
        return buildCompareAlignmentOptions(
            typeof getTimelineEventInfos === "function"
                ? getTimelineEventInfos()
                : [],
        );
    }

    function resolveSelectedAlignmentOptionValue(options, requestedValue) {
        if (!Array.isArray(options) || options.length === 0) {
            return "";
        }

        const normalizedRequestedValue = normalizeKey(requestedValue);
        if (normalizedRequestedValue && options.some((option) => option.value === normalizedRequestedValue)) {
            return normalizedRequestedValue;
        }
        return "";
    }

    function setRowHidden(row, hidden) {
        if (!row) return;
        row.hidden = !!hidden;
        row.classList?.toggle?.("settings-row--hidden", !!hidden);
    }

    function syncAlignmentControls(compareModeActive = isCompareRuntimeMode(new URLSearchParams(windowRef?.location?.search || "").get("mode"))) {
        const alignmentRow = getElement("compare-alignment-row");
        const primarySelect = getElement("compare-primary-event-select");
        const secondarySelect = getElement("compare-secondary-event-select");
        if (!alignmentRow || !primarySelect || !secondarySelect) {
            return;
        }

        const {
            primaryOptions = [],
            comparisonOptions: secondaryOptions = [],
        } = compareModeActive
            ? getAlignmentOptions()
            : {};
        const showAlignmentControls = compareModeActive && primaryOptions.length > 0 && secondaryOptions.length > 0;

        setRowHidden(alignmentRow, !showAlignmentControls);
        primarySelect.disabled = !showAlignmentControls;
        secondarySelect.disabled = !showAlignmentControls;

        replaceSelectOptions(
            primarySelect,
            [
                createOption("", "Launch / Start"),
                ...primaryOptions.map((option) => createOption(option.value, option.label)),
            ],
        );
        replaceSelectOptions(
            secondarySelect,
            [
                createOption("", "Launch / Start"),
                ...secondaryOptions.map((option) => createOption(option.value, option.label)),
            ],
        );

        if (!showAlignmentControls) {
            primarySelect.value = "";
            secondarySelect.value = "";
            return;
        }

        primarySelect.value = resolveSelectedAlignmentOptionValue(
            primaryOptions,
            getAlignmentEventKeyFromUrl("comparePrimaryEvent"),
        );
        secondarySelect.value = resolveSelectedAlignmentOptionValue(
            secondaryOptions,
            getAlignmentEventKeyFromUrl("compareSecondaryEvent"),
        );
    }

    function sync() {
        const toggle = getElement("compare-mode-toggle");
        const select = getElement("compare-mission-select");
        const comparePillButton = getElement("compare-pill-button");
        if (!toggle || !select) {
            return;
        }

        const params = new URLSearchParams(windowRef?.location?.search || "");
        const compareMissionParam = normalizeKey(params.get("compareMission"));
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
        if (comparePillButton) {
            comparePillButton.disabled = entries.length === 0;
            comparePillButton.title = entries.length === 0
                ? "No alternate missions available for comparison"
                : "Open compare controls";
            comparePillButton.classList?.toggle?.("is-active", compareModeActive);
        }
        syncAlignmentControls(compareModeActive);
    }

    function bind() {
        if (bound) return;
        bound = true;

        const toggle = getElement("compare-mode-toggle");
        const select = getElement("compare-mission-select");
        const primaryAlignmentSelect = getElement("compare-primary-event-select");
        const secondaryAlignmentSelect = getElement("compare-secondary-event-select");

        sync();

        toggle?.addEventListener("change", function (event) {
            toggleCompareMode?.({
                compareMission: getSelectedCompareMission(),
                primaryEventKey: getRequestedAlignmentEventKey("compare-primary-event-select"),
                secondaryEventKey: getRequestedAlignmentEventKey("compare-secondary-event-select"),
                enabled: !!event?.target?.checked,
            });
        });

        select?.addEventListener("change", function (event) {
            changeCompareMission?.({
                compareMission: asTrimmedString(event?.target?.value),
                compareEnabled: !!getElement("compare-mode-toggle")?.checked,
                primaryEventKey: getRequestedAlignmentEventKey("compare-primary-event-select"),
                secondaryEventKey: getRequestedAlignmentEventKey("compare-secondary-event-select"),
            });
        });

        const onAlignmentChange = () => {
            changeCompareAlignment?.({
                compareEnabled: !!getElement("compare-mode-toggle")?.checked,
                primaryEventKey: getSelectedAlignmentEventKey("compare-primary-event-select"),
                secondaryEventKey: getSelectedAlignmentEventKey("compare-secondary-event-select"),
            });
        };
        primaryAlignmentSelect?.addEventListener("change", onAlignmentChange);
        secondaryAlignmentSelect?.addEventListener("change", onAlignmentChange);
    }

    return {
        bind,
        getMissionEntries,
        getSelectedCompareMission,
        syncAlignmentControls,
        sync,
    };
}

export { createCompareModeController };
