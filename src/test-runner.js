/**
 * Test runner for the email classifier using the sample data from n8n workflow
 */

import { EmailClassifier } from './email-classifier.js';

// Sample test data from the n8n workflow pinData
const TEST_EMAILS = [
  {
    id: "1971723eacc72f08",
    To: "max@trigify.io",
    From: "Coresignal <info@coresignal.com>",
    Subject: "New MCP server: Direct data access for smarter AI",
    labels: [
      { id: "INBOX", name: "INBOX" },
      { id: "IMPORTANT", name: "IMPORTANT" },
      { id: "CATEGORY_PROMOTIONS", name: "CATEGORY_PROMOTIONS" }
    ],
    snippet: "What&#39;s new Empower your AI agent with Coresignal&#39;s data We&#39;re excited to unveil our latest news, the Coresignal MCP server that connects your LLM tools directly to our company, employee,",
    threadId: "1971723eacc72f08",
    historyId: "5524551",
    internalDate: "1748439919000",
    sizeEstimate: 62610
  },
  {
    id: "1971723cfa14c3df",
    To: "max@trigify.io",
    From: "Plain <hello@plain.com>",
    Subject: " Important update to Plain's Data Processing Agreement (DPA)",
    Cc: "",
    labels: [
      { id: "INBOX", name: "INBOX" },
      { id: "IMPORTANT", name: "IMPORTANT" },
      { id: "CATEGORY_UPDATES", name: "CATEGORY_UPDATES" },
      { id: "UNREAD", name: "UNREAD" }
    ],
    snippet: "Hi Max, We&#39;re writing to let you know about an upcoming change to our Data Processing Agreement (DPA). What&#39;s changing? We are simplifying our notification process for subprocessor updates.",
    threadId: "1971723cfa14c3df",
    historyId: "5524408",
    internalDate: "1748439911000",
    sizeEstimate: 45077
  }
];

export class TestRunner {
  constructor() {
    this.classifier = new EmailClassifier();
  }

  /**
   * Run tests on the sample emails
   * @returns {Promise<Object>} Test results
   */
  async runTests() {
    console.log('🧪 Starting Email Classifier Tests\n');
    
    try {
      // Test the sample emails
      const results = await this.classifier.classifyTestEmails(TEST_EMAILS);
      
      // Generate statistics
      const stats = this.classifier.getClassificationStats(results);
      
      // Display results
      this.displayResults(results, stats);
      
      return {
        results,
        stats,
        success: true
      };
      
    } catch (error) {
      console.error('❌ Test run failed:', error);
      return {
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Display test results in a formatted way
   * @param {Array} results - Classification results
   * @param {Object} stats - Statistics summary
   */
  displayResults(results, stats) {
    console.log('📊 TEST RESULTS\n');
    console.log('=' .repeat(80));
    
    results.forEach((result, index) => {
      console.log(`\n📧 EMAIL ${index + 1}:`);
      console.log('-'.repeat(40));
      
      if (result.success) {
        console.log(`Subject: ${result.email.subject}`);
        console.log(`From: ${result.email.from.name} <${result.email.from.address}>`);
        console.log(`\n🔍 ANALYSIS:`);
        console.log(`- Email History: ${result.relationshipAnalysis.history.summary}`);
        console.log(`- Thread Context: ${result.relationshipAnalysis.thread.context}`);
        console.log(`- Classification Hints: ${result.relationshipAnalysis.classification_hints.join(', ')}`);
        console.log(`\n🏷️  CLASSIFICATION:`);
        console.log(`- Label: ${result.classification.labelName}`);
        console.log(`- Confidence: ${result.classification.confidence}`);
        console.log(`- Reasoning: ${result.classification.reasoning}`);
      } else {
        console.log(`❌ FAILED: ${result.error}`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('📈 STATISTICS:');
    console.log('-'.repeat(40));
    console.log(`Total emails processed: ${stats.total}`);
    console.log(`Successful classifications: ${stats.successful}`);
    console.log(`Failed classifications: ${stats.failed}`);
    console.log(`\nLabel distribution:`);
    Object.entries(stats.labelCounts).forEach(([label, count]) => {
      console.log(`  - ${label}: ${count}`);
    });
    console.log(`\nConfidence distribution:`);
    Object.entries(stats.confidenceCounts).forEach(([confidence, count]) => {
      console.log(`  - ${confidence}: ${count}`);
    });
  }

  /**
   * Test individual email classification
   * @param {string} messageId - Gmail message ID
   * @returns {Promise<Object>} Classification result
   */
  async testSingleEmail(messageId) {
    console.log(`🧪 Testing single email: ${messageId}\n`);
    
    try {
      const result = await this.classifier.classifyEmail(messageId);
      
      if (result.success) {
        console.log('✅ Classification successful:');
        console.log(`Subject: ${result.email.subject}`);
        console.log(`Label: ${result.classification.labelName}`);
        console.log(`Confidence: ${result.classification.confidence}`);
        console.log(`Reasoning: ${result.classification.reasoning}`);
      } else {
        console.log(`❌ Classification failed: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Test failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate configuration and setup
   * @returns {Promise<boolean>} True if setup is valid
   */
  async validateSetup() {
    console.log('🔧 Validating setup...\n');
    
    const issues = [];
    
    // Check environment variables
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'GMAIL_CLIENT_ID', 
      'GMAIL_CLIENT_SECRET',
      'GMAIL_REFRESH_TOKEN'
    ];
    
    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        issues.push(`Missing environment variable: ${envVar}`);
      }
    });
    
    // Test Gmail API connection
    try {
      await this.classifier.gmailClient.searchEmails('in:inbox', 1);
      console.log('✅ Gmail API connection successful');
    } catch (error) {
      issues.push(`Gmail API connection failed: ${error.message}`);
    }
    
    // Test OpenAI API connection
    try {
      // Simple test classification with minimal data
      const testEmail = {
        id: 'test',
        subject: 'Test email',
        from: { name: 'Test', address: 'test@example.com' },
        to: [],
        cc: [],
        text: 'This is a test email',
        headers: {},
        labelIds: []
      };
      
      const testAnalysis = {
        history: { hasHistory: false, summary: 'No history' },
        thread: { context: 'Test context' },
        domain: { domain: 'example.com' },
        classification_hints: []
      };
      
      await this.classifier.openaiClassifier.classifyEmail(testEmail, testAnalysis);
      console.log('✅ OpenAI connection successful');
    } catch (error) {
      issues.push(`OpenAI connection failed: ${error.message}`);
    }
    
    // Display results
    if (issues.length === 0) {
      console.log('\n🎉 All systems operational!');
      return true;
    } else {
      console.log('\n❌ Setup issues found:');
      issues.forEach(issue => console.log(`  - ${issue}`));
      return false;
    }
  }

  /**
   * Run a comprehensive test suite
   * @returns {Promise<Object>} Complete test results
   */
  async runFullTestSuite() {
    console.log('🚀 Running Full Email Classifier Test Suite\n');
    
    const testResults = {
      setup: await this.validateSetup(),
      sampleTests: null,
      timestamp: new Date().toISOString()
    };
    
    if (testResults.setup) {
      console.log('\n📧 Running sample email tests...');
      testResults.sampleTests = await this.runTests();
    } else {
      console.log('\n⚠️  Skipping sample tests due to setup issues');
    }
    
    console.log('\n🏁 Test suite completed');
    return testResults;
  }
}

// Export a convenience function for quick testing
export async function runQuickTest() {
  const runner = new TestRunner();
  return await runner.runTests();
}

// Export function for setup validation
export async function validateSetup() {
  const runner = new TestRunner();
  return await runner.validateSetup();
}