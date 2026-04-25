#!/usr/bin/env node

import { resolve } from "path";

import { DEFAULT_SITE_URL, getAppRoot, writeMissionPages } from "./lib/mission-pages.mjs";

function parseArgs(argv) {
    const options = {
        appRoot: null,
        outputRoot: null,
        siteUrl: DEFAULT_SITE_URL,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--app-root") {
            options.appRoot = argv[index + 1] || null;
            index += 1;
            continue;
        }
        if (arg === "--output-root") {
            options.outputRoot = argv[index + 1] || null;
            index += 1;
            continue;
        }
        if (arg === "--site-url") {
            options.siteUrl = argv[index + 1] || DEFAULT_SITE_URL;
            index += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    return options;
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const appRoot = getAppRoot(options.appRoot);
    const outputRoot = resolve(options.outputRoot || resolve(appRoot, "pages"));
    const result = writeMissionPages({
        appRoot,
        outputRoot,
        siteUrl: options.siteUrl,
    });
    process.stdout.write(`Generated ${result.writtenCount} mission pages in ${result.outputRoot}\n`);
}

main();
