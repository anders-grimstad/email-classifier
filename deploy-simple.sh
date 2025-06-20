#!/bin/bash

# Email Classifier - Simple Google Cloud Run Deployment (No Docker)

set -e

echo "🚀 Deploying Email Classifier to Google Cloud Run (Source-based)"

# Configuration
PROJECT_ID=${GCLOUD_PROJECT_ID:-"email-classifier-463413"}
SERVICE_NAME="email-classifier"
REGION=${GCLOUD_REGION:-"us-central1"}

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
  --set-env-vars POLL_INTERVAL=300000,MAX_RESULTS=50 \
  --port 8080

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Set environment variables in Cloud Run console:"
echo "   https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/variables"
echo ""
echo "   Required variables:"
echo "   - OPENAI_API_KEY=your_openai_key"
echo "   - GMAIL_CLIENT_ID=your_client_id" 
echo "   - GMAIL_CLIENT_SECRET=your_client_secret"
echo "   - GMAIL_REFRESH_TOKEN=your_refresh_token"
echo "   - GMAIL_ACCESS_TOKEN=your_access_token"
echo ""
echo "2. Check logs:"
echo "   gcloud run logs tail $SERVICE_NAME --region $REGION"
echo ""
echo "3. Service URL:"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")
echo "   $SERVICE_URL"
echo ""
echo "4. Test health check:"
echo "   curl $SERVICE_URL/health"