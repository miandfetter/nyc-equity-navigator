#!/bin/bash
# ============================================================
# NYC Equity Navigator — One-shot Google Cloud Run Deploy
# Run: chmod +x deploy.sh && ./deploy.sh
# ============================================================

set -e

# ── Config — edit these ───────────────────────────────────────
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-project-id}"
REGION="us-central1"
SERVICE_NAME="nyc-equity-navigator"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"
# ─────────────────────────────────────────────────────────────

echo "🗽 NYC Equity Navigator — Deploying to Cloud Run"
echo "Project: $PROJECT_ID | Region: $REGION"
echo ""

# 1. Authenticate (if needed)
gcloud config set project "$PROJECT_ID"

# 2. Enable required APIs
echo "▸ Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  --quiet

# 3. Build and push Docker image
echo "▸ Building backend image..."
cd backend
gcloud builds submit --tag "$IMAGE" .
cd ..

# 4. Deploy to Cloud Run
echo "▸ Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY" \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --timeout 120 \
  --quiet

# 5. Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --format "value(status.url)")

echo ""
echo "✅ Backend deployed: $SERVICE_URL"
echo ""

# 6. Build frontend with backend URL
echo "▸ Building frontend..."
cd frontend
echo "VITE_API_URL=$SERVICE_URL" > .env.production
npm install --silent
npm run build

# 7. Deploy frontend to Firebase Hosting (or serve from Cloud Run)
if command -v firebase &> /dev/null; then
  echo "▸ Deploying frontend to Firebase Hosting..."
  firebase deploy --only hosting --project "$PROJECT_ID"
else
  echo "▸ Firebase CLI not found. Frontend built at frontend/dist/"
  echo "  Options:"
  echo "  1. npm install -g firebase-tools && firebase init hosting && firebase deploy"
  echo "  2. Copy frontend/dist/ to Cloud Storage and serve via CDN"
  echo "  3. Run locally: npm run preview"
fi

echo ""
echo "🎉 Deploy complete!"
echo "   Backend API: $SERVICE_URL"
echo "   Health check: $SERVICE_URL/health"
