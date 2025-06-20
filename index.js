/**
 * Main entry point for the email classifier
 * Usage examples for local testing and Cloudflare Workers
 */

import 'dotenv/config';

import { EmailClassifier } from './src/email-classifier.js';
import { TestRunner, runQuickTest, validateSetup } from './src/test-runner.js';
import { CONFIG } from './src/config.js';

// Export main classes for use in other projects
export { EmailClassifier, TestRunner };
export { GmailClient } from './src/gmail-client.js';
export { EmailHistoryChecker } from './src/email-history-checker.js';
export { OpenAIClassifier } from './src/openai-classifier.js';
export { CONFIG } from './src/config.js';

/**
 * Main function for command-line usage
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  console.log('📧 Email Classifier\n');
  
  switch (command) {
    case 'test':
      console.log('Running tests with sample data...\n');
      await runQuickTest();
      break;
      
    case 'validate':
      console.log('Validating setup...\n');
      await validateSetup();
      break;
      
    case 'classify':
      if (args.length < 2) {
        console.log('Usage: node index.js classify <message-id>');
        process.exit(1);
      }
      
      const messageId = args[1];
      console.log(`Classifying email: ${messageId}\n`);
      
      const classifier = new EmailClassifier();
      const result = await classifier.classifyEmail(messageId);
      
      if (result.success) {
        console.log('✅ Classification successful:');
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('❌ Classification failed:');
        console.log(result.error);
      }
      break;
      
    case 'monitor':
      console.log('Starting email monitoring...\n');
      const monitorClassifier = new EmailClassifier();
      await monitorClassifier.startMonitoring();
      break;
      
    case 'full-test':
      console.log('Running full test suite...\n');
      const runner = new TestRunner();
      const fullResults = await runner.runFullTestSuite();
      console.log('\nFull test results:');
      console.log(JSON.stringify(fullResults, null, 2));
      break;
      
    default:
      console.log('Available commands:');
      console.log('  test         - Run tests with sample data');
      console.log('  validate     - Validate setup and connections');
      console.log('  classify <id> - Classify a specific email by message ID');
      console.log('  monitor      - Start continuous email monitoring');
      console.log('  full-test    - Run complete test suite');
      console.log('\nExamples:');
      console.log('  node index.js test');
      console.log('  node index.js classify 1971723eacc72f08');
      console.log('  node index.js monitor');
      break;
  }
}

/**
 * Cloudflare Workers compatible handler
 * @param {Request} request - Incoming request
 * @param {Object} env - Environment variables
 * @returns {Response} Response object
 */
export async function handleCloudflareWorkerRequest(request, env) {
  try {
    // Set environment variables from Cloudflare Workers env
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
    process.env.GMAIL_CLIENT_ID = env.GMAIL_CLIENT_ID;
    process.env.GMAIL_CLIENT_SECRET = env.GMAIL_CLIENT_SECRET;
    process.env.GMAIL_REFRESH_TOKEN = env.GMAIL_REFRESH_TOKEN;
    process.env.GMAIL_ACCESS_TOKEN = env.GMAIL_ACCESS_TOKEN;
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    const classifier = new EmailClassifier();
    
    // Handle different endpoints
    switch (path) {
      case '/classify':
        if (request.method !== 'POST') {
          return new Response('Method not allowed', { status: 405 });
        }
        
        const body = await request.json();
        const messageId = body.messageId;
        
        if (!messageId) {
          return new Response('Missing messageId in request body', { status: 400 });
        }
        
        const result = await classifier.classifyEmail(messageId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      case '/classify-batch':
        if (request.method !== 'POST') {
          return new Response('Method not allowed', { status: 405 });
        }
        
        const batchBody = await request.json();
        const messageIds = batchBody.messageIds;
        
        if (!Array.isArray(messageIds)) {
          return new Response('Missing messageIds array in request body', { status: 400 });
        }
        
        const batchResults = await classifier.classifyEmails(messageIds);
        return new Response(JSON.stringify(batchResults), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      case '/test':
        const testResults = await runQuickTest();
        return new Response(JSON.stringify(testResults), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      case '/health':
        const isHealthy = await validateSetup();
        return new Response(JSON.stringify({ healthy: isHealthy }), {
          status: isHealthy ? 200 : 503,
          headers: { 'Content-Type': 'application/json' }
        });
        
      default:
        return new Response('Not found', { status: 404 });
    }
    
  } catch (error) {
    console.error('Cloudflare Workers error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Export default for Cloudflare Workers
export default {
  fetch: handleCloudflareWorkerRequest
};

// Run main function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}