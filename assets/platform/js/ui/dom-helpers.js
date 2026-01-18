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
    let value = bar.querySelector(".ui-progressbar-value");
    if (!value) {
        value = document.createElement("div");
        value.className = "ui-progressbar-value";
        bar.insertBefore(value, bar.firstChild);
    }
}

