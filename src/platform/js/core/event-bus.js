/**
 * Simple pub/sub event bus for decoupling modules.
 *
 * Usage:
 *   const bus = createEventBus();
 *   const off = bus.on("event:name", (payload) => {});
 *   bus.emit("event:name", { ... });
 *   off();
 */

export function createEventBus() {
    /** @type {Map<string, Set<(payload: any) => void>>} */
    const listenersByEvent = new Map();

    function on(eventName, listener) {
        if (typeof eventName !== "string" || eventName.length === 0) {
            throw new Error("eventBus.on(eventName, listener): eventName must be a non-empty string");
        }
        if (typeof listener !== "function") {
            throw new Error("eventBus.on(eventName, listener): listener must be a function");
        }

        let listeners = listenersByEvent.get(eventName);
        if (!listeners) {
            listeners = new Set();
            listenersByEvent.set(eventName, listeners);
        }
        listeners.add(listener);

        return () => off(eventName, listener);
    }

    function off(eventName, listener) {
        const listeners = listenersByEvent.get(eventName);
        if (!listeners) return;
        listeners.delete(listener);
        if (listeners.size === 0) listenersByEvent.delete(eventName);
    }

    function once(eventName, listener) {
        const offFn = on(eventName, (payload) => {
            offFn();
            listener(payload);
        });
        return offFn;
    }

    function emit(eventName, payload) {
        const listeners = listenersByEvent.get(eventName);
        if (!listeners || listeners.size === 0) return;

        // Snapshot to allow listeners to unsubscribe/subscribe during emit safely.
        for (const listener of Array.from(listeners)) {
            listener(payload);
        }
    }

    function clear() {
        listenersByEvent.clear();
    }

    return { on, off, once, emit, clear };
}

