# Trende: The Verifiable AI Oracle for Monad

Trende is a **Sovereign AI Agent** that bridges real-world social signal into verifiable on-chain intelligence. It is built to serve as the "Truth Layer" for the Monad Agent Economy.

## ⚡ Monad Integration

Trende is built natively on **Monad Testnet** (Chain ID: 10143) with:

- **Wallet-Gated Access**: Connect your Monad wallet to unlock higher rate limits
- **X402 Micropayments**: Pay-per-query using EIP-712 signed authorizations (0.001 MON/search)
- **Research Commons**: All completed research is publicly browsable at `/commons`, with sponsor attribution
- **On-Chain Identity**: Research queries are tagged with sponsor wallet addresses for permanent attribution

### Rate Limits
| Tier | Daily Searches | Requirement |
|------|---------------|-------------|
| Anonymous | 3 | None |
| Connected | 10 | Wallet connected |
| Premium | Unlimited | X402 payment |

### Environment Variables (Monad)
```bash
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_CHAIN_ID=10143
MONAD_EXPLORER_URL=https://testnet.monadexplorer.com
X402_RECIPIENT_ADDRESS=0xYourWallet
X402_PAYMENT_AMOUNT=0.001
FREE_TIER_DAILY_LIMIT=3
CONNECTED_TIER_DAILY_LIMIT=10
```

## 🤖 Agent Ecosystem (A2A)
Trende is designed to be **hired by other agents**. 
- **llms.txt**: [Master Discovery File](/llms.txt) for LLM-based agents.
- **Skill: Verifiable Alpha**: [A2A Integration Guide](/docs/skills/alpha.md) for launch bots and traders.
- **Settlement**: Native **X402 (EIP-3009)** support for automated intelligence purchases.

## 🚀 Capabilities

- **Multi-Platform Laboratory**: Autonomously searches TikTok, X, LinkedIn, and Web.
- **Consensus Forge**: Cross-verifies findings using multiple AI providers (Venice, GPT-4o, Llama, Gemini) to eliminate single-source bias.
- **Verifiable Output**: Every analysis produces an **Attestation Payload** cryptographically signed by the attestation service at `attest.famile.xyz`, linking to a permanent **Proof URL**.
- **Forge UI**: `/meme/[queryId]` provides specialized views for **Meme Theses** and **Institutional Intelligence**.

## 🛠️ Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Docker & Docker Compose (Recommended for Production)

### Backend Setup (Local)
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
   - `ATTESTATION_PROVIDER=eigencompute` with `EIGEN_ATTEST_URL=https://attest.famile.xyz/random` for remote attestations.
   - Production hardening toggles:
     - `ATTESTATION_STRICT_MODE=true` to prevent local fallback when Eigen is unavailable.
     - `EIGEN_HEALTH_URL=https://attest.famile.xyz/random` for baseline reachability checks.
     - `EIGEN_ATTEST_TIMEOUT_SECS`, `EIGEN_ATTEST_RETRIES`, `EIGEN_ATTEST_BACKOFF_MS` for network resiliency.

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

## 🚀 Deployment

### Backend (Docker)
For production, run the backend using Docker Compose.

1. **Configure Environment**:
   Ensure your `.env` file is present on the server with all API keys and `ATTESTATION_PROVIDER=eigencompute`.

2. **Start Service**:
   ```bash
   docker compose up -d api
   ```

3. **Update**:
   ```bash
   git pull origin master
   docker compose build api
   docker compose up -d api
   ```

### Frontend (Vercel)
1. Deploy the `frontend/` directory to Vercel.
2. Set Environment Variable:
   - `NEXT_PUBLIC_API_URL`: URL of your deployed backend (e.g., `https://api.trende.famile.xyz`).

## 🧪 Testing the Agent

You can run a live research task directly from the CLI to verify the AI backbone:
```bash
python3 scripts/test_agent.py "Your Research Topic"
```

For an end-to-end real run flow (start -> poll -> Forge links):
```bash
./scripts/finals_flow.sh "Your Research Topic"
```

Consensus preflight checks:
```bash
# Config-only readiness (no model calls)
curl -s "http://localhost:8000/api/health/consensus" | jq

# Live probe (lightweight calls to configured providers)
curl -s "http://localhost:8000/api/health/consensus?probe=true" | jq
```

Attestation preflight checks:
```bash
# Config-only readiness
curl -s "http://localhost:8000/api/health/attestation" | jq

# Live Eigen endpoint probe (when using eigencompute mode)
curl -s "http://localhost:8000/api/health/attestation?probe=true" | jq
```

## 🛡️ Core Principles
- **Enhancement First**: Prioritize improving existing components.
- **Aggressive Consolidation**: Delete unnecessary code; no bloat.
- **Privacy First**: Primary inference routed via Venice AI.
- **Fact-Checked**: Every report undergoes a dedicated validation node.

---

Built for the [Moltiverse Hackathon](https://moltiverse.dev) (Agent Track) on **Monad** and the [EigenCloud Open Innovation Challenge](https://x.com/eigencloud/status/2022385148189397227).

**Monad Testnet**: Chain ID `10143` | RPC `https://testnet-rpc.monad.xyz` | [Explorer](https://testnet.monadexplorer.com)
