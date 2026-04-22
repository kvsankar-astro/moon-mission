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
    const documentRef = deps.documentRef || globalThis.document;
    const windowRef = deps.windowRef || globalThis.window;
    const toggleCompareMode = deps.toggleCompareMode;
    const changeCompareMission = deps.changeCompareMission;
    const changeCompareAlignment = deps.changeCompareAlignment;

    let bound = false;
    let burnButtonsObserver = null;

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

    function collectAlignmentEventOptions(isComparisonRole) {
        const buttons = Array.from(
            documentRef?.querySelectorAll?.("#burnbuttons button[data-event-source-key]") || [],
        );
        const seen = new Set();
        const options = [];

        for (const button of buttons) {
            const role = normalizeKey(
                button?.dataset?.timelineRole ||
                button?.getAttribute?.("data-timeline-role") ||
                (button?.classList?.contains?.("burnbutton--comparison") ? "comparison" : "primary"),
            );
            const isComparisonButton = role === "comparison";
            if (isComparisonRole !== isComparisonButton) {
                continue;
            }

            const value = normalizeKey(
                button?.dataset?.eventSourceKey ||
                button?.getAttribute?.("data-event-source-key"),
            );
            if (!value || value === "now" || seen.has(value)) {
                continue;
            }
            seen.add(value);
            options.push({
                value,
                label: asTrimmedString(button?.textContent, value),
            });
        }

        return options;
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

        const primaryOptions = compareModeActive ? collectAlignmentEventOptions(false) : [];
        const secondaryOptions = compareModeActive ? collectAlignmentEventOptions(true) : [];
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

    function bindBurnButtonsObserver() {
        if (burnButtonsObserver || typeof windowRef?.MutationObserver !== "function") {
            return;
        }

        const burnButtonsHost = getElement("burnbuttons");
        if (!burnButtonsHost) {
            return;
        }

        burnButtonsObserver = new windowRef.MutationObserver(() => {
            syncAlignmentControls(!!getElement("compare-mode-toggle")?.checked);
        });
        burnButtonsObserver.observe(burnButtonsHost, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "data-event-source-key", "data-timeline-role"],
        });
    }

    function sync() {
        const toggle = getElement("compare-mode-toggle");
        const select = getElement("compare-mission-select");
        const comparePillButton = getElement("compare-pill-button");
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
        bindBurnButtonsObserver();

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
