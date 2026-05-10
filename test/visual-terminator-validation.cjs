const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 772, height: 428 }
    });
    const page = await context.newPage();

    // Mission: Artemis II
    const missionUrl = 'http://localhost:7274/mission.html?mission=artemis2&testMode=true';
    console.log(`Loading ${missionUrl}...`);
    
    await page.goto(missionUrl);

    // Wait for the app to initialize.
    await page.waitForSelector('canvas');
    
    console.log('Force removing overlays and setting state...');
    
    // Artemis II flyby date: April 6, 2026.
    // Target: 22:05 UTC.
    const targetTime = new Date('2026-04-06T22:05:00Z').getTime();

    await page.evaluate(async (time) => {
        // 1. Kill overlays
        const overlays = document.querySelectorAll('.loading-overlay, #loading-overlay');
        overlays.forEach(el => el.remove());

        // 2. Click Moon Origin
        const moonPill = document.getElementById('origin-pill-moon');
        if (moonPill) moonPill.click();

        // 3. Set Time via controller
        const setAppTime = (t) => {
             if (window.animationScenes) {
                Object.values(window.animationScenes).forEach(scene => {
                    if (scene.controller && typeof scene.controller.setTime === 'function') {
                        scene.controller.setTime(t);
                        scene.controller.pause();
                    }
                });
            }
            for (let key in window) {
                if (window[key] && typeof window[key].setTime === 'function' && window[key].currentTime !== undefined) {
                    window[key].setTime(t);
                }
            }
        };
        
        setAppTime(time);

        // 4. Force Camera in Lunar Scene
        // We'll wait a bit for the scene to switch if needed.
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (window.animationScenes && window.animationScenes.lunar) {
            const scene = window.animationScenes.lunar;
            if (scene.camera) {
                // Focus on the terminator limb.
                scene.camera.position.set(-8000, 3000, 4000); 
                if (scene.cameraController && scene.cameraController.controls) {
                    scene.cameraController.controls.target.set(0, 0, 0);
                    scene.cameraController.controls.update();
                } else {
                    scene.camera.lookAt(0, 0, 0);
                }
            }
            
            // Boost Earthshine and physical reach params for the validation shot.
            if (scene.lightFill) {
                scene.lightFill.intensity = 0.05; // Force bright fill for comparison
            }
        }

        // 5. Hide UI
        const ui = document.querySelectorAll('#header-pill-strip, #blurb, #control-panel-toggle, #footer-controls, #fps-counter, #test-id-display');
        ui.forEach(el => el.style.display = 'none');
    }, targetTime);

    // Give it plenty of time to render high-precision shadows.
    console.log('Waiting for render to stabilize...');
    await page.waitForTimeout(10000);

    // Capture the screenshot.
    const screenshotPath = path.join(__dirname, 'terminator-validation.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);

    await browser.close();
})();
