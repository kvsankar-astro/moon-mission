import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const auditScript = join(repoRoot, "scripts", "audit-data-repo-boundary.py");
const rulesPath = join(repoRoot, "scripts", "data-repo-boundary-rules.json");
const stageScript = join(repoRoot, "scripts", "stage-ephemeris-data.py");
const tempRoots = [];

function makeTempRoot() {
    const root = mkdtempSync(join(tmpdir(), "moon-mission-audit-"));
    tempRoots.push(root);
    return root;
}

function writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2));
}

function writeText(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, value);
}

function initGitRepo(root) {
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["add", "-A"], { cwd: root, stdio: "ignore" });
}

function makeManifest() {
    return {
        format: "ephemeris-manifest",
        version: "1.0",
        mission: "sample",
        phases: {
            geo: {
                artifacts: {
                    npz: { runtime: "geo-TST.npz" },
                    chebyshev: { runtime: "geo-TST-cheb.json" },
                    meta: { runtime: "geo-TST-meta.json" },
                },
            },
            lunar: {
                artifacts: {
                    npz: { runtime: "lunar-TST.npz" },
                    chebyshev: { runtime: "lunar-TST-cheb.json" },
                    meta: { runtime: "lunar-TST-meta.json" },
                },
            },
        },
    };
}

function makeChebFile(bodies) {
    return {
        format: "chebyshev-ephemeris",
        version: "1.0",
        metadata: {
            bodies,
        },
        time_range: {
            start: 0,
            end: 1,
        },
    };
}

function setupFixture({ bad = false } = {}) {
    const root = makeTempRoot();
    const appRoot = join(root, "app");
    const dataRoot = join(root, "data");

    writeJson(join(appRoot, "assets", "mission-catalog.json"), {
        missions: [{ folder: "sample" }],
    });
    writeJson(join(appRoot, "assets", "sample", "data", "config.json"), {
        spacecraft_mnemonic: "TST",
        relative: {
            orbits_file: "relative-TST",
        },
    });
    const manifest = makeManifest();
    writeJson(join(appRoot, "assets", "sample", "data", "ephemeris-manifest.json"), manifest);
    writeText(
        join(appRoot, "scripts", "stage-ephemeris-data.py"),
        readFileSync(stageScript, "utf-8"),
    );

    writeJson(join(dataRoot, "assets", "sample", "data", "ephemeris-manifest.json"), manifest);
    writeText(join(dataRoot, "assets", "sample", "data", "geo-TST.npz"), "geo");
    writeText(join(dataRoot, "assets", "sample", "data", "lunar-TST.npz"), "lunar");
    if (!bad) {
        writeText(join(dataRoot, "assets", "sample", "data", "relative-TST.npz"), "relative");
    }

    writeJson(
        join(dataRoot, "assets", "sample", "data", "geo-TST-cheb.json"),
        makeChebFile(bad ? ["TST", "EARTH", "MOON", "SUN"] : ["TST", "MOON", "SUN"]),
    );
    writeJson(
        join(dataRoot, "assets", "sample", "data", "lunar-TST-cheb.json"),
        makeChebFile(["TST", "EARTH", "SUN"]),
    );
    writeJson(
        join(dataRoot, "assets", "sample", "data", "relative-TST-cheb.json"),
        makeChebFile(bad ? ["TST", "MOON", "SUN"] : ["TST", "MOON", "SUN", "FRAME_ROT"]),
    );

    writeText(join(dataRoot, "assets", "sample", "data", "geo-TST-cheb.json.gz"), "gz");
    if (!bad) {
        writeText(join(dataRoot, "assets", "sample", "data", "lunar-TST-cheb.json.gz"), "gz");
    }
    writeText(join(dataRoot, "assets", "sample", "data", "relative-TST-cheb.json.gz"), "gz");
    writeText(join(dataRoot, "assets", "sample", "data", "geo-TST-meta.json"), "{}");
    writeText(join(dataRoot, "assets", "sample", "data", "lunar-TST-meta.json"), "{}");

    initGitRepo(appRoot);
    initGitRepo(dataRoot);
    return { appRoot, dataRoot };
}

function runAudit(appRoot, dataRoot) {
    const output = execFileSync(
        "python",
        [
            auditScript,
            "--app-root",
            appRoot,
            "--data-root",
            dataRoot,
            "--rules",
            rulesPath,
            "--format",
            "json",
        ],
        {
            encoding: "utf-8",
        },
    );
    return JSON.parse(output);
}

describe("audit-data-repo-boundary origin integrity checks", () => {
    afterEach(() => {
        while (tempRoots.length) {
            rmSync(tempRoots.pop(), { recursive: true, force: true });
        }
    });

    it("passes missions with all three origins, compressed chebyshev, and expected bodies", () => {
        const { appRoot, dataRoot } = setupFixture();
        const report = runAudit(appRoot, dataRoot);

        expect(report.summary.missing_required_artifacts).toBe(0);
        expect(report.summary.origin_integrity_issues).toBe(0);
        expect(report.origin_integrity.issues).toEqual([]);
    });

    it("flags missing compressed coverage, wrong origin bodies, and missing relative orbit data", () => {
        const { appRoot, dataRoot } = setupFixture({ bad: true });
        const report = runAudit(appRoot, dataRoot);
        const issueKinds = report.origin_integrity.issues.map((issue) => issue.kind);

        expect(report.summary.missing_required_artifacts).toBeGreaterThan(0);
        expect(issueKinds).toContain("contains-origin-degenerate-body");
        expect(issueKinds).toContain("missing-compressed-chebyshev");
        expect(issueKinds).toContain("missing-relative-npz");
        expect(issueKinds).toContain("missing-frame-rot");
    });
});
