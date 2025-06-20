#!/usr/bin/env node

/**
 * Google Cloud Run server for email classifier
 * Provides health checks and starts the monitoring service
 */

import 'dotenv/config';
import http from 'http';
import { EmailClassifier } from './src/email-classifier.js';

const PORT = process.env.PORT || 8080;

// Health check endpoint
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      service: 'email-classifier',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
  
  // Delay email monitoring startup to ensure server is ready
  setTimeout(() => {
    console.log('🚀 Starting email classifier monitoring...');
    startEmailMonitoring();
  }, 5000); // 5 second delay
});

async function startEmailMonitoring() {
  try {
    // Check if required environment variables are set
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'GMAIL_CLIENT_ID', 
      'GMAIL_CLIENT_SECRET',
      'GMAIL_REFRESH_TOKEN'
    ];
    
    console.log('🔍 Checking environment variables...');
    
    // Log each environment variable status
    requiredEnvVars.forEach(varName => {
      const isSet = !!process.env[varName];
      const maskedValue = isSet ? `${process.env[varName].substring(0, 8)}...` : 'NOT SET';
      console.log(`  ${isSet ? '✅' : '❌'} ${varName}: ${maskedValue}`);
    });
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn('⚠️  Missing environment variables:', missingVars.join(', '));
      console.warn('📝 Please set these in the Cloud Run console before email monitoring can start');
      console.warn('🌐 Health endpoint will remain available for debugging');
      return;
    }
    
    console.log('✅ All required environment variables found');
    const classifier = new EmailClassifier();
    
    // Enhanced monitoring options for cloud deployment
    await classifier.startMonitoring({
      pollInterval: process.env.POLL_INTERVAL || 300000, // 5 minutes default
      maxResults: process.env.MAX_RESULTS || 200,
      labelFilter: 'in:inbox'
    });
  } catch (error) {
    console.error('❌ Error starting email monitoring:', error);
    console.error('🌐 Health endpoint will remain available for debugging');
    // Don't exit - keep health endpoint running for debugging
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});