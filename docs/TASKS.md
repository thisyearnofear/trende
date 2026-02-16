# Tactical Task List

## 🔴 Priority 1: Bridging & Input Scope
- [x] **Connector expansion**: Added TikTok and YouTube metadata connectors via AIsa search.
- [x] **Platform Toggle**: Updated `QueryInput.tsx` with the new "Universe Selectors."
- [ ] **Venice Stability**: Ensure Venice model IDs are dynamically updated from the API to prevent 404s.

## 🟡 Priority 2: Verifiable Synthesis & The Architect
- [ ] **Consensus Node**: Implement parallel multi-provider requests in `ai_service.py` and a consolidation node in the workflow.
- [ ] **Architect Logic**: Expand `architect.py` to support "Verified News" output mode.
- [x] **Frontend Viewer**: Created `/meme/[queryId]` with a high-conviction "Alpha Page" format.
- [x] **Dual Output Toggle**: Added Meme Thesis and Verifiable News Synthesizer modes in the Forge UI.
- [x] **Verification Detail UX**: Added verification details modal and attestation check action in Forge news mode.

## 🟢 Priority 3: Agentic Interoperability (A2A)
- [x] **Alpha API**: Create a specialized `/api/agent/alpha` endpoint that returns a concise, signed JSON suitable for `nad.fun` launch agents.
- [x] **Permanent Proof URL**: Implement a public `/proof/[queryId]` page that displays the multi-model consensus for any token to link to.
- [ ] **Agent Wallet (Treasury)**: Maintain the Monad wallet to receive X402 payments from other agents hiring Trende for research.
- [x] **nad.fun Skill**: Created `llms.txt` and `docs/skills/alpha.md` to list Trende as a hireable skill for Monad bots.

## ⚙️ Infrastructure
- [x] **ecloud CLI Migration**: Installed `@layr-labs/ecloud-cli` and locked the key standard.
- [ ] **Baseline Dry Run**: Deploy `baseline-attested` (attested-api template) to Sepolia using `ecloud deploy`.
- [ ] **Staging Switch**: Point `ATTESTATION_PROVIDER` to `eigencompute` in a TEE environment.
- [ ] **Production Hardening**: Use verifiable builds, pinned digests, and restricted log visibility.
- [ ] **CI Integration**: Add checks to fail deploy if attestation verification fails.
- [ ] **Sovereign Persona**: Define the "Trende Bot" personality for social posts.

---
*Follow the Core Principles: Enhancement First, DRY, Clean, Modular, Performant.*
