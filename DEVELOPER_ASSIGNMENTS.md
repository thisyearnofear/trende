# Developer Assignment Document

## Project: Multi-Platform Trend Intelligence Platform

**Core Principles (Mandatory)**
- 🔧 **ENHANCEMENT FIRST**: Always prioritize enhancing existing components over creating new ones
- 🗑️ **CONSOLIDATION**: Delete unnecessary code rather than deprecating
- 🚫 **PREVENT BLOAT**: Systematically audit and consolidate before adding new features
- 🔄 **DRY**: Single source of truth for all shared logic
- 🧹 **CLEAN**: Clear separation of concerns with explicit dependencies
- 🧩 **MODULAR**: Composable, testable, independent modules
- ⚡ **PERFORMANT**: Adaptive loading, caching, and resource optimization
- 📂 **ORGANIZED**: Predictable file structure with domain-driven design

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
│     COMPLETE ✅                                                            │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │     SHARED CORE (DRY)           │
                    │  ✅ Domain Models                 │
                    │  ✅ Configuration                 │
                    │  ✅ Exception Classes             │
                    └─────────────────────────────────┘
                                      │
┌─────────────────────────────────────┴───────────────────────────────────────┐
│                           BACKEND (Python/Agents)                          │
│              Developer 2: Agent Orchestration + Data Layer                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Current Progress Summary

### ✅ COMPLETED

| Developer | Component | Status |
|-----------|------------|--------|
| **Dev 1 (Frontend)** | Next.js App | ✅ Complete |
| **Shared** | Domain Models | ✅ Complete |
| **Dev 2** | FastAPI Entry Point | ✅ Complete |
| **Dev 2** | LangGraph Workflow | ✅ Complete |
| **Dev 2** | x402 Payment Integration | ✅ Complete |
| **Dev 2** | Vector Store (RAG) | ✅ Complete |
| **Dev 2** | Database Persistence | ✅ Complete |
| **Dev 3** | BaseConnector Interface | ✅ Complete |
| **Dev 3** | Twitter / News Connectors | ✅ Complete |
| **Dev 3** | Rate Limiting | ✅ Complete |
| **Dev 3** | Auth Manager | ✅ Complete |

### 🔄 IN PROGRESS

| Developer | Component | Status |
|-----------|------------|--------|
| **Dev 3** | LinkedIn Connector (Composio) | 🔄 In Progress |
| **Dev 2** | GraphState Recovery | 🔄 In Progress |

### ⏳ PENDING

| Developer | Component | Status |
|-----------|------------|--------|
| **All** | Production Deployment | ⏳ Pending |
| **Dev 2** | Advanced Validator Node | ⏳ Pending |

---

## Developer Tracks

### 🟢 DEVELOPER 1: Frontend & UI/UX ✅ COMPLETE

#### Completed Deliverables
- [x] Next.js app with App Router structure
- [x] Dashboard with platform-specific tabs
- [x] Query input component with suggestions
- [x] Content cards with embeds
- [x] Auto-refresh mechanism (30s polling)
- [x] Loading states and error handling UI
- [x] History sidebar

#### Frontend Structure
```
frontend/
├── app/
│   ├── layout.tsx              # Root layout (dark theme)
│   └── page.tsx               # Main dashboard
├── components/
│   ├── QueryInput.tsx          # Idea submission + platform selection
│   ├── PlatformTabs.tsx       # Tabbed results by platform
│   ├── ContentCard.tsx        # Individual trend items
│   ├── TrendSummary.tsx       # AI analysis display
│   └── ProcessingStatus.tsx   # Real-time progress
├── hooks/
│   └── useTrendData.ts        # SWR + SSE hooks
├── lib/
│   ├── types.ts               # TypeScript types
│   └── api.ts                 # API client
└── .env.local.example
```

---

### 🔵 DEVELOPER 2: Agent Orchestration & Data Layer

#### Completed Deliverables
- [x] **LangGraph Workflow**: planner → researcher → analyzer pipeline
- [x] **FastAPI Endpoints**:
  - `POST /api/trends/start` - Returns `task_id` for background processing
  - `GET /api/trends/status/{task_id}` - Get task status
  - `GET /api/trends/stream/{task_id}` - SSE for real-time updates
- [x] **x402 Payment Integration**: Payment handshake for monetization
- [x] **AI Service**: LLM integration for analysis

#### Pending Deliverables
- [ ] **GET /api/trends/history** - Searchable history endpoint
- [ ] **GET /api/trends/{task_id}** - Get full results
- [ ] **Vector Integration**: ChromaDB/Pinecone for RAG
- [ ] **Database Persistence**: Store query history

#### Current Backend Structure
```
backend/
├── agents/
│   ├── workflow.py            # LangGraph (planner → researcher → analyzer)
│   └── state.py               # GraphState definition
├── api/
│   └── main.py                # FastAPI with SSE + x402
├── services/
│   ├── ai_service.py          # LLM wrapper
│   └── x402_service.py       # Payment verification
├── integrations/
│   └── connectors/
│       └── twitter.py         # Twitter connector
└── requirements.txt
```

#### API Contract (ACTUAL - Updated for Frontend)

```typescript
// Frontend expects this from /api/trends/{task_id}
interface TaskResponse {
  task_id: string;
  status: 'pending' | 'planning' | 'researching' | 'analyzing' | 'completed' | 'failed';
  logs: string[];
  result?: {
    items: TrendItem[];
    summary: string;
    relevance_score: number;
    impact_score: number;
    final_report_md?: string;
  };
  error?: string;
}

// Frontend sends this to /api/trends/start
interface StartRequest {
  topic: string;
  platforms: string[];  // ["twitter", "news", "linkedin"]
}

// Frontend receives this from /api/trends/start  
interface StartResponse {
  task_id: string;
}
```

---

### 🟣 DEVELOPER 3: Integration Layer

#### Completed Deliverables
- [x] **BaseConnector Interface**: Abstract class for platform connectors
- [x] **TwitterConnector**: RapidAPI-based implementation

#### Pending Deliverables
- [ ] **LinkedInConnector**: Composio toolkit
- [ ] **NewsConnector**: NewsAPI + Tavily fallback
- [ ] **WebSearchConnector**: Serper/Tavily
- [ ] **Rate Limiting**: Token bucket implementation
- [ ] **Auth Manager**: Credential rotation

---

## Workflow Integration

### Current API Flow
```
Frontend                           Backend
   │                                  │
   ├─ POST /api/trends/start ──────► │
   │   (with x402 payment)            │
   │◄──── { task_id } ───────────────┤
   │                                  │
   ├─ GET /api/trends/stream/{id} ──►│ (SSE)
   │◄──── real-time logs ────────────┤
   │                                  │
   ├─ GET /api/trends/status/{id} ──►│
   │◄──── { status, logs } ───────────┤
```

### What Developer 2 Needs to Fix

The frontend `lib/api.ts` expects these endpoints:
```typescript
// Current - what frontend expects
api.startAnalysis(request)      // POST /api/trends/start
api.getResults(queryId)        // GET /api/trends/{queryId}
api.getStatus(queryId)         // GET /api/trends/status/{queryId}
api.getHistory()              // GET /api/trends/history
api.subscribeToStream(queryId) // GET /api/trends/stream/{queryId}
```

The backend currently has:
```python
# Current - what backend provides
POST /api/trends/start       ✅ (needs /api/ prefix)
GET /api/trends/status/{id}  ✅
GET /api/trends/stream/{id}  ✅
GET /api/trends/{id}         ❌ MISSING
GET /api/trends/history      ❌ MISSING
```

---

## Critical Path Items

### 🔴 Priority 1: Fix Backend API (Dev 2)

1. Add missing endpoints:
   - `GET /api/trends/{task_id}` - Return full results in frontend-compatible format
   - `GET /api/trends/history` - Return list of past queries

2. Update response format to match frontend expectations

### 🟡 Priority 2: Complete Connectors (Dev 3)

1. Implement LinkedInConnector
2. Implement NewsConnector  
3. Add to workflow.py

### 🟢 Priority 3: Polish (All)

1. Add vector store for RAG
2. Add database persistence
3. Add rate limiting

---

## Implementation Order

```
Day 1:
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dev 2: Fix API endpoints (/trends/{id}, /trends/history)                  │
│  Dev 3: Implement LinkedInConnector + NewsConnector                        │
│  Dev 1: Test integration, fix any mismatches                                │
└─────────────────────────────────────────────────────────────────────────────┘

Day 2:
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dev 2: Add vector store, database persistence                              │
│  Dev 3: Add rate limiting, auth manager                                     │
│  Dev 1: Add embed rendering improvements                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Day 3:
┌─────────────────────────────────────────────────────────────────────────────┐
│  All: End-to-end testing                                                    │
│  All: Deployment setup                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Code Review Checklist

Before merging ANY code, verify:

- [ ] **ENHANCEMENT FIRST**: Could this use an existing component instead?
- [ ] **CONSOLIDATION**: Did you delete deprecated code?
- [ ] **DRY**: Is there duplicate logic that should be shared?
- [ ] **MODULAR**: Can this be tested independently?
- [ ] **CLEAN**: Are dependencies explicit (imports)?
- [ ] **PERFORMANT**: Any unnecessary API calls or memory usage?
- [ ] **ORGANIZED**: Does it follow the file structure?

---

## Shared Components

### Domain Models (`shared/models/`)
```python
# Already complete - used by both backend and frontend
from shared.models.models import (
    QueryStatus,
    PlatformType,
    TrendItem,
    TrendResult,
)
```

### Configuration (`shared/config/`)
```python
# Already complete
from shared.config import get_settings
settings = get_settings()
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React, Tailwind, SWR |
| Backend | Python 3.10+, FastAPI, LangGraph |
| Integrations | Composio SDK, RapidAPI, NewsAPI |
| Payments | x402 (EIP-3009) |
| Vector Store | ChromaDB (pending) |
| LLMs | Gemini 1.5 Flash, OpenAI |
| Deployment | Vercel, Railway/Docker |

---

## Quick Start

### Backend
```bash
cd /Users/udingethe/Dev/trende
pip install -r backend/requirements.txt
uvicorn backend.api.main:app --reload
# Runs on http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

---

*Last Updated: 2026-02-16*
*Follow Core Principles: Enhancement First, DRY, Clean, Modular, Performant*
