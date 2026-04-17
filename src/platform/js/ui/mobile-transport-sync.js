const DEFAULT_DESKTOP_TRANSPORT_IDS = {
    play: "animate",
    now: "missionnow",
    slower: "slower",
    faster: "faster",
    speed: "realtime",
};

function bindMobileTransportSync(deps) {
    const {
        mobileTransportSets = [],
        documentRef = document,
        windowRef = window,
        dispatchSyntheticPress,
        desktopTransportIds = DEFAULT_DESKTOP_TRANSPORT_IDS,
    } = deps;
    const MutationObserverRef =
        deps.MutationObserverRef ??
        (typeof MutationObserver === "function" ? MutationObserver : null);
    const desktopPlay = documentRef.getElementById(desktopTransportIds.play);
    const desktopNow = documentRef.getElementById(desktopTransportIds.now);
    const desktopSlower = documentRef.getElementById(desktopTransportIds.slower);
    const desktopFaster = documentRef.getElementById(desktopTransportIds.faster);
    const desktopSpeed = documentRef.getElementById(desktopTransportIds.speed);

    const proxyClick = (desktopId) => {
        const target = documentRef.getElementById(desktopId);
        if (!target || target.disabled) return;
        target.click();
    };

    const proxyPress = (desktopId) => {
        const target = documentRef.getElementById(desktopId);
        if (!target || target.disabled) return;
        dispatchSyntheticPress(target, "touch");
    };

    const syncTransportState = () => {
        mobileTransportSets.forEach((set) => {
            if (set.play && desktopPlay) {
                const isPlaying = (desktopPlay.textContent || "").trim().toLowerCase() === "pause";
                set.play.textContent = isPlaying ? "Pause" : "Play";
                set.play.classList.toggle("is-active", isPlaying);
            }
            if (set.now && desktopNow) {
                set.now.textContent = (desktopNow.textContent || "").trim() || "Now";
                set.now.title = desktopNow.title || "Jump to current time";
                set.now.setAttribute(
                    "aria-label",
                    desktopNow.getAttribute("aria-label") || "Jump to current time",
                );
                set.now.disabled = !!desktopNow.disabled;
                set.now.setAttribute("aria-disabled", desktopNow.disabled ? "true" : "false");
            }
            if (set.slower && desktopSlower) {
                set.slower.disabled = !!desktopSlower.disabled;
                set.slower.setAttribute("aria-disabled", desktopSlower.disabled ? "true" : "false");
            }
            if (set.faster && desktopFaster) {
                set.faster.disabled = !!desktopFaster.disabled;
                set.faster.setAttribute("aria-disabled", desktopFaster.disabled ? "true" : "false");
            }
            if (set.speed && desktopSpeed) {
                set.speed.textContent = (desktopSpeed.textContent || "").trim() || "1x";
                set.speed.setAttribute(
                    "aria-label",
                    desktopSpeed.getAttribute("aria-label") || "Current speed. Click to set realtime (1 sec/sec).",
                );
                set.speed.title = desktopSpeed.title || "Set speed to realtime (1 sec/sec)";
                const isRealtime = desktopSpeed.classList.contains("down");
                set.speed.classList.toggle("is-active", isRealtime);
                set.speed.disabled = !!desktopSpeed.disabled;
                set.speed.setAttribute("aria-disabled", desktopSpeed.disabled ? "true" : "false");
            }
        });
    };

    const queueTransportSync = () => {
        if (typeof windowRef?.requestAnimationFrame !== "function") {
            syncTransportState();
            return;
        }
        windowRef.requestAnimationFrame(() => {
            windowRef.requestAnimationFrame(() => {
                syncTransportState();
            });
        });
    };

    const bindTransportClick = (button, handler) => {
        if (!button) return;
        button.addEventListener("click", function () {
            handler();
            queueTransportSync();
        });
    };

    mobileTransportSets.forEach((set) => {
        bindTransportClick(set.play, () => proxyClick(desktopTransportIds.play));
        bindTransportClick(set.now, () => proxyClick(desktopTransportIds.now));
        bindTransportClick(set.slower, () => proxyPress(desktopTransportIds.slower));
        bindTransportClick(set.faster, () => proxyPress(desktopTransportIds.faster));
        bindTransportClick(set.speed, () => proxyPress(desktopTransportIds.speed));
    });

    syncTransportState();

    if (typeof MutationObserverRef === "function") {
        const observeTransport = (target, options) => {
            if (!target) return;
            const observer = new MutationObserverRef(syncTransportState);
            observer.observe(target, options);
        };

        observeTransport(desktopPlay, {
            childList: true,
            characterData: true,
            subtree: true,
            attributes: true,
        });
        observeTransport(desktopNow, {
            attributes: true,
            attributeFilter: ["class", "aria-pressed", "aria-label", "title", "disabled"],
            childList: true,
            characterData: true,
            subtree: true,
        });
        observeTransport(desktopSlower, {
            attributes: true,
            attributeFilter: ["class", "aria-pressed", "disabled", "aria-disabled"],
        });
        observeTransport(desktopFaster, {
            attributes: true,
            attributeFilter: ["class", "aria-pressed", "disabled", "aria-disabled"],
        });
        observeTransport(desktopSpeed, {
            childList: true,
            characterData: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["title", "aria-label", "class", "aria-pressed", "disabled"],
        });
    }

    return {
        syncTransportState,
    };
}

export { bindMobileTransportSync };
