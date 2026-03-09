# Trende Architecture

## System Overview

Trende is a verifiable AI oracle built on a 4-stage LangGraph pipeline with TEE-attested consensus and Chainlink integration.

```
┌──────────────────────┐     ┌──────────────────────┐
│  Frontend (Vercel)   │     │  Eigen Attestation   │
│   Next.js + React    │     │  eigen-attest.famile │
│  + Kinetic UI        │     │  .xyz (HTTPS)        │
└──────────┬───────────┘     └──────────▲───────────┘
           │                           │
┌──────────▼───────────┐               │
│  Backend API         │◄──────────────┘
│  FastAPI (Port 8000) │   HTTPS POST /attest
│  - Trend Analysis    │
│  - Consensus Engine  │
│  - ACP Integration   │
└──────────┬───────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌─────────────────┐   ┌──────────────────┐
│ Data Connectors │   │ Chainlink Oracle │
│ - Twitter/X     │   │ - Functions DON  │
│ - TikTok        │   │ - CRE Workflow   │
│ - LinkedIn      │   │ - Market Resolve │
│ - NewsAPI       │   └──────────────────┘
│ - TinyFish 🤖   │
└─────────────────┘
```

---

## The Quadrant Workflow (LangGraph)

### 1. Planner (Strategist)
Analyzes user query and selects relevant integrations:
- Platform selection (Twitter, TikTok, LinkedIn, News)
- Depth determination (standard vs deep)
- RAG retrieval for historical context

### 2. Researcher (Data Harvester)
Executes multi-threaded search across selected APIs:
- Twitter API - Real-time posts and sentiment
- TikTok/YouTube - Video trend metadata
- LinkedIn - Professional discussions
- NewsAPI/AIsa Web - News articles and research
- **TinyFish** - Autonomous deep-research agent

### 3. Validator (Fact-Checker)
Logic node for verification:
- Source credibility scoring
- Cross-reference counting
- Confidence score generation (0.0 - 1.0)
- Topic relevance filtering

### 4. Consensus Engine
Parallel multi-model synthesis:
- Simultaneous queries to Venice, AIsa, OpenRouter
- Triangulated archetype analysis
- Lexical agreement hardening
- Bias detection and mitigation

### 5. Architect (Visualizer)
Output synthesis into two lenses:
- **Meme Page Template**: High-conviction thesis layout
- **Verifiable News Brief**: Consensus digest with attestation

---

## TEE Attestation System

### Architecture

```
┌─────────────────┐
│  Trende Backend │
│   (Port 8000)   │
└────────┬────────┘
         │
         │ HTTPS POST /attest
         ▼
┌─────────────────────────┐
│  Eigen Attestation      │
│  Service (EigenCompute) │
│   HTTPS public domain   │
│                         │
│  🔐 Signs with wallet:  │
│  0xD518...0f15b         │
└─────────────────────────┘
```

### Attestation Flow

1. **Research Completion**: Backend creates consensus payload
2. **TEE Request**: POST to `https://eigen-attest.famile.xyz/attest`
3. **Cryptographic Signing**:
   - Canonical hash (SHA-256)
   - Attestation ID generation
   - Message: `TrendeAttestation|{id}|{hash}|{timestamp}`
   - EIP-191 signature with TEE wallet
4. **Response**: Signature + metadata returned to backend

### Attestation Response Format

```json
{
  "provider": "eigencompute",
  "status": "signed",
  "method": "tee-attestation",
  "attestation_id": "ATTEST-2b54e3ca4ce336cf",
  "input_hash": "2b54e3ca4ce336cf5365bbba86564c6123f7e983...",
  "signature": "0xf2f8f589fa013b00f7d660cad8c46c40b00ca0a3...",
  "signer": "0xD518465105bc1a4Db877e5d7b0C64cc88260f15B",
  "key_id": "eigencompute-tee",
  "generated_at": "2026-02-16T13:36:42.927422+00:00",
  "payload": { /* original consensus data */ }
}
```

### Verification

**API Endpoint**: `POST /api/attest/verify`

```bash
curl -X POST https://api.trende.famile.xyz/api/attest/verify \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {...},
    "attestation": {...}
  }'
```

**Response**:
```json
{
  "verified": true,
  "signer": "0xD518465105bc1a4Db877e5d7b0C64cc88260f15B",
  "attestation_id": "ATTEST-2b54e3ca4ce336cf",
  "message": "TrendeAttestation|ATTEST-2b54e3ca...|2b54e3ca...|...",
  "timestamp": "2026-02-16T13:40:00.000000+00:00"
}
```

### Security Properties

**Provides**:
- ✅ Non-repudiation via wallet signature
- ✅ Integrity via hash mismatch detection
- ✅ Timestamped attestations
- ✅ Public verifiability

**Production TEE Wallet**: `0xD518465105bc1a4Db877e5d7b0C64cc88260f15B`

---

## Chainlink Oracle System

### Architecture

```
┌─────────────────┐     ┌────────────────────────┐
│  Trende Backend │     │  TrendeOracle          │
│   (Port 8000)   │────►│  (Smart Contract)      │
└────────┬────────┘     └──────────┬─────────────┘
         │                         │ request
         │ HTTPS consensus API     ▼
         │              ┌────────────────────────┐
         └─────────────►│ Chainlink Functions DON│
                        │ (oracle-resolution.js) │
                        └────────────────────────┘
```

### Market Resolution Flow

1. **Market Creation**: Agent stages prediction market via `ChainlinkService.createMarket`
2. **Sentinel Monitoring Loop**: Backend asyncio sentinel scans staged markets every 90s
3. **Autonomous Resolution Trigger**: When trend duration ends, sentinel calls `resolveMarket`
4. **Decentralized Evaluation**: Chainlink DON executes `oracle-resolution.js`, queries Trende API
5. **On-Chain Settlement**: DON returns `score|summary`, contract decodes and settles market

### CRE Workflow (Decentralized Consensus)

The `backend/chainlink/cre/workflow/` module ports consensus to **Chainlink Runtime Environment**:

1. **EVM Log Trigger** watches for `MarketCreated` events on TrendeOracle
2. **Data fetch** from GDELT + CoinGecko via CRE HTTP capability (BFT consensus)
3. **Multi-model AI consensus** across Venice, OpenRouter, Trende API
4. **Signed report** submitted on-chain via `runtime.report()` + `evmClient.writeReport()` into `TrendeOracle.onReport(...)`

#### CRE Simulation

```bash
# Prerequisites: cre login, set API keys in environment
export VENICE_API_KEY=your_key
export OPENROUTER_API_KEY=your_key

cre workflow simulate ./backend/chainlink/cre/workflow --non-interactive --trigger-index 0
```

#### Key Implementation Notes

- `logTrigger` accepts `FilterLogTriggerRequestJson` — `addresses` and `topics[].values` must be **base64-encoded** bytes (protobuf JSON convention), not hex strings. Use `hexToBase64()` from the SDK.
- Contract: TrendeOracle @ `0xEEDeD7daC9D6b17f5D3915542A549B1AefCeed56` (Arbitrum Sepolia)
- Event topic: `keccak256("MarketCreated(bytes32,string,uint256)")` = `0x978ff0c9...`
- Chain selector name: `ethereum-testnet-sepolia-arbitrum-1`

#### Contract Tests (All Passing ✅)

All 20 Foundry tests pass covering: market creation, events, access control, Functions fulfillment flow, CRE receiver flow, workflow metadata validation, duplicate/stale CRE reports, and `splitResponse` edge cases.

### Active Deployments

| Network | Chain ID | TrendeOracle | Consumer | Status |
|---------|----------|--------------|----------|--------|
| Base Sepolia | 84532 | `0xe968...eA8b` | `0x95fa...bE21` | ✅ Live |
| Arbitrum Sepolia | 421614 | `0xEEDe...ed56` | `0xA4C4...DB84` | ✅ Live receiver path |

Note: CRE workflow deployment for Arbitrum Sepolia is still pending Chainlink org deployment access approval. The live workflow path has been verified in simulation against tx `0xcad4b3455e9d53281d6393318272eb01b98311740abbcae393d738829b93a3e0`.

---

## Configuration

### Environment Variables

```bash
# Attestation Provider
ATTESTATION_PROVIDER=eigencompute
ATTESTATION_STRICT_MODE=true

# TEE Service Endpoints
EIGEN_ATTEST_URL=https://eigen-attest.famile.xyz/attest
EIGEN_HEALTH_URL=https://eigen-attest.famile.xyz/health
EIGEN_ATTEST_TOKEN=replace_me_secure_token

# Retry Configuration
EIGEN_ATTEST_TIMEOUT_SECS=10
EIGEN_ATTEST_RETRIES=3
EIGEN_ATTEST_BACKOFF_MS=300

# ACP Configuration (optional)
ACP_ENABLED=true
ACP_AGENT_WALLET_ADDRESS=0x...
ACP_WALLET_PRIVATE_KEY=...
ACP_ENTITY_ID=...
ACP_SERVICE_PRICE=10.00
ACP_SERVICE_SLA_SECONDS=180

# Chainlink Configuration
CHAINLINK_ACTIVE_CHAIN=base-sepolia
CHAINLINK_RPC_URL=https://sepolia.base.org
CHAINLINK_CONSUMER_ADDRESS=0x...
CHAINLINK_ORACLE_ADDRESS=0x...
CHAINLINK_SUBSCRIPTION_ID=...
```

### Health Checks

```bash
# Attestation Service
curl https://eigen-attest.famile.xyz/health

# Backend Attestation Status
curl https://api.trende.famile.xyz/api/health/attestation?probe=true

# ACP Status
curl https://api.trende.famile.xyz/api/acp/status
```

---

## Deployment

### Attestation Service (Production)

EigenCloud hosts the attestor at `https://eigen-attest.famile.xyz`. No local container required.

### Backend API

```bash
cd /opt/trende-deploy
./deploy-backend.sh
```

### Frontend

Deployed to Vercel via git push.

---

## Troubleshooting

### Backend Can't Reach TEE Service
**Symptom**: `RuntimeError: ATTESTATION_STRICT_MODE=true requires live Eigen attestation`

**Solution**: Verify endpoint configuration:
```bash
EIGEN_ATTEST_URL=https://eigen-attest.famile.xyz/attest
```

### Signature Verification Fails
**Symptom**: `verified: false`

**Solution**: Use canonical JSON (sorted keys, no whitespace)

### Chainlink Oracle Not Resolving
**Symptom**: Market stays in `staged` state

**Solution**:
1. Check sentinel logs: `docker logs trende-backend | grep SENTINEL`
2. Verify subscription funded: [functions.chain.link](https://functions.chain.link)
3. Confirm consumer added to subscription

### Missing Research Results
**Symptom**: Empty findings in response

**Solution**: Check connector logs for rate limits or API key expiration
