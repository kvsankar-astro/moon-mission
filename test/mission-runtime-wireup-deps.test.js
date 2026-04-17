import { describe, expect, it, vi } from "vitest";
import {
    createRuntimeBootstrapDataPort,
    createRuntimeBootstrapPorts,
    createRuntimeBootstrapRenderPort,
} from "../src/platform/js/app/mission-runtime-wireup-deps.js";

describe("mission runtime wireup dependency builders", () => {
    it("injects wiring actions into the runtime bootstrap render port", () => {
        const baseRenderPort = { renderOnly: true };
        const setDimension = vi.fn();
        const handlePlaneChange = vi.fn();

        const renderPort = createRuntimeBootstrapRenderPort(
            { renderPort: baseRenderPort },
            {
                zoomEnd: vi.fn(),
                zoomChange: vi.fn(),
                zoomChangeTransform: vi.fn(),
                handleZoom: vi.fn(),
                setView: vi.fn(),
                initConfig: vi.fn(),
                dimensionActions: { setDimension },
                planeActions: { handlePlaneChange },
            },
        );

        expect(renderPort.renderOnly).toBe(true);
        expect(renderPort.zoomEnd).toEqual(expect.any(Function));
        expect(renderPort.zoomChange).toEqual(expect.any(Function));
        expect(renderPort.zoomChangeTransform).toEqual(expect.any(Function));
        expect(renderPort.handleZoom).toEqual(expect.any(Function));
        expect(renderPort.setView).toEqual(expect.any(Function));
        expect(renderPort.initConfig).toEqual(expect.any(Function));
        expect(renderPort.handlePlaneChange).toBe(handlePlaneChange);

        renderPort.setDimension("2D");
        expect(setDimension).toHaveBeenCalledWith("2D");
    });

    it("injects dataflow actions into the runtime bootstrap data port", () => {
        const initSVG = vi.fn();
        const loadOrbitDataIfNeededAndProcess = vi.fn();
        const loadLandingDataAndProcess = vi.fn();
        const processOrbitVectorsData = vi.fn();

        const dataPort = createRuntimeBootstrapDataPort(
            { dataPort: { dataOnly: true } },
            {
                svgActions: { initSVG },
                loadOrbitDataIfNeededAndProcess,
                loadLandingDataAndProcess,
                processOrbitVectorsData,
            },
        );

        expect(dataPort.dataOnly).toBe(true);
        dataPort.initSVG();
        expect(initSVG).toHaveBeenCalled();
        expect(dataPort.loadOrbitDataIfNeededAndProcess).toBe(
            loadOrbitDataIfNeededAndProcess,
        );
        expect(dataPort.loadLandingDataAndProcess).toBe(loadLandingDataAndProcess);
        expect(dataPort.processOrbitVectorsData).toBe(processOrbitVectorsData);
    });

    it("builds runtime bootstrap ports with the adapted render and data ports", () => {
        const runtimeBootstrapPorts = {
            uiPort: { uiOnly: true },
            renderPort: { renderOnly: true },
            dataPort: { dataOnly: true },
            statePort: { stateOnly: true },
        };

        const ports = createRuntimeBootstrapPorts(runtimeBootstrapPorts, {
            zoomEnd: vi.fn(),
            zoomChange: vi.fn(),
            zoomChangeTransform: vi.fn(),
            handleZoom: vi.fn(),
            setView: vi.fn(),
            initConfig: vi.fn(),
            dimensionActions: { setDimension: vi.fn() },
            planeActions: { handlePlaneChange: vi.fn() },
            svgActions: { initSVG: vi.fn() },
            loadOrbitDataIfNeededAndProcess: vi.fn(),
            loadLandingDataAndProcess: vi.fn(),
            processOrbitVectorsData: vi.fn(),
        });

        expect(ports.uiPort).toBe(runtimeBootstrapPorts.uiPort);
        expect(ports.statePort).toBe(runtimeBootstrapPorts.statePort);
        expect(ports.renderPort).not.toBe(runtimeBootstrapPorts.renderPort);
        expect(ports.dataPort).not.toBe(runtimeBootstrapPorts.dataPort);
        expect(ports.renderPort.renderOnly).toBe(true);
        expect(ports.dataPort.dataOnly).toBe(true);
    });
});
