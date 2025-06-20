#!/usr/bin/env node

/**
 * Google Cloud Run server for email classifier
 * Provides health checks and starts the monitoring service
 */

import 'dotenv/config';
import http from 'http';
import { EmailClassifier } from './src/email-classifier.js';

const PORT = process.env.PORT || 8080;
let emailClassifier = null;

// Server endpoints
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/health' || url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      service: 'email-classifier',
      timestamp: new Date().toISOString()
    }));
  } else if (url.pathname === '/gmail-webhook' && req.method === 'POST') {
    await handleGmailWebhook(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Gmail webhook handler
async function handleGmailWebhook(req, res) {
  try {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console.log('📨 Received Gmail webhook notification');
        
        // Parse the Pub/Sub message
        const pubsubMessage = JSON.parse(body);
        if (pubsubMessage.message && pubsubMessage.message.data) {
          const messageData = JSON.parse(Buffer.from(pubsubMessage.message.data, 'base64').toString());
          console.log('Gmail notification data:', messageData);
          
          // Process the notification
          if (messageData.historyId && emailClassifier) {
            console.log('🔄 Processing Gmail history changes...');
            await emailClassifier.processHistoryChanges(messageData.historyId);
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'processed' }));
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Processing failed' }));
      }
    });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Webhook failed' }));
  }
}

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
  
  // Delay email monitoring startup to ensure server is ready
  setTimeout(() => {
    console.log('🚀 Starting email classifier with push notifications...');
    startEmailClassifier();
  }, 5000); // 5 second delay
});

async function startEmailClassifier() {
  try {
    // Check if required environment variables are set
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'GMAIL_CLIENT_ID', 
      'GMAIL_CLIENT_SECRET',
      'GMAIL_REFRESH_TOKEN'
    ];
    
    // Check if running locally vs Cloud Run
    const isLocal = !process.env.K_SERVICE; // K_SERVICE is set in Cloud Run
    
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
    emailClassifier = new EmailClassifier();
    
    if (isLocal) {
      // Local development: use polling
      console.log('🖥️ Running locally - using polling mode...');
      await emailClassifier.startMonitoring({
        pollInterval: 60000, // 1 minute for local testing
        maxResults: 10,
        labelFilter: 'in:inbox'
      });
    } else {
      // Cloud Run: use push notifications
      console.log('☁️ Running on Cloud Run - setting up push notifications...');
      await emailClassifier.setupGmailWatch({
        topicName: `projects/${process.env.GCLOUD_PROJECT_ID || 'email-classifier-463413'}/topics/gmail-notifications`,
        labelIds: ['INBOX']
      });
      console.log('🎯 Gmail push notifications active - ready to receive emails!');
    }
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