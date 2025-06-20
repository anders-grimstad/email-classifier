# Email Classifier

An AI-powered email classification system that automatically categorizes Gmail emails using OpenAI's GPT-4. This project converts an n8n workflow into standalone JavaScript functions that can run locally or on Google Cloud Run.

## Features

- **AI-Powered Classification**: Uses GPT-4 for intelligent email categorization
- **Email History Analysis**: Checks prior communication to distinguish cold emails from known contacts
- **Gmail Integration**: Full Gmail API integration for reading emails and applying labels
- **Multiple Deployment Options**: Runs locally, as a service, or on Google Cloud Run
- **Comprehensive Testing**: Built-in test suite with sample data
- **Configurable Labels**: Supports custom Gmail labels for different email categories

## Email Categories

The system classifies emails into these categories:

- **To Respond**: Emails requiring direct action or reply
- **FYI**: Informational emails for awareness only
- **Comment**: Comments or feedback on documents/tasks
- **Notification**: Service updates, policy changes, system alerts
- **Meeting Update**: Calendar-related communications
- **Marketing**: Promotional content and sales pitches

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd email-classifier
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your actual API keys and credentials
```

## Configuration

### Required Environment Variables

Create a `.env` file with the following variables:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Gmail API OAuth2 Credentials
GMAIL_CLIENT_ID=your_gmail_client_id_here
GMAIL_CLIENT_SECRET=your_gmail_client_secret_here
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token_here
GMAIL_ACCESS_TOKEN=your_gmail_access_token_here
```

### Getting Gmail API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Gmail API
4. Create OAuth2 credentials (Web application)
5. Set up OAuth consent screen
6. Generate refresh token using OAuth2 flow

### Getting OpenAI API Key

1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Add it to your `.env` file

## Usage

### Command Line Interface

```bash
# Test with sample data
npm test

# Validate setup and connections
npm run validate

# Classify a specific email
node index.js classify <message-id>

# Start continuous monitoring
npm run monitor

# Run full test suite
npm run full-test
```

### Programmatic Usage

```javascript
import { EmailClassifier } from './index.js';

const classifier = new EmailClassifier();

// Classify a single email
const result = await classifier.classifyEmail('message-id');

// Classify multiple emails
const results = await classifier.classifyEmails(['id1', 'id2', 'id3']);

// Start monitoring for new emails
await classifier.startMonitoring({
  pollInterval: 60000, // 1 minute
  maxResults: 10
});
```

### Test with Sample Data

The system includes sample emails from the original n8n workflow:

```javascript
import { runQuickTest } from './src/test-runner.js';

const results = await runQuickTest();
console.log(results);
```

## Google Cloud Run Deployment

The system is designed to run as a continuous service on Google Cloud Run:

### 1. Quick Deployment

```bash
# Make the deployment script executable
chmod +x deploy-simple.sh

# Deploy to Google Cloud Run
./deploy-simple.sh
```

### 2. Manual Deployment

```bash
# Deploy directly from source
gcloud run deploy email-classifier \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 3600 \
  --max-instances 1
```

### 3. Configure Environment Variables

Set the required environment variables in the Cloud Run console:

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Select your `email-classifier` service
3. Click "Edit & Deploy New Revision"
4. Go to "Variables & Secrets" tab
5. Add the following environment variables:

```
OPENAI_API_KEY=your_openai_api_key
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token
GMAIL_ACCESS_TOKEN=your_gmail_access_token
```

### 4. Service Endpoints

Once deployed, your service will have these endpoints:

- `GET /health` - Health check and environment variable status
- `GET /` - Same as health check

The service automatically monitors Gmail every 5 minutes when environment variables are configured.

#### Example Health Check

```bash
# Check service health
curl https://your-service-url.run.app/health

# Expected response:
{
  "status": "healthy",
  "service": "email-classifier",
  "timestamp": "2025-06-19T21:17:10.577Z"
}
```

### 5. Monitoring

View logs in real-time:

```bash
# View recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=email-classifier" --limit=50

# Or check the Cloud Run console for logs
```

## Architecture

The system consists of several modular components:

- **`EmailClassifier`**: Main orchestrator class
- **`GmailClient`**: Gmail API wrapper for email operations
- **`EmailHistoryChecker`**: Analyzes email relationships and context
- **`OpenAIClassifier`**: OpenAI integration for classification
- **`TestRunner`**: Testing utilities and sample data

## How It Works

1. **Email Retrieval**: Fetches email details from Gmail API
2. **History Analysis**: Checks for prior communication with sender
3. **Context Analysis**: Examines headers, thread context, domain patterns
4. **AI Classification**: Uses OpenAI GPT-4 with comprehensive prompt
5. **Label Application**: Applies appropriate Gmail label to email

## Classification Logic

The system uses sophisticated logic combining:

- **Email History**: Cold vs. warm email detection
- **Thread Context**: Reply chains, auto-submitted emails
- **Content Analysis**: Subject line, body content, headers
- **Domain Analysis**: Sender patterns, no-reply addresses
- **Gmail Categories**: Existing Gmail auto-categorization

## Testing

Run the test suite to verify functionality:

```bash
# Quick test with sample data
npm test

# Comprehensive test suite
npm run full-test

# Validate setup only
npm run validate
```

The test suite includes:
- Setup validation
- API connection tests
- Sample email classification
- Error handling verification

## Error Handling

The system includes robust error handling:

- **Fallback Classification**: Rule-based classification when AI fails
- **Rate Limiting**: Built-in delays to respect API limits
- **Retry Logic**: Automatic retries for transient failures
- **Graceful Degradation**: Continues operation despite partial failures

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Troubleshooting

### Common Issues

1. **Gmail API Errors**: Verify OAuth2 credentials and scopes
2. **OpenAI API Errors**: Check API key and rate limits
3. **Classification Errors**: Review prompt and response parsing
4. **Token Expiry**: Refresh tokens may need renewal

### Debug Mode

Enable verbose logging:

```javascript
process.env.DEBUG = 'email-classifier';
```

### Rate Limits

- Gmail API: 250 quota units per user per 100 seconds
- OpenAI API: Varies by plan
- Built-in delays help manage rate limits automatically

## Roadmap

- [ ] Support for additional email providers
- [ ] Machine learning model training on classification results
- [ ] Real-time webhook processing
- [ ] Advanced analytics and reporting
- [ ] Custom classification rules engine