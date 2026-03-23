function normalizeChebyshevTransport(value) {
    if (typeof value !== "string") return "auto";
    const normalized = value.trim().toLowerCase();
    if (normalized === "json" || normalized === "gzip" || normalized === "auto") {
        return normalized;
    }
    return "auto";
}

function splitUrlSuffix(url) {
    if (typeof url !== "string") return { base: "", suffix: "" };
    const match = /([?#].*)$/.exec(url);
    if (!match) return { base: url, suffix: "" };
    return {
        base: url.slice(0, match.index),
        suffix: match[1] || "",
    };
}

function isGzipUrl(url) {
    const { base } = splitUrlSuffix(url);
    return /\.gz$/i.test(base);
}

function toChebyshevGzipCandidateUrl(url) {
    if (typeof url !== "string") return null;
    if (isGzipUrl(url)) return url;

    const { base, suffix } = splitUrlSuffix(url);
    if (!/\.json$/i.test(base)) return null;
    return `${base}.gz${suffix}`;
}

function shouldAttemptGzipTransport({
    url,
    transport = "auto",
    canDecompressGzip = false,
}) {
    if (!canDecompressGzip) return false;

    const normalizedTransport = normalizeChebyshevTransport(transport);
    if (normalizedTransport === "json") return false;

    if (isGzipUrl(url)) return true;
    if (normalizedTransport === "gzip") {
        return !!toChebyshevGzipCandidateUrl(url);
    }
    if (normalizedTransport === "auto") {
        return !!toChebyshevGzipCandidateUrl(url);
    }
    return false;
}

export {
    isGzipUrl,
    normalizeChebyshevTransport,
    shouldAttemptGzipTransport,
    splitUrlSuffix,
    toChebyshevGzipCandidateUrl,
};
