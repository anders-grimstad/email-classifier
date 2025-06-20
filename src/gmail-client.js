/**
 * Gmail API client for email operations
 */

import { google } from 'googleapis';
import { ENV } from './config.js';

export class GmailClient {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      ENV.GMAIL_CLIENT_ID,
      ENV.GMAIL_CLIENT_SECRET
    );
    
    this.oauth2Client.setCredentials({
      refresh_token: ENV.GMAIL_REFRESH_TOKEN,
      access_token: ENV.GMAIL_ACCESS_TOKEN
    });
    
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Get email details by message ID
   * @param {string} messageId - Gmail message ID
   * @returns {Promise<Object>} Email details
   */
  async getEmail(messageId) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });
      
      return this.parseEmailData(response.data);
    } catch (error) {
      console.error('Error getting email:', error);
      throw error;
    }
  }

  /**
   * Search for emails with specific query
   * @param {string} query - Gmail search query
   * @param {number} maxResults - Maximum number of results
   * @returns {Promise<Array>} Array of email objects
   */
  async searchEmails(query, maxResults = 10) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults
      });
      
      if (!response.data.messages) {
        return [];
      }
      
      // Get full details for each message
      const emails = await Promise.all(
        response.data.messages.map(msg => this.getEmail(msg.id))
      );
      
      return emails;
    } catch (error) {
      console.error('Error searching emails:', error);
      throw error;
    }
  }

  /**
   * Check for emails from a specific sender
   * @param {string} senderEmail - Sender's email address
   * @returns {Promise<Array>} Array of emails from sender
   */
  async getEmailsFromSender(senderEmail) {
    const query = `from:${senderEmail}`;
    return this.searchEmails(query);
  }

  /**
   * Check for emails sent to a specific recipient
   * @param {string} recipientEmail - Recipient's email address
   * @returns {Promise<Array>} Array of emails sent to recipient
   */
  async getEmailsToRecipient(recipientEmail) {
    const query = `to:${recipientEmail} in:sent`;
    return this.searchEmails(query);
  }

  /**
   * Add labels to an email
   * @param {string} messageId - Gmail message ID
   * @param {Array<string>} labelIds - Array of label IDs to add
   * @returns {Promise<Object>} Gmail API response
   */
  async addLabels(messageId, labelIds) {
    try {
      const response = await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: labelIds
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error adding labels:', error);
      throw error;
    }
  }

  /**
   * Parse Gmail API email data into a structured format
   * @param {Object} emailData - Raw Gmail API email data
   * @returns {Object} Parsed email data
   */
  parseEmailData(emailData) {
    const headers = this.extractHeaders(emailData.payload.headers);
    
    return {
      id: emailData.id,
      threadId: emailData.threadId,
      labelIds: emailData.labelIds || [],
      snippet: emailData.snippet,
      
      // Headers
      subject: headers.subject || '',
      from: this.parseEmailAddress(headers.from || ''),
      to: this.parseEmailAddresses(headers.to || ''),
      cc: this.parseEmailAddresses(headers.cc || ''),
      
      // Special headers for classification
      headers: {
        'auto-submitted': headers['auto-submitted'],
        'sender': headers.sender,
        'in-reply-to': headers['in-reply-to'],
        'references': headers.references,
        'list-unsubscribe': headers['list-unsubscribe'],
        'precedence': headers.precedence
      },
      
      // Email body
      text: this.extractTextContent(emailData.payload),
      html: this.extractHtmlContent(emailData.payload)
    };
  }

  /**
   * Extract headers from Gmail payload
   * @param {Array} headers - Gmail headers array
   * @returns {Object} Headers object
   */
  extractHeaders(headers) {
    const headerObj = {};
    headers.forEach(header => {
      headerObj[header.name.toLowerCase()] = header.value;
    });
    return headerObj;
  }

  /**
   * Parse email address string into structured format
   * @param {string} addressString - Email address string
   * @returns {Object} Parsed email address
   */
  parseEmailAddress(addressString) {
    const match = addressString.match(/^(.*?)\s*<(.+?)>$/) || [null, addressString, addressString];
    return {
      name: match[1]?.trim() || '',
      address: match[2]?.trim() || addressString.trim()
    };
  }

  /**
   * Parse multiple email addresses
   * @param {string} addressString - Comma-separated email addresses
   * @returns {Array} Array of parsed email addresses
   */
  parseEmailAddresses(addressString) {
    if (!addressString) return [];
    
    return addressString.split(',').map(addr => this.parseEmailAddress(addr.trim()));
  }

  /**
   * Extract text content from Gmail payload
   * @param {Object} payload - Gmail payload
   * @returns {string} Text content
   */
  extractTextContent(payload) {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        
        // Recursively search in nested parts
        const textContent = this.extractTextContent(part);
        if (textContent) return textContent;
      }
    }
    
    return '';
  }

  /**
   * Extract HTML content from Gmail payload
   * @param {Object} payload - Gmail payload
   * @returns {string} HTML content
   */
  extractHtmlContent(payload) {
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        
        // Recursively search in nested parts
        const htmlContent = this.extractHtmlContent(part);
        if (htmlContent) return htmlContent;
      }
    }
    
    return '';
  }

  /**
   * Get all Gmail labels
   * @returns {Promise<Array>} Array of label objects
   */
  async getLabels() {
    try {
      const response = await this.gmail.users.labels.list({
        userId: 'me'
      });
      
      return response.data.labels || [];
    } catch (error) {
      console.error('Error getting labels:', error);
      throw error;
    }
  }
}