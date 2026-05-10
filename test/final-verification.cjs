const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    const missionUrl = 'http://localhost:7274/mission.html?mission=artemis2&testMode=true&origin=moon';
    console.log(`Loading ${missionUrl}...`);
    await page.goto(missionUrl);

    // Wait for the app to initialize.
    await page.waitForTimeout(15000);

    // Set state
    const targetTime = new Date('2026-04-06T22:05:00Z').getTime();
    const metrics = await page.evaluate((time) => {
        // Kill overlays
        const overlays = document.querySelectorAll('.loading-overlay, #loading-overlay, .mobile-moon-farside-overlay');
        overlays.forEach(el => el.remove());

        const lunar = window.animationScenes?.lunar;
        if (!lunar) return "Scene not found";

        if (lunar.controller) {
            lunar.controller.setTime(time);
            lunar.controller.pause();
        }

        // Force camera to a known good spot for terminator
        lunar.camera.position.set(-4, 1.5, 1.5); 
        lunar.camera.lookAt(0, 0, 0);
        
        const light = lunar.light;
        return {
            lightPos: light.position,
            shadow: {
                near: light.shadow.camera.near,
                far: light.shadow.camera.far,
                frustum: light.shadow.camera.right,
                bias: light.shadow.bias,
                normalBias: light.shadow.normalBias
            }
        };
    }, targetTime);
    
    console.log('Final Metrics:', JSON.stringify(metrics, null, 2));

    await page.waitForTimeout(5000);

    const screenshotPath = path.join(__dirname, 'final-verification.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);

    await browser.close();
})();
