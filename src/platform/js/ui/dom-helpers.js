/**
 * UI DOM Helpers
 *
 * Small imperative-shell helpers for interacting with mission.html DOM.
 * These are intentionally tiny and side-effectful, to keep mission logic cleaner.
 */

export function readCheckedRadioValue(name, fallback = "") {
    const node = document.querySelector(`input[name="${name}"]:checked`);
    return node?.value ?? fallback;
}

export function showElementById(id) {
    const node = document.getElementById(id);
    if (!node) return;
    node.style.display = "";
}

export function hideElementById(id) {
    const node = document.getElementById(id);
    if (!node) return;
    node.style.display = "none";
}

export function toggleVisibilityById(id) {
    const node = document.getElementById(id);
    if (!node) return;
    const isHidden = getComputedStyle(node).display === "none";
    node.style.display = isHidden ? "" : "none";
}

export function ensureIndeterminateProgressBar(progressbarId = "progressbar") {
    const bar = document.getElementById(progressbarId);
    if (!bar) return;

    bar.classList.add("ui-progressbar", "ui-progressbar-indeterminate");
    bar.setAttribute("role", "progressbar");
    bar.removeAttribute("aria-valuenow");
    bar.removeAttribute("aria-valuemin");
    bar.removeAttribute("aria-valuemax");
    let value = bar.querySelector(".ui-progressbar-value");
    if (!value) {
        value = document.createElement("div");
        value.className = "ui-progressbar-value";
        bar.insertBefore(value, bar.firstChild);
    }
}

function getOrCreateProgressValueDiv(progressbarId = "progressbar") {
    const bar = document.getElementById(progressbarId);
    if (!bar) return { bar: null, valueDiv: null };

    let valueDiv = bar.querySelector(".ui-progressbar-value");
    if (!valueDiv) {
        valueDiv = document.createElement("div");
        valueDiv.className = "ui-progressbar-value";
        bar.insertBefore(valueDiv, bar.firstChild);
    }

    return { bar, valueDiv };
}

export function ensureDeterminateProgressBar(progressbarId = "progressbar", value = 0) {
    const { bar, valueDiv } = getOrCreateProgressValueDiv(progressbarId);
    if (!bar || !valueDiv) return;

    const normalized = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
    bar.classList.add("ui-progressbar");
    bar.classList.remove("ui-progressbar-indeterminate");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(Math.round(normalized)));
    valueDiv.style.width = `${normalized}%`;
}

export function setProgressBarValue(progressbarId = "progressbar", value = 0) {
    ensureDeterminateProgressBar(progressbarId, value);
}
