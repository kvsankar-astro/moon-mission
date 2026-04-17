function flattenMissionStatePorts(statePorts = {}) {
    return {
        ...(statePorts?.app || {}),
        ...(statePorts?.data || {}),
        ...(statePorts?.session || {}),
        ...(statePorts?.sceneView || {}),
        ...(statePorts?.sceneRuntime || {}),
        ...(statePorts?.interaction || {}),
    };
}

export { flattenMissionStatePorts };
