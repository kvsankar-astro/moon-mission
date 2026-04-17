import { createSceneUiUpdateActions } from "./scene-ui-update-actions.js";
import { createSceneFrameUiActions } from "./scene-frame-ui-actions.js";
import { createScene2DFrameActions } from "./scene-2d-frame-actions.js";
import { createSceneFrameOrchestrationActions } from "./scene-frame-orchestration-actions.js";
import {
    createFrameRendererDeps,
    createFrameUiUpdaterDeps,
    createScene2DFrameDeps,
    createSceneFrameOrchestrationDeps,
    createSceneFrameUiDeps,
    createSceneUiUpdateDeps,
} from "./scene-frame-wiring-deps.js";
import { createFrameRenderer } from "../shell/render/frame-renderer.js";
import { createFrameUiUpdater } from "../shell/ui/frame-ui-updater.js";

function createSceneFrameWiringActions(deps) {
    const sceneUiUpdateActions = createSceneUiUpdateActions(
        createSceneUiUpdateDeps(deps),
    );

    const sceneFrameUiActions = createSceneFrameUiActions(
        createSceneFrameUiDeps(deps, sceneUiUpdateActions),
    );

    const scene2DFrameActions = createScene2DFrameActions(
        createScene2DFrameDeps(deps),
    );

    const frameRenderer = createFrameRenderer(
        createFrameRendererDeps(deps, scene2DFrameActions),
    );

    const frameUiUpdater = createFrameUiUpdater(
        createFrameUiUpdaterDeps(sceneFrameUiActions),
    );

    const sceneFrameOrchestrationActions = createSceneFrameOrchestrationActions(
        createSceneFrameOrchestrationDeps(deps, {
            frameRenderer,
            frameUiUpdater,
        }),
    );

    return {
        sceneUiUpdateActions,
        sceneFrameUiActions,
        scene2DFrameActions,
        sceneFrameOrchestrationActions,
    };
}

export { createSceneFrameWiringActions };
