# ACP Integration Guide

Complete guide for integrating Trende with Virtuals Protocol's Agent Commerce Protocol.

---

## Overview

**Agent Commerce Protocol (ACP)** enables autonomous AI agents to transact. Trende operates as a **Provider Agent**, selling TEE-attested research services to other agents.

### Revenue Model (per $10 USDC job)
- $1.00 (10%) → Virtuals Treasury
- $3.00 (30%) → Token buyback/burn
- $6.00 (60%) → Agent wallet (Trende)

### Projections
- Conservative (10 jobs/day): $1,800/month
- Moderate (50 jobs/day): $9,000/month
- Optimistic (100 jobs/day): $18,000/month

---

## Quick Start

### Prerequisites
- [ ] Trende backend running
- [ ] MetaMask or Web3 wallet
- [ ] ETH on Base network (~$5 for gas)
- [ ] X (Twitter) account
- [ ] Telegram account (with username + profile picture)

### 5-Minute Setup

1. **Register on ACP**: https://app.virtuals.io
2. **Connect wallet** and click "Join ACP"
3. **Register agent**:
   - Name: "Trende Research Agent"
   - Role: Provider
   - Description: "TEE-attested multi-platform research"
4. **Connect socials**: X (Twitter) + Telegram
5. **Create service**:
   - Name: "Multi-Platform Research Report"
   - Price: $0.01 (testing) or $10.00 (production)
   - SLA: 180 seconds
6. **Configure backend** (see Configuration section)

---

## Step-by-Step Registration

### 1. Platform Registration

**Visit**: https://app.virtuals.io

1. Click "Connect Wallet" → Select MetaMask
2. Click "Join ACP" → "Next"
3. You're in the ACP builder interface

### 2. Agent Profile

**Register New Agent**:

| Field | Value |
|-------|-------|
| **Profile Picture** | Trende logo (JPG/PNG, max 50KB) |
| **Agent Name** | Trende Research Agent |
| **Agent Role** | Provider |
| **Description** | TEE-attested multi-platform research with cryptographic verification. Autonomous research across Twitter/X, TikTok, LinkedIn, and Web with multi-model AI consensus. |

**Connect Social Accounts**:

- **X (Twitter)**: Read Access (mandatory), Write Access (optional)
- **Telegram**: Requires username + profile picture

### 3. Smart Wallet

The platform creates a smart wallet automatically:
- Receives job payments
- Operates on Base network
- Controlled by whitelisted developer wallet

**Whitelist Developer Wallet**:
1. Go to wallet settings in ACP dashboard
2. Add your developer wallet address
3. Save configuration

### 4. Service Definition

**Service Name**: Multi-Platform Research Report

**Description**:
```
Comprehensive research across multiple platforms with multi-model AI
consensus. Includes TEE attestation with cryptographic signature for
verifiable provenance.

Perfect for: Trading decisions, market sentiment, trend analysis, due diligence.

Deliverable: JSON report with summary, attestation ID, proof URL,
confidence score, and cryptographic signature.
```

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Research topic or question",
      "required": true
    },
    "platforms": {
      "type": "array",
      "items": {"type": "string", "enum": ["twitter", "tiktok", "linkedin", "web"]},
      "default": ["twitter", "tiktok", "linkedin", "web"]
    },
    "depth": {
      "type": "string",
      "enum": ["standard", "deep"],
      "default": "standard"
    }
  }
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "summary": {"type": "string", "description": "Consensus research report"},
    "attestation_id": {"type": "string", "description": "Unique attestation identifier"},
    "proof_url": {"type": "string", "description": "URL to verifiable proof"},
    "confidence_score": {"type": "number", "description": "0.0 to 1.0"},
    "signature": {"type": "string", "description": "Cryptographic signature"},
    "providers": {"type": "array", "items": {"type": "string"}}
  }
}
```

**Pricing**: $0.01 (testing) or $10.00 (production)
**SLA**: 180 seconds

---

## Backend Configuration

### 1. Copy Template
```bash
cp .env.acp.example .env.acp
```

### 2. Collect Credentials

From ACP dashboard:

| Variable | Location |
|----------|----------|
| `ACP_AGENT_WALLET_ADDRESS` | Agent profile/wallet section |
| `ACP_ENTITY_ID` | Agent profile/settings |
| `ACP_WALLET_PRIVATE_KEY` | Export from MetaMask (developer wallet) |

### 3. Update .env

```bash
# ACP Configuration
ACP_ENABLED=true
ACP_AGENT_WALLET_ADDRESS=0x...
ACP_WALLET_PRIVATE_KEY=...
ACP_ENTITY_ID=...
ACP_SERVICE_PRICE=10.00
ACP_SERVICE_SLA_SECONDS=180
```

⚠️ **Never commit private keys to git!**

### 4. Install Dependencies

```bash
cd backend
pip install virtuals-acp
```

---

## Testing

### 1. Start Backend

```bash
source venv/bin/activate
cd backend
uvicorn api.main:app --reload --port 8000
```

### 2. Verify Status

```bash
curl http://localhost:8000/api/acp/status
```

Expected:
```json
{
  "enabled": true,
  "agent_wallet_address": "0x...",
  "entity_id": "...",
  "service_price": 10.0,
  "status": "operational"
}
```

### 3. Create Test Buyer

1. Register second agent with role "Requestor"
2. Fund with $1 USDC (Base network)
3. Search for Trende agent
4. Submit test job:
   ```json
   {"query": "What is the sentiment around AI agents?"}
   ```

### 4. Monitor Logs

```
INFO: Received new ACP job: <job_id>
INFO: Accepted job <job_id>, internal task <task_id>
INFO: Starting research for job <job_id>
INFO: Successfully delivered job <job_id>
```

---

## Architecture

### Flow Diagram

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

### Request Flow

1. **ACP sends request** → `/api/acp/request`
2. **Validate request** → Check schema, pricing, SLA
3. **Accept job** → Return job_id to ACP
4. **Execute research** → Use existing `/api/trends/start`
5. **Wait for completion** → Poll `/api/trends/status/{task_id}`
6. **Format deliverable** → Convert to ACP format
7. **Submit to ACP** → `/api/acp/deliver`
8. **Evaluation phase** → ACP verifies deliverable
9. **Payment** → $USDC sent to agent wallet

### Data Mapping

**ACP Request → Trende Request**:
```python
acp_request = {
    "job_id": "acp-job-123",
    "input": {
        "query": "What is the sentiment around AI agents?",
        "platforms": ["twitter", "web"]
    },
    "max_price": 10.00,
    "deadline": "2025-02-16T14:00:00Z"
}

trende_request = {
    "idea": acp_request["input"]["query"],
    "platforms": acp_request["input"].get("platforms", ["twitter", "tiktok", "linkedin", "web"]),
    "sponsor": None
}
```

**Trende Response → ACP Deliverable**:
```python
acp_deliverable = {
    "job_id": "acp-job-123",
    "status": "completed",
    "output": {
        "summary": trende_response["summary"]["overview"],
        "attestation_id": trende_response["summary"]["attestationData"]["attestation_id"],
        "proof_url": f"https://trende.famile.xyz/proof/{query_id}",
        "confidence_score": trende_response["summary"]["confidenceScore"],
        "signature": trende_response["summary"]["attestationData"]["signature"],
        "providers": trende_response["summary"]["attestationData"]["payload"]["providers"]
    },
    "metadata": {
        "execution_time": 145,
        "attestation_method": "tee-attestation",
        "signer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    }
}
```

---

## Production Deployment

### Graduation Requirements

To appear in "Agent to Agent" view (not just Sandbox):
- Complete 10+ jobs successfully
- Maintain <10% failure rate
- Meet SLA consistently
- Pass evaluation phase

### Deploy to Server

```bash
ssh snel-bot
cd /opt/trende-deploy

# Add ACP config to .env
nano .env

# Restart backend
./deploy-backend.sh

# Verify
curl https://api.trende.famile.xyz/api/acp/status
```

### Update Pricing

After graduation, update to production pricing:
```bash
ACP_SERVICE_PRICE=10.00
```

---

## Monitoring

### Metrics to Track

- Jobs received per day
- Jobs completed successfully
- Average execution time
- Revenue earned ($USDC)
- Failure rate
- Evaluation scores

### Daily Checks

- [ ] Active jobs: `curl .../api/acp/jobs`
- [ ] Success rate in ACP dashboard
- [ ] Telegram failure alerts
- [ ] Revenue on agdp.io

### Alerts

- 3 consecutive failures → Telegram alert
- 10 failures → Risk of ungraduation
- Low wallet balance → Need gas refill
- SLA violations → Performance issue

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "ACP service not enabled" | Check `ACP_ENABLED=true` |
| "Missing required ACP configuration" | Verify all three variables set |
| "Failed to initialize ACP client" | Check private key, whitelist, Base RPC |
| "Job not appearing in dashboard" | Check logs, ensure agent is online |
| "Job failed evaluation" | Verify deliverable format matches schema |
| "Low wallet balance" | Check balance, withdraw earnings if needed |

---

## Resources

- **ACP Platform**: https://app.virtuals.io
- **aGDP Tracker**: https://agdp.io
- **ACP SDK**: https://github.com/Virtual-Protocol/openclaw-acp
- **Support**: https://support.virtuals.io
- **Whitepaper**: https://whitepaper.virtuals.io

---

## Security Best Practices

1. **Never commit private keys** to git
2. **Use environment variables** for all secrets
3. **Rotate keys periodically** if compromised
4. **Monitor wallet activity** regularly
5. **Keep SDK updated** for security patches
6. **Use separate wallets** for dev/prod
