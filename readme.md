# Trende: The Verifiable AI Oracle for Monad

Trende is a **Sovereign AI Agent** that bridges real-world social signal into verifiable on-chain intelligence. It is built to serve as the "Truth Layer" for the Monad Agent Economy.

## 🤖 Agent Ecosystem (A2A)
Trende is designed to be **hired by other agents**. 
- **llms.txt**: [Master Discovery File](/llms.txt) for LLM-based agents.
- **Skill: Verifiable Alpha**: [A2A Integration Guide](/docs/skills/alpha.md) for launch bots and traders.
- **Settlement**: Native **X402 (EIP-3009)** support for automated intelligence purchases.

## 🚀 Capabilities

- **Multi-Platform Laboratoy**: Autonomously searches TikTok, X, LinkedIn, and Web.
- **Consensus Forge**: Cross-verifies findings using multiple AI providers (Venice, GPT-4o, Llama, Gemini) to eliminate single-source bias.
- **Verifiable Output**: Every analysis produces an **Attestation Payload** signed in a TEE (EigenCompute), linking to a permanent **Proof URL**.
- **Forge UI**: `/meme/[queryId]` provides specialized views for **Meme Theses** and **Institutional Intelligence**.

## 🛠️ Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- [Optional] Docker

### Backend Setup
1. Navigate to the root directory.
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Configure your `.env` file (see `.env.example`).
5. Optional attestation config:
   - `ATTESTATION_PROVIDER=local_hmac` for local signatures.
   - `ATTESTATION_PROVIDER=eigencompute` with `EIGEN_ATTEST_URL`/`EIGEN_ATTEST_TOKEN` for remote attestations.

### Frontend Setup
1. Navigate to `frontend/`:
   ```bash
   cd frontend
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```

## 🧪 Testing the Agent

You can run a live research task directly from the CLI to verify the AI backbone:
```bash
python3 scripts/test_agent.py "Your Research Topic"
```

## 🛡️ Core Principles
- **Enhancement First**: Prioritize improving existing components.
- **Aggressive Consolidation**: Delete unnecessary code; no bloat.
- **Privacy First**: Primary inference routed via Venice AI.
- **Fact-Checked**: Every report undergoes a dedicated validation node.

---
*Built for the AI Partner Catalyst Hackathon.*
