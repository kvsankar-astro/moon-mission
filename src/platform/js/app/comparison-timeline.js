import {
    mapComparisonSourceTimeMsToDisplayTime,
    resolveComparisonOverlay,
    resolveComparisonTimelineEventsByOrigin,
} from "../core/domain/comparison-overlay.js";
import { buildEventHoverText, buildEventInfoText } from "./burn-event-metadata.js";
import { formatDateTimeUTC } from "../utils/time-utils.js";

const TIMELINE_ROLE_PRIMARY = "primary";
const TIMELINE_ROLE_COMPARISON = "comparison";

function asTrimmedString(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function resolveEventTimeMs(eventInfo) {
    if (!eventInfo) return Number.NaN;
    if (eventInfo.startTime instanceof Date) {
        return eventInfo.startTime.getTime();
    }
    if (Number.isFinite(eventInfo.startTime)) {
        return eventInfo.startTime;
    }
    const parsed = new Date(eventInfo.startTime).getTime();
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isNowEventInfo(eventInfo) {
    return eventInfo?.kind === "now" || eventInfo?.key === "now";
}

function resolveTimelineMissionLabel({ missionShortLabel, missionName, fallback }) {
    return asTrimmedString(
        missionShortLabel,
        asTrimmedString(missionName, asTrimmedString(fallback, "Mission")),
    );
}

function prefixTimelineText(missionLabel, text) {
    const normalizedText = asTrimmedString(text);
    if (!missionLabel) {
        return normalizedText;
    }
    if (!normalizedText) {
        return missionLabel;
    }
    return `${missionLabel} • ${normalizedText}`;
}

function resolveTimelineEventLabel(eventInfo) {
    return (
        asTrimmedString(eventInfo?.timelineLabel) ||
        asTrimmedString(eventInfo?.label, "Event")
    );
}

function resolveTimelineEventHoverText(
    eventInfo,
    buildEventHoverTextImpl = buildEventHoverText,
) {
    if (eventInfo?.timelineHoverText) {
        return eventInfo.timelineHoverText;
    }
    const fallbackText =
        typeof buildEventHoverTextImpl === "function"
            ? buildEventHoverTextImpl(eventInfo)
            : "";
    return fallbackText || resolveTimelineEventLabel(eventInfo);
}

function resolveTimelineEventInfoText(
    eventInfo,
    buildEventInfoTextImpl = buildEventInfoText,
) {
    if (eventInfo?.timelineInfoText) {
        return eventInfo.timelineInfoText;
    }
    const fallbackText =
        typeof buildEventInfoTextImpl === "function"
            ? buildEventInfoTextImpl(eventInfo)
            : "";
    return fallbackText || resolveTimelineEventLabel(eventInfo);
}

function buildTimelineEventCopy({
    eventInfo,
    timelineTimeMs,
    sourceTimeMs,
    missionLabel,
    missionKey,
    timelineRole,
    bodyId = "",
    formatDateTimeUTCImpl = formatDateTimeUTC,
}) {
    const normalizedTimelineTimeMs = Number(timelineTimeMs);
    const normalizedSourceTimeMs = Number(sourceTimeMs);
    if (!Number.isFinite(normalizedTimelineTimeMs)) {
        return null;
    }

    const baseLabel = asTrimmedString(eventInfo?.label, "Event");
    const sourceTimeLabel = Number.isFinite(normalizedSourceTimeMs)
        ? formatDateTimeUTCImpl(normalizedSourceTimeMs)
        : "";
    const hoverText = buildEventHoverText(eventInfo);
    const infoText = buildEventInfoText(eventInfo);
    const missionScopedLabel = missionLabel
        ? `${missionLabel}: ${baseLabel}`
        : baseLabel;

    return {
        ...eventInfo,
        key: [
            "timeline",
            timelineRole,
            asTrimmedString(missionKey, timelineRole),
            asTrimmedString(eventInfo?.key, baseLabel),
            Number.isFinite(normalizedSourceTimeMs)
                ? String(normalizedSourceTimeMs)
                : "NaN",
        ].join(":"),
        startTime: new Date(normalizedTimelineTimeMs),
        sourceStartTime: Number.isFinite(normalizedSourceTimeMs)
            ? new Date(normalizedSourceTimeMs)
            : null,
        body: asTrimmedString(bodyId, eventInfo?.body),
        timelineEvent: true,
        timelineRole,
        timelineMissionLabel: missionLabel,
        timelineMissionKey: asTrimmedString(missionKey, timelineRole),
        timelineSourceKey: asTrimmedString(eventInfo?.key),
        timelineLabel: missionScopedLabel,
        timelineHoverText: prefixTimelineText(
            missionLabel,
            [sourceTimeLabel, hoverText].filter(Boolean).join(" • "),
        ),
        timelineInfoText: prefixTimelineText(
            missionLabel,
            [sourceTimeLabel, infoText].filter(Boolean).join(" • "),
        ),
        comparisonEvent: timelineRole === TIMELINE_ROLE_COMPARISON,
    };
}

function sortTimelineEvents(a, b) {
    const timeDiff = resolveEventTimeMs(a) - resolveEventTimeMs(b);
    if (timeDiff !== 0) {
        return timeDiff;
    }

    const roleA = a?.timelineRole === TIMELINE_ROLE_COMPARISON ? 1 : 0;
    const roleB = b?.timelineRole === TIMELINE_ROLE_COMPARISON ? 1 : 0;
    if (roleA !== roleB) {
        return roleA - roleB;
    }

    return asTrimmedString(a?.timelineLabel || a?.label).localeCompare(
        asTrimmedString(b?.timelineLabel || b?.label),
    );
}

function mapComparisonEventTimelineTime({
    globalConfig,
    bodyId,
    config,
    sourceTimeMs,
}) {
    return mapComparisonSourceTimeMsToDisplayTime({
        globalConfig,
        bodyId,
        config,
        timeMs: sourceTimeMs,
    });
}

function buildPrimaryTimelineEventInfos({ globalConfig, eventInfos }) {
    const missionLabel = resolveTimelineMissionLabel({
        missionShortLabel: globalConfig?.mission_name_short,
        missionName: globalConfig?.mission_name,
        fallback: "Primary",
    });

    return (Array.isArray(eventInfos) ? eventInfos : [])
        .filter((eventInfo) => !isNowEventInfo(eventInfo))
        .map((eventInfo) => {
            const eventTimeMs = resolveEventTimeMs(eventInfo);
            return buildTimelineEventCopy({
                eventInfo,
                timelineTimeMs: eventTimeMs,
                sourceTimeMs: eventTimeMs,
                missionLabel,
                missionKey: globalConfig?.primaryCraftId || globalConfig?.spacecraft_mnemonic || "primary",
                timelineRole: TIMELINE_ROLE_PRIMARY,
            });
        })
        .filter(Boolean);
}

function buildComparisonTimelineEventInfos({
    globalConfig,
    config,
    formatDateTimeUTCImpl = formatDateTimeUTC,
}) {
    const overlay = resolveComparisonOverlay(globalConfig);
    if (!overlay?.compareCraftId) {
        return [];
    }

    const comparisonSourceEvents = resolveComparisonTimelineEventsByOrigin(
        overlay.timelineSourceEventInfosByOrigin,
        config,
    );
    if (!Array.isArray(comparisonSourceEvents) || comparisonSourceEvents.length === 0) {
        return [];
    }

    const missionLabel = resolveTimelineMissionLabel({
        missionShortLabel: overlay.missionShortLabel,
        missionName: overlay.missionName,
        fallback: "Comparison",
    });
    const missionKey = overlay.missionKey || overlay.missionFolder || overlay.compareCraftId;

    return comparisonSourceEvents
        .filter((eventInfo) => !isNowEventInfo(eventInfo))
        .map((eventInfo) => {
            const sourceTimeMs = resolveEventTimeMs(eventInfo);
            if (!Number.isFinite(sourceTimeMs)) {
                return null;
            }

            const timelineTimeMs = mapComparisonEventTimelineTime({
                globalConfig,
                bodyId: overlay.compareCraftId,
                config,
                sourceTimeMs,
            });
            return buildTimelineEventCopy({
                eventInfo,
                timelineTimeMs,
                sourceTimeMs,
                missionLabel,
                missionKey,
                timelineRole: TIMELINE_ROLE_COMPARISON,
                bodyId: overlay.compareCraftId,
                formatDateTimeUTCImpl,
            });
        })
        .filter(Boolean);
}

function buildTimelineEventInfos({
    compareMode,
    globalConfig,
    config,
    primaryEventInfos,
}) {
    const normalizedPrimaryEventInfos = Array.isArray(primaryEventInfos)
        ? primaryEventInfos
        : [];
    if (!compareMode) {
        return normalizedPrimaryEventInfos;
    }

    const mergedEvents = [
        ...buildPrimaryTimelineEventInfos({
            globalConfig,
            eventInfos: normalizedPrimaryEventInfos,
        }),
        ...buildComparisonTimelineEventInfos({
            globalConfig,
            config,
        }),
    ];
    mergedEvents.sort(sortTimelineEvents);
    return mergedEvents;
}

export {
    TIMELINE_ROLE_COMPARISON,
    TIMELINE_ROLE_PRIMARY,
    buildTimelineEventInfos,
    isNowEventInfo,
    resolveEventTimeMs,
    resolveTimelineEventHoverText,
    resolveTimelineEventInfoText,
    resolveTimelineEventLabel,
    resolveTimelineMissionLabel,
};
