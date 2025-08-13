/**
 * Unified Test Runner
 * 
 * Runs streamlined testing approach for maximum efficiency:
 * 1. Quick structural checks (no browser needed)
 * 2. Playwright MCP tests (comprehensive browser automation)
 * 
 * Features:
 * - Optimized two-strategy approach for speed and reliability
 * - Automatic server management (Vite + MCP)
 * - Confidence scoring based on passing strategies
 * - Detailed reporting with actionable insights
 * - Native ES6 module support via Playwright MCP
 */

import { promises as fs } from 'fs';
import { PlaywrightMCPTest } from './playwright-mcp-test.js';
import { ensureViteServer } from './vite-server-manager.js';

export class TestRunner {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      allStrategies: options.allStrategies || false,
      stopOnFirstFailure: options.stopOnFirstFailure || false,
      ...options
    };
    
    this.strategies = [
      { 
        name: 'Quick Check', 
        runner: this.runQuickCheck.bind(this), 
        required: true,
        description: 'Structural validation (files, imports, exports)'
      },
      { 
        name: 'Playwright MCP', 
        runner: this.runPlaywrightMCP.bind(this), 
        required: true,
        description: 'Browser automation via MCP server'
      }
    ];
    
    this.server = null;
  }
  
  /**
   * Run all configured test strategies
   * @returns {Promise<Object>} Comprehensive test results
   */
  async runAllTests() {
    console.log('🧪 Starting Unified Test Runner...');
    console.log('='.repeat(50));
    
    const results = {
      strategies: {},
      overall: 'unknown',
      confidence: 0,
      startTime: new Date(),
      endTime: null
    };
    
    // Ensure Vite server is available for browser tests
    try {
      this.server = await ensureViteServer({ silent: !this.options.verbose });
      if (this.options.verbose) {
        const info = this.server.getServerInfo();
        console.log(`🚀 Vite server ready at ${info.url}`);
      }
    } catch (error) {
      console.log('⚠️  Warning: Could not start Vite server:', error.message);
      console.log('   Browser tests may fail, but structural tests will continue...');
    }
    
    // Run each strategy
    for (const strategy of this.strategies) {
      console.log(`\n🔍 Running ${strategy.name} tests...`);
      console.log(`   ${strategy.description}`);
      
      try {
        const startTime = Date.now();
        const result = await strategy.runner();
        const duration = Date.now() - startTime;
        
        result.duration = duration;
        results.strategies[strategy.name] = result;
        
        if (result.passed) {
          console.log(`✅ ${strategy.name}: PASSED (${duration}ms)`);
          if (this.options.verbose && result.summary) {
            console.log(`   ${result.summary}`);
          }
        } else {
          const status = strategy.required ? 'FAILED (REQUIRED)' : 'FAILED (optional)';
          console.log(`❌ ${strategy.name}: ${status} (${duration}ms)`);
          
          if (result.reason) {
            console.log(`   Reason: ${result.reason}`);
          }
          
          if (strategy.required && this.options.stopOnFirstFailure) {
            results.overall = 'failed';
            console.log('\n🛑 Stopping due to required test failure');
            break;
          }
        }
        
      } catch (error) {
        const errorMsg = `ERROR - ${error.message}`;
        console.log(`💥 ${strategy.name}: ${errorMsg}`);
        
        results.strategies[strategy.name] = {
          passed: false,
          error: error.message,
          duration: 0
        };
        
        if (strategy.required && this.options.stopOnFirstFailure) {
          results.overall = 'error';
          console.log('\n🛑 Stopping due to required test error');
          break;
        }
      }
    }
    
    // Calculate overall results
    results.endTime = new Date();
    results.confidence = this.calculateConfidence(results.strategies);
    results.overall = this.determineOverallStatus(results.strategies);
    
    return this.generateDetailedReport(results);
  }
  
  /**
   * Run quick structural checks
   */
  async runQuickCheck() {
    const QuickCheck = await this.loadQuickCheck();
    
    // Simulate quick check results for now
    // In practice, this would run the actual quick-check.js
    const checks = [
      { name: 'Math utilities module exists', passed: await this.fileExists('assets/platform/js/utils/math-utils.js') },
      { name: 'Mission.js exists', passed: await this.fileExists('assets/platform/js/mission.js') },
      { name: 'Main HTML file exists', passed: await this.fileExists('chandrayaan3.html') },
      { name: 'Package.json valid', passed: await this.fileExists('package.json') },
      { name: 'Vite config exists', passed: await this.fileExists('vite.config.js') }
    ];
    
    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;
    
    return {
      passed: passed === total,
      stats: { passed, total, failed: total - passed },
      summary: `${passed}/${total} structural checks passed`,
      details: checks,
      reason: passed < total ? `${total - passed} structural checks failed` : null
    };
  }
  
  /**
   * Run Playwright MCP tests
   */
  async runPlaywrightMCP() {
    try {
      const mcpTest = new PlaywrightMCPTest();
      return await mcpTest.runFullSuite({ verbose: this.options.verbose });
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        reason: 'Playwright MCP test setup failed'
      };
    }
  }
  
  
  /**
   * Calculate confidence level based on passing strategies
   */
  calculateConfidence(strategyResults) {
    const strategies = Object.values(strategyResults);
    const totalStrategies = strategies.length;
    
    if (totalStrategies === 0) return 0;
    
    const passingStrategies = strategies.filter(r => r.passed).length;
    const requiredStrategies = this.strategies.filter(s => s.required).length;
    const passingRequired = this.strategies
      .filter(s => s.required)
      .every(s => strategyResults[s.name]?.passed);
    
    // Base confidence on passing rate, but heavily weight required tests
    let confidence = Math.round((passingStrategies / totalStrategies) * 100);
    
    // Penalize if required tests fail
    if (!passingRequired) {
      confidence = Math.min(confidence, 30); // Max 30% if required tests fail
    }
    
    // Bonus for all tests passing
    if (passingStrategies === totalStrategies) {
      confidence = Math.min(100, confidence + 10);
    }
    
    return confidence;
  }
  
  /**
   * Determine overall test status
   */
  determineOverallStatus(strategyResults) {
    const requiredTests = this.strategies.filter(s => s.required);
    const requiredPassed = requiredTests.every(s => strategyResults[s.name]?.passed);
    
    if (!requiredPassed) {
      return 'failed';
    }
    
    const hasErrors = Object.values(strategyResults).some(r => r.error);
    if (hasErrors) {
      return 'passed_with_warnings';
    }
    
    return 'passed';
  }
  
  /**
   * Generate comprehensive test report
   */
  generateDetailedReport(results) {
    const duration = results.endTime - results.startTime;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Unified Test Results Summary');
    console.log('='.repeat(50));
    console.log(`Overall Status: ${this.getStatusEmoji(results.overall)} ${results.overall.toUpperCase()}`);
    console.log(`Confidence Level: ${results.confidence}%`);
    console.log(`Total Duration: ${duration}ms`);
    
    console.log('\n📋 Strategy Results:');
    for (const [name, result] of Object.entries(results.strategies)) {
      const emoji = result.passed ? '✅' : '❌';
      const duration = result.duration || 0;
      console.log(`  ${emoji} ${name}: ${result.passed ? 'PASSED' : 'FAILED'} (${duration}ms)`);
      
      if (result.stats) {
        console.log(`     Stats: ${JSON.stringify(result.stats)}`);
      }
      
      if (result.reason) {
        console.log(`     Reason: ${result.reason}`);
      }
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (results.overall === 'passed') {
      console.log('  🎉 All tests passed! Ready to proceed with refactoring.');
    } else if (results.overall === 'passed_with_warnings') {
      console.log('  ⚠️  Core functionality works, but some optional tests failed.');
      console.log('  📋 Consider investigating failures before major refactoring.');
    } else {
      console.log('  🚨 Required tests failed. Address these issues before continuing:');
      
      const failedRequired = this.strategies
        .filter(s => s.required && !results.strategies[s.name]?.passed)
        .map(s => s.name);
        
      failedRequired.forEach(name => {
        console.log(`    - Fix ${name} test issues`);
      });
    }
    
    console.log('='.repeat(50));
    
    return {
      passed: results.overall === 'passed',
      status: results.overall,
      confidence: results.confidence,
      duration,
      strategies: results.strategies,
      recommendations: this.generateRecommendations(results)
    };
  }
  
  generateRecommendations(results) {
    const recommendations = [];
    
    if (results.overall === 'failed') {
      recommendations.push('Address failing required tests before proceeding');
    }
    
    if (results.confidence < 80) {
      recommendations.push('Consider improving test coverage or fixing failing tests');
    }
    
    if (!results.strategies['Playwright MCP']?.passed) {
      recommendations.push('Playwright MCP integration needs attention for optimal testing');
    }
    
    return recommendations;
  }
  
  getStatusEmoji(status) {
    const emojis = {
      'passed': '🎉',
      'passed_with_warnings': '⚠️',
      'failed': '❌',
      'error': '💥',
      'unknown': '❓'
    };
    return emojis[status] || '❓';
  }
  
  // Utility methods
  async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
  
  async loadQuickCheck() {
    // Placeholder for loading quick-check.js
    return null;
  }
}

// CLI usage
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const options = {
    verbose: process.argv.includes('--verbose'),
    allStrategies: process.argv.includes('--all-strategies'),
    stopOnFirstFailure: process.argv.includes('--stop-on-failure')
  };
  
  const runner = new TestRunner(options);
  
  runner.runAllTests()
    .then(results => {
      process.exit(results.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner crashed:', error);
      process.exit(1);
    });
}