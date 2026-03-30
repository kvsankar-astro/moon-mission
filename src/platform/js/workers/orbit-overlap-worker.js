import { computeOrbitOverlapOpacities } from "../app/orbit-overlap-core.js";

self.onmessage = function onmessage(event) {
    const payload = event?.data || {};
    const {
        jobId,
        chunksByBodyId,
        options,
    } = payload;

    try {
        const result = computeOrbitOverlapOpacities(chunksByBodyId || {}, options || {});
        self.postMessage({
            jobId,
            ...result,
        });
    } catch (error) {
        self.postMessage({
            jobId,
            error: error?.message || String(error),
        });
    }
};
