(function () {
    "use strict";

    const POLL_INTERVAL_MS = 2 * 60 * 1000;
    const INITIAL_POLL_DELAY_MS = 20 * 1000;
    const MAX_ANCESTOR_DEPTH = 4;

    let resolvedVersionUrl = null;
    let loadedVersionKey = null;
    let notifiedVersionKey = null;
    let bannerRoot = null;
    let bannerMessage = null;

    function trimString(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function shortCommit(commit) {
        const value = trimString(commit);
        if (!value) return "";
        return value.slice(0, 7);
    }

    function extractVersionKey(payload) {
        if (!payload || typeof payload !== "object") return "";
        const commit = trimString(payload?.app_repo?.git_commit);
        if (commit) return commit;
        const generatedAt = trimString(payload?.generated_at_utc);
        return generatedAt || "";
    }

    function buildVersionUrlCandidates() {
        const candidates = [];
        const pathname = window.location.pathname || "/";
        const parts = pathname.split("/").filter(Boolean);
        const hasFileName = !pathname.endsWith("/");
        const directories = hasFileName ? parts.slice(0, -1) : parts.slice();

        for (let depth = 0; depth <= Math.min(directories.length, MAX_ANCESTOR_DEPTH); depth += 1) {
            const prefixParts = directories.slice(0, directories.length - depth);
            const prefix = prefixParts.length ? `/${prefixParts.join("/")}/` : "/";
            candidates.push(`${window.location.origin}${prefix}deployment/version.json`);
        }

        // Last-resort absolute path.
        candidates.push(`${window.location.origin}/deployment/version.json`);
        return [...new Set(candidates)];
    }

    async function fetchVersion(url) {
        const requestUrl = `${url}${url.includes("?") ? "&" : "?"}vcheck=${Date.now()}`;
        const response = await fetch(requestUrl, {
            cache: "no-store",
            credentials: "same-origin",
        });
        if (!response.ok) {
            throw new Error(`Version check failed: ${response.status}`);
        }
        return response.json();
    }

    async function resolveVersionEndpoint() {
        const candidates = buildVersionUrlCandidates();
        for (const candidate of candidates) {
            try {
                const payload = await fetchVersion(candidate);
                if (!extractVersionKey(payload)) continue;
                return {
                    url: candidate,
                    payload,
                };
            } catch {
                // Continue probing.
            }
        }
        return null;
    }

    function ensureBannerUi() {
        if (bannerRoot && bannerMessage) return;

        const styleId = "site-update-notifier-style";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `
                .site-update-notifier {
                    position: fixed;
                    left: 50%;
                    bottom: 14px;
                    transform: translateX(-50%);
                    z-index: 2147483640;
                    display: none;
                    align-items: center;
                    gap: 10px;
                    max-width: min(92vw, 560px);
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(153, 198, 255, 0.5);
                    background: rgba(7, 14, 25, 0.92);
                    color: #e8f3ff;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
                    font: 600 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                .site-update-notifier__message {
                    flex: 1 1 auto;
                    min-width: 0;
                }
                .site-update-notifier__actions {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    flex: 0 0 auto;
                }
                .site-update-notifier__btn {
                    border: 1px solid rgba(172, 211, 255, 0.5);
                    border-radius: 7px;
                    padding: 4px 8px;
                    font: 600 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    color: #dff0ff;
                    background: rgba(23, 41, 66, 0.9);
                    cursor: pointer;
                }
                .site-update-notifier__btn--primary {
                    color: #081624;
                    background: #9fd0ff;
                    border-color: #c9e5ff;
                }
            `;
            document.head.appendChild(style);
        }

        bannerRoot = document.createElement("div");
        bannerRoot.className = "site-update-notifier";
        bannerRoot.setAttribute("role", "status");
        bannerRoot.setAttribute("aria-live", "polite");

        bannerMessage = document.createElement("span");
        bannerMessage.className = "site-update-notifier__message";
        bannerRoot.appendChild(bannerMessage);

        const actions = document.createElement("div");
        actions.className = "site-update-notifier__actions";

        const reloadButton = document.createElement("button");
        reloadButton.type = "button";
        reloadButton.className = "site-update-notifier__btn site-update-notifier__btn--primary";
        reloadButton.textContent = "Reload";
        reloadButton.addEventListener("click", () => {
            window.location.reload();
        });
        actions.appendChild(reloadButton);

        const dismissButton = document.createElement("button");
        dismissButton.type = "button";
        dismissButton.className = "site-update-notifier__btn";
        dismissButton.textContent = "Later";
        dismissButton.addEventListener("click", () => {
            if (bannerRoot) {
                bannerRoot.style.display = "none";
            }
        });
        actions.appendChild(dismissButton);

        bannerRoot.appendChild(actions);
        document.body.appendChild(bannerRoot);
    }

    function showUpdateBanner(payload) {
        ensureBannerUi();
        if (!bannerRoot || !bannerMessage) return;
        const commit = shortCommit(payload?.app_repo?.git_commit);
        bannerMessage.textContent = commit
            ? `A new update is available (${commit}).`
            : "A new update is available.";
        bannerRoot.style.display = "inline-flex";
    }

    async function checkForUpdates() {
        if (document.visibilityState === "hidden") return;
        try {
            if (!resolvedVersionUrl) {
                const resolved = await resolveVersionEndpoint();
                if (!resolved?.url) return;
                resolvedVersionUrl = resolved.url;
                loadedVersionKey = extractVersionKey(resolved.payload);
                return;
            }

            const latestPayload = await fetchVersion(resolvedVersionUrl);
            const latestKey = extractVersionKey(latestPayload);
            if (!latestKey || !loadedVersionKey) return;
            if (latestKey === loadedVersionKey) return;
            if (latestKey === notifiedVersionKey) return;

            notifiedVersionKey = latestKey;
            showUpdateBanner(latestPayload);
        } catch {
            // Silent by design: this is optional UX, never a hard failure.
        }
    }

    function start() {
        window.setTimeout(() => {
            checkForUpdates();
            window.setInterval(checkForUpdates, POLL_INTERVAL_MS);
        }, INITIAL_POLL_DELAY_MS);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                checkForUpdates();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();

