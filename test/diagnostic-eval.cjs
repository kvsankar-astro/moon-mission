const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    const missionUrl = 'http://localhost:7274/mission.html?mission=artemis2&testMode=true&origin=moon';
    console.log(`Evaluating ${missionUrl}...`);
    
    await page.goto(missionUrl);

    // Hard wait for initial load
    await page.waitForTimeout(15000);

    // Get scene metrics to diagnose the unit mismatch
    const metrics = await page.evaluate(() => {
        const scene = window.animationScenes?.lunar;
        if (!scene) return "Scene not found";
        
        return {
            moonRadius: scene.primaryBodyRadius || scene.secondaryBodyRadius,
            lightPos: scene.light.position,
            shadowCamera: {
                near: scene.light.shadow.camera.near,
                far: scene.light.shadow.camera.far,
                frustum: scene.light.shadow.camera.right,
                bias: scene.light.shadow.bias,
                normalBias: scene.light.shadow.normalBias
            }
        };
    });
    console.log('Runtime Metrics:', JSON.stringify(metrics, null, 2));

    // Force state and clean render
    await page.evaluate(() => {
        const overlays = document.querySelectorAll('.loading-overlay, #loading-overlay, .mobile-moon-farside-overlay');
        overlays.forEach(el => el.remove());
        
        const scenes = window.animationScenes;
        if (scenes && scenes.lunar) {
            const scene = scenes.lunar;
            // Force camera to terminator
            if (scene.camera) {
                scene.camera.position.set(-5, 2, 2); // Relative to unit radius
                scene.camera.lookAt(0, 0, 0);
            }
        }
        
        const ui = document.querySelectorAll('#header-pill-strip, #blurb, #control-panel-toggle, #footer-controls, #fps-counter, #test-id-display');
        ui.forEach(el => el.style.display = 'none');
    });

    await page.waitForTimeout(10000);

    const screenshotPath = path.join(__dirname, 'diagnostic.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Diagnostic screenshot saved to ${screenshotPath}`);

    await browser.close();
})();
