const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    // Mission: Artemis II with Moon Origin and Test Mode
    const missionUrl = 'http://localhost:7274/mission.html?mission=artemis2&testMode=true&origin=moon';
    console.log(`Evaluating ${missionUrl}...`);
    
    await page.goto(missionUrl);

    // Give it a long time to clear all loading stages and for globals to be published.
    console.log('Waiting for mission and globals to load...');
    await page.waitForFunction(() => {
        const overlay = document.getElementById('loading-overlay');
        const isLoaded = !overlay || overlay.style.display === 'none' || window.getComputedStyle(overlay).display === 'none';
        // Wait for both the loading to finish AND the global scenes to be available
        return isLoaded && (window.animationScenes || window.controller);
    }, { timeout: 180000 });

    console.log('App ready. Configuring scene for capture...');

    // Force state for the Artemis II photo moment
    const targetTime = new Date('2026-04-06T22:05:00Z').getTime();

    await page.evaluate(async (time) => {
        // 1. Kill any persistent overlays
        const overlays = document.querySelectorAll('.loading-overlay, #loading-overlay, .mobile-moon-farside-overlay');
        overlays.forEach(el => el.remove());

        // 2. Set Time and Pause
        const scenes = window.animationScenes;
        if (scenes && scenes.lunar) {
            if (scenes.lunar.controller && typeof scenes.lunar.controller.setTime === 'function') {
                scenes.lunar.controller.setTime(time);
                scenes.lunar.controller.pause();
            }
        } else if (window.controller && typeof window.controller.setTime === 'function') {
            window.controller.setTime(time);
            window.controller.pause();
        }
        
        // 3. Force Camera to the problematic terminator region
        const lunarScene = window.animationScenes?.lunar;
        if (lunarScene && lunarScene.camera) {
            lunarScene.camera.position.set(-6000, 2000, 3000); 
            lunarScene.camera.lookAt(0, 0, 0);
            if (lunarScene.cameraController && lunarScene.cameraController.controls) {
                lunarScene.cameraController.controls.target.set(0, 0, 0);
                lunarScene.cameraController.controls.update();
            }
        }

        // 4. Hide UI for a clean shot
        const ui = document.querySelectorAll('#header-pill-strip, #blurb, #control-panel-toggle, #footer-controls, #fps-counter, #test-id-display');
        ui.forEach(el => el.style.display = 'none');
    }, targetTime);

    // Give it plenty of time to render high-resolution textures and resolve shadows
    console.log('Stabilizing render...');
    await page.waitForTimeout(20000);

    // Capture the final screenshot for evaluation
    const screenshotPath = path.join(__dirname, 'final-evaluation.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Final evaluation screenshot saved to ${screenshotPath}`);

    // LOG PHYSICAL STATE FOR FINAL REPORT
    const sceneInfo = await page.evaluate(() => {
        const scene = window.animationScenes?.lunar;
        if (!scene) return "Lunar scene not found in window.animationScenes";
        const light = scene.light;
        if (!light) return "Primary light not found";
        
        return {
            shadowCamera: {
                near: light.shadow.camera.near,
                far: light.shadow.camera.far,
                frustum: light.shadow.camera.right - light.shadow.camera.left,
                bias: light.shadow.bias,
                normalBias: light.shadow.normalBias
            }
        };
    });
    
    console.log('Final Validation Physics:', JSON.stringify(sceneInfo, null, 2));

    await browser.close();
})();
