import { createMissionSceneActionBundle } from "./mission-scene-action-bundle.js";
import { createMissionSceneBootstrap } from "./mission-scene-bootstrap.js";

function createMissionSceneRuntime({ sceneActionDeps, sceneBootstrapDeps }) {
    const sceneActionBundle = createMissionSceneActionBundle(sceneActionDeps);
    const sceneBootstrap = createMissionSceneBootstrap({
        ...sceneBootstrapDeps,
        ...sceneActionBundle,
    });

    return {
        SceneHandler: sceneBootstrap.SceneHandler,
        AnimationScene: sceneBootstrap.AnimationScene,
    };
}

export { createMissionSceneRuntime };
