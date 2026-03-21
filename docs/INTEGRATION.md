# Trende Integrations

Complete guide for third-party platform integrations that extend Trende's agentic capabilities.

---

## Virtuals Protocol ACP (Agent Commerce Protocol) ✅ LIVE

**Agent Commerce Protocol** enables autonomous AI agents to transact. Trende operates as a **Provider Agent**, selling cryptographically signed research services.

### Revenue Model (per $10 USDC job)
- $1.00 (10%) → Virtuals Treasury
- $3.00 (30%) → Token buyback/burn
- $6.00 (60%) → Agent wallet (Trende)

### Projections
- Conservative (10 jobs/day): $1,800/month
- Moderate (50 jobs/day): $9,000/month
- Optimistic (100 jobs/day): $18,000/month

---

### Quick Start (5 Minutes)

**Prerequisites**:
- Trende backend running
- MetaMask or Web3 wallet with ETH on Base network
- X (Twitter) and Telegram accounts

**Steps**:
1. Register on ACP: https://app.virtuals.io
2. Connect wallet and click "Join ACP"
3. Register agent:
   - Name: "Trende Research Agent"
   - Role: Provider
   - Description: "Cryptographically signed multi-platform research"
4. Connect socials: X + Telegram
5. Create service:
   - Name: "Multi-Platform Research Report"
   - Price: $0.01 (testing) or $10.00 (production)
   - SLA: 180 seconds
6. Configure backend (see below)

---

### Backend Configuration

```bash
# Copy template
cp .env.acp.example .env.acp

# Update with credentials from ACP dashboard
ACP_ENABLED=true
ACP_AGENT_WALLET_ADDRESS=0x...
ACP_WALLET_PRIVATE_KEY=...
ACP_ENTITY_ID=...
ACP_SERVICE_PRICE=10.00
ACP_SERVICE_SLA_SECONDS=180
```

⚠️ **Never commit private keys to git!**

---

### Testing

```bash
# Start backend
source venv/bin/activate
cd backend
uvicorn api.main:app --reload --port 8000

# Verify status
curl http://localhost:8000/api/acp/status
```

Expected response:
```json
{
  "enabled": true,
  "agent_wallet_address": "0x...",
  "entity_id": "...",
  "service_price": 10.0,
  "status": "operational"
}
```

---

### Architecture Flow

```
ACP Network (Butler/Other Agents)
         ↓
    [POST /api/acp/request]
         ↓
    ACP Service Layer
         ↓
    Existing Trende Workflow
    (Research → Consensus → Attestation)
         ↓
    [POST /api/acp/deliver]
         ↓
    ACP Network (Evaluation)
         ↓
    Payment Settlement ($USDC)
```

### Graduation Requirements

To appear in "Agent to Agent" view (not just Sandbox):
- Complete 10+ jobs successfully
- Maintain <10% failure rate
- Meet SLA consistently
- Pass evaluation phase

---

## Paragraph.xyz (Editorial Engine) ✅ LIVE

Transform trend analysis reports into published articles on [Paragraph.xyz](https://paragraph.xyz).

### Overview

The Editorial Engine converts passive intelligence into active thought leadership by:
1. Rewriting analytical reports into engaging article formats
2. Formatting citations as footnotes/inline links
3. Publishing directly to Paragraph as drafts

### Authentication Flow

Since Paragraph does not support OAuth, we use **Personal Access Token** authentication:

1. User clicks "Publish Findings" on Trend Report
2. System checks for stored `PARAGRAPH_API_KEY`
3. If missing, modal prompts user to:
   - Go to [Paragraph Dashboard Settings](https://paragraph.xyz/dashboard/settings)
   - Copy API Key from Settings tab
   - Paste into secure input field
4. System verifies key with lightweight API call
5. Key stored client-side, flow proceeds

### Drafting Workflow

**Input**: `Trend Report (Markdown)`, `Citations`, `Trend Name`

**Process**:
1. `PublisherAgent` rewrites report into engaging format
2. Adds "Key Takeaways" box
3. Formats citations as footnotes

**API Call**:
```
POST https://api.paragraph.ph/v1/posts
{
  "title": "Generated Title",
  "content": "Enhanced Markdown",
  "publishedAt": null  // Draft mode
}
```

**Output**: `preview_url` (e.g., `paragraph.xyz/@user/draft/123`)

### User Journey

```
Trend Report → "Publish" → Connect Modal → API Key → Draft Created → Review on Paragraph
```

**Reference**: [Paragraph API Docs](https://paragraph.com/docs/api-reference)

---

## Chainlink (Verifiable Oracle) ✅ LIVE

Trende uses **Chainlink Functions** and **Chainlink Runtime Environment (CRE)** to provide verifiable social intelligence.

### Integration Pillars

#### 1. Chainlink Functions (Data Integrity)
Fetches data from off-chain APIs with cryptographic proof.
- **Connectors**: `GDELTConnector`, `CoinGeckoConnector`
- **Output**: Request ID, Commitment, and Data Proof on-chain

#### 2. Chainlink Runtime Environment (CRE)
Executes the `ConsensusEngine` across a decentralized node network.
- **Nodes**: Ported `analyzer_node` logic
- **AI Oracles**: Venice, AI.SA, Gemini
- **Aggregation**: Verified multi-model synthesis within CRE

### On-Chain Components

**Contracts** (located in `/contracts`):
- `TrendeOracle.sol`: Manages market creation and resolution
- `TrendeFunctionsConsumer.sol`: Handles off-chain data fetching

**Deployments**:
- **Arbitrum Sepolia**: `0x95fa0c32181d073FA9b07F0eC3961C845d00bE21`
- **Base Sepolia**: `0x95fa0c32181d073FA9b07F0eC3961C845d00bE21`

### Off-Chain Components

**CRE Workflow** (`backend/chainlink/cre/workflow/`):
- EVM Log Trigger watches for `MarketCreated` events
- Data fetch from GDELT + CoinGecko via CRE HTTP capability
- Multi-model AI consensus across Venice, OpenRouter, Trende API
- Signed report submitted on-chain

**Functions Scripts** (`backend/chainlink/functions/`):
- JavaScript code executed by Chainlink nodes
- Fetches social data with cryptographic proof

---

## SynthData (Financial Intelligence) ✅ LIVE

Probabilistic price forecasts powered by Bittensor Subnet 50.

### Overview

SynthData provides ensemble predictions from 200+ competing ML models for:
- **Cryptocurrencies**: BTC, ETH, SOL
- **Equities**: SPY, NVDA, GOOGL, TSLA, AAPL

### Features

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Price Forecasts | `/insights/prediction-percentiles` | 7d/30d probabilistic forecasts (p10-p90) |
| Volatility | `/insights/volatility` | Forward-looking and realized volatility |
| Options | `/insights/option-pricing` | Theoretical fair values from ensemble |
| Liquidation | `/insights/liquidation` | Leveraged position risk analysis |
| LP Optimization | `/insights/lp-bounds` | Uniswap V3 optimal range calculator |
| Polymarket | `/insights/polymarket/*` | Prediction market comparison |

### Automatic Integration

When a research topic mentions supported assets (e.g., "Bitcoin price outlook"), 
SynthData automatically enriches the analysis with:

1. **Probabilistic forecasts** - Median price + confidence ranges
2. **Risk metrics** - Volatility, liquidation probabilities
3. **Consensus enhancement** - Financial data fed into AI consensus
4. **Architect integration** - Risk levels inform meme page payload

Execution notes:
- Enabled via request augmentation toggle: `"augmentation": {"synthdata": "auto|on|off"}`
- `coingecko` route can fall back to SynthData when enabled
- `synthdata` can also be selected as a direct source platform

### API Endpoints

```bash
# List supported assets
GET /api/synthdata/assets

# Get forecast for an asset
POST /api/synthdata/forecast
{
  "asset": "BTC",
  "include_options": false,
  "include_liquidation": true,
  "leverage": 10
}

# Health check
GET /api/health/synthdata
```

### Configuration

```bash
SYNTHDATA_API_KEY=your_api_key_here
```

### Research Workflow Integration

1. **Asset Detection**: Topic scanned for asset mentions
2. **Data Fetching**: Parallel calls to relevant endpoints
3. **Consensus Enhancement**: Financial data added to AI context
4. **Report Appendix**: Forecasts included in final report
5. **Payload Enrichment**: Architect receives risk metrics

---

## SerpApi (Search Discovery) ✅ LIVE

Structured search discovery used to reduce low-signal web scraping.

### Why it was added

- Avoid spending crawl budget on SERP wrapper pages (`google.com/search`, `duckduckgo?q=...`, redirect links)
- Get ranked organic candidates in JSON first, then run deeper extraction only when needed
- Improve latency and quality in `web` runs

### How it fits the pipeline

1. `web` route tries `serpapi` first (fast discovery)
2. If useful results are found, run may stop there for lightweight evidence
3. If empty/thin, fallback chain continues to `tabstack` → `firecrawl` → `tinyfish`

### Configuration

```bash
SERPAPI_API_KEY=your_api_key_here
SERPAPI_TIMEOUT_SECS=20
```

### Quality Guardrail

All web connectors now filter low-signal search pages before ingestion.

---

## Future Integrations

### Token Launchers (nad.fun, Pump.fun)

Enable one-click token creation from meme pages:
- Extract ticker, name, supply from meme payload
- Deploy verified ERC-20 contract
- Auto-setup liquidity pairs

### Substack/Mirror

Alternative publishing platforms for editorial content:
- Similar flow to Paragraph integration
- Platform-specific formatting

### Social Auto-Posting

Automated distribution to:
- Twitter/X via API
- Farcaster via Warpcast bots
- LinkedIn for professional audiences

### Monitoring Services

Ongoing trend tracking:
- Cron-based re-analysis every 24h
- Delta detection for sentiment/volume shifts
- Alerts via Email/Telegram/Discord

---

## Adding New Integrations

1. Create connector in `backend/integrations/connectors/`
2. Add agent node if AI transformation needed
3. Build frontend UI components
4. Document in this file

---

## Resources

- **ACP Platform**: https://app.virtuals.io
- **aGDP Tracker**: https://agdp.io
- **ACP SDK**: https://github.com/Virtual-Protocol/openclaw-acp
- **Chainlink Functions**: https://functions.chain.link
- **Paragraph API**: https://paragraph.com/docs/api-reference
