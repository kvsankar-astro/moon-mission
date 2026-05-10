const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default;
// ... other imports

const img1Path = path.join(__dirname, 'terminator-validation.png');
const img2Path = 'C:\\Users\\kvsan\\.gemini\\tmp\\moon-mission\\images\\clipboard-1778412322508.png'; // Reference

if (!fs.existsSync(img1Path)) {
    console.error(`Missing ${img1Path}`);
    process.exit(1);
}
if (!fs.existsSync(img2Path)) {
    console.error(`Missing ${img2Path}`);
    process.exit(1);
}

const img1 = PNG.sync.read(fs.readFileSync(img1Path));
const img2 = PNG.sync.read(fs.readFileSync(img2Path));

// Resize or crop if needed. For now just check dimensions.
console.log(`Image 1: ${img1.width}x${img1.height}`);
console.log(`Image 2: ${img2.width}x${img2.height}`);

const { width, height } = img1;
const diff = new PNG({ width, height });

const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });

console.log(`Different pixels: ${numDiffPixels}`);
console.log(`Difference percentage: ${(numDiffPixels / (width * height) * 100).toFixed(2)}%`);

fs.writeFileSync(path.join(__dirname, 'diff.png'), PNG.sync.write(diff));
console.log('Diff image saved to test/diff.png');
