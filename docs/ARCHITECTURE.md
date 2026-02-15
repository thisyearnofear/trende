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
4. **The Launchpad (nad.fun)**: One-click button that:
   - Sets the Meme Page as the `metadata_url`.
   - Populates the token name/ticker based on the AI analysis.
   - Submits the transaction to Monad via the user's wallet (Snap) or the Agent's delegated wallet.

## 🧠 Infrastructure Layer
- **Verifiable Execution**: **EigenCompute** (TEEs) hosts the Intelligence Core to provide cryptographic attestations of agent reasoning.
- **Inference**: Venice AI (Primary/Private) + AIsa/OpenRouter (Failover).
- **Extraction**: Tabstack (Full-text Markdown extraction).
- **Payment/Monetization**: X402 (EIP-3009) for agent-to-agent hiring.
- **Sovereignty**: Integration with **OpenRouter** and **Venice** ensures no centralized "shut-off" switch for the agent's logic.
