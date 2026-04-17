import { createRuntimeUiControlGroups } from "./runtime-ui-control-groups.js";

function createRuntimeUiControlsActions(deps) {
    const {
        navigationActions,
        repeatHandlers,
        lockActions,
        cameraActions,
        modeActions,
        moonRenderProfileActions,
        burnActions,
    } = createRuntimeUiControlGroups(deps);

    return {
        ...navigationActions,
        ...repeatHandlers,
        ...lockActions,
        ...cameraActions,
        ...modeActions,
        ...moonRenderProfileActions,
        burnButtonHandler: burnActions.burnButtonHandler,
    };
}

export { createRuntimeUiControlsActions };
