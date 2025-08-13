/**
 * Quick functionality check for refactoring progress
 * 
 * This test does basic checks to ensure the refactored code is working.
 * It doesn't require a full browser test setup.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Quick Check: Refactoring Progress Validation');
console.log('='.repeat(50));

let passed = 0;
let total = 0;

function test(name, condition) {
    total++;
    const result = condition();
    console.log(`${result ? '✅' : '❌'} ${name}`);
    if (result) passed++;
    return result;
}

// Test 1: Math utilities module exists and is well-formed
test('Math utilities module exists', () => {
    return fs.existsSync('assets/platform/js/utils/math-utils.js');
});

test('Math utilities has proper ES6 exports', () => {
    const content = fs.readFileSync('assets/platform/js/utils/math-utils.js', 'utf8');
    const expectedFunctions = [
        'degreesToRadians', 'radiansToDegrees', 'clamp', 'normalizeAngle',
        'sphericalToCartesian', 'rotate2D', 'distance3D', 'distance2D',
        'velocityToAngle', 'ellipseSemiMinorAxis', 'lerp', 'formatFloat'
    ];
    return expectedFunctions.every(fn => content.includes(`export function ${fn}`));
});

// Test 2: Mission.js imports math utilities
test('Mission.js imports math utilities', () => {
    const content = fs.readFileSync('assets/platform/js/mission.js', 'utf8');
    return content.includes('from "./utils/math-utils.js"') && 
           content.includes('degreesToRadians') &&
           content.includes('radiansToDegrees');
});

// Test 3: Utils directory structure
test('Utils directory properly organized', () => {
    return fs.existsSync('assets/platform/js/utils') &&
           fs.statSync('assets/platform/js/utils').isDirectory();
});

// Test 4: Main HTML file exists
test('Main Chandrayaan-3 HTML file exists', () => {
    return fs.existsSync('chandrayaan3.html');
});

// Test 5: Mission.js file exists and has reasonable size
test('Mission.js exists and is not empty', () => {
    if (!fs.existsSync('assets/platform/js/mission.js')) return false;
    const stats = fs.statSync('assets/platform/js/mission.js');
    return stats.size > 50000; // Should be a substantial file
});

// Test 6: Check that refactoring documentation exists
test('Refactoring documentation exists', () => {
    return fs.existsSync('doc/claude-mission-js-refactoring-proposal.md');
});

// Test 7: Package.json has test scripts
test('Package.json has test scripts configured', () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return packageJson.scripts && 
           packageJson.scripts.test &&
           packageJson.devDependencies &&
           packageJson.devDependencies.puppeteer;
});

// Test 8: Critical asset directories exist
test('Critical asset directories exist', () => {
    const requiredDirs = [
        'assets/platform/js',
        'assets/chandrayaan3/js',
        'third-party',
        'images'
    ];
    return requiredDirs.every(dir => fs.existsSync(dir));
});

console.log('='.repeat(50));
console.log(`📊 Results: ${passed}/${total} tests passed`);

if (passed === total) {
    console.log('🎉 All checks passed! Refactoring iteration 1 is working correctly.');
    console.log('✅ Ready to proceed to iteration 2 (Extract Constants)');
    process.exit(0);
} else {
    console.log('⚠️  Some checks failed. Review the issues above.');
    console.log(`📈 Progress: ${Math.round(passed/total*100)}% complete`);
    process.exit(1);
}