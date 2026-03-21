# Trende Hackathon Video Script

## 2-Minute Version

### 0:00 - 0:20

"Trende is a verifiable intelligence engine for agents. It turns noisy web and market signals into conviction that can be checked, reused, and settled on-chain."

Show:
- landing page
- agent/oracle framing

### 0:20 - 0:45

"The problem is that most AI outputs are black-box. For markets or autonomous agents, that is not good enough. We used Chainlink Functions for verifiable external data access, and Chainlink CRE for decentralized consensus and report delivery."

Show:
- brief architecture view
- contracts/workflow folders

### 0:45 - 1:15

"On Arbitrum Sepolia, `TrendeOracle` emits `MarketCreated`. Our CRE workflow listens for that event, fetches external context, queries multiple providers, computes agreement, and writes a signed report into the oracle receiver path at `onReport(...)`."

Show:
- `backend/chainlink/cre/workflow/main.ts`
- `contracts/src/TrendeOracle.sol`

### 1:15 - 1:40

"Here is the live oracle on Arbitrum Sepolia, and here is a fresh `MarketCreated` transaction we used to verify the CRE workflow in simulation. The workflow completed successfully with a score of 40 and agreement of 1.00."

Show:
- oracle address `0xEEDeD7daC9D6b17f5D3915542A549B1AefCeed56`
- tx `0xcad4b3455e9d53281d6393318272eb01b98311740abbcae393d738829b93a3e0`
- simulation output

### 1:40 - 2:00

"This is why Trende matters for the agent economy: trader agents, risk agents, and creator agents can all consume the same verifiable output instead of trusting a black-box answer. We already have the live receiver path and verified CRE simulation, and we will lock workflow metadata onchain as soon as Chainlink deployment access is enabled for the org."

End on:
- proof UI
- oracle framing

## Goal

Record a 3-5 minute demo that makes one thing obvious:

Trende uses Chainlink CRE and Chainlink Functions to turn narrative intelligence into an on-chain market settlement primitive for agents.

## Runtime Target

- Target length: 4 minutes
- Hard maximum: 5 minutes

## Structure

### 0:00 - 0:20

Open with the product in one sentence:

"Trende is a verifiable intelligence engine for agents. It gathers web and market signals, computes decentralized AI consensus using Chainlink CRE, and settles that conviction on-chain through a prediction-market oracle."

While saying this, show:

- the app landing page
- the mission / oracle framing
- the Chainlink-related proof UI if visible

### 0:20 - 0:50

State the problem:

"Most AI outputs are produced by one backend and can’t be trusted for financial or agentic use. We wanted a way for agents to consume intelligence that is provable, reproducible, and settleable on-chain."

Then transition immediately:

"So we used Chainlink in two places: Functions for verifiable data access, and CRE for decentralized consensus and market resolution."

### 0:50 - 1:40

Show the Chainlink architecture quickly:

- CRE workflow directory
- TrendeOracle contract
- Functions scripts

Say:

"A market is created on Arbitrum Sepolia. That emits `MarketCreated`. Our Chainlink CRE workflow listens for that event, fetches external context, queries multiple AI providers, computes agreement, and writes a signed settlement report back on-chain through the oracle's CRE receiver."

Keep this visual. Do not stay in code too long.

### 1:40 - 2:40

Show the live app flow:

1. submit a thesis or market topic
2. show mission configuration
3. show processing / agent state
4. show result with proof and oracle framing

Narration:

"From the user perspective, Trende feels like an agent. But the important part is not the UI. The important part is that the underlying intelligence can be verified and then used to resolve a market or trigger downstream agent actions."

### 2:40 - 3:20

Show on-chain evidence:

- contract address
- tx hash
- event or resolved market state

Narration:

"Here is the oracle contract on Arbitrum Sepolia. The market is created here, and the result is resolved here. The off-chain reasoning becomes a usable on-chain primitive."

### 3:20 - 4:00

Close with the agent economy angle:

"This is not just a research dashboard. A trader agent, risk agent, or creator agent can all consume the same verifiable output. That is the core value: agents can pay for, verify, and act on intelligence instead of trusting a black-box answer."

End with:

"Trende turns what the market is saying into conviction that can be settled."

## Recording Rules

- Keep Chainlink central in every minute of the video.
- Do not spend too much time on UI polish.
- Prefer one clean end-to-end path over many features.
- If a feature is not shown live, do not make it sound production-critical.
- If CRE deployment is simulated rather than fully deployed, say that clearly.

## What Not To Do

- Do not over-explain infrastructure. Hetzner-backed proof is supporting trust infrastructure, not the Chainlink headline.
- Do not show five different product modes.
- Do not spend more than 20 seconds on setup screens.
- Do not claim fully decentralized inference if the important part is still backend-assisted.
