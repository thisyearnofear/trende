# Phase 2a: Backend Modularization Plan

## Current State
- `backend/api/main.py`: 2,916 lines (too large, hard to maintain)
- All routes, models, helpers in one file
- Successfully deployed and running

## Target Structure

### Core Files
```
backend/api/
├── main.py                 (~150 lines: app setup, lifespan, middleware)
├── models.py              (Pydantic request/response models) ✅ CREATED
├── helpers.py             (Utility functions)
└── routes/
    ├── __init__.py
    ├── trends.py          (start, status, results, export, save, history, ask) ✅ STARTED
    ├── health.py          (attestation, consensus, runs, synthdata)
    ├── actions.py         (agent actions, sentinel, oracle staging)
    ├── markets.py         (polymarket, kalshi scoring)
    ├── user.py            (rate limiting, wallet)
    └── telemetry.py       (research events)
```

## Models to Extract (✅ Done)
- [x] QueryRequest
- [x] AttestationVerifyRequest  
- [x] SaveResearchRequest
- [x] ActionSubmitRequest
- [x] ResearchTelemetryRequest (renamed from MissionTelemetryRequest)
- [x] PublishRequest
- [x] SynthDataForecastRequest
- [x] AskTrendeRequest

## Helper Functions to Extract
- [ ] `_env_flag()` - Environment variable parsing
- [ ] `_extract_task_findings()` - Task data extraction
- [ ] `_build_podcast_payload()` - Podcast generation
- [ ] `_mark_task_failed()` - Error handling
- [ ] `_get_task()`, `_save_task()`, `_update_task()` - Task cache management
- [ ] `_normalize_key_parts()` - Data normalization
- [ ] `_find_matching_active_task()` - Task deduplication
- [ ] `_parse_iso()` - Date parsing
- [ ] `_provider_failure_rate()` - Consensus metrics
- [ ] `_extract_chainlink_proof()` - Chainlink data extraction
- [ ] `_derive_chainlink_stage()` - Chainlink status
- [ ] `_task_runtime_alerts()` - Runtime monitoring
- [ ] `_estimate_live_progress()` - Progress calculation
- [ ] `_derive_top_trends_from_findings()` - Trend extraction
- [ ] `_derive_source_breakdown()` - Source analytics
- [ ] `_tokenize_market_text()`, `_has_market_intent()` - Market detection
- [ ] `_normalize_probability()`, `_parse_market_dt()` - Market data parsing
- [ ] `_score_market_fit()` - Market scoring
- [ ] `_configured_consensus_routes()` - Consensus configuration

## Routes to Extract

### trends.py (~400 lines)
- [ ] `POST /api/trends/start` - Start research
- [ ] `GET /api/trends/{task_id}` - Get status
- [ ] `GET /api/trends/{task_id}/export` - Export report
- [ ] `POST /api/trends/{task_id}/save` - Save to vault
- [ ] `GET /api/trends/history` - Get history
- [ ] `GET /api/trends/saved` - Get saved research
- [ ] `POST /api/trends/{task_id}/ask` - Ask Trende AI
- [ ] `POST /api/trends/{task_id}/publish` - Publish to external platforms

### health.py (~200 lines)
- [ ] `GET /api/health/attestation` - TEE attestation status
- [ ] `GET /api/health/consensus` - Consensus health
- [ ] `GET /api/health/runs` - Recent runs
- [ ] `POST /api/health/attestation/verify` - Verify attestation
- [ ] `GET /api/health/synthdata/forecast` - SynthData forecast

### actions.py (~300 lines)
- [ ] `POST /api/actions/submit` - Submit agent action
- [ ] `GET /api/actions/{action_id}` - Get action status
- [ ] `GET /api/actions/task/{task_id}` - Get task actions
- [ ] Background: `run_agent_action()` - Execute actions
- [ ] Background: `_sentinel_loop()` - Autonomous oracle resolution

### markets.py (~400 lines)
- [ ] `GET /api/markets/polymarket/search` - Search Polymarket
- [ ] `GET /api/markets/kalshi/search` - Search Kalshi
- [ ] `POST /api/markets/stage` - Stage oracle market
- [ ] Helper: `_score_market_fit()` - Market scoring logic

### user.py (~100 lines)
- [ ] `GET /api/user/rate-limit` - Get rate limit info
- [ ] Middleware: `check_rate_limit()` - Rate limiting
- [ ] Helper: `get_client_ip()` - IP extraction

### telemetry.py (~50 lines)
- [ ] `POST /api/telemetry/research-event` - Log research events

## Migration Strategy

1. **Phase 1: Models** ✅ DONE
   - Extract all Pydantic models to `models.py`
   - Update imports in main.py

2. **Phase 2: Helpers**
   - Extract utility functions to `helpers.py`
   - Update imports in main.py

3. **Phase 3: Routes (one at a time)**
   - Start with simplest: telemetry.py
   - Then: health.py, user.py
   - Then: trends.py (largest, most complex)
   - Then: actions.py, markets.py
   - Test after each extraction

4. **Phase 4: Main.py Cleanup**
   - Keep only: app setup, lifespan, middleware, router includes
   - Target: ~150 lines

## Testing Checklist
- [ ] All endpoints respond correctly
- [ ] Rate limiting works
- [ ] TEE attestation works
- [ ] Consensus routes work
- [ ] Research workflow completes
- [ ] Export functionality works
- [ ] Agent actions execute
- [ ] Sentinel loop runs
- [ ] No circular import issues

## Benefits
- Easier to navigate and maintain
- Better separation of concerns
- Easier to test individual components
- Faster development velocity
- Clearer code ownership

## Risks
- Circular import issues (mitigate with lazy imports)
- Breaking existing functionality (mitigate with comprehensive testing)
- Deployment downtime (mitigate with careful rollout)

## Next Steps
1. Complete helpers.py extraction
2. Extract telemetry.py (simplest route)
3. Test thoroughly
4. Continue with other routes one by one
5. Deploy incrementally with rollback plan
