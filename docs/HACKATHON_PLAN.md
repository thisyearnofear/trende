# Chainlink Convergence Hackathon Plan (Feb 2026)

## Overview
- **Hackathon**: [Convergence: A Chainlink Hackathon](https://chain.link/hackathon)
- **Timeline**: February 6 – March 1, 2026
- **Objective**: Decentralize Trende's intelligence pipeline using the **Chainlink Runtime Environment (CRE)** and **Chainlink Functions** to create the world's first verifiable trend oracle.

## Core Integration Pillars

### 1. Verifiable Data Sourcing (Chainlink Functions)
- **Current State**: Python-based connectors fetch data from GDELT, CoinGecko, and Twitter via centralized APIs.
- **Hackathon Goal**: Replace/Augment with Chainlink Functions.
- **Benefit**: Cryptographic proof that the data synthesized by the AI was actually fetched from the claimed source at a specific time.
- **Implementation**:
    - Create `ChainlinkConnector` in `backend/integrations/connectors/`.
    - Develop JavaScript snippets for Chainlink Functions to fetch GDELT/CoinGecko data.
    - Store the `requestId` and `commitment` in the trend's metadata.

### 2. Decentralized Consensus (Chainlink Runtime Environment - CRE)
- **Current State**: Multi-model consensus happens in a centralized FastAPI backend, optionally attested by a single-node TEE (EigenCompute).
- **Hackathon Goal**: Port the `ConsensusEngine` logic to the **Chainlink Runtime Environment**.
- **Benefit**: Moves "Reasoning" from a single server to a decentralized network of nodes, making the "Intelligence" truly sovereign and tamper-proof.
- **Implementation**:
    - CRE TypeScript workflow in `backend/chainlink/cre/workflow/`.
    - EVM Log Trigger on `MarketCreated` events from TrendeOracle.
    - HTTP capability fetches from Venice AI, OpenRouter (Llama 3.3 70B), and Trende API.
    - Jaccard agreement scoring + score averaging produces a signed consensus report.
    - `runtime.report()` + `evmClient.writeReport()` settles on-chain.

### 3. The "Meme Oracle" (On-Chain Resolution)
- **Current State**: Reports are stored in a database and displayed on a web dashboard.
- **Hackathon Goal**: Deploy a "Trend Prediction" smart contract that uses Trende as its oracle.
- **Benefit**: Enables a new class of "Social Prediction Markets" where users bet on narratives, resolved by verifiable AI consensus.
- **Implementation**:
    - Solidity contract for market creation and resolution.
    - Integration with Chainlink Functions to "push" the final trend score to the contract.

## Roadmap & Milestones

| Date | Milestone | Description | Status |
|------|-----------|-------------|--------|
| **Feb 21** | **Planning & Setup** | Finalize architecture and register for the hackathon. | ✅ Done |
| **Feb 22-23** | **Functions Integration** | Implement Chainlink Functions for GDELT and CoinGecko. | ✅ Backend Live |
| **Feb 24-25** | **CRE Migration** | Port `ConsensusEngine` to Chainlink Runtime Environment. | ✅ Done |
| **Feb 26** | **Oracle Contract** | Deploy the "Meme Oracle" Solidity contract on Base/Monad Testnet. | ✅ Live (Base Sepolia + Arbitrum Sepolia) |
| **Feb 27-28** | **E2E Testing** | Connect the frontend to the on-chain oracle data. | ⏳ Pending |
| **Mar 1** | **Submission** | Finalize video demo and technical documentation. | ⏳ Pending |

## Success Metrics for Hackathon
- [x] Backend Integration for Chainlink Functions (Connectors wired & verified).
- [ ] 100% Verifiable Data Sourcing for at least 2 platforms (On-chain tx confirmation).
- [x] Consensus Report generated and signed within CRE.
- [ ] At least one successful prediction market resolution via Trende Oracle.
- [ ] Technical post-mortem/guide on "Building Verifiable AI Agents with CRE".

## Track Alignment
- **AI Agents Track**: High (using CRE for agent reasoning).
- **Prediction Markets Track**: High (Trende as a social narrative oracle).
- **DeFi & Tokenization**: Medium (on-chain resolution of trend markets).
