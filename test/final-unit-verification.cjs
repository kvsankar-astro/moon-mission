const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    const missionUrl = 'http://localhost:7274/mission.html?mission=artemis2&testMode=true&origin=moon';
    console.log(`Verifying: ${missionUrl}...`);
    await page.goto(missionUrl);

    // Hard wait for initial load and globals publication
    console.log('Waiting for application to stabilize...');
    await page.waitForTimeout(20000);

    // Force state and capture metrics
    const results = await page.evaluate(() => {
        const overlays = document.querySelectorAll('.loading-overlay, #loading-overlay, .mobile-moon-farside-overlay');
        overlays.forEach(el => el.remove());

        const lunar = window.animationScenes?.lunar;
        if (!lunar) return "LUNAR SCENE NOT FOUND";

        // Set Target Time: Artemis II flyby 2026-04-06T22:05:00Z
        const targetTime = 1775513100000; 
        if (lunar.controller) {
            lunar.controller.setTime(targetTime);
            lunar.controller.pause();
        }

        // Position camera to see the terminator
        lunar.camera.position.set(-4, 1.5, 1.5); 
        lunar.camera.lookAt(0, 0, 0);
        
        const light = lunar.light;
        return {
            lightPos: light.position,
            shadowCamera: {
                near: light.shadow.camera.near,
                far: light.shadow.camera.far,
                frustum: light.shadow.camera.right,
                bias: light.shadow.bias,
                normalBias: light.shadow.normalBias
            }
        };
    });
    
    console.log('Final Physical Metrics:', JSON.stringify(results, null, 2));

    // Hide UI
    await page.evaluate(() => {
        const ui = document.querySelectorAll('#header-pill-strip, #blurb, #control-panel-toggle, #footer-controls, #fps-counter, #test-id-display');
        ui.forEach(el => el.style.display = 'none');
    });

    // Wait for high-res shadows and textures to resolve
    console.log('Resolving final render...');
    await page.waitForTimeout(10000);

    const screenshotPath = path.join(__dirname, 'final-unit-correct-verification.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Verification screenshot saved to ${screenshotPath}`);

    await browser.close();
})();
