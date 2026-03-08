# Trende CRE — Decentralized AI Consensus Workflow

This module ports Trende's multi-model consensus engine to the **Chainlink Runtime Environment (CRE)**, moving AI reasoning from a single server to a decentralized oracle network.

## Architecture

```
TrendeOracle (Arbitrum Sepolia)
  │ emits MarketCreated(marketId, topic, endTime)
  ▼
CRE Workflow DON (EVM Log Trigger)
  │
  ├─► Fetch GDELT article (HTTP, BFT consensus)
  ├─► Fetch CoinGecko data (HTTP, BFT consensus)
  │
  ├─► Ask Venice AI — Llama 3.3 70B (HTTP, BFT consensus)
  ├─► Ask OpenRouter — Llama 3.3 70B free (HTTP, BFT consensus)
  ├─► Ask Trende API — pre-computed TEE-attested consensus (HTTP, BFT consensus)
  │
  ├─► Compute cross-provider agreement (Jaccard index + score averaging)
  │
  └─► Sign & write settlement report → TrendeOracle.onReport (via Chainlink forwarder)
```

Every HTTP call runs independently on each CRE node. Results are aggregated via Byzantine Fault Tolerant consensus before the workflow proceeds. The final settlement report is cryptographically signed by the DON.

## Files

| File | Purpose |
|------|---------|
| `workflow/main.ts` | Entry point — trigger, handler, oracle settlement |
| `workflow/providers.ts` | HTTP fetchers for data sources and AI providers |
| `workflow/consensus.ts` | Multi-model agreement scoring and result merging |
| `workflow/types.ts` | Config schema (Zod), event ABIs, shared types |
| `workflow/config.json` | Runtime config (contract address, chain, API URL) |
| `workflow/secrets.yaml` | Secret mappings for CRE Vault DON |
| `consensus.go` | Reference Go implementation of Jaccard agreement scoring |
| `consensus_test.go` | Go tests for the reference implementation |

## Quick Start

```bash
# Install CRE CLI
curl -sSL https://cre.chain.link/install.sh | bash
cre login

# Install dependencies
cd backend/chainlink/cre/workflow
npm install    # or: bun install

# Simulate locally (makes real HTTP calls, no deployment needed)
cre simulate

# Build WASM binary
cre build

# Deploy (requires Early Access approval)
cre deploy
```

## How It Works

1. **Trigger**: The workflow watches for `MarketCreated` events on TrendeOracle.
2. **Data fetch**: GDELT and CoinGecko provide verifiable context about the topic.
3. **AI consensus**: Venice and OpenRouter each analyze the topic independently. The Trende API provides a third signal from its own multi-model pipeline (Venice + AIsa + OpenRouter variants with TEE attestation).
4. **Agreement scoring**: Jaccard index across provider responses, same algorithm as `consensus.go` and `ai_service.py:_calculate_agreement_score`.
5. **Settlement**: The DON signs the consensus score and submits it to `TrendeOracle.onReport(...)` through the configured Chainlink forwarder.

## Consensus Algorithm

Agreement scoring uses pairwise Jaccard index with smoothing, consistent across all three implementations:

```
smoothed = 0.1 + (0.8 × average_jaccard)
```

- `consensus.go` — Go reference (standalone)
- `workflow/consensus.ts` — TypeScript (runs in CRE WASM)
- `ai_service.py:_calculate_agreement_score` — Python (runs in backend)

## Contract

- **TrendeOracle**: `0xe968d89E47c4e4Cd111dcde8d2E984703E7FeA8b`
- **Network**: Arbitrum Sepolia (chain 421614)
- **Subscription**: 558 (funded)
