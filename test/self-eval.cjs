const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    // Use a URL that likely bypasses any heavy initial overhead.
    const missionUrl = 'http://localhost:7274/mission.html?mission=artemis2&testMode=true&origin=moon';
    console.log(`Evaluating ${missionUrl}...`);
    
    await page.goto(missionUrl);

    // Give it a long time to clear all loading stages.
    console.log('Waiting for mission to load...');
    try {
        await page.waitForFunction(() => {
            const overlay = document.getElementById('loading-overlay');
            const isLoaded = !overlay || overlay.style.display === 'none' || window.getComputedStyle(overlay).display === 'none';
            return isLoaded && window.animationScenes && window.animationScenes.lunar;
        }, { timeout: 120000 });
    } catch (e) {
        console.log('Loading wait timed out, continuing anyway...');
    }

    console.log('Configuring scene...');

    // Force state
    const targetTime = new Date('2026-04-06T22:05:00Z').getTime();

    await page.evaluate(async (time) => {
        // 1. Kill overlays
        const overlays = document.querySelectorAll('.loading-overlay, #loading-overlay, .mobile-moon-farside-overlay');
        overlays.forEach(el => el.remove());

        // 2. Set Time and Pause
        const scenes = window.animationScenes;
        if (scenes && scenes.lunar) {
            if (scenes.lunar.controller && typeof scenes.lunar.controller.setTime === 'function') {
                scenes.lunar.controller.setTime(time);
                scenes.lunar.controller.pause();
            }
        }
        
        // 3. Force Camera to the problematic terminator region
        if (scenes && scenes.lunar && scenes.lunar.camera) {
            const scene = scenes.lunar;
            scene.camera.position.set(-6000, 2000, 3000); 
            scene.camera.lookAt(0, 0, 0);
            if (scene.cameraController && scene.cameraController.controls) {
                scene.cameraController.controls.target.set(0, 0, 0);
                scene.cameraController.controls.update();
            }
        }

        // 4. Hide UI
        const ui = document.querySelectorAll('#header-pill-strip, #blurb, #control-panel-toggle, #footer-controls, #fps-counter, #test-id-display');
        ui.forEach(el => el.style.display = 'none');
    }, targetTime);

    // Wait for textures and shadows to fully resolve
    console.log('Waiting for render to stabilize...');
    await page.waitForTimeout(20000);

    // Capture the screenshot for my own evaluation
    const screenshotPath = path.join(__dirname, 'self-evaluation.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Evaluation screenshot saved to ${screenshotPath}`);

    // LOG PHYSICAL STATE FOR DEBUGGING
    const sceneInfo = await page.evaluate(() => {
        if (!window.animationScenes || !window.animationScenes.lunar) return "Scene not found";
        const scene = window.animationScenes.lunar;
        const light = scene.light;
        if (!light) return "Light not found";
        
        return {
            lightPos: light.position,
            shadowCamera: {
                near: light.shadow.camera.near,
                far: light.shadow.camera.far,
                left: light.shadow.camera.left,
                right: light.shadow.camera.right,
                bias: light.shadow.bias,
                normalBias: light.shadow.normalBias
            }
        };
    });
    
    console.log('Runtime Scene Info:', JSON.stringify(sceneInfo, null, 2));

    await browser.close();
})();
