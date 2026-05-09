#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSON5 from "json5";

const DEFAULT_THUMBNAILS = {
  basePath: "../media/thumbnails",
  imagePattern: "images/{key}.webp",
  videoPattern: "videos/{key}.webp",
  audioFallbackAsset: "audio/waveform.svg",
};

const AUDIO_WAVEFORM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="Audio waveform">
  <rect width="320" height="180" rx="14" fill="#070d17"/>
  <circle cx="160" cy="88" r="118" fill="#f5be67" opacity="0.08"/>
  <path d="M24 92 C42 54 60 54 78 92 S112 130 130 92 S160 38 180 92 S218 146 238 92 S278 58 296 92" fill="none" stroke="#f5be67" stroke-width="24" stroke-linecap="round" opacity="0.22"/>
  <path d="M24 92 C42 54 60 54 78 92 S112 130 130 92 S160 38 180 92 S218 146 238 92 S278 58 296 92" fill="none" stroke="#ffe8b1" stroke-width="7" stroke-linecap="round"/>
</svg>
`;

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripMediaFileExtension(value) {
  return asTrimmedString(value).replace(/\.[A-Za-z0-9]{2,5}$/u, "");
}

function buildMediaThumbnailKey(...values) {
  const source = values.map(asTrimmedString).find(Boolean);
  if (!source) return "media";
  return stripMediaFileExtension(source)
    .replace(/\\/g, "/")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "media";
}

function ensureTrailingSlash(value) {
  const normalized = asTrimmedString(value);
  if (!normalized) return "";
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function encodePathSegments(value) {
  return asTrimmedString(value)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function resolveRemoteWebAssetUrl(fileName, mediaBase) {
  const normalizedFileName = asTrimmedString(fileName);
  const normalizedMediaBase = ensureTrailingSlash(mediaBase);
  if (!normalizedFileName || !normalizedMediaBase) return "";
  return `${normalizedMediaBase}web/${encodePathSegments(normalizedFileName)}`;
}

function resolveConfiguredAssetSourceUrl(asset, mediaBase) {
  const normalizedAsset = asTrimmedString(asset);
  if (!normalizedAsset) return "";
  if (/^https?:\/\//iu.test(normalizedAsset)) return normalizedAsset;
  const normalizedMediaBase = ensureTrailingSlash(mediaBase);
  if (normalizedMediaBase) {
    return `${normalizedMediaBase}${encodePathSegments(normalizedAsset)}`;
  }
  return normalizedAsset;
}

function normalizeMediaItemKind(value) {
  const normalized = asTrimmedString(value);
  if (normalized === "video" || normalized === "videoClip") return "videoClip";
  if (normalized === "audio" || normalized === "audioClip") return "audioClip";
  return "image";
}

function normalizeThumbnailConfig(manifest) {
  const thumbnails = manifest?.thumbnails && typeof manifest.thumbnails === "object"
    ? manifest.thumbnails
    : {};
  return {
    ...DEFAULT_THUMBNAILS,
    ...Object.fromEntries(
      Object.entries(thumbnails)
        .map(([key, value]) => [key, asTrimmedString(value)])
        .filter(([, value]) => value),
    ),
  };
}

function resolvePattern(pattern, item) {
  const key = buildMediaThumbnailKey(item.thumbnailKey, item.id, item.file);
  return asTrimmedString(pattern)
    .replaceAll("{id}", buildMediaThumbnailKey(item.id))
    .replaceAll("{key}", key)
    .replaceAll("{file}", buildMediaThumbnailKey(item.file))
    .replaceAll("{kind}", buildMediaThumbnailKey(item.kind));
}

function joinRelativePath(basePath, relativePath) {
  const base = asTrimmedString(basePath).replace(/\/+$/g, "");
  const relative = asTrimmedString(relativePath).replace(/^\/+/g, "");
  return base ? `${base}/${relative}` : relative;
}

function resolveThumbnailRelativePath(config, item) {
  if (item.kind === "audioClip") {
    return joinRelativePath(config.basePath, config.audioFallbackAsset);
  }
  const pattern = item.kind === "videoClip" ? config.videoPattern : config.imagePattern;
  return joinRelativePath(config.basePath, resolvePattern(pattern, item));
}

function isPathWithin(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertSafeMissionId(mission) {
  if (!/^[A-Za-z0-9._-]+$/u.test(mission)) {
    throw new Error(`Unsafe mission id: ${mission}`);
  }
}

function resolveDataRepoOutputPath(dataRoot, mission, relativeFromDataDir) {
  assertSafeMissionId(mission);
  const missionRoot = path.resolve(dataRoot, "assets", mission);
  const outputPath = path.resolve(missionRoot, "data", relativeFromDataDir);
  if (!isPathWithin(outputPath, missionRoot)) {
    throw new Error(`Thumbnail output escapes mission folder: ${relativeFromDataDir}`);
  }
  return outputPath;
}

function parseArgs(argv) {
  const args = {
    appRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    dataRoot: path.resolve("../moon-mission-data"),
    mission: "artemis2",
    kind: "all",
    force: false,
    dryRun: false,
    limit: 0,
    jobs: 2,
    snapshotSeconds: 1,
    ffmpegTimeoutSeconds: 45,
    width: 320,
    height: 180,
    quality: 74,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    const next = () => argv[++index];
    if (entry === "--app-root") args.appRoot = path.resolve(next());
    else if (entry === "--data-root") args.dataRoot = path.resolve(next());
    else if (entry === "--mission") args.mission = asTrimmedString(next()) || args.mission;
    else if (entry === "--kind") args.kind = asTrimmedString(next()) || args.kind;
    else if (entry === "--limit") args.limit = Math.max(0, Number(next()) || 0);
    else if (entry === "--jobs") args.jobs = Math.max(1, Number(next()) || 1);
    else if (entry === "--snapshot-seconds") args.snapshotSeconds = Math.max(0, Number(next()) || 0);
    else if (entry === "--ffmpeg-timeout-seconds") args.ffmpegTimeoutSeconds = Math.max(1, Number(next()) || args.ffmpegTimeoutSeconds);
    else if (entry === "--width") args.width = Math.max(1, Number(next()) || args.width);
    else if (entry === "--height") args.height = Math.max(1, Number(next()) || args.height);
    else if (entry === "--quality") args.quality = Math.max(1, Math.min(100, Number(next()) || args.quality));
    else if (entry === "--force") args.force = true;
    else if (entry === "--dry-run") args.dryRun = true;
    else if (entry === "--help" || entry === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${entry}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/generate-media-thumbnails.mjs [options]

Options:
  --mission <id>             Mission folder under assets/ (default: artemis2)
  --data-root <path>         moon-mission-data root (default: ../moon-mission-data)
  --kind <all|image|video|audio>
  --limit <n>                Limit image/video generation count
  --jobs <n>                 Concurrent ffmpeg jobs (default: 2)
  --force                    Regenerate existing files
  --dry-run                  Print planned outputs only
  --snapshot-seconds <n>     Video frame time in seconds (default: 1)
  --ffmpeg-timeout-seconds <n> Per-file ffmpeg timeout (default: 45)
  --width <px> --height <px> Thumbnail dimensions (default: 320x180)
  --quality <1-100>          WebP quality (default: 74)
`);
}

async function readManifest(appRoot, mission) {
  const manifestPath = path.resolve(appRoot, "assets", mission, "data", "media-manifest.json5");
  const text = await fs.readFile(manifestPath, "utf8");
  return {
    manifestPath,
    manifest: JSON5.parse(text),
  };
}

function buildMediaJobs(manifest) {
  const photos = Array.isArray(manifest.photos) ? manifest.photos : [];
  const audio = Array.isArray(manifest.audio) ? manifest.audio : [];
  const mediaItems = Array.isArray(manifest.mediaItems) ? manifest.mediaItems : [];
  const audioItems = Array.isArray(manifest.audioItems) ? manifest.audioItems : [];
  const mediaBase = asTrimmedString(manifest.mediaBase);
  const jobs = [];

  for (const item of mediaItems) {
    const kind = normalizeMediaItemKind(item?.kind);
    const file = asTrimmedString(item?.file || item?.filename || item?.asset || item?.id);
    if (!file || item?.enabled === false) continue;
    jobs.push({
      id: asTrimmedString(item.id || file),
      kind,
      file,
      sourceUrl: kind === "audioClip"
        ? ""
        : resolveConfiguredAssetSourceUrl(item?.asset || item?.sourceUrl || file, mediaBase),
      title: asTrimmedString(item.title || item.label || file),
      thumbnailKey: asTrimmedString(item.thumbnailKey),
    });
  }

  for (const photo of photos) {
    const file = asTrimmedString(photo?.file);
    if (!file || photo?.enabled === false) continue;
    const kind = photo.video === true ? "videoClip" : "image";
    jobs.push({
      id: asTrimmedString(photo.id || file),
      kind,
      file,
      sourceUrl: resolveRemoteWebAssetUrl(file, mediaBase),
      title: asTrimmedString(photo.title || file),
      thumbnailKey: asTrimmedString(photo.thumbnailKey),
    });
  }

  for (const item of audioItems) {
    const file = asTrimmedString(item?.file || item?.filename || item?.asset || item?.id);
    if (!file || item?.enabled === false) continue;
    jobs.push({
      id: asTrimmedString(item.id) || `audio:${file}`,
      kind: "audioClip",
      file,
      sourceUrl: "",
      title: asTrimmedString(item.description || item.desc || item.title || item.label || file),
      thumbnailKey: asTrimmedString(item.thumbnailKey),
    });
  }

  for (const item of audio) {
    const file = asTrimmedString(item?.file);
    if (!file || item?.enabled === false) continue;
    jobs.push({
      id: asTrimmedString(item.id) || `audio:${file}`,
      kind: "audioClip",
      file,
      sourceUrl: "",
      title: asTrimmedString(item.desc || item.title || file),
      thumbnailKey: asTrimmedString(item.thumbnailKey),
    });
  }

  return jobs;
}

function shouldIncludeKind(job, requestedKind) {
  if (requestedKind === "all") return true;
  if (requestedKind === "image") return job.kind === "image";
  if (requestedKind === "video") return job.kind === "videoClip";
  if (requestedKind === "audio") return job.kind === "audioClip";
  throw new Error(`Unsupported kind: ${requestedKind}`);
}

async function ensureParentDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function hasUsableFile(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
}

function runCommand(command, args, {
  timeoutSeconds = 45,
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${timeoutSeconds}s`));
    }, timeoutSeconds * 1000);
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited ${code}: ${stderr.trim()}`));
    });
  });
}

async function writeAudioFallback(outputPath, { force = false, dryRun = false } = {}) {
  if (!force && await hasUsableFile(outputPath)) {
    return "skipped";
  }
  if (dryRun) {
    console.log(`[dry-run] audio waveform -> ${outputPath}`);
    return "planned";
  }
  await ensureParentDirectory(outputPath);
  await fs.writeFile(outputPath, AUDIO_WAVEFORM_SVG, "utf8");
  return "written";
}

async function generateWebpThumbnail(job, outputPath, options) {
  if (!job.sourceUrl) {
    return "missing-source";
  }
  if (!options.force && await hasUsableFile(outputPath)) {
    return "skipped";
  }
  if (options.dryRun) {
    console.log(`[dry-run] ${job.sourceUrl} -> ${outputPath}`);
    return "planned";
  }

  await ensureParentDirectory(outputPath);
  const tempOutputPath = `${outputPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const videoFilter = `scale=${options.width}:${options.height}:force_original_aspect_ratio=increase,crop=${options.width}:${options.height}`;
  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
  ];
  if (job.kind === "videoClip" && options.snapshotSeconds > 0) {
    args.push("-ss", String(options.snapshotSeconds));
  }
  args.push(
    "-i",
    job.sourceUrl,
    "-vf",
    videoFilter,
    "-frames:v",
    "1",
    "-c:v",
    "libwebp",
    "-quality",
    String(options.quality),
    tempOutputPath,
  );
  try {
    await runCommand("ffmpeg", args, {
      timeoutSeconds: options.ffmpegTimeoutSeconds,
    });
    if (!await hasUsableFile(tempOutputPath)) {
      throw new Error("ffmpeg produced an empty thumbnail");
    }
    await fs.rm(outputPath, { force: true });
    await fs.rename(tempOutputPath, outputPath);
  } catch (error) {
    await fs.rm(tempOutputPath, { force: true });
    throw error;
  }
  return "written";
}

async function runWithConcurrency(items, concurrency, worker) {
  let index = 0;
  const results = [];
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

async function writeGenerationManifest(baseOutputPath, records, dryRun) {
  if (dryRun) return;
  await fs.mkdir(baseOutputPath, { recursive: true });
  const manifestPath = path.join(baseOutputPath, "media-thumbnails-manifest.json");
  let existingRecords = [];
  try {
    const existing = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (Array.isArray(existing.records)) {
      existingRecords = existing.records;
    }
  } catch {
    existingRecords = [];
  }
  const merged = new Map();
  for (const record of existingRecords) {
    merged.set(record.output || `${record.kind}:${record.id}`, record);
  }
  for (const record of records) {
    merged.set(record.output || `${record.kind}:${record.id}`, record);
  }
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      records: [...merged.values()].sort((a, b) => String(a.output).localeCompare(String(b.output))),
    }, null, 2)}\n`,
    "utf8",
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  const { manifest } = await readManifest(args.appRoot, args.mission);
  const thumbnailConfig = normalizeThumbnailConfig(manifest);
  const allJobs = buildMediaJobs(manifest).filter((job) => shouldIncludeKind(job, args.kind));
  const mediaJobs = allJobs
    .filter((job) => job.kind !== "audioClip")
    .slice(0, args.limit > 0 ? args.limit : undefined);
  const audioJobs = allJobs.filter((job) => job.kind === "audioClip");
  const records = [];

  if (audioJobs.length > 0 || args.kind === "audio" || args.kind === "all") {
    const audioRelativePath = joinRelativePath(thumbnailConfig.basePath, thumbnailConfig.audioFallbackAsset);
    const audioOutputPath = resolveDataRepoOutputPath(args.dataRoot, args.mission, audioRelativePath);
    const status = await writeAudioFallback(audioOutputPath, args);
    records.push({
      kind: "audioClip",
      id: "audio-waveform",
      output: path.relative(args.dataRoot, audioOutputPath).replace(/\\/g, "/"),
      status,
    });
  }

  const generated = await runWithConcurrency(mediaJobs, args.jobs, async (job) => {
    const relativePath = resolveThumbnailRelativePath(thumbnailConfig, job);
    const outputPath = resolveDataRepoOutputPath(args.dataRoot, args.mission, relativePath);
    try {
      const status = await generateWebpThumbnail(job, outputPath, args);
      console.log(`${status}: ${job.kind} ${job.file}`);
      return {
        id: job.id,
        kind: job.kind,
        source: job.sourceUrl,
        output: path.relative(args.dataRoot, outputPath).replace(/\\/g, "/"),
        status,
      };
    } catch (error) {
      console.warn(`failed: ${job.kind} ${job.file}: ${error.message}`);
      return {
        id: job.id,
        kind: job.kind,
        source: job.sourceUrl,
        output: path.relative(args.dataRoot, outputPath).replace(/\\/g, "/"),
        status: "failed",
        error: error.message,
      };
    }
  });
  records.push(...generated);

  const baseOutputPath = resolveDataRepoOutputPath(
    args.dataRoot,
    args.mission,
    thumbnailConfig.basePath,
  );
  await writeGenerationManifest(baseOutputPath, records, args.dryRun);

  const counts = records.reduce((acc, record) => {
    acc[record.status] = (acc[record.status] || 0) + 1;
    return acc;
  }, {});
  console.log(`\nThumbnail generation summary for ${args.mission}:`);
  console.log(JSON.stringify(counts, null, 2));
  return records.some((record) => record.status === "failed") ? 1 : 0;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
