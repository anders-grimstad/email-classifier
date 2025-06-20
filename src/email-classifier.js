/**
 * Main email classifier that orchestrates the entire classification workflow
 */

import { GmailClient } from './gmail-client.js';
import { EmailHistoryChecker } from './email-history-checker.js';
import { OpenAIClassifier } from './openai-classifier.js';
import { CONFIG } from './config.js';

export class EmailClassifier {
  constructor() {
    this.gmailClient = new GmailClient();
    this.historyChecker = new EmailHistoryChecker(this.gmailClient);
    this.openaiClassifier = new OpenAIClassifier();
  }

  /**
   * Process and classify a single email by message ID
   * @param {string} messageId - Gmail message ID
   * @returns {Promise<Object>} Classification result with applied label
   */
  async classifyEmail(messageId) {
    try {
      console.log(`Starting classification for email ${messageId}`);
      
      // Step 1: Get email details
      const email = await this.gmailClient.getEmail(messageId);
      console.log(`Retrieved email: ${email.subject}`);
      
      // Step 2: Perform relationship analysis
      const relationshipAnalysis = await this.historyChecker.performRelationshipAnalysis(email);
      console.log(`Relationship analysis: ${relationshipAnalysis.history.summary}`);
      
      // Step 3: Classify with OpenAI
      const classification = await this.openaiClassifier.classifyEmail(email, relationshipAnalysis);
      console.log(`Classification: ${classification.labelName} (${classification.confidence})`);
      
      // Step 4: Apply the label to the email
      await this.applyLabel(messageId, classification.labelId);
      console.log(`Applied label: ${classification.labelName}`);
      
      return {
        messageId,
        email: {
          id: email.id,
          subject: email.subject,
          from: email.from,
          to: email.to,
          timestamp: new Date().toISOString()
        },
        relationshipAnalysis,
        classification,
        success: true
      };
      
    } catch (error) {
      console.error(`Error classifying email ${messageId}:`, error);
      
      return {
        messageId,
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Apply a label to an email
   * @param {string} messageId - Gmail message ID
   * @param {string} labelId - Label ID to apply
   * @returns {Promise<Object>} Gmail API response
   */
  async applyLabel(messageId, labelId) {
    try {
      return await this.gmailClient.addLabels(messageId, [labelId]);
    } catch (error) {
      console.error(`Error applying label ${labelId} to email ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Process multiple emails from a list of message IDs
   * @param {Array<string>} messageIds - Array of Gmail message IDs
   * @returns {Promise<Array>} Array of classification results
   */
  async classifyEmails(messageIds) {
    const results = [];
    
    for (const messageId of messageIds) {
      try {
        const result = await this.classifyEmail(messageId);
        results.push(result);
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to classify email ${messageId}:`, error);
        results.push({
          messageId,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  /**
   * Monitor Gmail for new emails and classify them automatically
   * @param {Object} options - Monitoring options
   * @returns {Promise<void>} Runs indefinitely
   */
  async startMonitoring(options = {}) {
    const {
      pollInterval = CONFIG.GMAIL.POLL_INTERVAL,
      maxResults = CONFIG.GMAIL.MAX_RESULTS,
      labelFilter = 'in:inbox'
    } = options;
    
    console.log(`Starting email monitoring (polling every ${pollInterval}ms)`);
    let lastHistoryId = null;
    
    while (true) {
      try {
        // Get recent emails
        const emails = await this.gmailClient.searchEmails(labelFilter, maxResults);
        
        // Filter for new emails if we have a history ID
        const newEmails = lastHistoryId 
          ? emails.filter(email => email.historyId > lastHistoryId)
          : emails.slice(0, 5); // Process only first 5 on initial run
        
        if (newEmails.length > 0) {
          console.log(`Found ${newEmails.length} new emails to classify`);
          
          // Process each new email
          for (const email of newEmails) {
            const result = await this.classifyEmail(email.id);
            
            if (result.success) {
              console.log(`✅ Classified: ${email.subject} → ${result.classification.labelName}`);
            } else {
              console.log(`❌ Failed: ${email.subject} - ${result.error}`);
            }
            
            // Update last history ID
            if (!lastHistoryId || email.historyId > lastHistoryId) {
              lastHistoryId = email.historyId;
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else {
          console.log('No new emails to process');
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.error('Error in monitoring loop:', error);
        
        // Wait longer on error before retrying
        await new Promise(resolve => setTimeout(resolve, pollInterval * 2));
      }
    }
  }

  /**
   * Set up Gmail push notifications
   * @param {Object} options - Watch options
   * @returns {Promise<Object>} Watch response
   */
  async setupGmailWatch(options) {
    try {
      console.log('🔧 Setting up Gmail watch for push notifications...');
      const watchResult = await this.gmailClient.setupWatch(options);
      
      // Store the history ID for future reference
      this.lastHistoryId = watchResult.historyId;
      console.log(`📊 Gmail watch active with history ID: ${this.lastHistoryId}`);
      
      return watchResult;
    } catch (error) {
      console.error('❌ Failed to setup Gmail watch:', error);
      throw error;
    }
  }

  /**
   * Process Gmail history changes from push notifications
   * @param {string} historyId - History ID from push notification
   * @returns {Promise<void>}
   */
  async processHistoryChanges(historyId) {
    try {
      if (!this.lastHistoryId) {
        console.log('⚠️ No stored history ID, fetching recent emails...');
        // If we don't have a baseline, just process recent emails
        const recentEmails = await this.gmailClient.searchEmails('in:inbox', 5);
        await this.processEmails(recentEmails);
        this.lastHistoryId = historyId;
        return;
      }

      console.log(`🔍 Processing history changes from ${this.lastHistoryId} to ${historyId}`);
      
      // Get history changes since last processed
      const historyChanges = await this.gmailClient.getHistory(this.lastHistoryId);
      
      if (historyChanges.length === 0) {
        console.log('📭 No new history changes to process');
        return;
      }

      // Extract new message IDs from history
      const newMessageIds = [];
      for (const change of historyChanges) {
        if (change.messagesAdded) {
          for (const messageAdded of change.messagesAdded) {
            newMessageIds.push(messageAdded.message.id);
          }
        }
      }

      console.log(`📬 Found ${newMessageIds.length} new messages to classify`);

      // Process each new message
      for (const messageId of newMessageIds) {
        try {
          console.log(`🔄 Processing message: ${messageId}`);
          await this.classifyEmail(messageId);
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`❌ Failed to process message ${messageId}:`, error);
        }
      }

      // Update our stored history ID
      this.lastHistoryId = historyId;
      console.log(`✅ Processed ${newMessageIds.length} messages, updated history ID to ${historyId}`);
      
    } catch (error) {
      console.error('❌ Error processing history changes:', error);
    }
  }

  /**
   * Process multiple emails
   * @param {Array} emails - Array of email objects with id property
   * @returns {Promise<void>}
   */
  async processEmails(emails) {
    for (const email of emails) {
      try {
        await this.classifyEmail(email.id);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
      } catch (error) {
        console.error(`Failed to process email ${email.id}:`, error);
      }
    }
  }

  /**
   * Classify emails from test data (useful for testing)
   * @param {Array<Object>} testEmails - Array of test email objects
   * @returns {Promise<Array>} Classification results
   */
  async classifyTestEmails(testEmails) {
    const results = [];
    
    for (const testEmail of testEmails) {
      try {
        console.log(`Classifying test email: ${testEmail.Subject}`);
        
        // Convert test email format to our email format
        const email = this.convertTestEmailFormat(testEmail);
        
        // Perform relationship analysis
        const relationshipAnalysis = await this.historyChecker.performRelationshipAnalysis(email);
        
        // Classify with OpenAI
        const classification = await this.openaiClassifier.classifyEmail(email, relationshipAnalysis);
        
        results.push({
          testEmail,
          email,
          relationshipAnalysis,
          classification,
          success: true
        });
        
        console.log(`✅ Test classification: ${email.subject} → ${classification.labelName}`);
        
      } catch (error) {
        console.error(`Failed to classify test email:`, error);
        results.push({
          testEmail,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  /**
   * Convert test email format to our internal email format
   * @param {Object} testEmail - Test email object
   * @returns {Object} Converted email object
   */
  convertTestEmailFormat(testEmail) {
    return {
      id: testEmail.id || 'test-' + Date.now(),
      threadId: testEmail.threadId || 'test-thread',
      labelIds: testEmail.labels?.map(l => l.id) || [],
      snippet: testEmail.snippet || '',
      subject: testEmail.Subject || '',
      from: this.gmailClient.parseEmailAddress(testEmail.From || ''),
      to: testEmail.To ? [this.gmailClient.parseEmailAddress(testEmail.To)] : [],
      cc: testEmail.Cc ? [this.gmailClient.parseEmailAddress(testEmail.Cc)] : [],
      headers: {
        'auto-submitted': null,
        'sender': null,
        'in-reply-to': null,
        'references': null,
        'list-unsubscribe': null,
        'precedence': null
      },
      text: testEmail.snippet || '',
      html: ''
    };
  }

  /**
   * Get classification statistics
   * @param {Array} results - Classification results
   * @returns {Object} Statistics summary
   */
  getClassificationStats(results) {
    const stats = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      labelCounts: {},
      confidenceCounts: { HIGH: 0, MEDIUM: 0, LOW: 0 }
    };
    
    // Count labels and confidence levels
    results.forEach(result => {
      if (result.success && result.classification) {
        const labelName = result.classification.labelName;
        const confidence = result.classification.confidence;
        
        stats.labelCounts[labelName] = (stats.labelCounts[labelName] || 0) + 1;
        stats.confidenceCounts[confidence] = (stats.confidenceCounts[confidence] || 0) + 1;
      }
    });
    
    return stats;
  }
}