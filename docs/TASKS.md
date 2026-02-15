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

## 🟢 Priority 3: Monad & nad.fun
- [ ] **nad.fun Payload**: Research the `nad.fun` contract/API parameters for launching tokens.
- [ ] **X402 Settlement**: Add Monad Testnet support to `x402_service.py`.

## ⚙️ Infrastructure
- [x] **EigenCompute Dockerization**: Created `.dockerignore` for a lean backend image.
- [ ] **TEE Deployment**: Deploy the container to EigenCompute and verify attestation.
- [ ] **Consensus Attestation Wiring**: Attach model-level consensus metadata and attestation payloads to API responses.
- [ ] **OpenRouter Free Fallback**: Implement logic to switch to `free` models if balance is low.
- [ ] **Sovereign Persona**: Define the "Trende Bot" personality for social posts.

---
*Follow the Core Principles: Enhancement First, DRY, Clean, Modular, Performant.*
