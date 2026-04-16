export function createSceneCreationActions() {
    function stopCreation(scene) {
        scene.stopCreationFlag = true;
        scene.decorationsReady3D = false;
        scene.deferred3DInitRunId = Number.isFinite(scene.deferred3DInitRunId)
            ? scene.deferred3DInitRunId + 1
            : 1;
    }

    return { stopCreation };
}
