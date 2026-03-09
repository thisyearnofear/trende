# Trende Developer Guide

Quick start, deployment, and troubleshooting guide.

---

## Quick Start

### Backend (Python 3.10+)

```bash
# Clone and setup
git clone https://github.com/your-org/trende
cd trende
python3 -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -e ".[dev]"

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run backend
uvicorn backend.api.main:app --reload --port 8000
```

**Verify**: http://localhost:8000/docs (Swagger UI)

---

### Frontend (Node.js 18+)

```bash
cd frontend
npm install
npm run dev
```

**Verify**: http://localhost:3000

---

### Testing

```bash
# Run a live research task
python3 scripts/test_agent.py "Your Research Topic"

# Run full flow (start → poll → Forge links)
./scripts/finals_flow.sh "Your Research Topic"

# Run test suite
pytest -q
```

---

## Configuration

### Environment Variables

**Required**:
```bash
# AI Providers
VENICE_API_KEY=...
AISA_API_KEY=...
OPENROUTER_API_KEY=...

# Database
DATABASE_URL=sqlite:///./trends.db

# App Config
FRONTEND_URL=http://localhost:3000
```

**Optional**:
```bash
# Attestation (Production)
ATTESTATION_PROVIDER=eigencompute
EIGEN_ATTEST_URL=https://eigen-attest.famile.xyz/attest

# ACP (Agent Commerce)
ACP_ENABLED=true
ACP_AGENT_WALLET_ADDRESS=0x...
ACP_WALLET_PRIVATE_KEY=...
ACP_ENTITY_ID=...

# Chainlink
CHAINLINK_ACTIVE_CHAIN=base-sepolia
CHAINLINK_SUBSCRIPTION_ID=...
CHAINLINK_CONSUMER_ADDRESS=0x...
CHAINLINK_ORACLE_ADDRESS=0x...

# X402 Payments
REQUIRE_X402=false
X402_RECIPIENT_ADDRESS=0x...
```

---

## Deployment

### Production Backend (Hetzner)

```bash
# SSH to server
ssh snel-bot

# Deploy
cd /opt/trende-deploy
./deploy-backend.sh
```

**Health Checks**:
```bash
curl https://api.trende.famile.xyz/api/health/attestation?probe=true
curl https://api.trende.famile.xyz/api/health/consensus?probe=true
```

---

### Frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod
```

Or connect GitHub repo for auto-deploy on push.

---

### Docker Deployment

```bash
# Build image
docker build -t trende/backend:latest -f config/docker/Dockerfile .

# Create network
docker network create trende-network

# Run container
docker run -d \
  --name trende-backend \
  --network trende-network \
  -p 8000:8000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  trende/backend:latest
```

---

## Chainlink Deployment

### Deploy Contracts

```bash
cd contracts
source ../.env

# Base Sepolia
forge script script/DeployTrende.s.sol:DeployTrende \
  --rpc-url base-sepolia \
  --broadcast \
  --verify

# Arbitrum Sepolia
CHAINLINK_SUBSCRIPTION_ID=<arb-sub-id> \
forge script script/DeployTrende.s.sol:DeployTrende \
  --rpc-url arbitrum-sepolia \
  --broadcast \
  --verify
```

### Add Consumer to Subscription

1. Go to [functions.chain.link](https://functions.chain.link)
2. Select network (Base/Arbitrum Sepolia)
3. Select your subscription
4. Click "Add Consumer" → paste `TrendeFunctionsConsumer` address
5. Confirm transaction

---

## CRE Workflow (Chainlink Runtime Environment)

### Prerequisites

```bash
# Install CRE CLI (one-time)
curl -sSL https://get.cre.chain.link | bash
export PATH="$HOME/.cre:$HOME/.cre/bin:$PATH"

# Authenticate
cre login
```

### Simulate Locally

```bash
# Set required API keys
export VENICE_API_KEY=your_venice_key
export OPENROUTER_API_KEY=your_openrouter_key

# Run simulation (trigger-index 0 = EVM log trigger)
cre workflow simulate ./backend/chainlink/cre/workflow --non-interactive --trigger-index 0
```

### Workflow Structure

| File | Purpose |
|------|---------|
| `workflow/main.ts` | Entry point — EVM log trigger + handler registration |
| `workflow/providers.ts` | GDELT, CoinGecko, Venice, OpenRouter, Trende API calls |
| `workflow/consensus.ts` | Multi-model score aggregation |
| `workflow/secrets.yaml` | Secret name mappings (resolved from env in simulation) |
| `workflow/config.json` | Chain selector, oracle address, gas config |

### Official CRE Receiver Model

Chainlink's CRE docs require onchain write targets to use the receiver/forwarder pattern:

1. The workflow generates a signed report.
2. `evmClient.writeReport(...)` submits that report to the Chainlink-managed `KeystoneForwarder`.
3. The forwarder verifies signatures and calls `onReport(bytes metadata, bytes report)` on the receiver contract.
4. The receiver contract must support `IReceiver` via ERC165.

Trende now follows this pattern in `contracts/src/TrendeOracle.sol`.

### Status

- ✅ Workflow compiles successfully
- ✅ EVM log trigger registers without error (WASM subscribe fixed)
- ✅ CRE receiver settlement path implemented in `TrendeOracle.onReport(...)`
- ✅ All 15 contract tests passing
- ⚠️ Full simulation requires `VENICE_API_KEY` + `OPENROUTER_API_KEY` in environment
- ⚠️ Production deployment still requires the correct CRE forwarder address from Chainlink's Forwarder Directory

---

## ACP Integration Setup

### 1. Register Agent

1. Visit https://app.virtuals.io
2. Connect wallet → "Join ACP"
3. Register agent:
   - Name: "Trende Research Agent"
   - Role: Provider
   - Description: "TEE-attested multi-platform research"

### 2. Configure Service

- **Name**: Multi-Platform Research Report
- **Price**: $0.01 (testing) or $10.00 (production)
- **SLA**: 180 seconds

### 3. Update Backend

```bash
cp .env.acp.example .env.acp
# Fill in credentials from ACP dashboard
nano .env.acp
```

### 4. Test

```bash
curl http://localhost:8000/api/acp/status
```

---

## Troubleshooting

### Backend Won't Start

**Symptom**: Import errors or module not found

**Solution**:
```bash
source venv/bin/activate
pip install -e ".[dev]"
```

---

### Attestation Fails

**Symptom**: `ATTESTATION_STRICT_MODE=true requires live Eigen attestation`

**Solution**:
1. Check endpoint: `curl https://eigen-attest.famile.xyz/health`
2. Verify token in `.env`
3. For dev, use: `ATTESTATION_PROVIDER=local_hmac`

---

### Chainlink Oracle Not Resolving

**Symptom**: Market stays in `staged` state

**Solution**:
1. Check sentinel logs: `docker logs trende-backend | grep SENTINEL`
2. Verify subscription funded: [functions.chain.link](https://functions.chain.link)
3. Confirm consumer added to subscription in UI

---

### CRE Simulate: WASM `unreachable` trap

**Symptom**: `Failed to create engine: failed to execute subscribe: wasm trap: wasm unreachable instruction executed`

**Cause**: `logTrigger` expects `FilterLogTriggerRequestJson` — `addresses` and `topics[].values` must be **base64-encoded** bytes, not hex strings.

**Solution**: Use `hexToBase64()` from the SDK (already fixed in `main.ts`):
```ts
evmClient.logTrigger({
  addresses: [hexToBase64(evmCfg.oracleAddress)],
  topics: [{ values: [hexToBase64(MARKET_CREATED_TOPIC)] }],
  confidence: "CONFIDENCE_LEVEL_FINALIZED",
})
```

---

### CRE Simulate: Missing env vars

**Symptom**: `environment variable VENICE_API_KEY for secret value not found`

**Solution**:
```bash
export VENICE_API_KEY=your_key
export OPENROUTER_API_KEY=your_key
cre workflow simulate ./backend/chainlink/cre/workflow --non-interactive --trigger-index 0
```

---

### Research Returns Empty Results

**Symptom**: No findings in response

**Solution**:
1. Check API keys in `.env`
2. Verify connectors not rate-limited
3. Check logs: `docker logs trende-backend`
4. Increase timeout: `RESEARCH_CONNECTOR_TIMEOUT_SECS=60`

---

### Frontend Can't Connect to Backend

**Symptom**: Network error in browser console

**Solution**:
1. Verify backend running: `curl http://localhost:8000/api/health/consensus`
2. Check CORS settings in `backend/api/main.py`
3. Update `FRONTEND_URL` in `.env`

---

### ACP Jobs Not Appearing

**Symptom**: Agent shows offline in ACP dashboard

**Solution**:
1. Check `ACP_ENABLED=true` in `.env`
2. Verify wallet whitelisted in ACP dashboard
3. Check logs for ACP connection errors

---

## Resources

- **API Docs**: http://localhost:8000/docs
- **Chainlink Functions**: https://functions.chain.link
- **ACP Platform**: https://app.virtuals.io
