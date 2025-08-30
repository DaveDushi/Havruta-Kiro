#!/usr/bin/env node

/**
 * Verification script for Cloudflare tunnel configuration
 * Run this to verify your setup is correct
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Cloudflare Tunnel Configuration...\n');

// Check environment files
const frontendEnv = path.join(__dirname, 'frontend/.env');
const backendEnv = path.join(__dirname, 'backend/.env');

console.log('📁 Checking environment files:');

let frontendConfigured = false;
let backendConfigured = false;

if (fs.existsSync(frontendEnv)) {
  const frontendEnvContent = fs.readFileSync(frontendEnv, 'utf8');
  console.log('✅ Frontend .env exists');
  
  if (frontendEnvContent.includes('VITE_BASE_URL=')) {
    console.log('✅ Frontend base URL configured');
    frontendConfigured = true;
  } else {
    console.log('⚠️  Frontend base URL not set (will use localhost)');
  }
  
  if (frontendEnvContent.includes('VITE_API_URL=')) {
    console.log('✅ Frontend API URL configured');
  } else {
    console.log('⚠️  Frontend API URL not set (will use localhost)');
  }
} else {
  console.log('❌ Frontend .env file missing');
}

if (fs.existsSync(backendEnv)) {
  const backendEnvContent = fs.readFileSync(backendEnv, 'utf8');
  console.log('✅ Backend .env exists');
  
  if (backendEnvContent.includes('FRONTEND_URL=')) {
    console.log('✅ Backend frontend URL configured');
    backendConfigured = true;
  } else {
    console.log('⚠️  Backend frontend URL not set (will use localhost)');
  }
} else {
  console.log('❌ Backend .env file missing');
}

console.log('\n🔧 Configuration Summary:');
console.log('- Code fallbacks: localhost (development-friendly)');
console.log('- Environment variables: control tunnel URLs');
console.log('- Cloudflare Tunnel: havruta.daviddusi.com → http://localhost:3000');
console.log('- Vite Dev Server: localhost:3000 (with proxy to localhost:3001)');
console.log('- Backend Server: localhost:3001');

if (frontendConfigured && backendConfigured) {
  console.log('\n✅ Tunnel Mode: Environment variables set for tunnel access');
  console.log('- Access via: https://havruta.daviddusi.com');
  console.log('- Google OAuth Callback: https://havruta.daviddusi.com/api/auth/google/callback');
} else {
  console.log('\n🏠 Local Mode: Using localhost fallbacks');
  console.log('- Access via: http://localhost:3000');
  console.log('- Google OAuth Callback: http://localhost:3000/api/auth/google/callback');
}

console.log('\n🚀 To start your servers:');
console.log('1. Start backend: cd backend && npm run dev');
console.log('2. Start frontend: cd frontend && npm run dev');

if (frontendConfigured && backendConfigured) {
  console.log('\n📋 Google OAuth Configuration (for tunnel):');
  console.log('Authorized JavaScript origins: https://havruta.daviddusi.com');
  console.log('Authorized redirect URIs: https://havruta.daviddusi.com/api/auth/google/callback');
} else {
  console.log('\n📋 Google OAuth Configuration (for local):');
  console.log('Authorized JavaScript origins: http://localhost:3000');
  console.log('Authorized redirect URIs: http://localhost:3000/api/auth/google/callback');
}

console.log('\n💡 Pro tip: To switch between local and tunnel mode,');
console.log('   just update the environment variables in .env files!');

console.log('\n🔧 Common Issues & Solutions:');
console.log('1. "Text retrieval not working from tunnel":');
console.log('   → Check that frontend services use VITE_API_URL consistently');
console.log('   → Verify Vite proxy is forwarding /api/* to backend');
console.log('2. "WebSocket connection fails":');
console.log('   → Ensure tunnel supports WebSocket connections');
console.log('   → Check that socket service uses correct backend URL');
console.log('3. "CORS errors from different clients":');
console.log('   → Verify FRONTEND_URL in backend .env matches tunnel URL');
console.log('   → Check that backend trusts proxy (app.set("trust proxy", 1))');

console.log('\n🧪 Test your setup:');
console.log('Run: node test-api-endpoints.js');

console.log('\n✨ Configuration verification complete!');