#!/bin/bash

# Email Classifier - Simple Google Cloud Run Deployment (No Docker)

set -e

echo "🚀 Deploying Email Classifier to Google Cloud Run (Source-based)"

# Configuration
PROJECT_ID=${GCLOUD_PROJECT_ID:-"email-classifier-463413"}
SERVICE_NAME="email-classifier"
REGION=${GCLOUD_REGION:-"us-central1"}

# Load environment variables from .env file
if [ -f .env ]; then
  echo "📄 Loading environment variables from .env file..."
  source .env
else
  echo "❌ .env file not found! Please create one with your API keys."
  exit 1
fi

# Check required environment variables
REQUIRED_VARS="OPENAI_API_KEY GMAIL_CLIENT_ID GMAIL_CLIENT_SECRET GMAIL_REFRESH_TOKEN GMAIL_ACCESS_TOKEN"
for var in $REQUIRED_VARS; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required environment variable: $var"
    exit 1
  fi
done

echo "✅ All required environment variables found"

echo "📋 Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Service Name: $SERVICE_NAME" 
echo "  Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Please login to gcloud first: gcloud auth login"
    exit 1
fi

# Set project
echo "🔧 Setting project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔌 Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Deploy directly from source (no Docker needed!)
echo "☁️  Deploying from source to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 1 \
  --concurrency 1 \
  --cpu-throttling \
  --execution-environment gen2 \
  --set-env-vars OPENAI_API_KEY="$OPENAI_API_KEY",GMAIL_CLIENT_ID="$GMAIL_CLIENT_ID",GMAIL_CLIENT_SECRET="$GMAIL_CLIENT_SECRET",GMAIL_REFRESH_TOKEN="$GMAIL_REFRESH_TOKEN",GMAIL_ACCESS_TOKEN="$GMAIL_ACCESS_TOKEN" \
  --port 8080

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. ✅ Environment variables automatically set from .env file"
echo ""
echo "2. Check logs to verify Gmail push notifications:"
echo "   gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\" --limit=20 --project=$PROJECT_ID"
echo ""
echo "3. Service URL:"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")
echo "   $SERVICE_URL"
echo ""
echo "4. Test health check:"
echo "   curl $SERVICE_URL/health"
echo ""
echo "5. Gmail push notifications will be automatically set up!"
echo "   Watch the logs for: '🎯 Gmail push notifications active'"