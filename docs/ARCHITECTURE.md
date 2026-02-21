# Technical Architecture

## System Overview

Trende is built on a 4-stage agentic pipeline (LangGraph) with TEE-attested consensus.

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
│  - ACP Integration  │
└──────────┬───────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌─────────────────┐   ┌──────────┐
│ Data Connectors │   │ AI Models│
│ - Twitter       │   │ - Venice  │
│ - TikTok        │   │ - AIsa    │
│ - LinkedIn      │   │ - OpenRouter│
│ - NewsAPI       │   │          │
│ - TinyFish 🤖   │   │          │
│   (AI Agent)    │   │          │
└─────────────────┘   └──────────┘
```

### Key Differentiator: TinyFish AI Agent

**TinyFish** is Trende's autonomous deep-research agent - a key differentiator from competitors:

- **Agentic, not just API**: TinyFish uses goal-based AI to autonomously browse the web
- **Primary source reading**: Opens and reads actual docs, posts, research papers - not just API metadata
- **Deep discovery**: Used for "deep" research profiles where depth matters more than speed
- **Premium capability**: Included in Alpha Hunter and Due Diligence mission profiles

---

## The Quadrant Workflow

### 1. Planner (Strategist)
Analyzes user query and selects relevant integrations:
- Platform selection (Twitter, TikTok, LinkedIn, News)
- Depth determination (standard vs deep)
- Resource allocation

### 2. Researcher (Data Harvester)
Executes multi-threaded search across selected APIs:
- Twitter API - Real-time posts and sentiment
- TikTok/YouTube - Video trend metadata
- LinkedIn - Professional discussions
- NewsAPI/AIsa Web - News articles and research

### 3. Validator (Fact-Checker)
Logic node for verification:
- Source credibility scoring
- Cross-reference counting
- Confidence score generation (0.0 - 1.0)

### 4. Consensus Engine
Parallel multi-model synthesis:
- Simultaneous queries to Venice, AIsa, OpenRouter
- Triangulated archetype analysis (Pillars vs Anomalies)
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

**Future Enhancements**:
- [x] Production Eigen endpoint with trusted custom-domain TLS
- [ ] Remote attestation quotes
- [ ] Key rotation mechanism
- [ ] On-chain attestation registry
- [ ] IPFS storage

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
```

### Domain + TLS Notes

Use a real domain you control for Eigen TLS issuance, for example:

```bash
eigen-attest.famile.xyz -> 34.10.131.255
```

Do not use shared wildcard helper domains (for example `nip.io`) in production due to ACME rate limits.

### Docker Network

```bash
docker network create trende-network

docker run -d --name baseline-attested \
  --network trende-network \
  -p 8082:8080 \
  trende/baseline:v2

docker run -d --name trende-backend \
  --network trende-network \
  -p 8000:8000 \
  trende/backend:latest
```

---

## Health Checks

### Attestation Service
```bash
curl http://localhost:8082/health
```

### Backend Attestation Status
```bash
# Configuration check
curl https://api.trende.famile.xyz/api/health/attestation

# Live probe
curl https://api.trende.famile.xyz/api/health/attestation?probe=true
```

### ACP Status
```bash
curl https://api.trende.famile.xyz/api/acp/status
```

---

## TEE Service Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/attest` | POST | Attest to arbitrary payload |
| `/verify` | POST | Verify an attestation |
| `/random` | GET | Generate attested random number |
| `/health` | GET | Service health check |

---

## Deployment

### Attestation Service (Hetzner)

```bash
ssh snel-bot "/opt/trende-deploy/deploy-baseline.sh"
```

Script performs:
1. `git pull` in `/opt/trende-deploy/trende-repo/`
2. Rebuilds Docker image
3. Stops and replaces container (preserving `.env`)
4. Health-checks `/random` endpoint

### Backend API

```bash
cd /opt/trende-deploy
./deploy-backend.sh
```

### Frontend

Deployed to Vercel via git push.

---

## API Integration

### Frontend Display

```typescript
const response = await fetch(`/api/trends/${taskId}`);
const data = await response.json();
const attestation = data.summary.attestationData;

console.log('Attestation ID:', attestation.attestation_id);
console.log('Signature:', attestation.signature);
console.log('Signer:', attestation.signer);
```

### Verification

```typescript
const verifyResponse = await fetch('/api/attest/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    payload: attestation.payload,
    attestation: attestation
  })
});
const result = await verifyResponse.json();
console.log('Verified:', result.verified);
```

---

## Troubleshooting

### Backend Can't Reach TEE Service
**Symptom**: `RuntimeError: ATTESTATION_STRICT_MODE=true requires live Eigen attestation`

**Solution**: Ensure same Docker network, use container name:
```bash
EIGEN_ATTEST_URL=https://eigen-attest.famile.xyz/attest
```

### Signature Verification Fails
**Symptom**: `verified: false`

**Solution**: Use canonical JSON (sorted keys, no whitespace)

### TEE Service Not Starting
**Symptom**: Container exits immediately

**Solution**: Check MNEMONIC in `.env`:
```bash
docker logs baseline-attested
```

---

## Signer Address

**Production TEE Wallet**: `0xD518465105bc1a4Db877e5d7b0C64cc88260f15B`

All attestations are signed by this address. Verify against it to confirm authenticity.
