#!/usr/bin/env node

/**
 * API Endpoints Test Script
 * Tests if all API endpoints are accessible from the tunnel
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://havruta.daviddusi.com';
const API_URL = `${BASE_URL}/api`;

console.log('🔍 Testing API Endpoints...\n');

const endpoints = [
  { path: '/health', description: 'Health check' },
  { path: '/sefaria/index', description: 'Sefaria index' },
  { path: '/sefaria/texts/Genesis%201:1', description: 'Sefaria text retrieval' },
];

async function testEndpoint(path, description) {
  return new Promise((resolve) => {
    const url = `${API_URL}${path}`;
    console.log(`Testing: ${description}`);
    console.log(`URL: ${url}`);
    
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      console.log(`Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Success');
          try {
            const parsed = JSON.parse(data);
            console.log(`Response preview: ${JSON.stringify(parsed).substring(0, 100)}...`);
          } catch (e) {
            console.log(`Response preview: ${data.substring(0, 100)}...`);
          }
        } else {
          console.log('❌ Failed');
          console.log(`Error: ${data}`);
        }
        console.log('---');
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ Network Error');
      console.log(`Error: ${error.message}`);
      console.log('---');
      resolve();
    });
    
    req.setTimeout(10000, () => {
      console.log('❌ Timeout');
      console.log('---');
      req.destroy();
      resolve();
    });
  });
}

async function runTests() {
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API URL: ${API_URL}\n`);
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint.path, endpoint.description);
  }
  
  console.log('🏁 Testing complete!');
  console.log('\n💡 If tests fail:');
  console.log('1. Make sure your backend server is running (npm run dev)');
  console.log('2. Make sure your frontend server is running (npm run dev)');
  console.log('3. Make sure your Cloudflare tunnel is active');
  console.log('4. Check that Vite proxy is working (/api/* → localhost:3001)');
}

runTests().catch(console.error);