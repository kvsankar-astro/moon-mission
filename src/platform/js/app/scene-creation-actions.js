export function createSceneCreationActions() {
    function stopCreation(scene) {
        scene.stopCreationFlag = true;
    }

    return { stopCreation };
}

