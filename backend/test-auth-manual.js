// Manual Authentication Testing Script
// Run this with: node test-auth-manual.js

const BASE_URL = 'http://localhost:3001/api';

// Replace this with the actual token you get from the OAuth flow
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE';

async function testEndpoint(endpoint, method = 'GET', token = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers
    });
    
    const data = await response.json();
    console.log(`\n${method} ${endpoint}`);
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error(`Error testing ${endpoint}:`, error.message);
  }
}

async function runTests() {
  console.log('🧪 Testing Authentication Endpoints\n');
  
  // Test 1: Health check (no auth required)
  console.log('1. Testing health endpoint...');
  await testEndpoint('/health');
  
  // Test 2: Try protected endpoint without token (should fail)
  console.log('\n2. Testing /auth/me without token (should fail)...');
  await testEndpoint('/auth/me');
  
  // Test 3: Try protected endpoint with token (should work if you have a valid token)
  if (JWT_TOKEN !== 'YOUR_JWT_TOKEN_HERE') {
    console.log('\n3. Testing /auth/me with token...');
    await testEndpoint('/auth/me', 'GET', JWT_TOKEN);
    
    console.log('\n4. Testing token refresh...');
    await testEndpoint('/auth/refresh', 'POST', JWT_TOKEN);
    
    console.log('\n5. Testing logout...');
    await testEndpoint('/auth/logout', 'POST', JWT_TOKEN);
  } else {
    console.log('\n3. ⚠️  To test protected endpoints:');
    console.log('   - Go to http://localhost:3001/api/auth/google in your browser');
    console.log('   - Complete the OAuth flow');
    console.log('   - Copy the token from the redirect URL');
    console.log('   - Replace JWT_TOKEN in this script and run again');
  }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ or you can install node-fetch');
  console.log('Alternative: Use curl commands or a tool like Postman');
  process.exit(1);
}

runTests().catch(console.error);