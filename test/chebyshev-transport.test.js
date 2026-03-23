import { describe, expect, it, vi } from "vitest";
import {
    isGzipUrl,
    normalizeChebyshevTransport,
    shouldAttemptGzipTransport,
    toChebyshevGzipCandidateUrl,
} from "../src/platform/js/core/domain/chebyshev-transport.js";
import { loadChebyshevData } from "../src/platform/js/chebyshev.js";

describe("chebyshev transport domain helpers", () => {
    it("normalizes transport preferences", () => {
        expect(normalizeChebyshevTransport(undefined)).toBe("auto");
        expect(normalizeChebyshevTransport(" gzip ")).toBe("gzip");
        expect(normalizeChebyshevTransport("json")).toBe("json");
        expect(normalizeChebyshevTransport("invalid")).toBe("auto");
    });

    it("detects gzip URLs and builds .json.gz candidate URLs", () => {
        expect(isGzipUrl("assets/ch3/data/geo-CY3-cheb.json.gz")).toBe(true);
        expect(isGzipUrl("assets/ch3/data/geo-CY3-cheb.json")).toBe(false);

        expect(toChebyshevGzipCandidateUrl("assets/ch3/data/geo-CY3-cheb.json")).toBe(
            "assets/ch3/data/geo-CY3-cheb.json.gz",
        );
        expect(
            toChebyshevGzipCandidateUrl("assets/ch3/data/geo-CY3-cheb.json?cache=1#frag"),
        ).toBe("assets/ch3/data/geo-CY3-cheb.json.gz?cache=1#frag");
        expect(toChebyshevGzipCandidateUrl("assets/ch3/data/geo-CY3-cheb.npz")).toBeNull();
    });

    it("decides gzip attempts based on transport mode and capabilities", () => {
        expect(
            shouldAttemptGzipTransport({
                url: "assets/ch3/data/geo-CY3-cheb.json",
                transport: "auto",
                canDecompressGzip: true,
            }),
        ).toBe(true);
        expect(
            shouldAttemptGzipTransport({
                url: "assets/ch3/data/geo-CY3-cheb.json",
                transport: "json",
                canDecompressGzip: true,
            }),
        ).toBe(false);
        expect(
            shouldAttemptGzipTransport({
                url: "assets/ch3/data/geo-CY3-cheb.json",
                transport: "gzip",
                canDecompressGzip: false,
            }),
        ).toBe(false);
    });
});

describe("loadChebyshevData transport behavior", () => {
    it("prefers .json.gz in auto mode when available", async () => {
        const fetchFn = vi.fn(async (url) => {
            if (url.endsWith(".json.gz")) {
                return { ok: true, status: 200 };
            }
            return { ok: false, status: 404 };
        });
        const decodeGzipJson = vi.fn(async () => ({ format: "chebyshev-ephemeris", segments: [] }));

        const data = await loadChebyshevData("assets/ch3/data/geo-CY3-cheb.json", {
            fetchFn,
            decodeGzipJson,
            canDecompressGzip: true,
            transport: "auto",
        });

        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(fetchFn.mock.calls[0][0]).toBe("assets/ch3/data/geo-CY3-cheb.json.gz");
        expect(decodeGzipJson).toHaveBeenCalledTimes(1);
        expect(data).toEqual({ format: "chebyshev-ephemeris", segments: [] });
    });

    it("falls back to JSON when gzip URL is unavailable in auto mode", async () => {
        const jsonPayload = { format: "chebyshev-ephemeris", segments: [{ t_start: 0, t_end: 1 }] };
        const fetchFn = vi.fn(async (url) => {
            if (url.endsWith(".json.gz")) return { ok: false, status: 404 };
            return { ok: true, status: 200, json: async () => jsonPayload };
        });
        const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

        try {
            const data = await loadChebyshevData("assets/ch3/data/geo-CY3-cheb.json", {
                fetchFn,
                canDecompressGzip: true,
                transport: "auto",
                decodeGzipJson: vi.fn(async () => ({ format: "bad" })),
            });

            expect(fetchFn).toHaveBeenCalledTimes(2);
            expect(fetchFn.mock.calls[0][0]).toBe("assets/ch3/data/geo-CY3-cheb.json.gz");
            expect(fetchFn.mock.calls[1][0]).toBe("assets/ch3/data/geo-CY3-cheb.json");
            expect(data).toBe(jsonPayload);
        } finally {
            debugSpy.mockRestore();
        }
    });

    it("uses JSON directly when transport mode is json", async () => {
        const jsonPayload = { format: "chebyshev-ephemeris", segments: [] };
        const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => jsonPayload }));

        const data = await loadChebyshevData("assets/ch3/data/geo-CY3-cheb.json", {
            fetchFn,
            canDecompressGzip: true,
            transport: "json",
        });

        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(fetchFn.mock.calls[0][0]).toBe("assets/ch3/data/geo-CY3-cheb.json");
        expect(data).toBe(jsonPayload);
    });

    it("decodes explicit gzip URLs regardless of transport preference", async () => {
        const fetchFn = vi.fn(async () => ({ ok: true, status: 200 }));
        const decodeGzipJson = vi.fn(async () => ({ format: "chebyshev-ephemeris", segments: [] }));

        const data = await loadChebyshevData("assets/ch3/data/geo-CY3-cheb.json.gz", {
            fetchFn,
            decodeGzipJson,
            canDecompressGzip: true,
            transport: "json",
        });

        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(fetchFn.mock.calls[0][0]).toBe("assets/ch3/data/geo-CY3-cheb.json.gz");
        expect(decodeGzipJson).toHaveBeenCalledTimes(1);
        expect(data).toEqual({ format: "chebyshev-ephemeris", segments: [] });
    });
});
