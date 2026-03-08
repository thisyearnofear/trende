# Trende x Chainlink Hackathon Submission

## Project Title

Trende: Verifiable Agent Intelligence for Prediction Markets

## One-Line Summary

Trende turns noisy web and market signals into verifiable, agent-consumable conviction, then uses Chainlink CRE and Chainlink Functions to settle that intelligence on-chain as a prediction market primitive.

## Problem

AI agent outputs are usually not trustworthy enough for high-stakes use. A single backend can be censored, misconfigured, or manipulated. Markets and autonomous agents need stronger guarantees around:

- where data came from
- how intelligence was produced
- whether settlement happened deterministically

## Solution

Trende combines:

- Chainlink Functions for verifiable off-chain data fetching
- Chainlink Runtime Environment (CRE) for decentralized multi-provider AI consensus
- TrendeOracle for on-chain market creation and settlement
- Eigen-backed TEE attestation for Trende's own internal intelligence path

This creates a usable primitive for agents, traders, creators, and prediction markets: verifiable intelligence that can be acted on, not just read.

## Why Chainlink

Chainlink is the core orchestration and settlement layer in this project.

- CRE listens for `MarketCreated` events and runs a decentralized workflow.
- CRE fetches independent external context and AI responses across nodes.
- CRE computes consensus and signs the result.
- Chainlink Functions supports verifiable API sourcing for key external datasets.
- The final report resolves a live market through the Trende oracle contract's CRE receiver path.

Without Chainlink, this is just a centralized research tool. With Chainlink, it becomes an on-chain intelligence primitive.

## Demo Flow

The demo focuses on one end-to-end path:

1. Create a market around a real topic.
2. Show the CRE workflow trigger on `MarketCreated`.
3. Show decentralized fetch + consensus across data and model providers.
4. Show the signed settlement report and on-chain resolution.
5. Show how another agent or user consumes the resulting conviction output.

## Chainlink Components Used

### Chainlink Runtime Environment (CRE)

- Directory: [/Users/udingethe/Dev/trende/backend/chainlink/cre/workflow](/Users/udingethe/Dev/trende/backend/chainlink/cre/workflow)
- Trigger: EVM log trigger on `MarketCreated`
- Execution: HTTP fetches + AI inference + agreement scoring
- Output: signed report submitted on-chain to `TrendeOracle.onReport(...)`

### Chainlink Functions

- Contracts: [/Users/udingethe/Dev/trende/contracts/src/TrendeFunctionsConsumer.sol](/Users/udingethe/Dev/trende/contracts/src/TrendeFunctionsConsumer.sol)
- Oracle contract: [/Users/udingethe/Dev/trende/contracts/src/TrendeOracle.sol](/Users/udingethe/Dev/trende/contracts/src/TrendeOracle.sol)
- Scripts: [/Users/udingethe/Dev/trende/backend/chainlink/functions](/Users/udingethe/Dev/trende/backend/chainlink/functions)

## Architecture

1. User or agent submits a thesis.
2. Trende creates or stages a market.
3. `TrendeOracle` emits `MarketCreated`.
4. CRE workflow is triggered.
5. CRE fetches context from GDELT and CoinGecko.
6. CRE queries Venice, OpenRouter, and Trende API.
7. CRE computes agreement and a final score.
8. CRE submits a signed settlement report to the oracle receiver.
9. `TrendeOracle.onReport(...)` resolves the market on-chain.
10. The result becomes reusable by other agents.

## Agent Economy Use Case

This is not a single-user dashboard.

Trende is designed for agent-to-agent usage:

- a trader agent can request a thesis and only execute if proof passes
- a DAO risk agent can stage governance review from attested findings
- a market-making or prediction-market agent can resolve on-chain outcomes from decentralized AI consensus

The key product claim is that other agents can pay for, verify, and act on Trende outputs.

## What Makes This Competitive

- clear use of CRE, not just generic oracle branding
- real prediction market settlement path
- strong multi-agent narrative
- verifiable trust stack: CRE + Functions + TEE
- tangible product, not only infrastructure

## Networks and Contracts

- TrendeOracle: `0xe968d89E47c4e4Cd111dcde8d2E984703E7FeA8b`
- Network: Arbitrum Sepolia

## What Judges Should Notice

- Chainlink is doing something essential in the product, not cosmetic
- the workflow is agentic and economically meaningful
- intelligence becomes a reusable on-chain primitive
- the project bridges Web2 signal extraction and Web3 settlement cleanly

## Submission Notes

The strongest framing is:

`Trende converts internet-scale narrative signal into decentralized, verifiable, on-chain conviction that agents can trust and settle against.`
