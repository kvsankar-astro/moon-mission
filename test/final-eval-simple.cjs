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

    // Fixed wait for initial load
    console.log('Waiting for initial load...');
    await page.waitForTimeout(15000);

    // Clear overlays and set camera
    await page.evaluate(() => {
        const overlays = document.querySelectorAll('.loading-overlay, #loading-overlay, .mobile-moon-farside-overlay');
        overlays.forEach(el => el.remove());
        
        const scenes = window.animationScenes;
        if (scenes && scenes.lunar) {
            const scene = scenes.lunar;
            if (scene.camera) {
                scene.camera.position.set(-6000, 2000, 3000); 
                scene.camera.lookAt(0, 0, 0);
            }
        }
        
        const ui = document.querySelectorAll('#header-pill-strip, #blurb, #control-panel-toggle, #footer-controls, #fps-counter, #test-id-display');
        ui.forEach(el => el.style.display = 'none');
    });

    // Let it render
    console.log('Waiting for render stabilization...');
    await page.waitForTimeout(10000);

    const screenshotPath = path.join(__dirname, 'final-evaluation-clean.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);

    await browser.close();
})();
