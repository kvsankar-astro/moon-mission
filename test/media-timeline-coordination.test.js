import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    loadMissionMediaManifest: vi.fn(),
    panelRender: vi.fn(),
    panelSetMissionContext: vi.fn(),
    panelSetPanelState: vi.fn(),
}));

vi.mock("../src/platform/js/data/mission-media.js", () => ({
    loadMissionMediaManifest: mocks.loadMissionMediaManifest,
}));

vi.mock("../src/platform/js/app/media-browser-panel.js", () => ({
    MEDIA_BROWSER_PANEL_ID: "workflow:media-browser",
    createMediaBrowserPanelActions: vi.fn(() => ({
        render: mocks.panelRender,
        setMissionContext: mocks.panelSetMissionContext,
        setPanelState: mocks.panelSetPanelState,
    })),
}));

import { createMediaTimelineCoordination } from "../src/platform/js/app/media-timeline-coordination.js";

function createDocumentStub() {
    return {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getElementById: vi.fn(() => null),
    };
}

function createMissionConfig({ mediaEnabled } = {}) {
    return {
        mission_name: "Test Mission",
        ui: {
            panels: {
                defaults: {
                    "workflow:media-browser": {
                        enabled: mediaEnabled,
                        defaultState: "closed",
                    },
                },
            },
        },
    };
}

describe("createMediaTimelineCoordination", () => {
    let originalDocument;

    beforeEach(() => {
        originalDocument = globalThis.document;
        globalThis.document = createDocumentStub();
        mocks.loadMissionMediaManifest.mockReset();
        mocks.panelRender.mockReset();
        mocks.panelSetMissionContext.mockReset();
        mocks.panelSetPanelState.mockReset();
    });

    afterEach(() => {
        globalThis.document = originalDocument;
    });

    it("does not load or bind mission media when the workflow panel is not enabled by config", () => {
        const setTimelineMediaMarkers = vi.fn();
        const coordination = createMediaTimelineCoordination({
            setTimelineMediaMarkers,
        });

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: false }),
            animTime: 1234,
        });

        expect(mocks.loadMissionMediaManifest).not.toHaveBeenCalled();
        expect(globalThis.document.addEventListener).not.toHaveBeenCalled();
        expect(setTimelineMediaMarkers).toHaveBeenCalledWith([]);
        expect(mocks.panelSetMissionContext).toHaveBeenCalledWith(expect.objectContaining({
            available: false,
            mediaCount: 0,
        }));
        expect(mocks.panelRender).toHaveBeenCalledWith(expect.objectContaining({
            statusText: "Mission media is disabled for this mission.",
        }));
    });

    it("loads and binds mission media when the workflow panel is explicitly enabled", () => {
        mocks.loadMissionMediaManifest.mockResolvedValue(null);
        const coordination = createMediaTimelineCoordination();

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: 1234,
        });

        expect(mocks.loadMissionMediaManifest).toHaveBeenCalledTimes(1);
        expect(globalThis.document.addEventListener).toHaveBeenCalledWith(
            "mission-media-marker-select",
            expect.any(Function),
        );
    });

    it("releases the media marker listener when config disables the workflow panel", () => {
        mocks.loadMissionMediaManifest.mockResolvedValue(null);
        const coordination = createMediaTimelineCoordination();

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: true }),
            animTime: 1234,
        });
        const [, handler] = globalThis.document.addEventListener.mock.calls[0];

        coordination.update({
            globalConfig: createMissionConfig({ mediaEnabled: false }),
            animTime: 2345,
        });

        expect(globalThis.document.removeEventListener).toHaveBeenCalledWith(
            "mission-media-marker-select",
            handler,
        );
    });
});
