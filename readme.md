# Trende: The Verifiable AI Oracle for the Multichain Agent Economy

Trende is a **Sovereign AI Agent** that bridges real-world social signal into verifiable intelligence. Powered by TEE-verifiable compute (Eigen), it serves as the "Truth Layer" for the emerging Agent Economy across Monad, Base, BNB, Solana, and beyond.

## 📖 Documentation

Detailed guides and specifications are available in the [./docs/](./docs/) directory:

- **[Vision & Strategy](./docs/VISION.md)**: Mission, core value proposition, and strategic opportunities.
- **[Technical Architecture](./docs/ARCHITECTURE.md)**: System overview, LangGraph workflow, TEE attestation, and configuration.
- **[ACP Integration](./docs/ACP_GUIDE.md)**: Guide for Virtuals Protocol's Agent Commerce Protocol.
- **[Roadmap](./docs/ROADMAP.md)**: Development phases and future milestones.
- **[A2A Integration](./docs/skills/alpha.md)**: Integrating Trende with other agents (Verifiable Alpha).

## 🚀 Quick Start

### Backend (Python 3.10+)
```bash
python -m venv venv
source venv/bin/activate
pip install -e .
# Configure .env based on .env.example
uvicorn backend.api.main:app --reload
```

### Frontend (Node.js 18+)
```bash
cd frontend
npm install
npm run dev
```

### Testing
```bash
# Run a live research task
python3 scripts/test_agent.py "Your Research Topic"

# Run full flow (start -> poll -> Forge links)
./scripts/finals_flow.sh "Your Research Topic"
```

## 🤖 Agent Ecosystem (A2A)

Trende is built for the agent-to-agent economy:
- **llms.txt**: [Master Discovery File](./llms.txt) for LLM-based agents.
- **Verifiable Output**: Every analysis produces an **Attestation Payload** signed by a TEE.
- **Settlement**: Native **X402 (EIP-3009)** support for automated intelligence purchases.

## 🛡️ Core Principles

- **Verifiable First**: Cryptographic proof for every report, leveraging **Eigen TEE** for verifiable compute.
- **Multi-Model**: Eliminates single-source bias using Venice, GPT-4o, Llama, and Gemini.
- **Chain Agnostic**: Built to serve intelligence to any ecosystem, including Monad, Base, BNB, and Solana.
- **Privacy Centric**: Primary inference routed via Venice AI.

## 🔗 Chainlink Integration (Hackathon 2026)

Trende uses **Chainlink Functions** and the **Chainlink Runtime Environment (CRE)** to provide verifiable social intelligence.

- **Contracts**: Located in `/contracts`
- **Functions**: JS sources in `backend/chainlink/functions`
- **Deployment**: See [docs/CHAINLINK_DEPLOY.md](docs/CHAINLINK_DEPLOY.md)

### Verifiable Features
1. **Data Sourcing**: GDELT & CoinGecko data fetched via Chainlink Functions.
2. **Oracle**: `TrendeOracle` contract for on-chain trend resolution.

---

**Monad Testnet**: Chain ID `10143` | RPC `https://testnet-rpc.monad.xyz` | [Explorer](https://testnet.monadexplorer.com)
