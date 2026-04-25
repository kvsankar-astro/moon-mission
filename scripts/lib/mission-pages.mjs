import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const DEFAULT_SITE_URL = "https://sankara.net/astro/lunar-missions/";

function asTrimmedString(value) {
    if (typeof value !== "string") {
        return "";
    }
    return value.trim();
}

function ensureTrailingSentence(text) {
    const value = asTrimmedString(text);
    if (!value) {
        return "";
    }
    return /[.!?]$/.test(value) ? value : `${value}.`;
}

function truncateText(text, maxLength = 180) {
    const value = asTrimmedString(text);
    if (!value || value.length <= maxLength) {
        return value;
    }

    const truncated = value.slice(0, Math.max(0, maxLength - 1));
    const lastBreak = truncated.lastIndexOf(" ");
    return `${(lastBreak > 80 ? truncated.slice(0, lastBreak) : truncated).trim()}...`;
}

function firstSentence(text) {
    const value = asTrimmedString(text);
    if (!value) {
        return "";
    }
    const match = value.match(/^.*?[.!?](?:\s|$)/);
    return asTrimmedString(match?.[0] || value);
}

function escapeHtmlAttribute(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeRegex(value) {
    return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureTrailingSlashUrl(siteUrl) {
    const value = asTrimmedString(siteUrl) || DEFAULT_SITE_URL;
    return value.endsWith("/") ? value : `${value}/`;
}

function getDefaultAppRoot() {
    return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

function getAppRoot(appRoot = null) {
    return resolve(appRoot || getDefaultAppRoot());
}

function readJsonFile(filePath) {
    return JSON.parse(readFileSync(filePath, "utf-8"));
}

function replaceOnce(source, pattern, replacement, label) {
    const nextValue = source.replace(pattern, replacement);
    if (nextValue === source) {
        throw new Error(`Could not update mission page template: ${label}`);
    }
    return nextValue;
}

function replaceTagAttribute(html, dataAttribute, attributeName, value) {
    const escapedValue = escapeHtmlAttribute(value);
    const tagPattern = new RegExp(
        `<(?:meta|link)\\b[^>]*\\bdata-(?:mission-meta|social-meta)="${escapeRegex(dataAttribute)}"[^>]*>`,
        "i",
    );
    const tagMatch = html.match(tagPattern);
    if (!tagMatch?.[0]) {
        throw new Error(`Could not update mission page template: ${dataAttribute}:${attributeName}`);
    }

    const originalTag = tagMatch[0];
    const attributePattern = new RegExp(`(\\b${escapeRegex(attributeName)}=")[^"]*(")`, "i");
    const replacementTag = attributePattern.test(originalTag)
        ? originalTag.replace(attributePattern, `$1${escapedValue}$2`)
        : originalTag.replace(/>$/, ` ${attributeName}="${escapedValue}">`);
    if (replacementTag === originalTag) {
        return html;
    }
    const nextValue = html.replace(originalTag, () => replacementTag);
    if (nextValue === html) {
        throw new Error(`Could not update mission page template: ${dataAttribute}:${attributeName}`);
    }
    return nextValue;
}

function replaceTitleContent(html, value) {
    const escapedValue = escapeHtmlAttribute(value);
    return replaceOnce(
        html,
        /(<title[^>]*data-mission-meta="title"[^>]*>)([^<]*)(<\/title>)/i,
        `$1${escapedValue}$3`,
        "title",
    );
}

function parsePngDimensions(filePath) {
    const buffer = readFileSync(filePath);
    if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") {
        return null;
    }
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
    };
}

function resolveSocialImageMeta(folder, appRoot, siteUrl) {
    const socialDir = join(appRoot, "images", "social");
    const candidates = [
        `${folder}-landscape.png`,
        "lunar-missions.png",
        "chandrayaan3-landscape.png",
    ];

    for (const fileName of candidates) {
        const filePath = join(socialDir, fileName);
        if (!existsSync(filePath)) {
            continue;
        }
        const dimensions = parsePngDimensions(filePath);
        return {
            imageUrl: new URL(`images/social/${fileName}`, ensureTrailingSlashUrl(siteUrl)).toString(),
            width: dimensions?.width ? String(dimensions.width) : "",
            height: dimensions?.height ? String(dimensions.height) : "",
        };
    }

    return {
        imageUrl: "",
        width: "",
        height: "",
    };
}

function buildMissionDescription(entry, briefs) {
    const folder = asTrimmedString(entry?.folder);
    const authoredMissionText = asTrimmedString(briefs?.[folder]?.mission);
    const descriptionCandidate =
        firstSentence(authoredMissionText) ||
        asTrimmedString(entry?.description) ||
        `Interactive ${asTrimmedString(entry?.title) || folder} lunar mission orbit visualization from mission ephemeris data`;
    return ensureTrailingSentence(truncateText(descriptionCandidate));
}

function buildMissionTitle(entry) {
    return `${asTrimmedString(entry?.title) || asTrimmedString(entry?.folder) || "Moon Mission"} Lunar Mission Orbit Animation`;
}

function renderMissionPageHtml({
    templateHtml,
    entry,
    briefs,
    appRoot,
    siteUrl = DEFAULT_SITE_URL,
}) {
    const folder = asTrimmedString(entry?.folder);
    if (!folder) {
        throw new Error("Mission entry is missing folder");
    }

    const title = buildMissionTitle(entry);
    const description = buildMissionDescription(entry, briefs);
    const canonicalUrl = new URL(`${folder}/`, ensureTrailingSlashUrl(siteUrl)).toString();
    const socialImage = resolveSocialImageMeta(folder, appRoot, siteUrl);
    const preset = {
        canonicalUrl,
        description,
        folder,
        title,
    };

    let html = templateHtml;
    html = replaceOnce(
        html,
        /(<meta charset="UTF-8">\r?\n)/i,
        `$1        <base href="../">\n`,
        "base-href",
    );
    html = replaceTagAttribute(html, "description", "content", description);
    html = replaceTagAttribute(html, "canonical", "href", canonicalUrl);
    html = replaceTagAttribute(html, "og-url", "content", canonicalUrl);
    html = replaceTagAttribute(html, "og-title", "content", title);
    html = replaceTagAttribute(html, "og-description", "content", description);
    html = replaceTagAttribute(html, "twitter-url", "content", canonicalUrl);
    html = replaceTagAttribute(html, "twitter-title", "content", title);
    html = replaceTagAttribute(html, "twitter-description", "content", description);
    html = replaceTitleContent(html, title);

    if (socialImage.imageUrl) {
        html = replaceTagAttribute(html, "og-image", "content", socialImage.imageUrl);
        html = replaceTagAttribute(html, "twitter-image", "content", socialImage.imageUrl);
    }
    if (socialImage.width) {
        html = replaceTagAttribute(html, "og-image-width", "content", socialImage.width);
    }
    if (socialImage.height) {
        html = replaceTagAttribute(html, "og-image-height", "content", socialImage.height);
    }

    html = replaceOnce(
        html,
        /(<script type="module" src="src\/platform\/js\/astro\.js"><\/script>\r?\n)/i,
        `$1        <script>\n            window.__MISSION_PAGE_PRESET = ${JSON.stringify(preset)};\n        </script>\n`,
        "preset-script",
    );

    return html;
}

function loadMissionPageContext({ appRoot = null, siteUrl = DEFAULT_SITE_URL } = {}) {
    const resolvedAppRoot = getAppRoot(appRoot);
    const templateHtml = readFileSync(join(resolvedAppRoot, "mission.html"), "utf-8");
    const catalog = readJsonFile(join(resolvedAppRoot, "assets", "mission-catalog.json"));
    const briefs = readJsonFile(join(resolvedAppRoot, "assets", "mission-briefs.json"));
    const missions = Array.isArray(catalog?.missions) ? catalog.missions : [];
    return {
        appRoot: resolvedAppRoot,
        briefs,
        missions,
        siteUrl: ensureTrailingSlashUrl(siteUrl),
        templateHtml,
    };
}

function writeMissionPages({
    appRoot = null,
    outputRoot,
    siteUrl = DEFAULT_SITE_URL,
}) {
    if (!outputRoot) {
        throw new Error("outputRoot is required");
    }

    const context = loadMissionPageContext({ appRoot, siteUrl });
    const resolvedOutputRoot = resolve(outputRoot);
    let writtenCount = 0;

    for (const mission of context.missions) {
        const folder = asTrimmedString(mission?.folder);
        if (!folder) {
            continue;
        }
        const html = renderMissionPageHtml({
            templateHtml: context.templateHtml,
            entry: mission,
            briefs: context.briefs,
            appRoot: context.appRoot,
            siteUrl: context.siteUrl,
        });
        const missionDir = join(resolvedOutputRoot, folder);
        mkdirSync(missionDir, { recursive: true });
        writeFileSync(join(missionDir, "index.html"), html, "utf-8");
        writtenCount += 1;
    }

    return {
        outputRoot: resolvedOutputRoot,
        writtenCount,
    };
}

function renderMissionPageForFolder(folder, options = {}) {
    const context = loadMissionPageContext(options);
    const mission = context.missions.find((entry) => asTrimmedString(entry?.folder) === asTrimmedString(folder));
    if (!mission) {
        return null;
    }
    return renderMissionPageHtml({
        templateHtml: context.templateHtml,
        entry: mission,
        briefs: context.briefs,
        appRoot: context.appRoot,
        siteUrl: context.siteUrl,
    });
}

export {
    DEFAULT_SITE_URL,
    getAppRoot,
    loadMissionPageContext,
    renderMissionPageForFolder,
    renderMissionPageHtml,
    writeMissionPages,
};
