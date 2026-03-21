# Trende Architecture

## System Overview

Trende is a verifiable AI oracle built on a LangGraph research pipeline, server-side proof generation on Hetzner, and Chainlink settlement primitives.

```
┌──────────────────────┐     ┌──────────────────────┐
│  Frontend (Vercel)   │     │  Proof Runtime       │
│   Next.js + React    │     │  Hetzner Backend     │
│  + Kinetic UI        │     │  HMAC-signed proofs  │
└──────────┬───────────┘     └──────────▲───────────┘
           │                           │
┌──────────▼───────────┐               │
│  Backend API         │───────────────┘
│  FastAPI (Port 8000) │   local proof generation
│  - Trend Analysis    │
│  - Consensus Engine  │
│  - ACP Integration   │
└──────────┬───────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌─────────────────┐   ┌──────────────────┐
│ Data Connectors │   │ Chainlink Oracle │
│ - X / News / Web│   │ - Functions DON  │
│ - HN / StackEx  │   │ - CRE Workflow   │
│ - CoinGecko     │   │ - Market Resolve │
│ - TinyFish 🤖   │   └──────────────────┘
└─────────────────┘
```

## Research Workflow

### 1. Planner
- decomposes the thesis
- selects source routes
- decides research depth

### 2. Researcher
- runs connector fetches in parallel
- normalizes source payloads
- captures platform metadata

### 3. Validator
- filters weak or stale evidence
- scores relevance and source quality
- prepares consensus-ready findings

### 4. Consensus Engine
- runs Venice, AIsA, and OpenRouter routes
- measures agreement and divergence
- builds the final report payload

### 5. Architect
- shapes UI/report output
- packages the proof manifest
- persists export and telemetry artifacts

## Server Proof System

Trende no longer depends on an external attestation provider. Proof is generated directly inside the backend runtime on Hetzner.

### Proof flow

1. Backend completes synthesis.
2. Canonical JSON payload is hashed with SHA-256.
3. The hash is signed with the configured proof secret.
4. The API returns a proof payload alongside the report.
5. Clients can verify the canonical hash against the signature.

### Proof payload

```json
{
  "provider": "hetzner",
  "status": "signed",
  "method": "server-signature",
  "attestation_id": "PROOF-2b54e3ca4ce336cf",
  "input_hash": "2b54e3ca4ce336cf5365bbba86564c6123f7e983...",
  "signature": "9c52d6d3...",
  "key_id": "hetzner-runtime-key",
  "generated_at": "2026-03-21T10:15:00+00:00"
}
```

### Runtime health

- `GET /api/health/attestation`
- `GET /api/health/attestation?probe=true`
- `POST /api/health/attestation/verify`

## Chainlink Integration

### Functions
- fetches off-chain context used by oracle resolution
- supports external data sourcing

### CRE
- watches `MarketCreated`
- runs decentralized fetch + consensus logic
- writes signed reports to `TrendeOracle.onReport(...)`

### Live contracts
- `TrendeOracle`: `0xEEDeD7daC9D6b17f5D3915542A549B1AefCeed56`
- `TrendeFunctionsConsumer`: `0xA4C4FC79909165fFeAFEdEb47A93Db058383DB84`
- verified simulation tx: `0xcad4b3455e9d53281d6393318272eb01b98311740abbcae393d738829b93a3e0`

## Key Environment Variables

```bash
ATTESTATION_PROVIDER=hetzner
ATTESTATION_DEV_SECRET=replace_me_dev_secret
ATTESTATION_KEY_ID=hetzner-runtime-key
ATTESTATION_HOST=hetzner

CHAINLINK_ACTIVE_CHAIN=arbitrum-sepolia
CHAINLINK_ORACLE_ADDRESS=0xEEDeD7daC9D6b17f5D3915542A549B1AefCeed56
CHAINLINK_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
```

## Troubleshooting

### Proof verification is degraded
- ensure `ATTESTATION_DEV_SECRET` is set
- check `/api/health/attestation?probe=true`
- confirm the backend container has the updated env

### CRE workflow is not live
- receiver contract is deployed
- full workflow deployment still depends on Chainlink org access approval
