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
- [ ] **Alpha API**: Create a specialized `/api/agent/alpha` endpoint that returns a concise, signed JSON suitable for `nad.fun` launch agents.
- [ ] **Permanent Proof URL**: Implement a public `/proof/[queryId]` page that displays the multi-model consensus for any token to link to.
- [ ] **Agent Wallet (Treasury)**: Maintain the Monad wallet to receive X402 payments from other agents hiring Trende for research.
- [ ] **nad.fun Skill**: Create a `nadfun-skill.json` or `skill.md` that allows Trende to be "installed" by Monad ecosystem bots.

## ⚙️ Infrastructure
- [x] **EigenCompute Dockerization**: Created `.dockerignore` for a lean backend image.
- [ ] **TEE Deployment**: Deploy the container to EigenCompute and verify attestation.
- [x] **Consensus Attestation Wiring**: Attached model-level consensus metadata and attestation payloads to API responses.
- [x] **Attestation Service Abstraction**: Added pluggable provider flow (`local_hmac` fallback + `eigencompute` endpoint hook).
- [x] **Verification Endpoint**: Added `/api/attest/verify` to validate attestation payloads.
- [ ] **OpenRouter Free Fallback**: Implement logic to switch to `free` models if balance is low.
- [ ] **Sovereign Persona**: Define the "Trende Bot" personality for social posts.

---
*Follow the Core Principles: Enhancement First, DRY, Clean, Modular, Performant.*
