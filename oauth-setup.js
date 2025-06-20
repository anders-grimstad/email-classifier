#!/usr/bin/env node

/**
 * Gmail OAuth2 Setup Script
 * Run this to generate refresh tokens for Gmail API access
 */

import 'dotenv/config';
import { google } from 'googleapis';
import readline from 'readline';
import fs from 'fs';

const { OAuth2 } = google.auth;

// OAuth2 configuration
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

const oauth2Client = new OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob' // Desktop app redirect URI
);

/**
 * Get authorization URL
 */
function getAuthUrl() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to get refresh token
  });
  
  return authUrl;
}

/**
 * Get access token from authorization code
 */
async function getTokenFromCode(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Error getting tokens:', error);
    throw error;
  }
}

/**
 * Update .env file with new tokens
 */
function updateEnvFile(tokens) {
  const envPath = '.env';
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update refresh token
  if (tokens.refresh_token) {
    envContent = envContent.replace(
      /GMAIL_REFRESH_TOKEN=.*/,
      `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`
    );
  }
  
  // Update access token
  if (tokens.access_token) {
    envContent = envContent.replace(
      /GMAIL_ACCESS_TOKEN=.*/,
      `GMAIL_ACCESS_TOKEN=${tokens.access_token}`
    );
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env file with new tokens');
}

/**
 * Main OAuth setup flow
 */
async function main() {
  console.log('🔐 Gmail OAuth2 Setup\n');
  
  // Check if we have client credentials
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    console.error('❌ Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env file');
    process.exit(1);
  }
  
  console.log('📋 Follow these steps to authorize Gmail access:\n');
  
  // Step 1: Get authorization URL
  const authUrl = getAuthUrl();
  console.log('1. Open this URL in your browser:');
  console.log(`   ${authUrl}\n`);
  
  console.log('2. Complete the authorization in your browser');
  console.log('3. Google will show you an authorization code');
  console.log('4. Copy that authorization code\n');
  
  // Step 2: Get authorization code from user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const code = await new Promise((resolve) => {
    rl.question('Enter the authorization code: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
  
  if (!code) {
    console.error('❌ No authorization code provided');
    process.exit(1);
  }
  
  console.log('\n🔄 Exchanging code for tokens...');
  
  try {
    // Step 3: Exchange code for tokens
    const tokens = await getTokenFromCode(code);
    
    console.log('✅ Successfully obtained tokens:');
    console.log(`   Access Token: ${tokens.access_token ? '✓' : '✗'}`);
    console.log(`   Refresh Token: ${tokens.refresh_token ? '✓' : '✗'}`);
    
    if (!tokens.refresh_token) {
      console.log('\n⚠️  No refresh token received. This might happen if:');
      console.log('   - You\'ve already authorized this app before');
      console.log('   - Try revoking access in Google Account settings and try again');
      console.log('   - Or add prompt=consent to force consent screen');
    }
    
    // Step 4: Update .env file
    updateEnvFile(tokens);
    
    console.log('\n🎉 OAuth setup complete!');
    console.log('You can now run: npm run validate');
    
  } catch (error) {
    console.error('❌ Failed to get tokens:', error.message);
    process.exit(1);
  }
}

// Helper function to revoke tokens (optional)
async function revokeTokens() {
  try {
    const tokens = {
      access_token: process.env.GMAIL_ACCESS_TOKEN,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    };
    
    oauth2Client.setCredentials(tokens);
    await oauth2Client.revokeCredentials();
    console.log('✅ Tokens revoked successfully');
  } catch (error) {
    console.error('❌ Failed to revoke tokens:', error);
  }
}

// Check command line arguments
const args = process.argv.slice(2);

if (args[0] === 'revoke') {
  console.log('🔄 Revoking existing tokens...');
  revokeTokens();
} else if (args[0] === 'help') {
  console.log('Gmail OAuth2 Setup Tool\n');
  console.log('Usage:');
  console.log('  node oauth-setup.js        - Run OAuth flow');
  console.log('  node oauth-setup.js revoke - Revoke existing tokens');
  console.log('  node oauth-setup.js help   - Show this help');
} else {
  main().catch(console.error);
}