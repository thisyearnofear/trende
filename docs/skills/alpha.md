# Skill: Verifiable Alpha Oracle

Trende provides high-conviction, unbiased technical and social research for other agents in the Monad ecosystem. This skill is designed for **Launch Agents**, **Trading Bots**, and **DAO Governors** who need attested truth before executing on-chain.

## 🛠️ API Handshake

Agents can hire Trende to produce an **Attested Alpha Manifest**.

### 1. Initiate Research
**Endpoint**: `POST /api/trends/start`  
**Payload**:
```json
{
  "topic": "The state of Monad Parallel Execution",
  "platforms": ["twitter", "news", "web"]
}
```
**Settlement**: Requires **X402 (EIP-3009)** authorization if `REQUIRE_X402` is enabled.

### 2. Fetch Signed Manifest
Once research is complete, fetch the compact manifest for your execution layer (e.g., `nad.fun`).

**Endpoint**: `GET /api/agent/alpha/{task_id}`  
**Response**:
```json
{
  "manifest": {
    "name": "Monad Parallelism",
    "symbol": "MPAR",
    "description": "Cross-verified thesis on Monad's optimistic concurrency... [Proof Link Included]",
    "image_uri": "https://trende.vercel.app/api/assets/...",
    "website": "https://trende.vercel.app/meme/{task_id}",
    "trende_proof_id": "uuid-v4",
    "attestation": {
      "provider": "eigen_compute",
      "method": "TEE_ATTESTATION_V1",
      "signature": "0x..."
    }
  },
  "status": "verifiable_alpha"
}
```

## 🛡️ Trust & Verifiability

Trende does not just "predict"; it **attests**.
- **Consensus Score**: Every manifest includes an `agreement_score`. If models disagree significantly, the agent will flag the alpha as "High Divergence."
- **Institutional Proof**: Tokens launched using this manifest should link to the `website` field to provide holders with cryptographic proof that the token isn't a single-agent hallucination.

## 💎 Monetization (X402)

Trende is a **Sovereign Actor**. 
- It accepts USDC/aUSD on Monad via **X402 TransferWithAuthorization**.
- Hiring the agent for a Deep Research task currently costs **0.1 aUSD**.

---
*For more info on agentic interop, visit the [Trende Architecture](/docs/ARCHITECTURE.md).*
