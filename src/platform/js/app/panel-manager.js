import {
    invokeMissionPanelAction,
    subscribeMissionPanels,
} from "./panel-registry.js";
import { showMissionPanelInfo } from "./panel-info-popover.js";
import { isDomElement } from "../ui/dom-helpers.js";

function isDesktopViewport() {
    return typeof window !== "undefined" && window.innerWidth > 600;
}

function actionLabelForPanel(panel) {
    if (panel?.state === "open") return "Focus";
    if (panel?.state === "deleted") return "Add";
    if (panel?.state === "closed") return "Open";
    return "Restore";
}

function actionNameForPanel(panel) {
    if (panel?.state === "open") {
        if (panel?.actions?.focus === true) {
            return "focus";
        }
        if (panel?.actions?.open === true) {
            return "open";
        }
    }
    if (panel?.actions?.restore === true) {
        return "restore";
    }
    if (panel?.actions?.open === true) {
        return "open";
    }
    return "";
}

class DesktopPanelManager {
    static getGlobalInstanceKey() {
        return "__moonMissionDesktopPanelManager";
    }

    static removeStaleDom() {
        document.querySelectorAll(".panel-manager-root, .panel-manager-launcher-slot")
            .forEach((node) => node.remove());
    }

    /**
     * @param {{ overlayHost?: HTMLElement | null }} [options]
     */
    constructor({ overlayHost } = {}) {
        this.overlayHost = overlayHost || document.body;
        this.root = null;
        this.launcherSlot = null;
        this.launcher = null;
        this.menu = null;
        this.menuBody = null;
        this.panels = [];
        this.unsubscribe = null;
        this.menuOpen = false;
        this.handleDocumentPointerDownBound = this.handleDocumentPointerDown.bind(this);
        this.handleDocumentKeyDownBound = this.handleDocumentKeyDown.bind(this);
        this.handleResizeBound = this.handleResize.bind(this);

        if (!isDesktopViewport()) {
            return;
        }

        const globalInstanceKey = DesktopPanelManager.getGlobalInstanceKey();
        const previousInstance = globalThis?.[globalInstanceKey];
        if (previousInstance && previousInstance !== this && typeof previousInstance.dispose === "function") {
            previousInstance.dispose();
        }
        DesktopPanelManager.removeStaleDom();
        this.createDom();
        this.setMenuOpen(false);
        if (globalThis) {
            globalThis[globalInstanceKey] = this;
        }
        this.unsubscribe = subscribeMissionPanels((panels) => {
            this.panels = Array.isArray(panels) ? panels : [];
            this.render();
        });
        document.addEventListener("pointerdown", this.handleDocumentPointerDownBound);
        document.addEventListener("keydown", this.handleDocumentKeyDownBound);
        window.addEventListener("resize", this.handleResizeBound, { passive: true });
    }

    createDom() {
        this.root = document.createElement("div");
        this.root.className = "panel-manager-root";

        this.launcherSlot = document.createElement("div");
        this.launcherSlot.className = "panel-manager-launcher-slot header-pill-segment header-pill-segment--single";
        this.launcherSlot.hidden = true;

        this.launcher = document.createElement("button");
        this.launcher.type = "button";
        this.launcher.className = "panel-manager-launcher header-pill-segment__btn";
        this.launcher.textContent = "Advanced";
        this.launcher.hidden = true;
        this.launcher.setAttribute("aria-haspopup", "dialog");
        this.launcher.setAttribute("aria-expanded", "false");
        this.launcher.title = "Open advanced panel controls";
        this.launcher.addEventListener("click", () => {
            this.setMenuOpen(!this.menuOpen);
        });
        this.launcherSlot.appendChild(this.launcher);

        this.menu = document.createElement("section");
        this.menu.className = "panel-manager-menu";
        this.menu.setAttribute("aria-hidden", "true");
        this.menu.innerHTML = `
            <div class="panel-manager-menu__header">
                <div class="panel-manager-menu__title">Advanced Panels</div>
                <button type="button" class="panel-manager-menu__close" aria-label="Close panels menu" title="Close">x</button>
            </div>
            <div class="panel-manager-menu__body"></div>
        `;
        this.menuBody = this.menu.querySelector(".panel-manager-menu__body");
        const closeButton = this.menu.querySelector(".panel-manager-menu__close");
        closeButton?.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.setMenuOpen(false);
        });
        closeButton?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.setMenuOpen(false);
        });
        this.root.appendChild(this.menu);

        const headerRow = document.getElementById("panel-manager-launcher-mount") ||
            document.getElementById("header-pill-strip-tertiary") ||
            document.getElementById("header-pill-strip-secondary") ||
            document.getElementById("header-pill-strip-primary") ||
            document.getElementById("header-pill-strip") ||
            document.getElementById("header");
        if (isDomElement(headerRow)) {
            headerRow.appendChild(this.launcherSlot);
        } else {
            this.root.appendChild(this.launcherSlot);
        }

        this.overlayHost.appendChild(this.root);
    }

    handleDocumentPointerDown(event) {
        if (!this.menuOpen) {
            return;
        }
        if (!isDomElement(event.target)) {
            return;
        }
        if (this.menu?.contains(event.target) || this.launcher?.contains(event.target)) {
            return;
        }
        this.setMenuOpen(false);
    }

    handleDocumentKeyDown(event) {
        if (event.key === "Escape") {
            this.setMenuOpen(false);
        }
    }

    handleResize() {
        if (!isDesktopViewport()) {
            this.setMenuOpen(false);
            if (this.root) {
                this.root.hidden = true;
            }
            if (this.launcherSlot) {
                this.launcherSlot.hidden = true;
            }
            if (this.launcher) {
                this.launcher.hidden = true;
            }
            return;
        }
        if (this.root) {
            this.root.hidden = false;
        }
        this.render();
        this.positionMenu();
    }

    setMenuOpen(open) {
        this.menuOpen = open === true;
        if (this.menu) {
            this.menu.classList.toggle("is-open", this.menuOpen);
            this.menu.setAttribute("aria-hidden", this.menuOpen ? "false" : "true");
        }
        if (this.launcher) {
            this.launcher.setAttribute("aria-expanded", this.menuOpen ? "true" : "false");
        }
        if (this.menuOpen) {
            this.positionMenu();
        }
    }

    positionMenu() {
        if (!this.menu || !this.launcher || this.menuOpen !== true) {
            return;
        }
        const launcherRect = this.launcher.getBoundingClientRect();
        const menuRect = this.menu.getBoundingClientRect();
        const width = Math.max(menuRect.width || 320, 280);
        const height = Math.max(menuRect.height || 120, 100);
        const margin = 8;
        const maxLeft = Math.max(margin, window.innerWidth - width - margin);
        const maxTop = Math.max(margin, window.innerHeight - height - margin);
        let left = launcherRect.left;
        let top = launcherRect.bottom + 8;
        if (left > maxLeft) {
            left = maxLeft;
        }
        if (top > maxTop) {
            top = Math.max(margin, launcherRect.top - height - 8);
        }
        this.menu.style.left = `${Math.round(left)}px`;
        this.menu.style.top = `${Math.round(top)}px`;
    }

    createActionButton(panel, action, label) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "panel-manager-menu__action";
        button.textContent = label;
        const enabled = panel?.actions?.[action] === true;
        button.disabled = !enabled;
        if (enabled) {
            button.addEventListener("click", () => {
                invokeMissionPanelAction(panel.id, action);
                if (action === "restore" || action === "open") {
                    this.setMenuOpen(false);
                } else {
                    this.render();
                }
            });
        }
        return button;
    }

    createInfoButton(panel) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "panel-manager-menu__action";
        button.textContent = "Info";
        button.dataset.panelInfoTrigger = "true";
        button.addEventListener("click", () => {
            showMissionPanelInfo(panel.id, button);
        });
        return button;
    }

    createMenuRow(panel) {
        const row = document.createElement("div");
        row.className = "panel-manager-menu__row";

        const meta = document.createElement("div");
        meta.className = "panel-manager-menu__meta";

        const title = document.createElement("div");
        title.className = "panel-manager-menu__row-title";
        title.textContent = panel.title || panel.id;
        meta.appendChild(title);

        const badges = document.createElement("div");
        badges.className = "panel-manager-menu__badges";

        const stateBadge = document.createElement("span");
        stateBadge.className = "panel-manager-menu__badge";
        stateBadge.textContent = panel?.state || "hidden";
        badges.appendChild(stateBadge);

        if (panel.builtIn === true) {
            const builtInBadge = document.createElement("span");
            builtInBadge.className = "panel-manager-menu__badge panel-manager-menu__badge--muted";
            builtInBadge.textContent = "built-in";
            badges.appendChild(builtInBadge);
        }

        meta.appendChild(badges);
        row.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "panel-manager-menu__actions";
        actions.appendChild(this.createInfoButton(panel));
        const primaryAction = actionNameForPanel(panel);
        if (primaryAction) {
            actions.appendChild(this.createActionButton(panel, primaryAction, actionLabelForPanel(panel)));
        }
        row.appendChild(actions);
        return row;
    }

    createEmptyState() {
        const empty = document.createElement("div");
        empty.className = "panel-manager-menu__empty";
        empty.textContent = "All available panels are already on screen.";
        return empty;
    }

    createSection(titleText, panels) {
        const section = document.createElement("section");
        section.className = "panel-manager-menu__section";

        const title = document.createElement("div");
        title.className = "panel-manager-menu__section-title";
        title.textContent = titleText;
        section.appendChild(title);

        const list = document.createElement("div");
        list.className = "panel-manager-menu__rows";
        for (const panel of panels) {
            list.appendChild(this.createMenuRow(panel));
        }
        section.appendChild(list);
        return section;
    }

    renderLauncher() {
        if (!this.launcher) {
            return;
        }

        const actionablePanels = this.panels.filter((panel) => panel.available !== false);
        const shouldShowLauncher = actionablePanels.length > 0;

        if (!shouldShowLauncher && this.menuOpen) {
            this.setMenuOpen(false);
        }
        if (this.launcherSlot) {
            this.launcherSlot.hidden = !shouldShowLauncher;
        }
        this.launcher.hidden = !shouldShowLauncher;
        this.launcher.textContent = "Advanced";
    }

    renderMenu() {
        if (!this.menuBody) {
            return;
        }

        const missionPanels = this.panels.filter((panel) => panel.available !== false);
        const nonOpenPanels = missionPanels.filter((panel) =>
            panel.state === "minimized" ||
            panel.state === "closed" ||
            (panel.state === "deleted" && panel.builtIn === true));
        const openPanels = missionPanels.filter((panel) => panel.state === "open");

        const fragments = [];
        if (nonOpenPanels.length > 0) {
            fragments.push(this.createSection("Closed", nonOpenPanels));
        }
        if (openPanels.length > 0) {
            fragments.push(this.createSection("Open", openPanels));
        }
        const unavailablePanels = this.panels.filter((panel) => panel.available === false);
        if (unavailablePanels.length > 0) {
            fragments.push(this.createSection("Unavailable", unavailablePanels));
        }
        if (fragments.length === 0) {
            fragments.push(this.createEmptyState());
        }

        this.menuBody.replaceChildren(...fragments);
        this.positionMenu();
    }

    render() {
        this.renderLauncher();
        this.renderMenu();
    }

    dispose() {
        document.removeEventListener("pointerdown", this.handleDocumentPointerDownBound);
        document.removeEventListener("keydown", this.handleDocumentKeyDownBound);
        window.removeEventListener("resize", this.handleResizeBound);
        this.unsubscribe?.();
        this.unsubscribe = null;
        const globalInstanceKey = DesktopPanelManager.getGlobalInstanceKey();
        if (globalThis?.[globalInstanceKey] === this) {
            delete globalThis[globalInstanceKey];
        }
        this.root?.remove();
        this.launcherSlot?.remove();
        this.root = null;
        this.launcherSlot = null;
        this.launcher = null;
        this.menu = null;
        this.menuBody = null;
    }
}

export { DesktopPanelManager };
