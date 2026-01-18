export function shouldSkipInitConfig({ animationScene, AnimationScene }) {
    return (
        !!animationScene &&
        animationScene.state >= AnimationScene.SCENE_STATE_INIT_CONFIG_DONE
    );
}

export function applyInitConfigAlreadyInitialized({
    config,
    handleModeSwitchToGeo,
    handleModeSwitchToLunar,
    setChecked,
    animationScene,
}) {
    if (config === "geo") {
        handleModeSwitchToGeo();
    } else if (config === "lunar") {
        handleModeSwitchToLunar();
    }

    setChecked("checkbox-lock-moon", animationScene.lockOnMoon);
    setChecked("checkbox-lock-earth", animationScene.lockOnEarth);
    setChecked("checkbox-lock-sc", animationScene.lockOnSC);

    setChecked("checkbox-lock-xy", animationScene.lockOnXY);
    setChecked("checkbox-lock-zx", animationScene.lockOnZX);
    setChecked("checkbox-lock-yz", animationScene.lockOnYZ);
    setChecked("checkbox-lock-xy-minus", animationScene.lockOnXYMinus);
    setChecked("checkbox-lock-zx-minus", animationScene.lockOnZXMinus);
    setChecked("checkbox-lock-yz-minus", animationScene.lockOnYZMinus);
}

