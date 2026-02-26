# Trende: Multi-Source AI Research with Cryptographic Proof

Trende researches any topic across social media, news, forums, and market data using multiple AI models, then produces **cryptographically verified research reports**.

**What it does:**
1. **Research**: Multi-platform analysis across 17 data sources via LangGraph agents
2. **Verify**: Every report is TEE-attested with cryptographic signatures (Eigen)
3. **Distribute**: Publish to Paragraph, settle on-chain via Chainlink, or serve via A2A API
4. **Automate**: ACP integration lets other AI agents hire Trende for research

**Live deployments**: Arbitrum Sepolia + Base Sepolia ✅

## 📖 Documentation

Consolidated documentation (max 4 docs, 300 lines each):

- **[Architecture](./docs/ARCHITECTURE.md)**: System overview, LangGraph workflow, TEE attestation, Chainlink oracle
- **[Integration](./docs/INTEGRATION.md)**: ACP, Paragraph, Chainlink integration guides
- **[API Reference](./docs/API.md)**: Complete API documentation for developers
- **[Developer Guide](./docs/GUIDE.md)**: Quick start, deployment, troubleshooting

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
- **Agentic UX**: Live "Deploy Agent" dispatch, visible on-chain oracle state, autonomous sentinel-triggered settlement, and copyable A2A invocation payloads.

## 🛡️ Core Principles

- **Verifiable First**: Cryptographic proof for every report, leveraging **Eigen TEE** for verifiable compute.
- **Multi-Model**: Eliminates single-source bias using Venice, GPT-4o, Llama, and Gemini.
- **Chain Agnostic**: Built to serve intelligence to any ecosystem, including Monad, Base, BNB, and Solana.
- **Privacy Centric**: Primary inference routed via Venice AI.

## 🔗 Chainlink Integration

Trende uses **Chainlink Functions** and **Chainlink Runtime Environment (CRE)** for verifiable social intelligence.

- **Contracts**: `/contracts` (✅ Live on Arbitrum Sepolia + Base Sepolia)
- **Functions**: JS sources in `backend/chainlink/functions`
- **CRE Workflow**: Decentralized consensus in `backend/chainlink/cre/workflow/`

### Verifiable Features
1. **Data Sourcing**: GDELT & CoinGecko via Chainlink Functions
2. **Oracle**: `TrendeOracle` contract for on-chain trend resolution
3. **Autonomous Settlement**: Sentinel loop auto-triggers resolution when markets mature

## ✅ Production

- CI gates: `/.github/workflows/ci.yml`
- Smoke tests: `scripts/smoke_matrix.sh`

---

**Monad Testnet**: Chain ID `10143` | RPC `https://testnet-rpc.monad.xyz` | [Explorer](https://testnet.monadexplorer.com)
