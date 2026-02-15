# Trende: Multi-Platform Trend Intelligence Platform

Trende is an AI-powered trend research and analysis platform that autonomously searches, validates, and synthesizes market insights from across the social web.

It now supports dual Forge outputs:
- **Meme Thesis Page** for narrative-driven token and community positioning.
- **Verifiable News Synthesizer** for multi-model, bias-reduced, attestation-ready news aggregation.

## 🚀 Architecture

- **Frontend**: Next.js 16 (App Router) with a premium dark-mode dashboard.
- **Forge UI**: `/meme/[queryId]` includes both Meme Thesis and Verifiable News views.
- **Backend**: FastAPI with a LangGraph-powered AI Agent workforce.
- **AI Brain**: Multi-provider failover system (Venice AI → AIsa → OpenRouter → Gemini).
- **Data Layer**: Autonomous connectors for Twitter, NewsAPI, LinkedIn (via AIsa), and Tabstack (Deep Extraction).
- **Security**: Private-first inference via Venice AI.

## 🛠️ Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- [Optional] Docker

### Backend Setup
1. Navigate to the root directory.
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Configure your `.env` file (see `.env.example`).

### Frontend Setup
1. Navigate to `frontend/`:
   ```bash
   cd frontend
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```

## 🧪 Testing the Agent

You can run a live research task directly from the CLI to verify the AI backbone:
```bash
python3 scripts/test_agent.py "Your Research Topic"
```

## 🛡️ Core Principles
- **Enhancement First**: Prioritize improving existing components.
- **Aggressive Consolidation**: Delete unnecessary code; no bloat.
- **Privacy First**: Primary inference routed via Venice AI.
- **Fact-Checked**: Every report undergoes a dedicated validation node.

---
*Built for the AI Partner Catalyst Hackathon.*
