/**
 * Configuration for the email classifier
 */

export const CONFIG = {
  // Gmail Label IDs for classification
  LABELS: {
    TO_RESPOND: 'Label_19',        // "to respond"
    FYI: 'Label_18',               // "FYI"
    COMMENT: 'Label_20',           // "comment"
    NOTIFICATION: 'Label_17',      // "notification"
    MEETING_UPDATE: 'INBOX',       // Using INBOX for meeting updates
    MARKETING: 'Label_15',         // "promotion"
    TICKETS: 'Label_10',           // "Tickets" - flights, buses, trains
    RECEIPTS: 'Label_2'            // "Bills & Receipts" - purchases, order confirmations
  },
  
  // Your email address for context
  MY_EMAIL: 'grimstad.anders@gmail.com',
  
  // OpenAI model configuration
  OPENAI: {
    MODEL: 'gpt-4o',
    MAX_TOKENS: 10000
  },
  
  // Gmail API settings
  GMAIL: {
    POLL_INTERVAL: 300000, // 5 minutes in milliseconds
    MAX_RESULTS: 200
  }
};

// Environment variables (to be set in .env or process.env)
export const ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
  GMAIL_ACCESS_TOKEN: process.env.GMAIL_ACCESS_TOKEN
};