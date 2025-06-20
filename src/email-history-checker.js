/**
 * Email history checker for determining if emails are cold or from known contacts
 */

import { CONFIG } from './config.js';

export class EmailHistoryChecker {
  constructor(gmailClient) {
    this.gmailClient = gmailClient;
  }

  /**
   * Check if there's prior email history with a sender
   * @param {string} senderEmail - Sender's email address
   * @returns {Promise<Object>} History check result
   */
  async checkEmailHistory(senderEmail) {
    try {
      // Check for emails received from this sender
      const receivedEmails = await this.gmailClient.getEmailsFromSender(senderEmail);
      
      // Check for emails sent to this sender
      const sentEmails = await this.gmailClient.getEmailsToRecipient(senderEmail);
      
      const hasHistory = receivedEmails.length > 0 || sentEmails.length > 0;
      
      return {
        hasHistory,
        receivedCount: receivedEmails.length,
        sentCount: sentEmails.length,
        receivedEmails: receivedEmails.slice(0, 5), // Keep only first 5 for context
        sentEmails: sentEmails.slice(0, 5),
        summary: this.generateHistorySummary(hasHistory, receivedEmails.length, sentEmails.length)
      };
    } catch (error) {
      console.error('Error checking email history:', error);
      return {
        hasHistory: false,
        receivedCount: 0,
        sentCount: 0,
        receivedEmails: [],
        sentEmails: [],
        summary: 'Error checking history - treating as no history',
        error: error.message
      };
    }
  }

  /**
   * Generate a human-readable summary of email history
   * @param {boolean} hasHistory - Whether history exists
   * @param {number} receivedCount - Number of emails received
   * @param {number} sentCount - Number of emails sent
   * @returns {string} History summary
   */
  generateHistorySummary(hasHistory, receivedCount, sentCount) {
    if (!hasHistory) {
      return 'No prior email history found - this appears to be a cold email';
    }
    
    const parts = [];
    if (receivedCount > 0) {
      parts.push(`${receivedCount} email(s) received from this sender`);
    }
    if (sentCount > 0) {
      parts.push(`${sentCount} email(s) sent to this sender`);
    }
    
    return `Prior email history exists: ${parts.join(', ')}`;
  }

  /**
   * Analyze conversation thread context
   * @param {Object} email - Email data
   * @returns {Object} Thread analysis
   */
  analyzeThreadContext(email) {
    const isReply = !!(email.headers['in-reply-to'] || email.headers.references);
    const isAutoSubmitted = !!(email.headers['auto-submitted']);
    const hasUnsubscribe = !!(email.headers['list-unsubscribe']);
    const isBulk = email.headers.precedence === 'bulk';
    
    return {
      isReply,
      isAutoSubmitted,
      hasUnsubscribe,
      isBulk,
      threadId: email.threadId,
      context: this.generateThreadContext(isReply, isAutoSubmitted, hasUnsubscribe, isBulk)
    };
  }

  /**
   * Generate thread context description
   * @param {boolean} isReply - Is this a reply
   * @param {boolean} isAutoSubmitted - Is auto-submitted
   * @param {boolean} hasUnsubscribe - Has unsubscribe link
   * @param {boolean} isBulk - Is bulk email
   * @returns {string} Context description
   */
  generateThreadContext(isReply, isAutoSubmitted, hasUnsubscribe, isBulk) {
    const contexts = [];
    
    if (isReply) {
      contexts.push('Part of ongoing conversation thread');
    }
    if (isAutoSubmitted) {
      contexts.push('Auto-generated/system email');
    }
    if (hasUnsubscribe) {
      contexts.push('Contains unsubscribe mechanism');
    }
    if (isBulk) {
      contexts.push('Mass/bulk email');
    }
    
    return contexts.length > 0 ? contexts.join(', ') : 'Direct individual email';
  }

  /**
   * Check if sender is from a known domain pattern
   * @param {string} senderEmail - Sender's email address
   * @returns {Object} Domain analysis
   */
  analyzeSenderDomain(senderEmail) {
    const domain = senderEmail.split('@')[1]?.toLowerCase();
    
    // Common patterns for different email types
    const patterns = {
      noreply: /^(no-?reply|noreply|do-?not-?reply)/i,
      automated: /^(notification|alert|system|admin|support)/i,
      marketing: /^(marketing|promo|newsletter|info)/i
    };
    
    const localPart = senderEmail.split('@')[0]?.toLowerCase();
    
    return {
      domain,
      isNoReply: patterns.noreply.test(localPart),
      isAutomated: patterns.automated.test(localPart),
      isMarketing: patterns.marketing.test(localPart),
      localPart
    };
  }

  /**
   * Perform comprehensive email relationship analysis
   * @param {Object} email - Email data
   * @returns {Promise<Object>} Complete relationship analysis
   */
  async performRelationshipAnalysis(email) {
    const senderEmail = email.from.address;
    
    // Run all analyses in parallel
    const [emailHistory, threadContext, domainAnalysis] = await Promise.all([
      this.checkEmailHistory(senderEmail),
      Promise.resolve(this.analyzeThreadContext(email)),
      Promise.resolve(this.analyzeSenderDomain(senderEmail))
    ]);

    return {
      email: {
        id: email.id,
        subject: email.subject,
        from: email.from,
        timestamp: new Date().toISOString()
      },
      history: emailHistory,
      thread: threadContext,
      domain: domainAnalysis,
      classification_hints: this.generateClassificationHints(emailHistory, threadContext, domainAnalysis)
    };
  }

  /**
   * Generate hints for email classification based on relationship analysis
   * @param {Object} emailHistory - Email history data
   * @param {Object} threadContext - Thread context data
   * @param {Object} domainAnalysis - Domain analysis data
   * @returns {Array<string>} Classification hints
   */
  generateClassificationHints(emailHistory, threadContext, domainAnalysis) {
    const hints = [];
    
    // History-based hints
    if (!emailHistory.hasHistory) {
      hints.push('COLD_EMAIL: No prior communication history');
      if (domainAnalysis.isMarketing) {
        hints.push('LIKELY_MARKETING: Cold email from marketing-type address');
      }
    } else {
      hints.push('KNOWN_CONTACT: Prior email history exists');
      if (threadContext.isReply) {
        hints.push('ONGOING_CONVERSATION: Part of active thread');
      }
    }
    
    // Context-based hints
    if (threadContext.isAutoSubmitted) {
      hints.push('AUTOMATED: System-generated email');
    }
    
    if (threadContext.hasUnsubscribe && threadContext.isBulk) {
      hints.push('BULK_EMAIL: Mass mailing with unsubscribe');
    }
    
    if (domainAnalysis.isNoReply) {
      hints.push('NOTIFICATION_TYPE: No-reply address suggests notification');
    }
    
    return hints;
  }
}