(function () {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    let dialogIdCounter = 0;
    let overlayIdCounter = 0;
    const dialogMap = new WeakMap();

    function resolveNode(target) {
        if (!target) return null;
        if (typeof target === "string") return document.querySelector(target);
        if (target instanceof Element) return target;
        return null;
    }

    function parseClasses(baseClasses, additional) {
        const list = [...baseClasses];
        if (typeof additional === "string" && additional.trim()) {
            list.push(...additional.trim().split(/\s+/));
        }
        return list.filter(Boolean).join(" ");
    }

    function applyDialogPosition(entry) {
        const position = entry.options?.position;
        if (!position || !position.of) return;

        const anchor = resolveNode(position.of);
        if (!anchor) return;

        const rect = anchor.getBoundingClientRect();
        entry.wrapper.style.position = "fixed";
        entry.wrapper.style.top = `${Math.round(rect.bottom)}px`;
        entry.wrapper.style.left = `${Math.round(rect.left)}px`;
    }

    function setDialogTitle(entry, title) {
        if (typeof title === "string") {
            entry.title.textContent = title;
        }
    }

    function ensureOverlay(entry) {
        if (entry.overlay) return entry.overlay;

        const overlay = document.createElement("div");
        overlay.id = `mission-modal-${++overlayIdCounter}`;
        overlay.setAttribute("role", "presentation");
        overlay.className = parseClasses(
            ["mission-modal-overlay", "cy3-modal-overlay"],
            entry.options?.overlayClass,
        );
        overlay.style.display = "none";

        if (entry.options?.closeOnOverlayClick) {
            overlay.addEventListener("click", () => dialogApi.close(entry.content));
        }

        document.body.appendChild(overlay);
        entry.overlay = overlay;
        return overlay;
    }

    function syncModalClasses() {
        const hasOpenModal = Array.from(
            document.querySelectorAll(".mission-modal-overlay, .cy3-modal-overlay"),
        ).some((overlay) => overlay.style.display !== "none");
        if (hasOpenModal) {
            document.body.classList.add("mission-modal-open", "cy3-modal-open");
            return;
        }
        document.body.classList.remove("mission-modal-open", "cy3-modal-open");
    }

    function getDialogEntry(target) {
        const content = resolveNode(target);
        if (!content) return null;
        return dialogMap.get(content) || null;
    }

    function ensureDialog(target, options = {}) {
        const content = resolveNode(target);
        if (!content) return null;

        let entry = dialogMap.get(content);
        if (!entry) {
            const dialogId = `ui-id-${++dialogIdCounter}`;

            const wrapper = document.createElement("div");
            wrapper.className = parseClasses(
                ["ui-dialog", "ui-widget", "ui-widget-content", "ui-corner-all", "ui-front"],
                options.dialogClass,
            );
            wrapper.setAttribute("tabindex", "-1");
            wrapper.setAttribute("role", "dialog");
            wrapper.setAttribute("aria-labelledby", dialogId);
            wrapper.style.position = "absolute";
            wrapper.style.display = "none";

            const titlebar = document.createElement("div");
            titlebar.className = "ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix";

            const closeButton = document.createElement("button");
            closeButton.type = "button";
            closeButton.title = "close";
            closeButton.setAttribute("aria-label", "close");
            closeButton.className =
                "ui-button ui-widget ui-state-default ui-corner-all ui-button-icon-only ui-dialog-titlebar-close";

            const closeIcon = document.createElement("span");
            closeIcon.className = "ui-button-icon-primary ui-icon ui-icon-closethick";

            const closeText = document.createElement("span");
            closeText.className = "ui-button-text";
            closeText.textContent = "close";

            const title = document.createElement("span");
            title.className = "ui-dialog-title";
            title.id = dialogId;

            closeButton.append(closeIcon, closeText);
            titlebar.append(closeButton, title);

            content.classList.add("ui-dialog-content", "ui-widget-content");
            content.style.display = "block";

            wrapper.append(titlebar, content);
            document.body.appendChild(wrapper);

            entry = {
                content,
                wrapper,
                title,
                overlay: null,
                options: {},
            };
            dialogMap.set(content, entry);

            closeButton.addEventListener("click", () => dialogApi.close(content));
        }

        entry.options = {...entry.options, ...options};
        entry.wrapper.className = parseClasses(
            ["ui-dialog", "ui-widget", "ui-widget-content", "ui-corner-all", "ui-front"],
            entry.options?.dialogClass,
        );
        setDialogTitle(entry, entry.options?.title ?? "");
        applyDialogPosition(entry);
        return entry;
    }

    const dialogApi = {
        init(target, options = {}) {
            const entry = ensureDialog(target, options);
            return entry ? entry.content : null;
        },

        open(target) {
            const entry = ensureDialog(target);
            if (!entry) return null;

            entry.content.style.display = "block";
            entry.wrapper.style.display = "block";
            applyDialogPosition(entry);

            if (entry.options?.modal) {
                const overlay = ensureOverlay(entry);
                overlay.style.display = "block";
                document.body.classList.add("mission-modal-open", "cy3-modal-open");
            }

            return entry.content;
        },

        close(target) {
            const entry = getDialogEntry(target);
            if (!entry) return null;

            entry.wrapper.style.display = "none";
            if (entry.overlay) {
                entry.overlay.style.display = "none";
            }
            syncModalClasses();
            return entry.content;
        },

        widget(target) {
            const entry = getDialogEntry(target);
            return entry ? entry.wrapper : null;
        },

        widgetElement(target) {
            return dialogApi.widget(target);
        },
    };

    window.MissionDialog = dialogApi;
    window.CY3Dialog = dialogApi;
})();
