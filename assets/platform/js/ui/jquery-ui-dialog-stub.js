(function () {
    if (typeof window === "undefined") return;
    if (!window.jQuery) return;

    const $ = window.jQuery;

    let dialogIdCounter = 0;
    let progressbarIdCounter = 0;
    let overlayIdCounter = 0;

    function ensureDialog($el, options) {
        const existing = $el.data("dialogWrapper");
        if (existing) {
            return existing;
        }

        const title = options?.title ?? "";
        const dialogId = `ui-id-${++dialogIdCounter}`;

        const $wrapper = $("<div></div>")
            .addClass(
                [
                    "ui-dialog",
                    "ui-widget",
                    "ui-widget-content",
                    "ui-corner-all",
                    "ui-front",
                    options?.dialogClass || "",
                ]
                    .filter(Boolean)
                    .join(" "),
            )
            .attr("tabindex", "-1")
            .attr("role", "dialog")
            .attr("aria-labelledby", dialogId)
            .css({ position: "absolute" });

        const $titlebar = $("<div></div>")
            .addClass("ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix");

        const $title = $("<span></span>")
            .addClass("ui-dialog-title")
            .attr("id", dialogId)
            .text(title);

        const $closeButton = $("<button></button>")
            .attr("type", "button")
            .attr("title", "close")
            .attr("aria-label", "close")
            .addClass(
                "ui-button ui-widget ui-state-default ui-corner-all ui-button-icon-only ui-dialog-titlebar-close",
            );

        const $closeIcon = $("<span></span>").addClass(
            "ui-button-icon-primary ui-icon ui-icon-closethick",
        );
        const $closeText = $("<span></span>").addClass("ui-button-text").text("close");
        $closeButton.append($closeIcon, $closeText);

        $titlebar.append($closeButton, $title);

        $el.addClass("ui-dialog-content ui-widget-content").css({ display: "block" });
        $wrapper.append($titlebar, $el);
        $("body").append($wrapper);

        $el.data("dialogWrapper", $wrapper);
        $el.data("dialogOptions", options || {});

        $closeButton.on("click", function () {
            dialogApi.close($el);
        });

        return $wrapper;
    }

    function ensureOverlay($wrapper, options) {
        const existing = $wrapper.data("modalOverlay");
        if (existing) return existing;

        const overlayId = `cy3-modal-${++overlayIdCounter}`;
        const $overlay = $("<div></div>")
            .addClass(["cy3-modal-overlay", options?.overlayClass || ""].filter(Boolean).join(" "))
            .attr("id", overlayId)
            .attr("role", "presentation")
            .hide();

        $("body").append($overlay);
        $wrapper.data("modalOverlay", $overlay);

        if (options?.closeOnOverlayClick) {
            $overlay.on("click", function () {
                dialogApi.close($wrapper.find(".ui-dialog-content").first());
            });
        }

        return $overlay;
    }

    function applyPosition($wrapper, options) {
        const position = options?.position;
        if (!position || !position.of) return;

        const of =
            typeof position.of === "string"
                ? document.querySelector(position.of)
                : position.of;
        if (!of) return;

        const rect = of.getBoundingClientRect();
        const top = Math.round(rect.bottom);
        const left = Math.round(rect.left);

        // jQuery UI uses absolute positioning (document coords). In our layout, fixed works the same
        // because #svg-top-baseline is fixed; absolute also works but needs scroll offsets.
        $wrapper.css({
            position: "fixed",
            top: `${top}px`,
            left: `${left}px`,
        });
    }

    $.fn.dialog = function (arg) {
        if (typeof arg === "string") {
            const command = arg;

            if (command === "open") {
                dialogApi.open(this);
                return this;
            }

            if (command === "close") {
                dialogApi.close(this);
                return this;
            }

            if (command === "widget") {
                return dialogApi.widget(this);
            }

            return this;
        }

        const options = arg || {};
        dialogApi.init(this, options);
        dialogApi.open(this);

        return this;
    };

    $.fn.dialogExtend = function () {
        return this;
    };

    function normalizeDialogTarget(target) {
        if (!target) return $();
        if (typeof target === "string") return $(target);
        if (target instanceof $) return target;
        return $(target);
    }

    const dialogApi = {
        init(target, options) {
            const $el = normalizeDialogTarget(target);
            if (!$el.length) return $el;

            $el.each(function () {
                const $node = $(this);
                const $wrapper = ensureDialog($node, options || {});
                $node.data("dialogOptions", options || {});

                // Update title if changed.
                if (typeof options?.title === "string") {
                    const labelledBy = $wrapper.attr("aria-labelledby");
                    if (labelledBy) {
                        const titleNode = document.getElementById(labelledBy);
                        if (titleNode) titleNode.textContent = options.title;
                    }
                }

                applyPosition($wrapper, options || {});
            });

            return $el;
        },

        open(target) {
            const $el = normalizeDialogTarget(target);
            if (!$el.length) return $el;
            $el.each(function () {
                const $node = $(this);
                const $wrapper = $node.data("dialogWrapper");
                const options = $node.data("dialogOptions") || {};

                if (options.modal && $wrapper) {
                    const $overlay = ensureOverlay($wrapper, options);
                    $overlay.show();
                    $("body").addClass("cy3-modal-open");
                }

                if ($wrapper) $wrapper.show();
                else $node.show();
            });
            return $el;
        },

        close(target) {
            const $el = normalizeDialogTarget(target);
            if (!$el.length) return $el;
            $el.each(function () {
                const $node = $(this);
                const $wrapper = $node.data("dialogWrapper");
                const options = $node.data("dialogOptions") || {};

                if ($wrapper) $wrapper.hide();
                else $node.hide();

                if (options.modal && $wrapper) {
                    const $overlay = $wrapper.data("modalOverlay");
                    if ($overlay) $overlay.hide();
                    $("body").removeClass("cy3-modal-open");
                }
            });
            return $el;
        },

        widget(target) {
            const $el = normalizeDialogTarget(target).first();
            if (!$el.length) return $();
            const $wrapper = $el.data("dialogWrapper");
            return $wrapper || $();
        },

        widgetElement(target) {
            const $wrapper = dialogApi.widget(target);
            if (!$wrapper || !$wrapper.length) return null;
            return $wrapper.get ? $wrapper.get(0) : $wrapper[0] || null;
        },
    };

    // Expose a tiny non-jQuery-UI API so app code can avoid calling $.fn.dialog directly,
    // while keeping $.fn.dialog available for back-compat and tests.
    window.CY3Dialog = window.CY3Dialog || dialogApi;

    function ensureProgressbar($el) {
        const existing = $el.data("progressbarValueDiv");
        if (existing) return existing;

        $el.addClass("ui-progressbar ui-widget ui-widget-content ui-corner-all")
            .attr("role", "progressbar")
            .attr("aria-valuemin", "0")
            .attr("aria-valuemax", "100");

        if (!$el.attr("id")) {
            $el.attr("id", `ui-progressbar-${++progressbarIdCounter}`);
        }

        const $valueDiv = $("<div></div>")
            .addClass("ui-progressbar-value ui-widget-header ui-corner-left")
            .css({ width: "0%" });

        $el.append($valueDiv);
        $el.data("progressbarValueDiv", $valueDiv);
        return $valueDiv;
    }

    function clampValue(value) {
        if (value === false || value == null) return false;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 0;
        return Math.max(0, Math.min(100, parsed));
    }

    function setProgressbarValue($el, value) {
        const $valueDiv = ensureProgressbar($el);
        const normalized = clampValue(value);

        if (normalized === false) {
            $el.addClass("ui-progressbar-indeterminate").removeAttr("aria-valuenow");
            $valueDiv.css({ width: "100%" });
            return;
        }

        $el.removeClass("ui-progressbar-indeterminate").attr("aria-valuenow", String(normalized));
        $valueDiv.css({ width: `${normalized}%` });
    }

    $.fn.progressbar = function (arg1, arg2, arg3) {
        if (typeof arg1 === "string") {
            const command = arg1;

            if (command === "option") {
                const optionKey = arg2;
                const optionValue = arg3;

                if (optionKey === "value") {
                    this.each(function () {
                        const $el = $(this);
                        $el.data("progressbarValue", optionValue);
                        setProgressbarValue($el, optionValue);
                    });
                }

                return this;
            }

            if (command === "value") {
                if (typeof arg2 === "undefined") {
                    const $el = this.first();
                    return $el.data("progressbarValue");
                }

                this.each(function () {
                    const $el = $(this);
                    $el.data("progressbarValue", arg2);
                    setProgressbarValue($el, arg2);
                });
                return this;
            }

            if (command === "destroy") {
                this.each(function () {
                    const $el = $(this);
                    const $valueDiv = $el.data("progressbarValueDiv");
                    if ($valueDiv) $valueDiv.remove();
                    $el.removeData("progressbarValueDiv");
                    $el.removeData("progressbarValue");
                    $el.removeClass(
                        "ui-progressbar ui-widget ui-widget-content ui-corner-all ui-progressbar-indeterminate",
                    )
                        .removeAttr("role")
                        .removeAttr("aria-valuemin")
                        .removeAttr("aria-valuemax")
                        .removeAttr("aria-valuenow");
                });
                return this;
            }

            return this;
        }

        const options = arg1 || {};
        this.each(function () {
            const $el = $(this);
            ensureProgressbar($el);

            const initialValue =
                Object.prototype.hasOwnProperty.call(options, "value")
                    ? options.value
                    : $el.data("progressbarValue");

            if (typeof initialValue !== "undefined") {
                $el.data("progressbarValue", initialValue);
                setProgressbarValue($el, initialValue);
            }
        });

        return this;
    };
})();
