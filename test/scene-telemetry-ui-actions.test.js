import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const groundTrackUpdate = vi.fn();

vi.mock("../src/platform/js/app/ground-track-panel.js", () => ({
    createGroundTrackPanelActions: vi.fn(() => ({
        update: groundTrackUpdate,
    })),
}));

import { createSceneTelemetryUiActions } from "../src/platform/js/app/scene-telemetry-ui-actions.js";

function createClassList(initialValues = []) {
    const values = new Set(initialValues);
    return {
        toggle: vi.fn((value, enabled) => {
            if (enabled) {
                values.add(value);
                return;
            }
            values.delete(value);
        }),
        contains: (value) => values.has(value),
    };
}

function createElementStub(overrides = {}) {
    const listeners = {};
    const attributes = {};
    return {
        textContent: "",
        classList: createClassList(),
        addEventListener: vi.fn((eventName, handler) => {
            listeners[eventName] = handler;
        }),
        setAttribute: vi.fn((name, value) => {
            attributes[name] = value;
        }),
        getAttribute: vi.fn((name) => attributes[name] || null),
        ...overrides,
        _listeners: listeners,
        _attributes: attributes,
    };
}

function createD3Stub(nodesBySelector) {
    return {
        select(selector) {
            const node = nodesBySelector[selector];
            return {
                text(value) {
                    node.textContent = value;
                    return this;
                },
            };
        },
    };
}

function createDocumentStub({ ids, distanceNodes, speedNodes }) {
    return {
        getElementById(id) {
            return ids[id] || null;
        },
        querySelector(selector) {
            if (selector === 'input[name="mode"]:checked') {
                return { value: "geo" };
            }
            return null;
        },
        querySelectorAll(selector) {
            if (selector === ".stats-unit-distance") {
                return distanceNodes;
            }
            if (selector === ".stats-unit-speed") {
                return speedNodes;
            }
            return [];
        },
    };
}

describe("scene telemetry ui actions", () => {
    let originalDocument;
    let originalWindow;

    beforeEach(() => {
        originalDocument = globalThis.document;
        originalWindow = globalThis.window;
        groundTrackUpdate.mockReset();
    });

    afterEach(() => {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
    });

    it("updates telemetry text, unit controls, ground-track state, and latest scene snapshot", () => {
        const distanceUnitDesktop = createElementStub();
        const distanceUnitMobile = createElementStub();
        const speedUnitDesktop = createElementStub();
        const speedUnitMobile = createElementStub();
        const desktopKmButton = createElementStub();
        const desktopMilesButton = createElementStub();
        const mobileKmButton = createElementStub();
        const mobileMilesButton = createElementStub();
        const ids = {
            "stats-unit-km": desktopKmButton,
            "stats-unit-miles": desktopMilesButton,
            "mobile-unit-km": mobileKmButton,
            "mobile-unit-miles": mobileMilesButton,
            "mobile-metric-earth": createElementStub(),
            "mobile-metric-moon": createElementStub(),
            "mobile-metric-speed": createElementStub(),
            "mobile-metric-angle": createElementStub(),
        };
        const d3Nodes = {
            "#distance-SC-EARTH": createElementStub(),
            "#altitude-SC-EARTH": createElementStub(),
            "#velocity-SC-EARTH": createElementStub(),
            "#distance-SC-MOON": createElementStub(),
            "#altitude-SC-MOON": createElementStub(),
            "#velocity-SC-MOON": createElementStub(),
        };

        globalThis.document = createDocumentStub({
            ids,
            distanceNodes: [distanceUnitDesktop, distanceUnitMobile],
            speedNodes: [speedUnitDesktop, speedUnitMobile],
        });
        globalThis.window = {
            animationScenes: {
                geo: {
                    latestSceneState: null,
                },
            },
        };

        const actions = createSceneTelemetryUiActions({
            d3: createD3Stub(d3Nodes),
            formatMetric: (value) => Number(value).toFixed(1),
            setMobileText(id, text) {
                ids[id].textContent = text;
            },
            documentRef: globalThis.document,
            windowRef: globalThis.window,
        });

        const sceneState = {
            telemetryBodyId: "SC",
            telemetry: {
                distancePrimary: 100,
                altitudePrimary: 25,
                velocityPrimary: 2,
                distanceMoon: 50,
                altitudeMoon: 5,
                velocityMoon: 1.5,
            },
            bodies: {
                EARTH: { position: { x: 1, y: 0, z: 0 } },
                MOON: { position: { x: 0, y: 0, z: 0 } },
                SC: { position: { x: 0, y: 1, z: 0 } },
            },
        };

        actions.updateTelemetry(sceneState, "EARTH", "geo", 4321);

        expect(distanceUnitDesktop.textContent).toBe("km");
        expect(distanceUnitMobile.textContent).toBe("km");
        expect(speedUnitDesktop.textContent).toBe("km/s");
        expect(speedUnitMobile.textContent).toBe("km/s");
        expect(desktopKmButton.classList.contains("is-active")).toBe(true);
        expect(desktopKmButton.getAttribute("aria-pressed")).toBe("true");
        expect(desktopMilesButton.getAttribute("aria-pressed")).toBe("false");
        expect(d3Nodes["#distance-SC-EARTH"].textContent).toBe("100.0");
        expect(d3Nodes["#distance-SC-MOON"].textContent).toBe("50.0");
        expect(ids["mobile-metric-earth"].textContent).toBe("100.0 km");
        expect(ids["mobile-metric-speed"].textContent).toBe("2.0 km/s");
        expect(ids["mobile-metric-angle"].textContent).toBe("90.0°");
        expect(globalThis.window.animationScenes.geo.latestSceneState).toBe(sceneState);
        expect(groundTrackUpdate).toHaveBeenCalledWith({
            sceneState,
            config: "geo",
            animTime: 4321,
        });

        desktopMilesButton._listeners.click();

        expect(distanceUnitDesktop.textContent).toBe("miles");
        expect(speedUnitDesktop.textContent).toBe("miles/h");
        expect(desktopKmButton.getAttribute("aria-pressed")).toBe("false");
        expect(desktopMilesButton.getAttribute("aria-pressed")).toBe("true");
        expect(d3Nodes["#distance-SC-EARTH"].textContent).toBe("62.1");
        expect(ids["mobile-metric-speed"].textContent).toBe("4473.9 miles/h");
    });

    it("leaves unit controls unbound when the buttons are absent but still renders telemetry", () => {
        const ids = {
            "mobile-metric-earth": createElementStub(),
            "mobile-metric-moon": createElementStub(),
            "mobile-metric-speed": createElementStub(),
            "mobile-metric-angle": createElementStub(),
        };
        const d3Nodes = {
            "#distance-SC-EARTH": createElementStub(),
            "#altitude-SC-EARTH": createElementStub(),
            "#velocity-SC-EARTH": createElementStub(),
            "#distance-SC-MOON": createElementStub(),
            "#altitude-SC-MOON": createElementStub(),
            "#velocity-SC-MOON": createElementStub(),
        };

        globalThis.document = createDocumentStub({
            ids,
            distanceNodes: [],
            speedNodes: [],
        });
        globalThis.window = { animationScenes: {} };

        const actions = createSceneTelemetryUiActions({
            d3: createD3Stub(d3Nodes),
            formatMetric: (value) => Number(value).toFixed(1),
            setMobileText(id, text) {
                ids[id].textContent = text;
            },
            documentRef: globalThis.document,
            windowRef: globalThis.window,
        });

        actions.updateTelemetry({
            telemetryBodyId: "SC",
            telemetry: {
                distancePrimary: 10,
                altitudePrimary: 4,
                velocityPrimary: 0.5,
            },
            bodies: {
                EARTH: { position: { x: 1, y: 0, z: 0 } },
                MOON: { position: { x: 0, y: 0, z: 0 } },
                SC: { position: { x: 0, y: 1, z: 0 } },
            },
        }, "EARTH");

        expect(d3Nodes["#distance-SC-EARTH"].textContent).toBe("10.0");
        expect(ids["mobile-metric-earth"].textContent).toBe("10.0 km");
        expect(groundTrackUpdate).toHaveBeenCalledTimes(1);
    });
});
