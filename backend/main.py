"""
NYC Equity Navigator — Backend
FastAPI + Google GenAI SDK
Orchestrator + 3 sub-agents streaming via SSE
"""

import os
import json
import asyncio
import httpx
from typing import AsyncGenerator
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

# ── Config ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
NYC_DATA_URL = "https://data.cityofnewyork.us/resource/r3dx-pew9.json"


genai.configure(api_key=GEMINI_API_KEY)

SAFETY = {
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
}

app = FastAPI(title="NYC Equity Navigator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── NYC Open Data ─────────────────────────────────────────────────────────────

async def fetch_neighborhood_data(neighborhood: str) -> list[dict]:
    """Fetch NFH data for a given neighborhood from NYC Open Data (grounding)."""
    url = f"{NYC_DATA_URL}?$q={neighborhood.replace(' ', '+')}&$limit=50"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.json()


async def fetch_comparison_data() -> list[dict]:
    """Fetch city-wide sample for comparison baselines."""
    url = f"{NYC_DATA_URL}?$limit=500"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.json()


def compute_city_averages(rows: list[dict]) -> dict:
    def avg(key):
        vals = []
        for r in rows:
            try:
                vals.append(float(r[key]))
            except (ValueError, TypeError, KeyError):
                pass
        return round(sum(vals) / len(vals), 2) if vals else 0
    return {
        "avg_nfh_index": avg("indexscore"),
        "avg_median_income": avg("median_income"),
        "avg_poverty_rate": avg("nyc_poverty_rate"),
        "avg_perc_black": avg("perc_black"),
        "avg_perc_hispanic": avg("perc_hispanic"),
        "total_rows": len(rows),
    }


# ── Agent 1: Data Analyst ─────────────────────────────────────────────────────

async def data_analyst_agent(neighborhood_rows: list[dict], city_avgs: dict) -> dict:
    """
    Calls Gemini with structured output prompt.
    Returns chart-ready JSON: bar chart, percentile, key metrics.
    """
    model = genai.GenerativeModel("gemini-2.5-flash")

    sample = neighborhood_rows[:10]
    prompt = f"""
You are a data analyst. Given the following NYC Neighborhood Financial Health data rows
and city-wide averages, return ONLY valid JSON — no markdown, no explanation.

NFH DATA ROWS (sample):
{json.dumps(sample, indent=2)}

CITY-WIDE AVERAGES:
{json.dumps(city_avgs, indent=2)}

The data fields are: indexscore (NFH index), median_income, nyc_poverty_rate,
ind1outcome (homeownership rate), ind2outcome (neighborhood tenure rate),
perc_black, perc_hispanic, perc_white, neighborhoods (neighborhood name).

Return JSON in exactly this shape:
{{
  "neighborhood_name": "<name from neighborhoods field>",
  "nfh_index": <float from indexscore>,
  "city_avg_nfh": <float from city averages avg_nfh_index>,
  "percentile": <int 0-100, estimated based on scorerank field>,
  "metrics": [
    {{"label": "NFH Index", "neighborhood": <float>, "city_avg": <float>}},
    {{"label": "Median Income ($k)", "neighborhood": <float divided by 1000>, "city_avg": <float divided by 1000>}},
    {{"label": "Poverty Rate (%)", "neighborhood": <float * 100>, "city_avg": <float * 100>}},
    {{"label": "Homeownership (%)", "neighborhood": <float * 100>, "city_avg": <float * 100>}},
    {{"label": "Long-term Residents (%)", "neighborhood": <float * 100>, "city_avg": <float * 100>}}
  ],
  "summary_stats": {{
    "total_locations_analyzed": <int>,
    "data_year": "<year_published field>",
    "borough": "<borough field>"
  }}
}}
"""
    response = await asyncio.to_thread(
        model.generate_content, prompt, safety_settings=SAFETY
    )
    text = response.text.strip().lstrip("```json").lstrip("```").rstrip("```")
    print("DATA AGENT RAW RESPONSE:", text)  # debug
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print("JSON PARSE ERROR:", e)
        # Return safe fallback so stream doesn't crash
        return {
            "neighborhood_name": neighborhood,
            "nfh_index": 0,
            "city_avg_nfh": 0,
            "percentile": 50,
            "metrics": [],
            "summary_stats": {"total_locations_analyzed": 0, "data_year": "Latest", "borough": ""}
        }


# ── Agent 2: Narrative Writer ─────────────────────────────────────────────────

async def narrative_agent_stream(
    neighborhood: str,
    chart_data: dict,
    neighborhood_rows: list[dict],
) -> AsyncGenerator[str, None]:
    """
    Streams a policy-grade narrative analysis token by token.
    Yields SSE chunks of type 'narrative'.
    """
    model = genai.GenerativeModel("gemini-2.5-flash")

    sample = neighborhood_rows[:5]
    prompt = f"""
You are a senior urban policy analyst writing for NYC city planners and equity advocates.

NEIGHBORHOOD: {neighborhood}
NFH INDEX: {chart_data.get("nfh_index")} (City avg: {chart_data.get("city_avg_nfh")})
PERCENTILE: {chart_data.get("percentile")}th percentile
RAW DATA SAMPLE: {json.dumps(sample, indent=2)}

Write a 4-paragraph narrative analysis (300-400 words total):

1. **Financial Health Overview** — What the NFH Index score means for this neighborhood vs the city.
2. **Banking Desert Analysis** — What the bank branch vs check casher/pawn shop rates reveal about predatory financial infrastructure.
3. **Racial Wealth Gap** — How this data reflects systemic disinvestment and the racial wealth gap in NYC.
4. **Policy Recommendations** — 2-3 concrete, actionable recommendations for city planners.

Use specific numbers from the data. Be direct and policy-relevant. Do not use bullet points — flowing paragraphs only.
"""
    response = await asyncio.to_thread(
        model.generate_content,
        prompt,
        safety_settings=SAFETY,
        stream=True,
    )

    for chunk in response:
        if chunk.text:
            yield chunk.text


# ── Agent 3: Imagery Agent ────────────────────────────────────────────────────

async def imagery_agent(neighborhood: str, chart_data: dict) -> list[str]:
    """
    Generates street-scene images via Gemini Imagen.
    Returns list of base64-encoded image strings.
    Falls back to descriptive prompt if Imagen unavailable.
    """
    nfh = chart_data.get("nfh_index", 50)
    borough = chart_data.get("summary_stats", {}).get("borough", "New York City")
    percentile = chart_data.get("percentile", 50)

    if percentile < 30:
        scene_desc = "underinvested urban neighborhood, aging storefronts, check cashing store, empty lots, cracked sidewalks, overcast sky"
    elif percentile < 60:
        scene_desc = "mixed-income urban neighborhood, small businesses, some renovation, moderate foot traffic, partly cloudy"
    else:
        scene_desc = "affluent urban neighborhood, luxury storefronts, well-maintained buildings, green trees, bright sunny day"

    prompt = (
        f"Photorealistic street-level view of {neighborhood}, {borough}, New York City. "
        f"{scene_desc}. Documentary photography style, eye level, wide angle."
    )

    try:
        imagen = genai.ImageGenerationModel("imagen-3.0-generate-001")
        result = await asyncio.to_thread(
            imagen.generate_images,
            prompt=prompt,
            number_of_images=1,
            safety_filter_level="block_only_high",
            person_generation="allow_adult",
        )
        images = []
        for img in result.images:
            import base64
            b64 = base64.b64encode(img._image_bytes).decode()
            images.append(f"data:image/png;base64,{b64}")
        return images
    except Exception as e:
        # Graceful fallback: return the prompt so frontend can display it
        return [f"PROMPT:{prompt}"]


# ── Orchestrator ──────────────────────────────────────────────────────────────

async def orchestrate_stream(neighborhood: str) -> AsyncGenerator[str, None]:
    """
    Master SSE stream. Emits typed events:
      data: {"type": "status", "message": "..."}
      data: {"type": "chart", "payload": {...}}
      data: {"type": "narrative_chunk", "text": "..."}
      data: {"type": "image", "src": "..."}
      data: {"type": "done"}
      data: {"type": "error", "message": "..."}
    """

    def sse(obj: dict) -> str:
        return f"data: {json.dumps(obj)}\n\n"

    try:
        # 1. Fetch grounded data from NYC Open Data
        yield sse({"type": "status", "message": f"Fetching live NYC data for {neighborhood}…"})
        try:
            neighborhood_rows, city_rows = await asyncio.gather(
                fetch_neighborhood_data(neighborhood),
                fetch_comparison_data(),
            )
            if city_rows:
                print("SAMPLE ROW KEYS:", list(city_rows[0].keys()))
            if neighborhood_rows:
                print("NEIGHBORHOOD ROW KEYS:", list(neighborhood_rows[0].keys()))
                print("NEIGHBORHOOD ROW:", neighborhood_rows[0])
        except Exception as e:
            yield sse({"type": "error", "message": f"NYC Open Data fetch failed: {str(e)}"})
            return

        if not neighborhood_rows:
            yield sse({"type": "error", "message": f"No data found for '{neighborhood}'. Try a different neighborhood name."})
            return

        city_avgs = compute_city_averages(city_rows)
        yield sse({"type": "status", "message": f"Found {len(neighborhood_rows)} data points. Running agents…"})

        # 2. Data Analyst Agent (structured JSON, runs first to unblock others)
        yield sse({"type": "status", "message": "Data analyst agent: computing metrics…"})
        try:
            chart_data = await data_analyst_agent(neighborhood_rows, city_avgs)
            yield sse({"type": "chart", "payload": chart_data})
        except Exception as e:
            yield sse({"type": "error", "message": f"Data agent error: {str(e)}"})
            chart_data = {"nfh_index": 0, "city_avg_nfh": 0, "percentile": 50, "metrics": [], "summary_stats": {}}

        # 3. Imagery Agent (fire-and-forget, will emit when ready)
        yield sse({"type": "status", "message": "Imagery agent: generating street scenes…"})
        imagery_task = asyncio.create_task(imagery_agent(neighborhood, chart_data))

        # 4. Narrative Agent (streaming)
        yield sse({"type": "status", "message": "Narrative agent: writing policy analysis…"})
        async for chunk in narrative_agent_stream(neighborhood, chart_data, neighborhood_rows):
            yield sse({"type": "narrative_chunk", "text": chunk})

        # 5. Emit images when ready
        try:
            images = await asyncio.wait_for(imagery_task, timeout=30)
            for src in images:
                yield sse({"type": "image", "src": src})
        except asyncio.TimeoutError:
            yield sse({"type": "status", "message": "Image generation timed out — skipping."})
        except Exception as e:
            yield sse({"type": "status", "message": f"Image generation unavailable: {str(e)}"})

        yield sse({"type": "done"})

    except Exception as e:
        yield sse({"type": "error", "message": f"Orchestrator error: {str(e)}"})


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/analyze")
async def analyze(neighborhood: str = Query(..., description="Neighborhood name, e.g. Brownsville")):
    """Main SSE endpoint — streams the full mixed-media neighborhood profile."""
    return StreamingResponse(
        orchestrate_stream(neighborhood),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/neighborhoods")
async def list_neighborhoods():
    """Returns list of distinct neighborhoods in the dataset for the map/search."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            "https://data.cityofnewyork.us/resource/r3dx-pew9.json"
            "?$limit=300"
        )
        r.raise_for_status()
        data = r.json()
        # Deduplicate by neighborhood name
        seen = set()
        unique = []
        for row in data:
            name = row.get("neighborhood")
            if name and name not in seen:
                seen.add(name)
                unique.append({
                    "neighborhood": name,
                    "borough": row.get("borough", ""),
                    "latitude": row.get("latitude", ""),
                    "longitude": row.get("longitude", ""),
                })
        return unique


@app.get("/health")
async def health():
    return {"status": "ok", "gemini_configured": bool(GEMINI_API_KEY)}
