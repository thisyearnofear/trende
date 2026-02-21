# Trende Chainlink Runtime Environment (CRE) Consensus Module

This module implements the **multi-model consensus logic** within the **Chainlink Runtime Environment (CRE)**.

## Purpose

The **Trende Consensus Engine** (currently in `backend/agents/analyzer_node`) is ported here to run on a decentralized network of Chainlink nodes. This ensures that the AI analysis is not subject to a single point of failure or manipulation.

## Implementation

- **Language**: Go (as Chainlink core is Go-based)
- **Functions**: `GenerateConsensus(inputs []string)`
- **Oracles**: Nodes fetch data from diverse AI providers (Venice, AIsa, Gemini)
- **Aggregation**: The CRE module computes the final `consensus_score` and `top_narrative`.

## Deployment

1. Build the module as a CRE plugin.
2. Deploy to a Chainlink Node running the OCR3 capability.
3. Configure the job spec to use the Trende consensus logic.
