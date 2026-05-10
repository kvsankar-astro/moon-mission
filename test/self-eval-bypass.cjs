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
    await page.goto(missionUrl);

    // Hard wait for initial JS execution
    await page.waitForTimeout(15000);

    // Destroy all overlays and UI
    await page.evaluate(() => {
        document.querySelectorAll('*').forEach(el => {
            if (el.tagName !== 'CANVAS' && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
                el.style.display = 'none';
            }
        });
        
        // Force state
        const targetTime = new Date('2026-04-06T22:05:00Z').getTime();
        const scenes = window.animationScenes;
        if (scenes && scenes.lunar) {
            const scene = scenes.lunar;
            if (scene.controller) {
                scene.controller.setTime(targetTime);
                scene.controller.pause();
            }
            if (scene.camera) {
                scene.camera.position.set(-6000, 2000, 3000); 
                scene.camera.lookAt(0, 0, 0);
            }
        }
    });

    // Wait for render
    await page.waitForTimeout(10000);

    const screenshotPath = path.join(__dirname, 'self-evaluation.png');
    await page.screenshot({ path: screenshotPath });
    await browser.close();
})();
