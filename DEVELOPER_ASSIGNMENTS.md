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
│  Developer 1: UI/UX + Dashboard    │    Developer 3: Integration Layer   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │     SHARED CORE (DRY)           │
                    │  - Domain Models                 │
                    │  - Configuration                 │
                    │  - Utils                         │
                    └─────────────────────────────────┘
                                      │
┌─────────────────────────────────────┴───────────────────────────────────────┐
│                           BACKEND (Python/Agents)                          │
│              Developer 2: Agent Orchestration + Data Layer                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Developer Tracks

### 🟢 DEVELOPER 1: Frontend & UI/UX
**Focus**: Next.js application, user interface, dashboard, real-time updates

#### Responsibilities
1. **Next.js Application** - Build the React frontend from scratch
2. **Dashboard UI** - Create platform tabs, content cards, summaries
3. **Real-time Updates** - Implement polling/WebSocket for live data
4. **Embed Rendering** - Display tweets, LinkedIn posts, news articles
5. **User Input Flow** - Idea submission, query builder UI

#### Deliverables
- [ ] Next.js app with App Router structure
- [ ] Dashboard with platform-specific tabs (Twitter, LinkedIn, News, etc.)
- [ ] Query input component with suggestions
- [ ] Content cards with embeds
- [ ] Auto-refresh mechanism (5min polling)
- [ ] Loading states and error handling UI

#### File Structure Target
```
frontend/
├── app/
│   ├── page.tsx                 # Main dashboard
│   ├── api/
│   │   └── query/route.ts      # Query submission endpoint
│   ├── components/
│   │   ├── QueryInput.tsx
│   │   ├── PlatformTabs.tsx
│   │   ├── ContentCard.tsx
│   │   ├── TrendSummary.tsx
│   │   └── LoadingSpinner.tsx
│   ├── hooks/
│   │   ├── usePolling.ts
│   │   └── useTrendData.ts
│   └── styles/
│       └── globals.css
├── package.json
└── next.config.js
```

#### Dependencies
- Next.js 14+, React 18+
- Tailwind CSS for styling
- SWR or TanStack Query for data fetching
- React Markdown for content rendering

#### API Contract (What Developer 1 expects from Developer 2)
```typescript
interface TrendQuery {
  id: string;
  idea: string;
  platforms: string[];
  createdAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface TrendResult {
  queryId: string;
  platform: 'twitter' | 'linkedin' | 'newsapi';
  items: TrendItem[];
  summary: string;
  relevanceScore: number;
}

interface TrendItem {
  id: string;
  title: string;
  content: string;
  author: string;
  url: string;
  metrics: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
  };
  timestamp: string;
  embedded?: string; // HTML embed code
}
```

---

### 🔵 DEVELOPER 2: Agent Orchestration & Data Layer
**Focus**: Python backend, LangGraph state machine, multi-agent coordination, data persistence

#### Responsibilities
1. **LangGraph State Machine** - Implement a persistent, stateful workflow using LangGraph (replacing sequential scripts).
2. **Multi-Agent Coordination** - Orchestrate specialized agents:
   - **Lead Researcher**: Decides platform priority and search keywords.
   - **Domain Analyst**: Filters noise, calculates influence/impact scores.
   - **Report Architect**: Structures findings into the final MD/JSON format.
3. **Data Persistence (RAG)** - Implement ChromaDB/Pinecone to store historical trends for temporal correlation.
4. **FastAPI Service** - Build a high-performance async API with streaming status updates (Server-Sent Events or WebSockets).
5. **Quality Assurance Agent** - A self-correction node that verifies quotes and sources before finalizing reports.

#### Deliverables
- [ ] **LangGraph Workflow**: query_planner → [research_nodes] → filtering_node → synthesis_node → [validator_node].
- [ ] **State Schema**: Define a robust `GraphState` that tracks search history, raw findings, and conflicting data.
- [ ] **Vector Integration**: RAG implementation to allow "Trend Evolution" queries (e.g., "how has X developed since last month?").
- [ ] **FastAPI Endpoints**:
  - `POST /api/trends/start` - Returns a `task_id` for background processing.
  - `GET /api/trends/stream/{task_id}` - SSE endpoint for real-time agent "thinking" logs.
  - `GET /api/trends/history` - Searchable history of past analyses.
- [ ] **Structured Output**: Pydantic models for every platform to ensure zero-error frontend rendering.

#### File Structure Target
```
backend/
├── agents/
│   ├── workflow.py           # LangGraph graph definition
│   ├── state.py              # GraphState Pydantic models
│   ├── nodes/
│   │   ├── planner.py        # Query breakdown agent
│   │   ├── researchers/      # Platform-specific search agents
│   │   ├── analyzer.py       # Insight extraction & scoring
│   │   └── validator.py      # Fact-checking & quote verification
│   └── prompts.py            # Centralized system prompts
├── api/
│   ├── routes/
│   │   ├── analysis.py       # Long-running task management
│   │   └── reports.py        # Static report retrieval
│   └── main.py               # FastAPI entry point
├── database/
│   ├── vector_store.py       # Chroma/Pinecone logic
│   └── repository.py         # CRUD for reports and metadata
└── services/
    ├── llm_factory.py        # Provider failover (Gemini/OpenAI/Anthropic)
    └── telemetry.py          # LangSmith / Logging integration
```

#### Dependencies
- LangGraph, LangChain
- FastAPI, Uvicorn
- Pydantic v2
- ChromaDB or Pinecone
- Google Generative AI (Gemini 1.5 Flash/Pro)
- OpenAI (GPT-4o)
- Composio (for tool-calling)

#### Shared Interface (What Developer 2 provides to Developer 1)
- Async FastAPI REST API at `http://localhost:8000`
- Server-Sent Events (SSE) for real-time progress updates
- Validated Pydantic models for all responses (see API Contract)

---

### 🟣 DEVELOPER 3: Integration Layer (The Connector Hub)
**Focus**: External APIs, Composio toolkits, rate limiting, and data normalization.

#### Responsibilities
1. **Unified Connector Interface** - Build an abstract `BaseConnector` that handles retries, cooling periods, and error mapping.
2. **Composio Toolkit Management** - Manage tool authentication and dynamic tool loading for Twitter, LinkedIn, and GitHub.
3. **NewsAPI/Serper Integration** - Build custom connectors for broad web searching and news indexing.
4. **Data Normalizer** - Transform heterogeneous API responses (Tweets, News, Posts) into a consistent `PlatformItem` schema.
5. **Proxy/Rate Limit Management** - Implement sophisticated token bucket or sliding window rate limiting.

#### Deliverables
- [ ] **Base Class**: `AbstractPlatformConnector` with async `search` and `fetch_thread` methods.
- [ ] **Connectors**:
  - `TwitterConnector`: RapidAPI + Composio fallback.
  - `LinkedInConnector`: Composio toolkit implementation.
  - `NewsConnector`: NewsAPI.org + Tavily fallback.
- [ ] **Normalizer Module**: Logic to sanitize HTML/Markdown from different sources.
- [ ] **Auth Manager**: Secure credential rotation and health checks for all external keys.

#### File Structure Target
```
backend/
├── integrations/
│   ├── base.py               # Abstract Base Class
│   ├── factory.py            # Dynamic connector instantiation
│   ├── normalizers/          # Platform-specific cleaning logic
│   └── connectors/
│       ├── __init__.py
│       ├── twitter.py
│       ├── linkedin.py
│       ├── newsapi.py
│       └── web_search.py     # Tavily / Serper
└── utils/
    ├── rate_limit.py         # Global rate limiting service
    ├── circuit_breaker.py    # Prevent cascading failures
    └── error_mapper.py       # API Error -> Internal Exception
```

#### Dependencies
- Composio SDK
- httpx for async HTTP
- python-dotenv
- Rate limiting libraries

#### Integration Contract (What Developer 3 provides to Developer 2)
```python
from typing import Protocol, list
from datetime import datetime

class PlatformItem:
    id: str
    platform: str
    title: str
    content: str
    author: str
    url: str
    metrics: dict
    timestamp: datetime
    raw_data: dict  # Original API response

class PlatformConnector(Protocol):
    async def search(self, query: str, limit: int = 10) -> list[PlatformItem]: ...
    async def get_item(self, item_id: str) -> PlatformItem: ...
    @property
    def platform_name(self) -> str: ...

# Usage in workflow:
connectors = {
    'twitter': TwitterConnector(),
    'linkedin': LinkedInConnector(),
    'newsapi': NewsAPIConnector(),
}
```

---

## Shared Components (DRY Principle)

Create these as shared modules that ALL developers use:

### 1. Domain Models (`shared/models/`)
```python
# shared/models/__init__.py
from .query import Query, QueryStatus
from .result import TrendResult, TrendItem
from .platform import Platform, PlatformType

__all__ = ['Query', 'QueryStatus', 'TrendResult', 'TrendItem', 'Platform', 'PlatformType']
```

### 2. Configuration (`shared/config/`)
```python
# shared/config/__init__.py
from .settings import settings

# Single source of truth for all config
```

### 3. Error Handling (`shared/exceptions/`)
```python
# shared/exceptions/__init__.py
class TrendPlatformError(Exception): ...
class RateLimitError(Exception): ...
class ValidationError(Exception): ...
```

---

## Workflow Integration

### How Developer 2 Uses Developer 3's Connectors
```python
# backend/agents/nodes/search.py
from integrations.connectors import twitter, linkedin, newsapi

async def search_node(state: GraphState) -> GraphState:
    query = state['query']
    connectors = [twitter, linkedin, newsapi]
    
    results = await asyncio.gather(
        *[c.search(query, limit=20) for c in connectors]
    )
    
    state['raw_results'] = flatten(results)
    return state
```

### How Developer 1 Uses Developer 2's API
```python
// frontend/hooks/useTrendData.ts
import useSWR from 'swr'

const fetcher = (url) => fetch(url).then(res => res.json())

export function useTrendData(queryId: string) {
  const { data, error, mutate } = useSWR(
    `/api/results/${queryId}`,
    fetcher,
    { refreshInterval: 300000 } // 5 minutes
  )
  
  return { data, error, refresh: mutate }
}
```

---

## Implementation Order (Critical Path)

```
Week 1, Day 1-2:
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dev 3: Set up AbstractPlatformConnector + Twitter/NewsAPI connectors      │
│  Dev 2: Define GraphState + LangGraph skeleton + FastAPI /api/trends/start │
│  Dev 1: Initialize Next.js + Query Input (v1)                              │
└─────────────────────────────────────────────────────────────────────────────┘

Week 1, Day 3-4:
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dev 3: LinkedIn connector + Data Normalizer logic                         │
│  Dev 2: Planner agent + Researcher node integration                       │
│  Dev 1: Streaming status UI (SSE consumer)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Week 1, Day 5:
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dev 3: Rate limiting + Auth rotating manager                              │
│  Dev 2: Analyst node (scoring) + ChromaDB persistence                      │
│  Dev 1: Dashboard results view + Report history                            │
└─────────────────────────────────────────────────────────────────────────────┘

Week 2, Day 1-2:
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dev 3: Dynamic toolkit selector + GitHub/Web connectors                   │
│  Dev 2: Validator agent + Report Architect node                            │
│  Dev 1: Share-to-Twitter/Farcaster rendering                               │
└─────────────────────────────────────────────────────────────────────────────┘

Week 2, Day 3-5:
┌─────────────────────────────────────────────────────────────────────────────┐
│  All: End-to-end integration testing, LangSmith trace auditing            │
│  All: Deployment (Vercel + Railway/Docker)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Code Review Checklist (Enforce Core Principles)

Before merging ANY code, verify:

- [ ] **ENHANCEMENT FIRST**: Could this use an existing component instead?
- [ ] **CONSOLIDATION**: Did you delete deprecated code?
- [ ] **DRY**: Is there duplicate logic that should be shared?
- [ ] **MODULAR**: Can this be tested independently?
- [ ] **CLEAN**: Are dependencies explicit (imports)?
- [ ] **PERFORMANT**: Any unnecessary API calls or memory usage?
- [ ] **ORGANIZED**: Does it follow the file structure?

---

## Communication & Coordination

### Daily Standups
- Each developer reports: What I did → What I'll do → Blockers

### Key Interfaces (Freeze These First)
1. **AbstractPlatformConnector** (Dev 3 → Dev 2)
2. **GraphState & API Contract** (Dev 2 → Dev 1) - **CRITICAL**
3. **Pydantic Platform Models** (Shared)

### Tech Stack Summary
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+, React, Tailwind, SWR/TanStack |
| Backend | Python 3.10+, FastAPI, LangGraph |
| Integrations | Composio SDK, RapidAPI, NewsAPI |
| Payments | **x402 (HTTP 402 + EIP-3009)** for Inference Monetization |
| Infrastructure| **OpenClaw** (Agent OS) + FastAPI Gateway |
| Vector Store | ChromaDB (Local) or Pinecone |
| LLMs | Gemini 1.5 Flash (Primary), GPT-4o (Validator) |
| Deployment | Vercel (Frontend), Railway (Backend) |

---

## Infrastructure Strategy: OpenClaw vs. Cloud
To optimize for **sovereignty** and **real-world functionality**, we are adopting a **Hybrid Sovereign Agent Architecture**:

1. **FastAPI Gateway (Hosted)**: Acts as the public portal. It handles the **x402 Payment Handshake**. When a request hits `/api/trends/start`, the gateway verifies the EIP-3009 signature before spinning up the agent.
2. **OpenClaw Runtime (Local/VPS)**: The actual Trend Agent runs inside an **OpenClaw** instance. This provides:
   - **Session Sandbox**: Safe tool execution.
   - **Markdown Memory**: Distilled trend knowledge saved as local files.
   - **Multi-channel**: Ability to notify the user via Telegram/Slack when a trend report is ready.
3. **Composio (Tooling)**: We leverage Composio to handle OAuth and authentication for Twitter/LinkedIn, removing the need for us to manage complex session cookies manually.

---

## Immediate First Steps (Day 1)

1. **Dev 2 (Antigravity)**: Initialize `backend/` directory structure and define `GraphState`.
2. **Dev 3**: Set up `AbstractPlatformConnector` and test Twitter RapidAPI connectivity.
3. **Dev 1 (User)**: Initialize `frontend/` and design the Query Input component.
4. **All**: Audit existing `main.py` and `twitter_lists.py` to extract curated data into the new system.

---

*Last Updated: 2026-02-15*
*Follow Core Principles: Enhancement First, DRY, Clean, Modular, Performant*
