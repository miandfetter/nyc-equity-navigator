#!/bin/bash
# ============================================================
# NYC Equity Navigator — Local Development
# Usage: ./dev.sh
# Requires: Python 3.11+, Node 18+, GEMINI_API_KEY env var
# ============================================================

set -e

echo "🗽 Starting NYC Equity Navigator locally"
echo ""

# Check for API key
if [ -z "$GEMINI_API_KEY" ]; then
  echo "⚠️  GEMINI_API_KEY not set."
  echo "   Run: export GEMINI_API_KEY=your_key_here"
  exit 1
fi

# Backend
echo "▸ Starting backend (FastAPI on :8080)..."
cd backend
pip install -r requirements.txt -q
uvicorn main:app --host 0.0.0.0 --port 8080 --reload &
BACKEND_PID=$!
cd ..

# Frontend
echo "▸ Starting frontend (Vite on :5173)..."
cd frontend
npm install --silent
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8080"
echo "   API docs: http://localhost:8080/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
