const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    const tunerUrl = 'http://localhost:7274/moon-render-tuner.html';
    console.log(`Loading Tuner: ${tunerUrl}...`);
    await page.goto(tunerUrl);

    // Wait for the tuner to load textures and initialize
    console.log('Waiting for tuner initialization...');
    await page.waitForTimeout(15000);

    // Set Sun to a low angle to stress-test shadows and reach
    await page.evaluate(() => {
        // Find tuner state and controls
        // Set Primary Elevation to 8 degrees (near terminator)
        if (window.state) {
            window.state.primaryElevationDeg = 8;
            window.state.primaryAzimuthDeg = 160;
            if (typeof window.updateLightSettings === 'function') window.updateLightSettings();
            if (typeof window.updateMaterialSettings === 'function') window.updateMaterialSettings();
        }
        
        // Hide UI
        const controls = document.getElementById('tuner-controls-root');
        if (controls) controls.style.display = 'none';
        const json = document.getElementById('tuner-json-container');
        if (json) json.style.display = 'none';
    });

    console.log('Stabilizing tuner render...');
    await page.waitForTimeout(5000);

    const screenshotPath = path.join(__dirname, 'tuner-verification.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Tuner screenshot saved to ${screenshotPath}`);

    await browser.close();
})();
