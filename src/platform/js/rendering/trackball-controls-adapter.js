import { Vector3 } from "three";
import { TrackballControls as UpstreamTrackballControls } from "three/addons/controls/TrackballControls.js";

/**
 * Adapter over upstream three.js TrackballControls.
 * Keeps legacy helper methods that our code expects.
 */
class TrackballControlsAdapter extends UpstreamTrackballControls {
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
