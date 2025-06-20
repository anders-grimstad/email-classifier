/**
 * OpenAI integration for email classification
 */

import OpenAI from 'openai';
import { CONFIG, ENV } from './config.js';

export class OpenAIClassifier {
  constructor() {
    this.openai = new OpenAI({
      apiKey: ENV.OPENAI_API_KEY,
    });
  }

  /**
   * Classify an email using OpenAI
   * @param {Object} email - Email data
   * @param {Object} relationshipAnalysis - Email relationship analysis
   * @returns {Promise<Object>} Classification result
   */
  async classifyEmail(email, relationshipAnalysis) {
    try {
      const prompt = this.buildClassificationPrompt(email, relationshipAnalysis);
      
      const response = await this.openai.chat.completions.create({
        model: CONFIG.OPENAI.MODEL,
        max_tokens: CONFIG.OPENAI.MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      const result = this.parseClassificationResponse(response.choices[0].message.content);
      
      return {
        labelId: result.labelId,
        labelName: result.labelName,
        confidence: result.confidence,
        reasoning: result.reasoning,
        rawResponse: response.choices[0].message.content
      };
    } catch (error) {
      console.error('Error classifying email with OpenAI:', error);
      
      // Fallback classification based on simple rules
      return this.fallbackClassification(email, relationshipAnalysis);
    }
  }

  /**
   * Build the classification prompt for OpenAI
   * @param {Object} email - Email data
   * @param {Object} relationshipAnalysis - Email relationship analysis  
   * @returns {string} Classification prompt
   */
  buildClassificationPrompt(email, relationshipAnalysis) {
    const hasHistory = relationshipAnalysis.history.hasHistory;
    const threadContext = relationshipAnalysis.thread;
    const domainAnalysis = relationshipAnalysis.domain;
    
    return `**Objective:** Analyze the provided email data and classify it with the most appropriate label. **Utilize the email history analysis** to determine if this is a first-time interaction (cold email) or part of an existing relationship. This context is crucial for accurate labeling, especially for distinguishing between Marketing, Notifications, and FYI. Respond with **only** the corresponding Label ID.

**Your Email Address (for context):** \`${CONFIG.MY_EMAIL}\`

**Email History Analysis:**
* **Prior Email History:** ${hasHistory ? 'Yes' : 'No'} (${relationshipAnalysis.history.summary})
* **Thread Context:** ${threadContext.context}
* **Domain Analysis:** ${domainAnalysis.domain} (${domainAnalysis.isNoReply ? 'No-reply address' : 'Regular address'})
* **Classification Hints:** ${relationshipAnalysis.classification_hints.join(', ')}

**Input Email Data:**
* **Sender Email:** \`${email.from.address}\`
* **Sender Name:** \`${email.from.name}\`
* **Direct Recipient Emails (To):** \`${email.to.map(r => r.address).join(', ')}\`
* **CC Recipient Emails:** \`${email.cc.map(r => r.address).join(', ')}\`
* **Subject:** \`${email.subject}\`
* **Body (Plain Text):** \`${email.text.substring(0, 2000)}${email.text.length > 2000 ? '...' : ''}\`
* **Existing Gmail Labels:** \`${email.labelIds.join(', ')}\`
* **Auto-Submitted Header:** \`${email.headers['auto-submitted'] || 'None'}\`
* **Original Sender Header:** \`${email.headers['sender'] || 'None'}\`
* **In-Reply-To Header:** \`${email.headers['in-reply-to'] || 'None'}\`
* **References Header:** \`${email.headers['references'] || 'None'}\`
* **List-Unsubscribe Header:** \`${email.headers['list-unsubscribe'] || 'None'}\`
* **Precedence Header:** \`${email.headers['precedence'] || 'None'}\`

**Labels, Descriptions, and Prioritization Logic:**

**Guidance on Using Prior Email History & Unsubscribe Links:**
* **Prior Email History = "No":** Strong indicator of a **cold/unsolicited email**.
    * If promotional/sales pitch: Likely "Marketing."
    * If exceptionally personalized & high-value for business: Rare "To Respond."
* **Prior Email History = "Yes":** Indicates an **existing relationship/conversation**.
    * If it's an update on terms, policies, or service changes from this known entity: Likely "Notification."
    * If it's a newsletter subscribed to: Could be "FYI" or "Marketing" based on content.
    * If it's a direct message requiring action: Likely "To Respond."
* **\`List-Unsubscribe\` Header or Unsubscribe Links in Body:**
    * Common in "Marketing" emails.
    * Also present in many legitimate "Notification" emails (e.g., service updates, policy changes) and some "FYI" newsletters for compliance.
    * **Therefore, an unsubscribe link alone does not define the category. Consider it alongside Prior Email History and email content/purpose.**
* **\`Precedence: Bulk\` Header:** Often indicates mass mailings, common for Marketing, Notifications, and some FYIs.

---

* **To Respond (Label ID: \`${CONFIG.LABELS.TO_RESPOND}\`):**
    * **Primary Criteria:** Requires direct, timely action/reply.
    * **Key Indicators (especially if Prior Email History = "Yes"):** Direct questions, assigned tasks, requests for info, deadlines, part of an active conversation (indicated by \`In-Reply-To\`/\`References\`).
    * **Sales Process Prioritization (Warm Leads/Active Processes - typically Prior Email History = "Yes"):** Ongoing, active sales process discussions.
    * **High-Value Cold Outreach (Exceptional Cases - Prior Email History = "No"):** Highly personalized, strategic opportunity requiring personal attention. (Default for cold sales is "Marketing").

* **FYI (Label ID: \`${CONFIG.LABELS.FYI}\`):**
    * **Primary Criteria:** For awareness; no immediate action/reply required.
    * **Key Indicators:**
        * CC'd, primary action for others.
        * General announcements, **non-promotional** newsletters from **known entities/subscriptions** (Prior Email History = "Yes" or sender is clearly a subscribed source) that aren't critical service notifications.
        * Informational updates within ongoing projects where not the primary actor.
    * If an email is a mass mailing (\`Precedence: Bulk\`, \`List-Unsubscribe\` present) from a **known entity** (Prior Email History = "Yes") and is purely informational without a direct call to action or critical service update, it could be "FYI."

* **Comment (Label ID: \`${CONFIG.LABELS.COMMENT}\`):**
    * Comment/feedback on a document, task, system (e.g., subject "New comment on...").

* **Notification (Label ID: \`${CONFIG.LABELS.NOTIFICATION}\`):**
    * **Primary Criteria:** Provides important, often non-promotional, updates or alerts regarding an existing service, account, or system used or affected by. Action is typically awareness, potential configuration change, or noting a deadline, rather than a conversational reply.
    * **Key Indicators:**
        * **Updates from Known Service Providers (Prior Email History = "Yes" is common):**
            * Changes to Terms of Service, Privacy Policies, Data Processing Agreements (DPAs).
            * Critical service availability announcements (outages, maintenance).
            * Security alerts related to an account.
            * Important updates about features or functionality of a service relied upon, which are not primarily marketing new features.
        * System-generated alerts (e.g., \`Auto-Submitted Header\` = \`auto-generated\`) like social media notifications, non-meeting calendar reminders, some financial transaction alerts.
        * Subject lines may contain: "Important Update," "Service Notification," "Policy Change," "DPA Update," "Security Alert."
        * Even if a \`List-Unsubscribe\` link is present (for compliance), if the core content is a critical service/account/legal update from a company doing business with, it's a "Notification."
        * The \`Existing Gmail Labels\` might include \`CATEGORY_UPDATES\`.

* **Meeting Update (Label ID: \`${CONFIG.LABELS.MEETING_UPDATE}\`):**
    * Update specifically regarding a scheduled meeting (e.g., "Accepted:", "Declined:", "Updated Invitation:", "Cancelled:").

* **Marketing (Label ID: \`${CONFIG.LABELS.MARKETING}\`):**
    * **Primary Criteria:** Unsolicited promotional sales pitch, advertisement, or general marketing newsletter, especially if **Prior Email History = "No".**
    * **Key Indicators:**
        * **No prior email history found with the \`Sender Email\`,** AND the email is primarily aimed at selling a product/service or promoting a company/event.
        * Content is generic, focused on features/benefits without strong personalization to known, active projects.
        * Contains a \`List-Unsubscribe Header\` AND the content is promotional.
        * \`Existing Gmail Labels\` may include \`CATEGORY_PROMOTIONS\`.
    * If **Prior Email History = "Yes":** Could still be "Marketing" if it's a clearly promotional newsletter/offer from a known contact that doesn't fit "Notification" or demand a "To Respond."

* **Tickets (Label ID: \`${CONFIG.LABELS.TICKETS}\`):**
    * **Primary Criteria:** Travel-related confirmations and tickets for transportation.
    * **Key Indicators:**
        * Flight bookings, confirmations, check-in reminders, boarding passes.
        * Train, bus, ferry, or other transportation tickets.
        * Travel itineraries and booking confirmations.
        * Subject lines may contain: "Booking confirmation", "Check-in", "Boarding pass", "Travel itinerary", "Flight", "Train", "Bus".
        * Senders are typically airlines, travel agencies, booking platforms, transportation companies.

* **Receipts (Label ID: \`${CONFIG.LABELS.RECEIPTS}\`):**
    * **Primary Criteria:** Purchase confirmations, receipts, invoices, and order-related communications.
    * **Key Indicators:**
        * Order confirmations from online stores, marketplaces.
        * Purchase receipts, invoices, bills.
        * Shipping notifications, delivery confirmations.
        * Payment confirmations and transaction receipts.
        * Subject lines may contain: "Order confirmation", "Receipt", "Invoice", "Payment", "Shipped", "Delivered", "Purchase".
        * Senders are typically e-commerce sites, stores, payment processors, shipping companies.

**Output Format:**
Please provide your classification in the following JSON format:
{
  "labelId": "[LABEL_ID]",
  "labelName": "[LABEL_NAME]", 
  "confidence": "[HIGH/MEDIUM/LOW]",
  "reasoning": "[Brief explanation of why this label was chosen]"
}`;
  }

  /**
   * Parse the classification response from OpenAI
   * @param {string} response - Raw response from OpenAI
   * @returns {Object} Parsed classification result
   */
  parseClassificationResponse(response) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          labelId: parsed.labelId,
          labelName: parsed.labelName || this.getLabelName(parsed.labelId),
          confidence: parsed.confidence || 'MEDIUM',
          reasoning: parsed.reasoning || 'No reasoning provided'
        };
      }
      
      // Fallback: look for label ID in response
      const labelIds = Object.values(CONFIG.LABELS);
      for (const labelId of labelIds) {
        if (response.includes(labelId)) {
          return {
            labelId,
            labelName: this.getLabelName(labelId),
            confidence: 'MEDIUM',
            reasoning: 'Label ID found in response'
          };
        }
      }
      
      throw new Error('No valid label ID found in response');
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      
      // Default fallback
      return {
        labelId: CONFIG.LABELS.FYI,
        labelName: 'FYI',
        confidence: 'LOW',
        reasoning: 'Parse error - defaulted to FYI'
      };
    }
  }

  /**
   * Get label name from label ID
   * @param {string} labelId - Label ID
   * @returns {string} Label name
   */
  getLabelName(labelId) {
    const labelMap = {
      [CONFIG.LABELS.TO_RESPOND]: 'To Respond',
      [CONFIG.LABELS.FYI]: 'FYI',
      [CONFIG.LABELS.COMMENT]: 'Comment',
      [CONFIG.LABELS.NOTIFICATION]: 'Notification',
      [CONFIG.LABELS.MEETING_UPDATE]: 'Meeting Update',
      [CONFIG.LABELS.MARKETING]: 'Marketing',
      [CONFIG.LABELS.TICKETS]: 'Tickets',
      [CONFIG.LABELS.RECEIPTS]: 'Receipts'
    };
    
    return labelMap[labelId] || 'Unknown';
  }

  /**
   * Fallback classification when OpenAI is unavailable
   * @param {Object} email - Email data
   * @param {Object} relationshipAnalysis - Email relationship analysis
   * @returns {Object} Fallback classification result
   */
  fallbackClassification(email, relationshipAnalysis) {
    const hasHistory = relationshipAnalysis.history.hasHistory;
    const threadContext = relationshipAnalysis.thread;
    const domainAnalysis = relationshipAnalysis.domain;
    
    // Simple rule-based fallback
    let labelId = CONFIG.LABELS.FYI;
    let reasoning = 'Fallback classification';
    
    // Check for travel/ticket keywords
    if (this.appearsTicket(email)) {
      labelId = CONFIG.LABELS.TICKETS;
      reasoning = 'Appears to be travel/ticket related';
    }
    // Check for receipt/purchase keywords
    else if (this.appearsReceipt(email)) {
      labelId = CONFIG.LABELS.RECEIPTS;
      reasoning = 'Appears to be purchase/receipt related';
    }
    // Check for meeting-related keywords
    else if (this.containsMeetingKeywords(email.subject)) {
      labelId = CONFIG.LABELS.MEETING_UPDATE;
      reasoning = 'Subject contains meeting-related keywords';
    }
    // Check for comment keywords
    else if (this.containsCommentKeywords(email.subject)) {
      labelId = CONFIG.LABELS.COMMENT;
      reasoning = 'Subject indicates comment/feedback';
    }
    // No history + promotional content = Marketing
    else if (!hasHistory && this.appearsPromotional(email)) {
      labelId = CONFIG.LABELS.MARKETING;
      reasoning = 'No history and appears promotional';
    }
    // Notification patterns
    else if (this.appearsNotification(email, domainAnalysis)) {
      labelId = CONFIG.LABELS.NOTIFICATION;
      reasoning = 'Appears to be service notification';
    }
    // Reply or direct question = To Respond
    else if (threadContext.isReply || this.containsQuestionMarks(email.text)) {
      labelId = CONFIG.LABELS.TO_RESPOND;
      reasoning = 'Part of conversation thread or contains questions';
    }
    
    return {
      labelId,
      labelName: this.getLabelName(labelId),
      confidence: 'LOW',
      reasoning: `Fallback: ${reasoning}`
    };
  }

  /**
   * Check if subject contains meeting-related keywords
   * @param {string} subject - Email subject
   * @returns {boolean} True if contains meeting keywords
   */
  containsMeetingKeywords(subject) {
    const keywords = ['accepted:', 'declined:', 'invitation', 'meeting', 'calendar', 'cancelled:', 'updated invitation'];
    return keywords.some(keyword => subject.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Check if subject contains comment-related keywords
   * @param {string} subject - Email subject
   * @returns {boolean} True if contains comment keywords
   */
  containsCommentKeywords(subject) {
    const keywords = ['new comment', 'comment on', 'feedback on', 'review requested'];
    return keywords.some(keyword => subject.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Check if email appears promotional
   * @param {Object} email - Email data
   * @returns {boolean} True if appears promotional
   */
  appearsPromotional(email) {
    const promotionalKeywords = ['sale', 'discount', 'offer', 'deal', 'promotion', 'marketing', 'advertisement'];
    const text = (email.subject + ' ' + email.text).toLowerCase();
    
    return promotionalKeywords.some(keyword => text.includes(keyword)) ||
           email.labelIds.includes('CATEGORY_PROMOTIONS') ||
           !!email.headers['list-unsubscribe'];
  }

  /**
   * Check if email appears to be a notification
   * @param {Object} email - Email data
   * @param {Object} domainAnalysis - Domain analysis
   * @returns {boolean} True if appears to be notification
   */
  appearsNotification(email, domainAnalysis) {
    const notificationKeywords = ['important update', 'service notification', 'policy change', 'dpa update', 'security alert'];
    const text = (email.subject + ' ' + email.text).toLowerCase();
    
    return notificationKeywords.some(keyword => text.includes(keyword)) ||
           email.labelIds.includes('CATEGORY_UPDATES') ||
           domainAnalysis.isNoReply ||
           !!email.headers['auto-submitted'];
  }

  /**
   * Check if email text contains question marks (potential questions)
   * @param {string} text - Email text
   * @returns {boolean} True if contains questions
   */
  containsQuestionMarks(text) {
    return (text.match(/\?/g) || []).length >= 2; // At least 2 question marks
  }

  /**
   * Check if email appears to be ticket/travel related
   * @param {Object} email - Email data
   * @returns {boolean} True if appears to be ticket/travel related
   */
  appearsTicket(email) {
    const ticketKeywords = [
      'booking confirmation', 'flight', 'boarding pass', 'check-in', 'travel itinerary',
      'train', 'bus', 'ferry', 'airline', 'departure', 'arrival', 'ticket',
      'reservation', 'booking', 'travel', 'journey', 'trip'
    ];
    const text = (email.subject + ' ' + email.text).toLowerCase();
    
    return ticketKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if email appears to be receipt/purchase related
   * @param {Object} email - Email data
   * @returns {boolean} True if appears to be receipt/purchase related
   */
  appearsReceipt(email) {
    const receiptKeywords = [
      'order confirmation', 'receipt', 'invoice', 'payment', 'purchase',
      'shipped', 'delivered', 'order', 'transaction', 'billing',
      'your order', 'payment confirmation', 'thank you for your order',
      'delivery confirmation', 'shipping notification'
    ];
    const text = (email.subject + ' ' + email.text).toLowerCase();
    
    return receiptKeywords.some(keyword => text.includes(keyword));
  }
}