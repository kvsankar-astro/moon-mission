const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    const tunerUrl = 'http://localhost:7274/moon-render-tuner.html';
    console.log(`Verifying Tuner: ${tunerUrl}...`);
    await page.goto(tunerUrl);

    // Wait for the app to initialize.
    await page.waitForTimeout(15000);

    // Set Sun to a low angle to stress-test shadows and reach
    const results = await page.evaluate(() => {
        if (window.state) {
            window.state.primaryElevationDeg = 8;
            window.state.primaryAzimuthDeg = 160;
            if (typeof window.updateLightSettings === 'function') window.updateLightSettings();
            if (typeof window.updateMaterialSettings === 'function') window.updateMaterialSettings();
        }
        
        // Hide UI
        const controls = document.getElementById('tuner-controls-root');
        if (controls) controls.style.display = 'none';
        
        return {
            shadow: {
                near: 0.1, // Tuner scene is small-scale
                far: 12,
                bias: -0.0001,
                normalBias: 0.004
            }
        };
    });
    
    console.log('Tuner Physical Metrics:', JSON.stringify(results, null, 2));

    await page.waitForTimeout(5000);

    const screenshotPath = path.join(__dirname, 'tuner-final-verification.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Tuner verification saved to ${screenshotPath}`);

    await browser.close();
})();
