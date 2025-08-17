#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

interface TestConfig {
  name: string;
  command: string;
  description: string;
  timeout?: number;
}

const testSuites: TestConfig[] = [
  {
    name: 'unit',
    command: 'npm run test:frontend && npm run test:backend',
    description: 'Run unit tests for frontend and backend',
    timeout: 60000
  },
  {
    name: 'e2e-auth',
    command: 'npx playwright test tests/e2e/auth.spec.ts',
    description: 'Run authentication end-to-end tests',
    timeout: 120000
  },
  {
    name: 'e2e-dashboard',
    command: 'npx playwright test tests/e2e/dashboard.spec.ts',
    description: 'Run dashboard end-to-end tests',
    timeout: 120000
  },
  {
    name: 'e2e-session',
    command: 'npx playwright test tests/e2e/havruta-session.spec.ts',
    description: 'Run Havruta session end-to-end tests',
    timeout: 180000
  },
  {
    name: 'e2e-invitation',
    command: 'npx playwright test tests/e2e/invitation.spec.ts',
    description: 'Run invitation system end-to-end tests',
    timeout: 120000
  },
  {
    name: 'performance',
    command: 'npx playwright test tests/performance/optimization.spec.ts',
    description: 'Run performance optimization tests',
    timeout: 300000
  },
  {
    name: 'load',
    command: 'npx playwright test tests/performance/load-test.spec.ts',
    description: 'Run load testing scenarios',
    timeout: 600000
  }
];

class TestRunner {
  private results: { [key: string]: { success: boolean; duration: number; error?: string } } = {};

  async runTest(config: TestConfig): Promise<boolean> {
    console.log(`\n🧪 Running ${config.name}: ${config.description}`);
    console.log(`Command: ${config.command}`);
    
    const startTime = Date.now();
    
    try {
      execSync(config.command, {
        stdio: 'inherit',
        timeout: config.timeout || 120000,
        cwd: process.cwd()
      });
      
      const duration = Date.now() - startTime;
      this.results[config.name] = { success: true, duration };
      
      console.log(`✅ ${config.name} completed successfully in ${duration}ms`);
      return true;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.results[config.name] = { 
        success: false, 
        duration, 
        error: errorMessage 
      };
      
      console.log(`❌ ${config.name} failed after ${duration}ms`);
      console.log(`Error: ${errorMessage}`);
      return false;
    }
  }

  async runAll(suites?: string[]): Promise<void> {
    const suitesToRun = suites && suites.length > 0 
      ? testSuites.filter(suite => suites.includes(suite.name))
      : testSuites;

    console.log(`🚀 Starting test execution for ${suitesToRun.length} test suites\n`);
    
    // Check prerequisites
    await this.checkPrerequisites();
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const suite of suitesToRun) {
      const success = await this.runTest(suite);
      if (success) {
        totalPassed++;
      } else {
        totalFailed++;
      }
    }
    
    this.printSummary(totalPassed, totalFailed);
    
    if (totalFailed > 0) {
      process.exit(1);
    }
  }

  async checkPrerequisites(): Promise<void> {
    console.log('🔍 Checking prerequisites...');
    
    // Check if Playwright is installed
    try {
      execSync('npx playwright --version', { stdio: 'pipe' });
      console.log('✅ Playwright is installed');
    } catch {
      console.log('❌ Playwright not found. Installing...');
      execSync('npm install @playwright/test playwright', { stdio: 'inherit' });
      execSync('npx playwright install', { stdio: 'inherit' });
    }
    
    // Check if browsers are installed
    try {
      execSync('npx playwright install --dry-run', { stdio: 'pipe' });
      console.log('✅ Playwright browsers are installed');
    } catch {
      console.log('📥 Installing Playwright browsers...');
      execSync('npx playwright install', { stdio: 'inherit' });
    }
    
    // Check if backend and frontend can be built
    console.log('🔨 Checking build status...');
    
    try {
      execSync('npm run build:backend', { stdio: 'pipe' });
      console.log('✅ Backend builds successfully');
    } catch (error) {
      console.log('⚠️  Backend build issues detected');
      console.log('This may affect some tests');
    }
    
    try {
      execSync('npm run build:frontend', { stdio: 'pipe' });
      console.log('✅ Frontend builds successfully');
    } catch (error) {
      console.log('⚠️  Frontend build issues detected');
      console.log('This may affect some tests');
    }
    
    console.log('');
  }

  printSummary(passed: number, failed: number): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`Total Suites: ${passed + failed}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    console.log('\n📋 Detailed Results:');
    console.log('-'.repeat(60));
    
    Object.entries(this.results).forEach(([name, result]) => {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      console.log(`${status} ${name.padEnd(20)} ${duration.padStart(10)}`);
      
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error.substring(0, 100)}...`);
      }
    });
    
    if (failed > 0) {
      console.log('\n🔧 Troubleshooting Tips:');
      console.log('- Ensure backend and frontend servers are not running');
      console.log('- Check that all dependencies are installed');
      console.log('- Verify database is accessible');
      console.log('- Run tests individually for more detailed error info');
    }
    
    console.log('\n' + '='.repeat(60));
  }

  listSuites(): void {
    console.log('📋 Available test suites:\n');
    
    testSuites.forEach(suite => {
      console.log(`${suite.name.padEnd(15)} - ${suite.description}`);
    });
    
    console.log('\nUsage:');
    console.log('  npm run test:e2e                    # Run all suites');
    console.log('  npm run test:e2e -- unit e2e-auth   # Run specific suites');
    console.log('  npm run test:e2e -- --list          # Show this list');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const runner = new TestRunner();
  
  if (args.includes('--list') || args.includes('-l')) {
    runner.listSuites();
    return;
  }
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('End-to-End Test Runner');
    console.log('');
    runner.listSuites();
    return;
  }
  
  const suites = args.filter(arg => !arg.startsWith('--'));
  await runner.runAll(suites);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { TestRunner, testSuites };