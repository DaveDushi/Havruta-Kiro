#!/usr/bin/env node

/**
 * OAuth Configuration Debug Script
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 OAuth Configuration Debug\n');

// Read backend .env
const backendEnvPath = path.join(__dirname, 'backend/.env');
if (fs.existsSync(backendEnvPath)) {
  const backendEnv = fs.readFileSync(backendEnvPath, 'utf8');
  
  // Extract FRONTEND_URL
  const frontendUrlMatch = backendEnv.match(/FRONTEND_URL=(.+)/);
  const frontendUrl = frontendUrlMatch ? frontendUrlMatch[1].trim() : 'http://localhost:3000';
  
  // Extract Google Client ID
  const clientIdMatch = backendEnv.match(/GOOGLE_CLIENT_ID=(.+)/);
  const clientId = clientIdMatch ? clientIdMatch[1].trim() : 'NOT_SET';
  
  console.log('📋 Current Configuration:');
  console.log(`Frontend URL: ${frontendUrl}`);
  console.log(`Google Client ID: ${clientId}`);
  console.log(`Expected Callback URL: ${frontendUrl}/api/auth/google/callback`);
  
  console.log('\n🔧 Required Google OAuth Settings:');
  console.log('Authorized JavaScript origins:');
  console.log(`  ${frontendUrl}`);
  console.log('Authorized redirect URIs:');
  console.log(`  ${frontendUrl}/api/auth/google/callback`);
  
  console.log('\n🌐 Google Cloud Console Steps:');
  console.log('1. Go to: https://console.cloud.google.com/');
  console.log('2. Navigate to: APIs & Services → Credentials');
  console.log(`3. Edit OAuth client: ${clientId}`);
  console.log('4. Add the URLs shown above');
  console.log('5. Save changes');
  
  console.log('\n⚠️  Current Error:');
  console.log('Google is rejecting the redirect because the callback URL');
  console.log(`"${frontendUrl}/api/auth/google/callback"`);
  console.log('is not registered in your Google OAuth configuration.');
  
} else {
  console.log('❌ Backend .env file not found');
}

console.log('\n✨ After updating Google OAuth config, restart your servers!');