export function createLineOfSightActions() {
    function addLineOfSight(_scene) {
        // Intentionally a no-op for now (legacy implementation was disabled).
    }

    function disposeLineOfSight(scene) {
        if (scene.losLine) {
            if (scene.losLine.geometry) {
                scene.losLine.geometry.dispose();
            }
            if (scene.losLine.material) {
                scene.losLine.material.dispose();
            }
            if (scene.motherContainer) {
                scene.motherContainer.remove(scene.losLine);
            }
            scene.losLine = null;
        }

        if (scene.losLineGeometry) {
            scene.losLineGeometry.dispose();
            scene.losLineGeometry = null;
        }
    }

    return { addLineOfSight, disposeLineOfSight };
}

