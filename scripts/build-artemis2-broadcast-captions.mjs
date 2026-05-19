#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_PART1_PATH = "C:/sankar/projects/transcribe/transcripts/artemis2-lunar-flyby-broadcast-part1.json";
const DEFAULT_PART2_PATH = "C:/sankar/projects/transcribe/transcripts/artemis2-lunar-flyby-broadcast-part2.json";
const DEFAULT_OUTPUT_PATH = "../moon-mission-data/assets/artemis2/media/streams/lunar-flyby/v1/artemis2-lunar-flyby-broadcast.en.vtt";
const DEFAULT_PART2_OFFSET_SECONDS = 22373.268;
const HIDDEN_STATUSES = new Set(["silent", "garbled", "hallucination"]);

function parseArgs(argv) {
    const result = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (!arg.startsWith("--")) continue;
        const key = arg.slice(2);
        const value = argv[index + 1];
        if (!value || value.startsWith("--")) {
            result[key] = true;
            continue;
        }
        result[key] = value;
        index += 1;
    }
    return result;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toSeconds(value) {
    const seconds = Number(value);
    return Number.isFinite(seconds) ? seconds : Number.NaN;
}

function formatVttTime(seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const totalMilliseconds = Math.round(safeSeconds * 1000);
    const hours = Math.floor(totalMilliseconds / 3600000);
    const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
    const wholeSeconds = Math.floor((totalMilliseconds % 60000) / 1000);
    const milliseconds = totalMilliseconds % 1000;
    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(wholeSeconds).padStart(2, "0"),
    ].join(":") + `.${String(milliseconds).padStart(3, "0")}`;
}

function escapeVttText(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function normalizeCueText(value) {
    return String(value || "")
        .replace(/^\s*SECRETARY\s+POMPEO[:,]?\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeSpeakerName(value) {
    const speaker = String(value || "").trim();
    if (!speaker) return "";
    if (/^(unknown|unattributed speech|unidentified)$/i.test(speaker)) return "";
    return speaker;
}

function segmentToCue(segment, offsetSeconds) {
    const status = String(segment?.status || "ok").trim().toLowerCase();
    if (HIDDEN_STATUSES.has(status)) return null;
    const startSeconds = toSeconds(segment?.startSeconds);
    const endSeconds = toSeconds(segment?.endSeconds);
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
        return null;
    }
    const text = normalizeCueText(segment?.text);
    if (!text || text === ".") return null;
    const speaker = normalizeSpeakerName(segment?.displaySpeaker || segment?.speaker);
    return {
        startSeconds: startSeconds + offsetSeconds,
        endSeconds: endSeconds + offsetSeconds,
        speaker,
        text,
        status,
        count: 1,
    };
}

function shouldCollapseDuplicate(previous, next) {
    if (!previous || !next) return false;
    if (previous.status !== "duplicate" || next.status !== "duplicate") return false;
    if (previous.speaker !== next.speaker) return false;
    if (previous.text.toLowerCase() !== next.text.toLowerCase()) return false;
    return next.startSeconds - previous.endSeconds <= 2;
}

function appendCue(cues, cue) {
    const previous = cues[cues.length - 1];
    if (shouldCollapseDuplicate(previous, cue)) {
        previous.endSeconds = Math.max(previous.endSeconds, cue.endSeconds);
        previous.count += 1;
        return;
    }
    cues.push(cue);
}

function collectCues(payload, offsetSeconds) {
    const segments = Array.isArray(payload?.segments) ? payload.segments : [];
    const cues = [];
    for (const segment of segments) {
        const cue = segmentToCue(segment, offsetSeconds);
        if (cue) appendCue(cues, cue);
    }
    return cues;
}

function renderCueText(cue) {
    const prefix = cue.speaker ? `${cue.speaker}: ` : "";
    const suffix = cue.count > 1 ? ` (x${cue.count})` : "";
    return escapeVttText(`${prefix}${cue.text}${suffix}`);
}

function renderWebVtt(cues) {
    const lines = [
        "WEBVTT",
        "",
        "NOTE Generated from Artemis II diarized transcript JSON. Speaker labels are inferred and may contain errors.",
        "",
    ];
    cues.forEach((cue, index) => {
        lines.push(String(index + 1));
        lines.push(`${formatVttTime(cue.startSeconds)} --> ${formatVttTime(cue.endSeconds)}`);
        lines.push(renderCueText(cue));
        lines.push("");
    });
    return `${lines.join("\n")}\n`;
}

const args = parseArgs(process.argv.slice(2));
const part1Path = path.resolve(args.part1 || DEFAULT_PART1_PATH);
const part2Path = path.resolve(args.part2 || DEFAULT_PART2_PATH);
const outputPath = path.resolve(args.out || DEFAULT_OUTPUT_PATH);
const part2OffsetSeconds = Number.isFinite(Number(args["part2-offset"]))
    ? Number(args["part2-offset"])
    : DEFAULT_PART2_OFFSET_SECONDS;

const part1 = readJson(part1Path);
const part2 = readJson(part2Path);
const cues = [
    ...collectCues(part1, 0),
    ...collectCues(part2, part2OffsetSeconds),
].sort((a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, renderWebVtt(cues), "utf8");

console.log(`Wrote ${cues.length} caption cue(s) to ${outputPath}`);
