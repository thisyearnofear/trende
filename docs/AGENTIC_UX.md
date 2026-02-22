# Agentic UX Improvement Plan

## Problem Statement

The platform currently feels like a **research dashboard** — a user types → waits → reads results. True agentic UX means the machine **acts on its own**, makes visible decisions, and produces observable on-chain outcomes without constant human oversight.

This is critical for:
- **Chainlink Convergence Hackathon**: "AI agents consuming CRE workflows", "AI-powered prediction market settlement"
- **Arbitrum Open House Buildathon**: "Innovation and Creativity", "Real Problem Solving"

---

## 5-Part Implementation Plan

### ✅ #1 — "Deploy Agent" Language & Mission Dispatch
**Problem**: Submit button says "Execute Mission" — still feels like a search bar.
**Fix**: Reframe the entire input as a **Command Interface**. The user is briefing an agent, not searching.
- Submit button → **"Deploy Agent"** (with rocket icon)
- On dispatch: show **Mission ID** + timestamp toast
- Processing UI header → "Agent Deployed: Mission {ID}"

**Files**: `QueryInput.tsx`, `AgentPersona.tsx`
**Principle**: ENHANCEMENT FIRST — edit existing components only.

---

### ✅ #2 — Oracle Status Banner in ForgeViewer
**Problem**: On-chain market staging happens but there's no visible proof in the UI.
**Fix**: Persistent **Oracle Status Banner** at the top of the ForgeViewer that shows the live on-chain state.

States:
- `staged` → "🟡 Market staged on Arbitrum Sepolia — awaiting oracle data"  
- `resolution_requested` → "🔵 Chainlink DON processing consensus..."
- `resolved` → "✅ Settled on-chain: Score 87/100 — [View on Arbiscan ↗]"

**Files**: `ForgeViewer.tsx` — enhance existing action polling loop.
**Principle**: DRY — reuse existing `actions` state array for oracle state.

---

### ✅ #3 — Sentinel Auto-Resolve Loop (True Backend Autonomy)
**Problem**: Nothing happens unless a human presses a button. Judges need to see autonomous action.
**Fix**: Background asyncio task in the `lifespan` context that:
1. Every 60s, scans for completed research tasks where `oracle_market_id` is set but market is not yet resolved.
2. Automatically calls `resolve_market` via `ChainlinkService`.
3. Logs the autonomous action as a system-generated `AgentAction`.

**Files**: `backend/api/main.py` — add sentinel task to lifespan, clean + modular.
**Principle**: MODULAR — sentinel loop is a self-contained coroutine.

---

### ✅ #4 — Live Agent Reasoning Feed (AgentPersona Enhancement)
**Problem**: `AgentPersona` is a cosmetic status bar that doesn't narrate real decisions.
**Fix**: Enhance with a **scrollable decision log** — each real backend log becomes a timestamped agent narration entry. Agent proactively offers suggestions when done (e.g., "High agreement detected — should I stage this on-chain?").

**Files**: `AgentPersona.tsx`, `ProcessingStatus.tsx`
**Principle**: ENHANCEMENT FIRST — extend existing typewriter + message system.

---

### ✅ #5 — A2A Demo (Agent Playground)
**Problem**: The A2A endpoint `/api/agent/alpha` exists but there's no live demo.
**Fix**: Add an **"Agent API"** tab/section in the ForgeViewer that shows:
- The raw JSON manifest the agent returns
- A copyable `curl` command for other agents to call
- The X402 payment required / status

**Files**: `ForgeViewer.tsx` — enhance existing `fetchAgentAlpha` + `showAgentManifest` state.
**Principle**: DRY — reuse the already-wired `manifestData` state.

---

## Implementation Order

```
1. Docs (this file)                        ← DONE
2. QueryInput: "Deploy Agent" reframe      ← #1
3. ForgeViewer: Oracle Status Banner       ← #2
4. main.py: Sentinel auto-resolve loop     ← #3
5. AgentPersona: Decision feed             ← #4
6. ForgeViewer: A2A Demo tab               ← #5
7. git commit + server deploy
```

## Core Principles Applied

| Principle | Application |
|---|---|
| ENHANCEMENT FIRST | All changes are edits to existing components |
| DRY | Sentinel reuses ChainlinkService; Oracle banner reuses `actions` state |
| MODULAR | Sentinel is a standalone coroutine; Oracle banner is a derived view |
| PERFORMANT | Sentinel uses exponential polling, not a tight loop |
| CLEAN | Each concern (sentinel / oracle UX / A2A) is clearly separated |
