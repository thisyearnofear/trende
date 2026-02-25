# Trende API Reference

Complete API reference for developers integrating with Trende.

**Base URL**: `https://api.trende.famile.xyz`

---

## Core Endpoints

### Start Research Task

**POST** `/api/trends/start`

Initiates a new trend analysis task.

**Request**:
```json
{
  "topic": "Monad parallel execution",
  "platforms": ["newsapi", "web", "coingecko"],
  "models": ["venice_default", "openrouter_llama_70b", "aisa"],
  "visibility": "public",
  "augmentation": {
    "firecrawl": "auto",
    "synthdata": "on"
  }
}
```

**Response**:
```json
{
  "task_id": "uuid-v4",
  "id": "uuid-v4",
  "status": "pending",
  "created_at": "2026-02-25T10:00:00+00:00",
  "message": "Trend analysis started"
}
```

**Rate Limits**:
- Free tier: 3 searches/day
- Wallet-connected: 10 searches/day
- X402 payment: Unlimited

---

### Get Task Status

**GET** `/api/trends/status/{task_id}`

Poll for task completion status.

**Response**:
```json
{
  "task_id": "uuid-v4",
  "status": "completed",
  "progress": 100,
  "logs": [
    "🧠 INITIALIZING: Crafting research blueprint...",
    "📡 MISSION: Scanning Twitter, News, Web...",
    "✅ SUCCESS: Harvested 47 items"
  ]
}
```

**Status Values**: `pending`, `planning`, `researching`, `processing`, `analyzing`, `completed`, `failed`

---

### Get Research Results

**GET** `/api/trends/{task_id}`

Retrieve task state, findings, summary, telemetry, and attestation bundle.

**Response**:
```json
{
  "query": {
    "id": "uuid-v4",
    "idea": "Monad parallel execution",
    "status": "completed"
  },
  "results": [
    {
      "platform": "newsapi",
      "totalFetched": 6
    }
  ],
  "summary": {
    "overview": "Monad's optimistic concurrency control enables...",
    "confidenceScore": 0.87,
    "consensusData": {
      "agreement_score": 0.74
    },
    "attestationData": {
      "provider": "eigencompute",
      "attestation_id": "ATTEST-..."
    }
  },
  "telemetry": {
    "sourceRoutes": [
      {"requested_platform": "coingecko", "resolved_source": "synthdata"}
    ]
  }
}
```

---

### Export Research

**GET** `/api/trends/{task_id}/export?format=pdf|md|json`

Export research in various formats.

**Formats**:
- `pdf`: Rendered PDF report
- `md`: Markdown document
- `json`: Raw JSON data

---

### Verify Attestation

**POST** `/api/attest/verify`

Verify cryptographic attestation authenticity.

**Request**:
```json
{
  "payload": { /* original consensus data */ },
  "attestation": {
    "attestation_id": "ATTEST-...",
    "signature": "0x...",
    "signer": "0xD518..."
  }
}
```

**Response**:
```json
{
  "verified": true,
  "signer": "0xD518465105bc1a4Db877e5d7b0C64cc88260f15B",
  "attestation_id": "ATTEST-...",
  "message": "TrendeAttestation|...",
  "timestamp": "2026-02-16T13:40:00.000000+00:00"
}
```

---

## Agent-to-Agent (A2A) Endpoints

### Get Alpha Manifest

**GET** `/api/agent/alpha/{task_id}`

Returns compact, verifiable conviction manifest for external launch bots.

**X402 Payment Required** (if enabled)

**Response**:
```json
{
  "manifest": {
    "name": "Monad Parallelism",
    "symbol": "MPAR",
    "description": "Cross-verified thesis on Monad's optimistic concurrency... [Proof Link]",
    "image_uri": "https://trende.vercel.app/api/assets/placeholder.png",
    "website": "https://trende.vercel.app/meme/{task_id}",
    "trende_proof_id": "uuid-v4",
    "attestation": {
      "provider": "eigen_compute",
      "method": "TEE_ATTESTATION_V1",
      "signature": "0x..."
    }
  },
  "status": "verifiable_alpha",
  "settlement": "X402_COMPLETED"
}
```

---

## ACP (Agent Commerce Protocol) Endpoints

Managed by `backend/api/routes/acp.py`. See [INTEGRATION.md](INTEGRATION.md) for details.

**Endpoints**:
- `POST /api/acp/request` - Receive ACP job request
- `POST /api/acp/deliver` - Submit completed deliverable
- `GET /api/acp/status` - Check ACP service status
- `GET /api/acp/jobs` - List active jobs

---

## Health & Monitoring

### Attestation Health

**GET** `/api/health/attestation?probe=true`

Check attestation service connectivity.

**Response**:
```json
{
  "status": "healthy",
  "provider": "eigencompute",
  "endpoint": "https://eigen-attest.famile.xyz/attest",
  "reachable": true
}
```

### Consensus Health

**GET** `/api/health/consensus?probe=true`

Check AI service availability.

**Response**:
```json
{
  "status": "healthy",
  "providers": {
    "venice": "operational",
    "openrouter": "operational",
    "aisa": "operational"
  }
}
```

### System Runs Health

**GET** `/api/health/runs`

Check for stuck runs, attestation failures, provider issues.

---

## User & Rate Limiting

### Get Rate Limit Status

**GET** `/api/user/rate-limit`

**Response**:
```json
{
  "tier": "free",
  "limit": 3,
  "remaining": 2,
  "reset_at": "2026-02-17T00:00:00Z"
}
```

**Tiers**:
- `free`: 3 searches/day
- `wallet`: 10 searches/day (connected wallet)
- `premium`: Unlimited (X402 payment)

---

## Task Management

### Save Task

**POST** `/api/trends/{task_id}/save`

Bookmark a research task for later retrieval.

### Get Saved Tasks

**GET** `/api/trends/saved`

List all bookmarked research tasks.

### Get Task History

**GET** `/api/trends/history`

Retrieve user's complete research history.

---

## Common Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 402 | Payment Required (X402) |
| 404 | Task/Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## SynthData Endpoints

### List Supported Assets

**GET** `/api/synthdata/assets`

Returns all assets available for probabilistic forecasting.

**Response**:
```json
{
  "crypto": ["BTC", "ETH", "SOL"],
  "equities": ["SPY", "NVDA", "GOOGL", "TSLA", "AAPL"],
  "aliases": {"bitcoin": "BTC", "ethereum": "ETH", ...}
}
```

---

### Get Price Forecast

**POST** `/api/synthdata/forecast`

Get comprehensive financial intelligence for an asset.

**Request**:
```json
{
  "asset": "BTC",
  "include_options": false,
  "include_liquidation": true,
  "leverage": 10
}
```

**Response**:
```json
{
  "asset": "BTC",
  "asset_type": "crypto",
  "current_price": 65432.10,
  "forecast_7d": {
    "p10": 61200.0,
    "p25": 64150.0,
    "p50": 68100.5,
    "p75": 70320.0,
    "p90": 72300.0
  },
  "forecast_30d": {
    "p10": 58000.0,
    "p25": 64100.0,
    "p50": 71200.0,
    "p75": 76300.0,
    "p90": 81000.0
  },
  "risk_level": "medium",
  "volatility": {
    "realized": 0.45,
    "implied": 0.52
  },
  "liquidation_probability": 0.12,
  "data_source": "SynthData (Bittensor Subnet 50)",
  "timestamp": "2026-02-25T10:30:00Z"
}
```

---

### Health Check

**GET** `/api/health/synthdata`

Check SynthData API connectivity.

**Response**:
```json
{
  "ok": true,
  "configured": true,
  "message": "SynthData API healthy",
  "supported_assets": {
    "crypto": ["BTC", "ETH", "SOL"],
    "equities": ["SPY", "NVDA", "GOOGL", "TSLA", "AAPL"]
  }
}
```

---

## Resources

- **OpenAPI Spec**: `/docs` (Swagger UI)
- **llms.txt**: `/llms.txt` (LLM agent discovery)
