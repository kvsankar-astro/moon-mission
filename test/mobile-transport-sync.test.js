import { describe, expect, it, vi } from "vitest";

import { bindMobileTransportSync } from "../src/platform/js/ui/mobile-transport-sync.js";

function createClassList(initialValues = []) {
    const values = new Set(initialValues);
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        toggle(value, force) {
            if (force === undefined) {
                if (values.has(value)) {
                    values.delete(value);
                    return false;
                }
                values.add(value);
                return true;
            }
            if (force) {
                values.add(value);
                return true;
            }
            values.delete(value);
            return false;
        },
        contains(value) {
            return values.has(value);
        },
    };
}

function createButtonStub({
    textContent = "",
    title = "",
    disabled = false,
    ariaLabel = "",
    classNames = [],
    onClick = null,
} = {}) {
    const attributes = {};
    if (ariaLabel) {
        attributes["aria-label"] = ariaLabel;
    }
    const listeners = new Map();
    const button = {
        textContent,
        title,
        disabled,
        dataset: {},
        classList: createClassList(classNames),
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        dispatch(type = "click") {
            const handlers = listeners.get(type) || [];
            handlers.forEach((handler) => handler.call(button));
        },
        click: vi.fn(() => {
            if (typeof onClick === "function") {
                onClick(button);
            }
        }),
        setAttribute(name, value) {
            attributes[name] = String(value);
        },
        getAttribute(name) {
            return attributes[name] || "";
        },
    };
    return button;
}

function createDocumentRef(elementsById) {
    return {
        getElementById(id) {
            return elementsById[id] || null;
        },
    };
}

function createWindowRef() {
    const animationFrameCallbacks = [];
    return {
        requestAnimationFrame: vi.fn((callback) => {
            animationFrameCallbacks.push(callback);
            return animationFrameCallbacks.length;
        }),
        runNextAnimationFrame() {
            const callback = animationFrameCallbacks.shift();
            if (callback) {
                callback();
            }
        },
    };
}

function createMutationObserverHarness() {
    const instances = [];
    class MutationObserverStub {
        constructor(callback) {
            this.callback = callback;
            this.observe = vi.fn((target, options) => {
                this.target = target;
                this.options = options;
            });
            instances.push(this);
        }

        trigger() {
            this.callback();
        }
    }
    return { MutationObserverStub, instances };
}

function createTransportSet() {
    return {
        play: createButtonStub(),
        slower: createButtonStub(),
        faster: createButtonStub(),
        speed: createButtonStub(),
        now: createButtonStub(),
    };
}

function createDesktopTransport(overrides = {}) {
    return {
        animate: createButtonStub({
            textContent: "▶",
            onClick(button) {
                button.textContent = "⏸";
            },
            ...overrides.animate,
        }),
        missionnow: createButtonStub({
            textContent: "Now",
            title: "Jump to current time",
            ariaLabel: "Jump to current time",
            disabled: false,
            ...overrides.missionnow,
        }),
        slower: createButtonStub({
            disabled: false,
            ...overrides.slower,
        }),
        faster: createButtonStub({
            disabled: false,
            ...overrides.faster,
        }),
        realtime: createButtonStub({
            textContent: "1x",
            title: "Set speed to realtime (1 sec/sec)",
            ariaLabel: "Current speed. Click to set realtime (1 sec/sec).",
            disabled: false,
            classNames: [],
            ...overrides.realtime,
        }),
    };
}

describe("bindMobileTransportSync", () => {
    it("mirrors desktop transport state into each mobile control set and wires observers", () => {
        const mobileTransportSets = [createTransportSet(), createTransportSet()];
        const desktopTransport = createDesktopTransport({
            animate: { textContent: "⏸" },
            missionnow: {
                textContent: "Live",
                title: "Jump to live time",
                ariaLabel: "Jump to live time",
                disabled: true,
            },
            slower: { disabled: true },
            realtime: {
                textContent: "Realtime",
                title: "Back to realtime",
                ariaLabel: "Realtime speed",
                disabled: true,
                classNames: ["down"],
            },
        });
        const { MutationObserverStub, instances } = createMutationObserverHarness();

        bindMobileTransportSync({
            mobileTransportSets,
            documentRef: createDocumentRef(desktopTransport),
            windowRef: createWindowRef(),
            dispatchSyntheticPress: vi.fn(),
            MutationObserverRef: MutationObserverStub,
        });

        mobileTransportSets.forEach((set) => {
            expect(set.play.textContent).toBe("⏸");
            expect(set.play.classList.contains("is-active")).toBe(true);
            expect(set.now.textContent).toBe("Live");
            expect(set.now.title).toBe("Jump to live time");
            expect(set.now.getAttribute("aria-label")).toBe("Jump to live time");
            expect(set.now.disabled).toBe(true);
            expect(set.now.getAttribute("aria-disabled")).toBe("true");
            expect(set.slower.disabled).toBe(true);
            expect(set.slower.getAttribute("aria-disabled")).toBe("true");
            expect(set.faster.disabled).toBe(false);
            expect(set.speed.textContent).toBe("Realtime");
            expect(set.speed.title).toBe("Back to realtime");
            expect(set.speed.getAttribute("aria-label")).toBe("Realtime speed");
            expect(set.speed.classList.contains("is-active")).toBe(true);
            expect(set.speed.disabled).toBe(true);
            expect(set.speed.getAttribute("aria-disabled")).toBe("true");
        });

        expect(instances).toHaveLength(5);
        expect(instances[1].options.attributeFilter).toEqual([
            "class",
            "aria-pressed",
            "aria-label",
            "title",
            "disabled",
        ]);
        expect(instances[4].options.attributeFilter).toEqual([
            "title",
            "aria-label",
            "class",
            "aria-pressed",
            "disabled",
        ]);
    });

    it("proxies play and now clicks, uses synthetic press for speed controls, and waits two animation frames before resyncing", () => {
        const mobileTransportSet = createTransportSet();
        const desktopTransport = createDesktopTransport();
        const windowRef = createWindowRef();
        const dispatchSyntheticPress = vi.fn();

        bindMobileTransportSync({
            mobileTransportSets: [mobileTransportSet],
            documentRef: createDocumentRef(desktopTransport),
            windowRef,
            dispatchSyntheticPress,
            MutationObserverRef: null,
        });

        expect(mobileTransportSet.play.textContent).toBe("▶");

        mobileTransportSet.play.dispatch("click");
        expect(desktopTransport.animate.click).toHaveBeenCalledTimes(1);
        expect(mobileTransportSet.play.textContent).toBe("▶");
        windowRef.runNextAnimationFrame();
        expect(mobileTransportSet.play.textContent).toBe("▶");
        windowRef.runNextAnimationFrame();
        expect(mobileTransportSet.play.textContent).toBe("⏸");
        expect(mobileTransportSet.play.classList.contains("is-active")).toBe(true);

        mobileTransportSet.now.dispatch("click");
        expect(desktopTransport.missionnow.click).toHaveBeenCalledTimes(1);
        expect(dispatchSyntheticPress).not.toHaveBeenCalled();

        mobileTransportSet.slower.dispatch("click");
        mobileTransportSet.faster.dispatch("click");
        mobileTransportSet.speed.dispatch("click");

        expect(dispatchSyntheticPress.mock.calls).toEqual([
            [desktopTransport.slower, "touch"],
            [desktopTransport.faster, "touch"],
            [desktopTransport.realtime, "touch"],
        ]);
        expect(desktopTransport.slower.click).not.toHaveBeenCalled();
        expect(desktopTransport.faster.click).not.toHaveBeenCalled();
        expect(desktopTransport.realtime.click).not.toHaveBeenCalled();
    });

    it("resyncs mobile state when desktop mutation observers fire", () => {
        const mobileTransportSet = createTransportSet();
        const desktopTransport = createDesktopTransport();
        const { MutationObserverStub, instances } = createMutationObserverHarness();

        bindMobileTransportSync({
            mobileTransportSets: [mobileTransportSet],
            documentRef: createDocumentRef(desktopTransport),
            windowRef: createWindowRef(),
            dispatchSyntheticPress: vi.fn(),
            MutationObserverRef: MutationObserverStub,
        });

        desktopTransport.animate.textContent = "⏸";
        desktopTransport.missionnow.textContent = "Realtime";
        desktopTransport.missionnow.title = "Jump to realtime";
        desktopTransport.missionnow.setAttribute("aria-label", "Jump to realtime");
        desktopTransport.faster.disabled = true;
        desktopTransport.realtime.textContent = "Realtime";
        desktopTransport.realtime.title = "Back to realtime";
        desktopTransport.realtime.setAttribute("aria-label", "Back to realtime");
        desktopTransport.realtime.classList.add("down");

        instances.forEach((instance) => instance.trigger());

        expect(mobileTransportSet.play.textContent).toBe("⏸");
        expect(mobileTransportSet.play.classList.contains("is-active")).toBe(true);
        expect(mobileTransportSet.now.textContent).toBe("Realtime");
        expect(mobileTransportSet.now.title).toBe("Jump to realtime");
        expect(mobileTransportSet.now.getAttribute("aria-label")).toBe("Jump to realtime");
        expect(mobileTransportSet.faster.disabled).toBe(true);
        expect(mobileTransportSet.faster.getAttribute("aria-disabled")).toBe("true");
        expect(mobileTransportSet.speed.textContent).toBe("Realtime");
        expect(mobileTransportSet.speed.title).toBe("Back to realtime");
        expect(mobileTransportSet.speed.getAttribute("aria-label")).toBe("Back to realtime");
        expect(mobileTransportSet.speed.classList.contains("is-active")).toBe(true);
    });
});
