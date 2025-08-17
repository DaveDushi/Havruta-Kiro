#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running Havruta Platform Tests\n');

// Test configurations
const tests = [
  {
    name: 'Unit Tests (Frontend)',
    command: 'npm run test:frontend',
    description: 'Frontend component and utility tests'
  },
  {
    name: 'Unit Tests (Backend)', 
    command: 'npm run test:backend',
    description: 'Backend service and API tests'
  },
  {
    name: 'Performance Tests',
    command: 'npx playwright test tests/performance/optimization.spec.ts --headed=false',
    description: 'Performance optimization validation'
  }
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  console.log(`\n🔍 Running: ${test.name}`);
  console.log(`📝 ${test.description}`);
  console.log(`⚡ Command: ${test.command}\n`);
  
  try {
    execSync(test.command, { 
      stdio: 'inherit',
      cwd: process.cwd(),
      timeout: 120000 // 2 minutes timeout
    });
    
    console.log(`✅ ${test.name} - PASSED\n`);
    passed++;
    
  } catch (error) {
    console.log(`❌ ${test.name} - FAILED`);
    console.log(`Error: ${error.message}\n`);
    failed++;
  }
}

// Summary
console.log('='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n💡 Tips:');
  console.log('- Check that all dependencies are installed: npm install');
  console.log('- Ensure TypeScript compiles: npm run type-check');
  console.log('- Run individual test suites for detailed error info');
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed!');
}