import { getMissionPanelDetails } from "./panel-registry.js";

let root = null;
let activePanelId = "";
let outsideClickBound = false;
let escapeBound = false;

function ensureRoot() {
    if (root) {
        return root;
    }
    root = document.createElement("div");
    root.className = "panel-info-popover";
    root.hidden = true;
    document.body.appendChild(root);
    return root;
}

function hideMissionPanelInfo() {
    if (!root) {
        return;
    }
    root.hidden = true;
    activePanelId = "";
}

function renderInfoMarkup(panel) {
    const baseItems = [
        { label: "Title", value: panel?.title || "--" },
        { label: "Kind", value: panel?.kind || panel?.panelType || "--" },
        { label: "Panel Type", value: panel?.panelType || "--" },
        { label: "Panel Id", value: panel?.id || "--" },
        { label: "Origin", value: panel?.builtIn === true ? "Built-in" : "User-created" },
        { label: "State", value: panel?.state || "--" },
    ];
    const infoItems = Array.isArray(panel?.infoItems) ? panel.infoItems : [];
    const rows = [...baseItems, ...infoItems]
        .filter((item) => item && typeof item === "object")
        .map((item) => `
            <div class="panel-info-popover__row">
                <div class="panel-info-popover__label">${item.label || "--"}</div>
                <div class="panel-info-popover__value">${item.value || "--"}</div>
            </div>
        `)
        .join("");

    return `
        <div class="panel-info-popover__header">
            <div class="panel-info-popover__title">Panel Info</div>
            <button type="button" class="panel-info-popover__close" aria-label="Close panel info" title="Close">x</button>
        </div>
        <div class="panel-info-popover__body">${rows}</div>
    `;
}

function positionPopover(anchorEl) {
    if (!root || !(anchorEl instanceof Element)) {
        return;
    }
    const rect = anchorEl.getBoundingClientRect();
    const popRect = root.getBoundingClientRect();
    const width = Math.max(popRect.width || 280, 220);
    const height = Math.max(popRect.height || 180, 120);
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    let left = rect.right + 6;
    let top = rect.top;
    if (left > maxLeft) {
        left = rect.left - width - 6;
    }
    if (left < margin) {
        left = maxLeft;
    }
    if (top > maxTop) {
        top = maxTop;
    }
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
}

function ensureGlobalDismissHandlers() {
    if (!outsideClickBound) {
        document.addEventListener("pointerdown", (event) => {
            if (!root || root.hidden) {
                return;
            }
            if (event.target instanceof Element && (root.contains(event.target) || event.target.closest("[data-panel-info-trigger='true']"))) {
                return;
            }
            hideMissionPanelInfo();
        });
        outsideClickBound = true;
    }
    if (!escapeBound) {
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                hideMissionPanelInfo();
            }
        });
        escapeBound = true;
    }
}

function showMissionPanelInfo(panelId, anchorEl) {
    const panel = getMissionPanelDetails(panelId);
    if (!panel) {
        return false;
    }
    ensureGlobalDismissHandlers();
    const popover = ensureRoot();
    if (activePanelId === panelId && !popover.hidden) {
        hideMissionPanelInfo();
        return true;
    }
    popover.innerHTML = renderInfoMarkup(panel);
    popover.hidden = false;
    popover.querySelector(".panel-info-popover__close")?.addEventListener("click", () => {
        hideMissionPanelInfo();
    });
    activePanelId = panelId;
    positionPopover(anchorEl);
    return true;
}

export {
    hideMissionPanelInfo,
    showMissionPanelInfo,
};
