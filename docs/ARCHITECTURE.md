# System Architecture

## 🛠️ The Quadrant Workflow
Trende is built on a 4-Stage Agentic Pipeline (LangGraph):

1. **The Planner (Strategist)**: Analyzes the user prompt and selects which integrations (TikTok, LinkedIn, News) are relevant.
2. **The Researcher (Data Harvester)**: Executes multi-threaded search across selected APIs (Twitter API, NewsAPI, AIsa Web Search, Tabstack).
3. **The Validator (Fact-Checker)**: A logic node that verifies sources, counts cross-references, and generates the **Confidence Score**.
4. **The Consensus Engine (Optional/Pro)**: A parallel processing node that queries multiple AI models (GPT-4o, Llama 3, Gemini) simultaneously and synthesizes a bias-free summary.
5. **The Architect (Visualizer)**: Synthesizes the finding into a **Meme Page Template** or a **Verified News Brief**.

## 🧪 Output Lenses
Trende ships two output lenses from the same validated evidence graph:
1. **Meme Thesis Lens**: Narrative-first output for social conviction and token-community storytelling.
2. **Verifiable News Lens**: Multi-model consensus digest with explicit anti-bias and attestation metadata.

## 🧬 Frontend: The "Commitment to Token" Flow
Users don't just "see" results; they "act" on them:

1. **The Laboratory**: The research dashboard (What we have now).
2. **The Forge (Meme Page)**: Users customize a generated "Conviction Dashboard" (Charts, Citations, Viral Highlights).
3. **The Forge (Verifiable News Synthesizer)**: Users switch to a consensus digest that cross-verifies model outputs and displays attestation preview metadata.
4. **The Execute (Agent Interop)**: 
   - Exposes a **Verifiable Alpha API** for other Monad agents (e.g., `nad.fun` bots) to query research for a fee.
   - Generates an **Attested Metadata URL** (Permanent Link) that tokens use as their "Source of Authority" on-chain.
   - Trends are no longer "copied"; they are **Verified** and **Settled** between sovereign agents.

## 🏆 Strategic Positioning (The Moltiverse Narrative)
Trende is built to excel in the **Agentic Economy** by addressing three core archetypes:

### 1. Self-Sovereign Intelligence
- **Mechanic**: The **Verifiable News Synthesizer** runs multi-model consensus inside **EigenCompute (TEEs)**.
- **Goal**: Provide "Attested Truth." Trende is a sovereign entity that can cryptographically prove its reasoning is free from single-model or human bias.

### 2. Multiplayer Coordination
- **Mechanic**: The **X402 (EIP-3009)** payment layer.
- **Goal**: Enable an agent-to-agent economy. Trading bots, DAO governors, and gaming agents hire Trende to provide the "Social Truth" needed for their on-chain decisions.

### 3. Zero-Player Autonomy
- **Mechanic**: **Auto-Forge Pipeline**.
- **Goal**: A perpetual loop that bridges TikTok/X trends, validates them across 4+ models, and autonomously launches high-conviction token theses on `nad.fun` without human intervention.

## 🧠 Infrastructure Layer
- **Verifiable Execution**: **Baseline-attested** service (Fastify/Node.js) runs in Docker on Hetzner. Derives a signer from a BIP39 mnemonic, generates cryptographic random beacons, and signs them with the app wallet. Exposed via nginx reverse proxy at `https://attest.famile.xyz` with Let's Encrypt SSL.
  - **Future**: EigenCompute TEE deployment via **ecloud CLI** (`@layr-labs/ecloud-cli`).
  - **Auth Model**: Developer Auth Key (secp256k1) for deployments; TEE Mnemonic (persistent MNEMONIC env) for app secrets.
- **Inference**: Venice AI (Primary/Private) + AIsa/OpenRouter (Failover).
- **Extraction**: Tabstack (Full-text Markdown extraction).
- **Payment/Monetization**: X402 (EIP-3009) for agent-to-agent hiring.
- **Sovereignty**: Integration with **OpenRouter** and **Venice** ensures no centralized "shut-off" switch for the agent's logic.

## 🌐 Deployment Topology
- **Attestation Service**: `baseline-attested` Docker container → nginx reverse proxy → `https://attest.famile.xyz`
- **Backend API**: Python/FastAPI (local dev or containerized)
- **Frontend**: Next.js on Vercel
