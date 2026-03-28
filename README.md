# 🗽 NYC Equity Navigator

> **Hackathon submission** — An AI-powered, multi-agent tool for city planners and policy advocates to explore neighborhood financial health disparities across New York City.

---

## The Problem

NYC's racial wealth gap is visible in the streets — but the data is buried in spreadsheets. City planners need a tool that translates raw financial health metrics into a living, immersive profile of each neighborhood: real data, real images, real analysis, all at once.

## The Solution

Click a neighborhood. In seconds, three AI agents work in parallel to generate:

1. **Charts** — NFH Index vs. city average, bank branch rates, predatory lender density
2. **Street Imagery** — AI-generated scenes that physically represent the neighborhood's financial infrastructure
3. **Policy Narrative** — A streaming, policy-grade analysis of the racial wealth gap in that specific zip code

Everything streams live via SSE — the profile builds in front of you, not after a spinner.

---

## Architecture

```
User clicks neighborhood
        │
        ▼
┌─────────────────────────────────┐
│      Orchestrator Agent         │  FastAPI + Google GenAI SDK
│  • Fetches NYC Open Data (live) │  ← Grounding (no hallucinations)
│  • Routes to 3 sub-agents       │
└────────┬──────────┬─────────────┘
         │          │          │
    ┌────▼───┐  ┌───▼────┐  ┌──▼──────┐
    │  Data  │  │Narrative│  │ Imagery │
    │Analyst │  │ Agent   │  │  Agent  │
    │Agent   │  │         │  │         │
    │Gemini  │  │Gemini   │  │ Imagen  │
    │→ JSON  │  │→ Stream │  │→ base64 │
    └────┬───┘  └───┬────┘  └──┬──────┘
         │          │          │
         └──────────┴──────────┘
                    │
            ┌───────▼──────┐
            │  SSE Merger  │  Interleaves all outputs
            └───────┬──────┘  in real time
                    │
            ┌───────▼──────┐
            │ React Frontend│  Streaming panel builds live
            │ (Map + Panel) │
            └──────────────┘
```

**Cloud Infrastructure:**
- Backend: **Google Cloud Run** (auto-scaling, serverless)
- AI: **Gemini 2.0 Flash** (text) + **Imagen 3** (images)
- Data: **NYC Open Data API** (live grounding)
- Frontend: **Firebase Hosting** (or any static host)

---

## Hackathon Scoring

| Criterion | Implementation |
|-----------|----------------|
| Google Cloud Native | Gemini 2.0 Flash + Imagen 3 via GenAI SDK; deployed on Cloud Run |
| System Design | Orchestrator + 3 sub-agents; error handling + timeouts on every agent |
| Robustness / No Hallucinations | All data from live NYC Open Data API; Gemini only interprets, never invents |
| Beyond Text | Charts + AI street imagery + streaming narrative in one panel |
| Fluidity | SSE streaming: narrative types out live, images pop in when ready |
| The Story | Brownsville vs. Upper East Side — visceral data contrast |
| Cloud Proof | Cloud Run URL live; `/health` endpoint for verification |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node 18+
- Google Cloud account with billing enabled
- Gemini API key (get at [aistudio.google.com](https://aistudio.google.com))

### Local Development

```bash
# Clone and enter project
git clone <your-repo>
cd nyc-equity-navigator

# Set your Gemini API key
export GEMINI_API_KEY=your_key_here

# Start everything
chmod +x dev.sh
./dev.sh

# Open http://localhost:5173
```

### Deploy to Google Cloud Run

```bash
# Set required env vars
export GOOGLE_CLOUD_PROJECT=your-project-id
export GEMINI_API_KEY=your_key_here

# Deploy
chmod +x deploy.sh
./deploy.sh
```

---

## Dataset

**NYC Neighborhood Financial Health (NFH) Digital Mapping**
- Source: [NYC Open Data](https://data.cityofnewyork.us/Business/Neighborhood-Financial-Health-Digital-Mapping-and-/r3dx-pew9/about_data)
- Updated: Live API
- Key fields: `nfh_index`, `bank_branch_rate`, `check_casher_rate`, `pawn_shop_rate`, `median_household_income`

---

## Agent Details

### Orchestrator Agent (`main.py: orchestrate_stream`)
Coordinates all sub-agents. Fetches live data from NYC Open Data first (grounding), then fans out to all three agents. Merges outputs into a single SSE stream.

### Data Analyst Agent (`main.py: data_analyst_agent`)
Calls `gemini-2.0-flash-exp` with a structured output prompt. Returns chart-ready JSON with neighborhood vs. city comparisons. Unblocks the narrative and imagery agents.

### Narrative Agent (`main.py: narrative_agent_stream`)
Streams a 300-400 word policy analysis token-by-token. Covers: financial health overview, banking desert analysis, racial wealth gap, and actionable policy recommendations.

### Imagery Agent (`main.py: imagery_agent`)
Calls `imagen-3.0-generate-001` with a data-informed scene description (underinvested vs. affluent aesthetics based on NFH percentile). Gracefully falls back to a descriptive prompt if Imagen is unavailable.

---

## Project Structure

```
nyc-equity-navigator/
├── backend/
│   ├── main.py           # FastAPI app + all 4 agents
│   ├── requirements.txt
│   └── Dockerfile        # Cloud Run container
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Root + SSE stream management
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── MapPanel.jsx      # Interactive NYC map
│   │   │   ├── ProfilePanel.jsx  # Streaming output panel
│   │   │   └── NFHChart.jsx      # Chart.js bar charts
│   │   └── index.css     # Design system
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── dev.sh                # Local dev startup
├── deploy.sh             # One-shot Cloud Run deploy
└── README.md
```

---

## Demo Script (for video)

1. Open the app, show the NYC map with neighborhood dots
2. Search "Brownsville" → watch the profile build live:
   - Status bar: "Fetching live NYC data…" → "Running agents…"
   - Charts appear → Narrative starts streaming → Image pops in
3. Switch to "Upper East Side" — show the stark contrast in NFH Index and percentile
4. Show the backend logs / Cloud Run URL as proof of deployment
5. Show `/health` endpoint: `{"status": "ok", "gemini_configured": true}`
