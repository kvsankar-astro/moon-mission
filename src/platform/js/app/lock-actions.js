export function createLockActions({
    animationScenes,
    getConfig,
    reset,
    setChecked,
}) {
    function toggleLockSC() {
        const scene = animationScenes[getConfig()];
        scene.previousLockOnSC = scene.lockOnSC;
        scene.lockOnSC = !scene.lockOnSC;

        scene.previousLockOnMoon = scene.lockOnMoon;
        scene.lockOnMoon = false;
        setChecked("#checkbox-lock-moon", false);

        scene.previousLockOnEarth = scene.lockOnEarth;
        scene.lockOnEarth = false;
        setChecked("#checkbox-lock-earth", false);

        reset();
    }

    function toggleLockMoon() {
        const scene = animationScenes[getConfig()];
        scene.previousLockOnMoon = scene.lockOnMoon;
        scene.lockOnMoon = !scene.lockOnMoon;

        scene.previousLockOnSC = scene.lockOnSC;
        scene.lockOnSC = false;
        setChecked("#checkbox-lock-sc", false);

        scene.previousLockOnEarth = scene.lockOnEarth;
        scene.lockOnEarth = false;
        setChecked("#checkbox-lock-earth", false);

        reset();
    }

    function toggleLockEarth() {
        const scene = animationScenes[getConfig()];
        scene.previousLockOnEarth = scene.lockOnEarth;
        scene.lockOnEarth = !scene.lockOnEarth;

        scene.previousLockOnSC = scene.lockOnSC;
        scene.lockOnSC = false;
        setChecked("#checkbox-lock-sc", false);

        scene.previousLockOnMoon = scene.lockOnMoon;
        scene.lockOnMoon = false;
        setChecked("#checkbox-lock-moon", false);

        reset();
    }

    return { toggleLockSC, toggleLockMoon, toggleLockEarth };
}

