# ACP Integration Plan for Trende

## Overview

Integrate Trende as a Provider Agent in Virtuals Protocol's Agent Commerce Protocol (ACP) to enable autonomous AI agents to purchase research services.

---

## Phase 1: Registration & Setup

### 1.1 Agent Registration

**Platform**: https://app.virtuals.io

**Steps**:
1. Connect wallet (MetaMask/WalletConnect)
2. Click "Join ACP" → "Build" tab
3. Register New Agent with:
   - **Profile Picture**: Trende logo (JPG/PNG, max 50KB)
   - **Agent Name**: "Trende Research Agent"
   - **Agent Role**: Provider (seller of services)
   - **Description**: "TEE-attested multi-platform research with cryptographic verification"

4. Connect social accounts:
   - X (Twitter) - for mentions and alerts
   - Telegram - for failure notifications (3+ failed jobs)

### 1.2 Service Definition

**Service Name**: "Multi-Platform Research Report"

**Description**:
```
Autonomous research across Twitter/X, TikTok, LinkedIn, and Web with multi-model 
AI consensus (Venice, AIsa, OpenRouter). Every report includes TEE attestation 
with cryptographic signature for verifiable provenance.

Perfect for: Trading decisions, market sentiment, trend analysis, due diligence.
```

**Input Schema**:
```json
{
  "query": "string (required) - Research topic or question",
  "platforms": "array (optional) - ['twitter', 'tiktok', 'linkedin', 'web']",
  "depth": "string (optional) - 'standard' or 'deep'"
}
```

**Output Schema**:
```json
{
  "summary": "string - Consensus research report",
  "attestation_id": "string - Unique attestation identifier",
  "proof_url": "string - Verifiable proof URL",
  "confidence_score": "number - 0.0 to 1.0",
  "signature": "string - Cryptographic signature",
  "providers": "array - AI models used in consensus"
}
```

**Pricing**: $10.00 USDC per report
**SLA**: 180 seconds (3 minutes)

---

## Phase 2: ACP SDK Integration

### 2.1 Install ACP SDK

```bash
cd backend
pip install virtuals-acp-sdk
```

### 2.2 Create ACP Service Module

**File**: `backend/services/acp_service.py`

This will handle:
- ACP request parsing
- Job acceptance/rejection logic
- Deliverable submission
- Error handling

### 2.3 Create ACP API Endpoint

**File**: `backend/api/routes/acp.py`

Endpoints:
- `POST /api/acp/request` - Receive job requests from ACP
- `POST /api/acp/status` - Report job status
- `POST /api/acp/deliver` - Submit completed deliverable

---

## Phase 3: Integration Architecture

### 3.1 Flow Diagram

```
ACP Network (Butler/Other Agents)
         ↓
    [POST /api/acp/request]
         ↓
    ACP Service Layer
         ↓
    Existing Trende Workflow
    (Research → Consensus → Attestation)
         ↓
    [POST /api/acp/deliver]
         ↓
    ACP Network (Evaluation)
         ↓
    Payment Settlement ($USDC)
```

### 3.2 Request Flow

1. **ACP sends request** → `/api/acp/request`
2. **Validate request** → Check schema, pricing, SLA
3. **Accept job** → Return job_id to ACP
4. **Execute research** → Use existing `/api/trends/start`
5. **Wait for completion** → Poll `/api/trends/status/{task_id}`
6. **Format deliverable** → Convert to ACP format
7. **Submit to ACP** → `/api/acp/deliver`
8. **Evaluation phase** → ACP verifies deliverable
9. **Payment** → $USDC sent to agent wallet

### 3.3 Data Mapping

**ACP Request → Trende Request**:
```python
acp_request = {
    "job_id": "acp-job-123",
    "service_id": "research-report",
    "input": {
        "query": "What is the sentiment around AI agents?",
        "platforms": ["twitter", "web"]
    },
    "max_price": 10.00,
    "deadline": "2025-02-16T14:00:00Z"
}

trende_request = {
    "idea": acp_request["input"]["query"],
    "platforms": acp_request["input"].get("platforms", ["twitter", "tiktok", "linkedin", "web"]),
    "sponsor": None  # ACP jobs are paid via protocol
}
```

**Trende Response → ACP Deliverable**:
```python
trende_response = {
    "query": {...},
    "summary": {
        "overview": "...",
        "attestationData": {...},
        "confidenceScore": 0.85
    }
}

acp_deliverable = {
    "job_id": "acp-job-123",
    "status": "completed",
    "output": {
        "summary": trende_response["summary"]["overview"],
        "attestation_id": trende_response["summary"]["attestationData"]["attestation_id"],
        "proof_url": f"https://trende.famile.xyz/proof/{query_id}",
        "confidence_score": trende_response["summary"]["confidenceScore"],
        "signature": trende_response["summary"]["attestationData"]["signature"],
        "providers": trende_response["summary"]["attestationData"]["payload"]["providers"]
    },
    "metadata": {
        "execution_time": 145,  # seconds
        "attestation_method": "tee-attestation",
        "signer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    }
}
```

---

## Phase 4: Implementation Tasks

### 4.1 Backend Changes

**New Files**:
- [ ] `backend/services/acp_service.py` - ACP SDK wrapper
- [ ] `backend/api/routes/acp.py` - ACP endpoints
- [ ] `backend/models/acp_models.py` - Pydantic models for ACP

**Modified Files**:
- [ ] `backend/api/main.py` - Register ACP routes
- [ ] `backend/requirements.txt` - Add ACP SDK
- [ ] `.env` - Add ACP configuration

**Environment Variables**:
```bash
# ACP Configuration
ACP_AGENT_ID=trende-research-agent
ACP_WALLET_ADDRESS=0x...
ACP_WALLET_PRIVATE_KEY=...
ACP_SERVICE_PRICE=10.00
ACP_SERVICE_SLA_SECONDS=180
ACP_ENABLED=true
```

### 4.2 Testing Strategy

**Unit Tests**:
- [ ] Test ACP request parsing
- [ ] Test deliverable formatting
- [ ] Test error handling

**Integration Tests**:
- [ ] Test with ACP sandbox agents
- [ ] Test end-to-end flow
- [ ] Test payment settlement

**Sandbox Testing**:
- [ ] Register test agent on ACP
- [ ] Set service price to $0.01
- [ ] Test with other sandbox agents
- [ ] Verify deliverable acceptance

---

## Phase 5: Deployment

### 5.1 Production Checklist

- [ ] ACP agent registered and verified
- [ ] Wallet funded with gas (Base network)
- [ ] Service listed on aGDP.io
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Graduated from sandbox (10+ successful jobs)

### 5.2 Monitoring

**Metrics to Track**:
- Jobs received per day
- Jobs completed successfully
- Average execution time
- Revenue earned ($USDC)
- Failure rate
- Customer satisfaction (evaluation scores)

**Alerts**:
- 3 consecutive failures → Telegram alert
- 10 failures → Risk of ungraduation
- Low wallet balance → Need gas refill
- SLA violations → Performance issue

---

## Phase 6: Graduation & Scaling

### 6.1 Graduation Requirements

To appear in "Agent to Agent" view (not just Sandbox):
- Complete 10+ jobs successfully
- Maintain <10% failure rate
- Meet SLA consistently
- Pass evaluation phase

### 6.2 Scaling Strategy

**Once Graduated**:
- Butler Agent can route jobs to you (50k+ users)
- Other graduated agents can hire you
- Appear on aGDP.io leaderboard
- Eligible for cluster participation (AHF, AMH)

**Optimization**:
- Cache common queries
- Parallel processing for multiple jobs
- Dynamic pricing based on demand
- Priority queue for high-value jobs

---

## Phase 7: Revenue & Token Economics

### 7.1 Revenue Split

For every $10 USDC job:
- **$1.00** (10%) → Virtuals Treasury
- **$3.00** (30%) → Token buyback (if tokenized)
- **$6.00** (60%) → Agent wallet (Trende)

### 7.2 Monthly Projections

**Conservative** (10 jobs/day):
- 10 × 30 = 300 jobs/month
- 300 × $6 = $1,800/month

**Moderate** (50 jobs/day):
- 50 × 30 = 1,500 jobs/month
- 1,500 × $6 = $9,000/month

**Optimistic** (100 jobs/day):
- 100 × 30 = 3,000 jobs/month
- 3,000 × $6 = $18,000/month

### 7.3 Token Launch Consideration

If we tokenize via 60 Days:
- 30% buyback creates constant buy pressure
- Token holders benefit from agent revenue
- Can participate in clusters (AHF, AMH)
- Eligible for ecosystem airdrops

---

## Phase 8: Risk Management

### 8.1 Technical Risks

**Risk**: ACP request timeout
**Mitigation**: Implement async processing, return job_id immediately

**Risk**: TEE service unavailable
**Mitigation**: Fallback to local_hmac with clear disclosure

**Risk**: High volume overwhelms backend
**Mitigation**: Rate limiting, queue management

### 8.2 Business Risks

**Risk**: Pricing too high/low
**Mitigation**: Start at $10, adjust based on demand

**Risk**: Competition from other research agents
**Mitigation**: TEE attestation as differentiator

**Risk**: Evaluation failures
**Mitigation**: Clear output schema, comprehensive testing

---

## Timeline

### Week 1: Setup & Registration
- Day 1-2: Register on ACP platform
- Day 3-4: Study ACP SDK documentation
- Day 5-7: Design integration architecture

### Week 2: Development
- Day 8-10: Implement ACP service layer
- Day 11-12: Create API endpoints
- Day 13-14: Unit testing

### Week 3: Testing & Deployment
- Day 15-17: Sandbox testing
- Day 18-19: Bug fixes and optimization
- Day 20-21: Production deployment

### Week 4: Graduation & Scaling
- Day 22-28: Complete 10+ jobs
- Day 29-30: Graduate to main network

---

## Success Metrics

### Short-term (First Month)
- [ ] Successfully registered on ACP
- [ ] 10+ jobs completed (graduated)
- [ ] <10% failure rate
- [ ] Listed on aGDP.io
- [ ] First $1,000 revenue

### Medium-term (3 Months)
- [ ] 500+ jobs completed
- [ ] $10,000+ revenue
- [ ] Featured on aGDP leaderboard
- [ ] Positive evaluation scores
- [ ] Butler integration active

### Long-term (6 Months)
- [ ] 2,000+ jobs completed
- [ ] $50,000+ revenue
- [ ] Cluster participation (AHF/AMH)
- [ ] Token launch consideration
- [ ] Top 10 provider agent

---

## Next Immediate Actions

1. **Register on ACP** - https://app.virtuals.io
2. **Create wallet** - For receiving payments
3. **Install ACP SDK** - `pip install virtuals-acp-sdk`
4. **Review SDK examples** - https://github.com/Virtual-Protocol/openclaw-acp
5. **Start implementation** - Begin with `acp_service.py`

Ready to proceed with implementation?
