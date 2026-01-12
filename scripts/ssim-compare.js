/**
 * SSIM Comparison Script
 * Compares baseline vs current screenshots using Structural Similarity Index
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { PNG } from 'pngjs';
import { ssim } from 'ssim.js';
import pixelmatch from 'pixelmatch';

const screenshotDir = join(process.cwd(), 'test', 'screenshots');
const baselineDir = join(screenshotDir, 'baseline');
const currentDir = join(screenshotDir, 'current');

// SSIM thresholds for classification
const THRESHOLDS = {
  IDENTICAL: 0.99,      // Virtually identical
  VERY_SIMILAR: 0.97,   // Minor rendering differences (anti-aliasing)
  SIMILAR: 0.93,        // Noticeable but acceptable differences
  DIFFERENT: 0.90       // Significant differences - likely real issues
};

function loadImage(filepath) {
  const buffer = readFileSync(filepath);
  return PNG.sync.read(buffer);
}

function compareImages(baselinePath, currentPath) {
  const baseline = loadImage(baselinePath);
  const current = loadImage(currentPath);

  // Check dimensions match
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      error: `Dimension mismatch: baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`
    };
  }

  const { width, height } = baseline;
  const totalPixels = width * height;

  // Convert to format ssim.js expects (separate RGBA arrays)
  const baselineData = {
    data: baseline.data,
    width,
    height
  };
  const currentData = {
    data: current.data,
    width,
    height
  };

  // Calculate SSIM
  const ssimResult = ssim(baselineData, currentData);

  // Also calculate pixelmatch for reference
  const diff = new PNG({ width, height });
  const pixelDiff = pixelmatch(
    baseline.data, current.data, diff.data,
    width, height, { threshold: 0.1 }
  );

  const pixelDiffPercent = (pixelDiff / totalPixels * 100).toFixed(3);

  return {
    ssim: ssimResult.mssim,
    pixelDiff,
    pixelDiffPercent,
    totalPixels,
    width,
    height
  };
}

function classifyResult(ssimScore) {
  if (ssimScore >= THRESHOLDS.IDENTICAL) return { level: 'IDENTICAL', emoji: '✅', color: '\x1b[32m' };
  if (ssimScore >= THRESHOLDS.VERY_SIMILAR) return { level: 'VERY_SIMILAR', emoji: '🟢', color: '\x1b[32m' };
  if (ssimScore >= THRESHOLDS.SIMILAR) return { level: 'SIMILAR', emoji: '🟡', color: '\x1b[33m' };
  if (ssimScore >= THRESHOLDS.DIFFERENT) return { level: 'DIFFERENT', emoji: '🟠', color: '\x1b[33m' };
  return { level: 'VERY_DIFFERENT', emoji: '🔴', color: '\x1b[31m' };
}

function main() {
  console.log('='.repeat(80));
  console.log('SSIM Comparison: Baseline vs Current Screenshots');
  console.log('='.repeat(80));
  console.log(`\nThresholds: IDENTICAL >= ${THRESHOLDS.IDENTICAL}, VERY_SIMILAR >= ${THRESHOLDS.VERY_SIMILAR}, SIMILAR >= ${THRESHOLDS.SIMILAR}, DIFFERENT >= ${THRESHOLDS.DIFFERENT}\n`);

  if (!existsSync(baselineDir)) {
    console.error('Baseline directory not found:', baselineDir);
    process.exit(1);
  }

  if (!existsSync(currentDir)) {
    console.error('Current directory not found:', currentDir);
    console.log('Run the tests first to generate current screenshots.');
    process.exit(1);
  }

  const baselineFiles = readdirSync(baselineDir).filter(f => f.endsWith('.png'));
  const currentFiles = readdirSync(currentDir).filter(f => f.endsWith('.png'));

  console.log(`Found ${baselineFiles.length} baseline images, ${currentFiles.length} current images\n`);

  const results = {
    identical: [],
    verySimilar: [],
    similar: [],
    different: [],
    veryDifferent: [],
    missing: [],
    errors: []
  };

  // Compare each baseline with its current counterpart
  for (const filename of baselineFiles) {
    const baselinePath = join(baselineDir, filename);
    const currentPath = join(currentDir, filename);

    if (!existsSync(currentPath)) {
      results.missing.push(filename);
      continue;
    }

    try {
      const comparison = compareImages(baselinePath, currentPath);

      if (comparison.error) {
        results.errors.push({ filename, error: comparison.error });
        continue;
      }

      const classification = classifyResult(comparison.ssim);
      const result = {
        filename,
        ssim: comparison.ssim,
        pixelDiff: comparison.pixelDiff,
        pixelDiffPercent: comparison.pixelDiffPercent,
        classification
      };

      // Categorize
      switch (classification.level) {
        case 'IDENTICAL': results.identical.push(result); break;
        case 'VERY_SIMILAR': results.verySimilar.push(result); break;
        case 'SIMILAR': results.similar.push(result); break;
        case 'DIFFERENT': results.different.push(result); break;
        case 'VERY_DIFFERENT': results.veryDifferent.push(result); break;
      }
    } catch (err) {
      results.errors.push({ filename, error: err.message });
    }
  }

  // Print results by category
  const reset = '\x1b[0m';

  console.log('\n' + '─'.repeat(80));
  console.log('RESULTS SUMMARY');
  console.log('─'.repeat(80));

  // Identical (likely false positives in current tests)
  if (results.identical.length > 0) {
    console.log(`\n✅ IDENTICAL (${results.identical.length}) - SSIM >= ${THRESHOLDS.IDENTICAL} - These should PASS:`);
    results.identical.forEach(r => {
      console.log(`   ${r.filename}`);
      console.log(`      SSIM: ${r.ssim.toFixed(4)} | Pixels: ${r.pixelDiff} (${r.pixelDiffPercent}%)`);
    });
  }

  // Very Similar (anti-aliasing differences - false positives)
  if (results.verySimilar.length > 0) {
    console.log(`\n🟢 VERY SIMILAR (${results.verySimilar.length}) - SSIM >= ${THRESHOLDS.VERY_SIMILAR} - Anti-aliasing differences (FALSE POSITIVES):`);
    results.verySimilar.forEach(r => {
      console.log(`   ${r.filename}`);
      console.log(`      SSIM: ${r.ssim.toFixed(4)} | Pixels: ${r.pixelDiff} (${r.pixelDiffPercent}%)`);
    });
  }

  // Similar (minor differences - probably OK)
  if (results.similar.length > 0) {
    console.log(`\n🟡 SIMILAR (${results.similar.length}) - SSIM >= ${THRESHOLDS.SIMILAR} - Minor differences (REVIEW):`);
    results.similar.forEach(r => {
      console.log(`   ${r.filename}`);
      console.log(`      SSIM: ${r.ssim.toFixed(4)} | Pixels: ${r.pixelDiff} (${r.pixelDiffPercent}%)`);
    });
  }

  // Different (noticeable differences - need attention)
  if (results.different.length > 0) {
    console.log(`\n🟠 DIFFERENT (${results.different.length}) - SSIM >= ${THRESHOLDS.DIFFERENT} - Noticeable differences (NEEDS ATTENTION):`);
    results.different.forEach(r => {
      console.log(`   ${r.filename}`);
      console.log(`      SSIM: ${r.ssim.toFixed(4)} | Pixels: ${r.pixelDiff} (${r.pixelDiffPercent}%)`);
    });
  }

  // Very Different (significant issues - real failures)
  if (results.veryDifferent.length > 0) {
    console.log(`\n🔴 VERY DIFFERENT (${results.veryDifferent.length}) - SSIM < ${THRESHOLDS.DIFFERENT} - REAL ISSUES:`);
    results.veryDifferent.forEach(r => {
      console.log(`   ${r.filename}`);
      console.log(`      SSIM: ${r.ssim.toFixed(4)} | Pixels: ${r.pixelDiff} (${r.pixelDiffPercent}%)`);
    });
  }

  // Missing files
  if (results.missing.length > 0) {
    console.log(`\n⚪ MISSING CURRENT (${results.missing.length}) - No current screenshot for baseline:`);
    results.missing.forEach(f => console.log(`   ${f}`));
  }

  // Errors
  if (results.errors.length > 0) {
    console.log(`\n❌ ERRORS (${results.errors.length}):`);
    results.errors.forEach(e => console.log(`   ${e.filename}: ${e.error}`));
  }

  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total baseline images: ${baselineFiles.length}`);
  console.log(`✅ Identical:      ${results.identical.length}`);
  console.log(`🟢 Very Similar:   ${results.verySimilar.length} (anti-aliasing - false positives)`);
  console.log(`🟡 Similar:        ${results.similar.length} (minor - review)`);
  console.log(`🟠 Different:      ${results.different.length} (needs attention)`);
  console.log(`🔴 Very Different: ${results.veryDifferent.length} (real issues)`);
  console.log(`⚪ Missing:        ${results.missing.length}`);
  console.log(`❌ Errors:         ${results.errors.length}`);

  const falsePositives = results.identical.length + results.verySimilar.length;
  const realIssues = results.different.length + results.veryDifferent.length;
  console.log(`\n📊 Likely FALSE POSITIVES: ${falsePositives}`);
  console.log(`📊 Likely REAL ISSUES: ${realIssues}`);
  console.log(`📊 Need REVIEW: ${results.similar.length}`);
}

main();
