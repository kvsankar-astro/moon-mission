import { Vector3 } from "three";
import { TrackballControls as UpstreamTrackballControls } from "three/addons/controls/TrackballControls.js";

const SAFE_POINTER_CAPTURE_PATCH_FLAG = "__moonSafePointerCapturePatched";

function patchPointerCaptureGuards(domElement) {
    if (!domElement || domElement[SAFE_POINTER_CAPTURE_PATCH_FLAG] === true) {
        return;
    }

    const originalSetPointerCapture =
        typeof domElement.setPointerCapture === "function"
            ? domElement.setPointerCapture.bind(domElement)
            : null;
    const originalReleasePointerCapture =
        typeof domElement.releasePointerCapture === "function"
            ? domElement.releasePointerCapture.bind(domElement)
            : null;

    if (originalSetPointerCapture) {
        domElement.setPointerCapture = (pointerId) => {
            try {
                return originalSetPointerCapture(pointerId);
            } catch {
                return undefined;
            }
        };
    }

    if (originalReleasePointerCapture) {
        domElement.releasePointerCapture = (pointerId) => {
            if (typeof domElement.hasPointerCapture === "function") {
                try {
                    if (!domElement.hasPointerCapture(pointerId)) {
                        return undefined;
                    }
                } catch {
                    return undefined;
                }
            }
            try {
                return originalReleasePointerCapture(pointerId);
            } catch {
                return undefined;
            }
        };
    }

    domElement[SAFE_POINTER_CAPTURE_PATCH_FLAG] = true;
}

/**
 * Adapter over upstream three.js TrackballControls.
 * Keeps legacy helper methods that our code expects.
 */
class TrackballControlsAdapter extends UpstreamTrackballControls {
    constructor(object, domElement) {
        patchPointerCaptureGuards(domElement);
        super(object, domElement);
    }

    getWorldPos() {
        const pos = new Vector3();
        this.object.getWorldPosition(pos);
        return pos;
    }

    getPos() {
        return this.object.position.clone();
    }

    getCenter() {
        return this.target.clone();
    }
}

export { TrackballControlsAdapter as TrackballControls };
