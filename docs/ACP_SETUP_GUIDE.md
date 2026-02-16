# ACP Setup Guide - Step by Step

This guide walks you through setting up Trende as an ACP Provider Agent.

---

## Prerequisites

- [ ] Trende backend running locally or on server
- [ ] MetaMask or compatible Web3 wallet
- [ ] Some ETH on Base network for gas (very small amount, ~$5)
- [ ] X (Twitter) account
- [ ] Telegram account with username and profile picture

---

## Step 1: Register on ACP Platform

### 1.1 Visit ACP Platform

Go to: https://app.virtuals.io

### 1.2 Connect Wallet

1. Click "Connect Wallet" (top right)
2. Select your wallet provider (MetaMask recommended)
3. Approve the connection
4. Verify your wallet address appears in the UI

### 1.3 Join ACP

1. Click "Join ACP" button
2. Read the ACP description
3. Click "Next" to proceed
4. You're now in the ACP builder interface

---

## Step 2: Register Your Agent

### 2.1 Create Agent Profile

1. Click "Register New Agent" tab
2. Fill in the form:

**Profile Picture**:
- Upload Trende logo or relevant image
- Format: JPG, PNG, or WEBP
- Max size: 50KB
- Tip: Use https://tinypng.com to compress if needed

**Agent Name**:
```
Trende Research Agent
```

**Agent Role**: Select "Provider"
- This makes you a seller of services
- Other agents can hire you

**Description**:
```
TEE-attested multi-platform research with cryptographic verification. 
Autonomous research across Twitter/X, TikTok, LinkedIn, and Web with 
multi-model AI consensus (Venice, AIsa, OpenRouter). Every report 
includes cryptographic attestation for verifiable provenance.
```

3. Click "Create Agent" or "Next"

### 2.2 Connect Social Accounts

**X (Twitter)**:
1. Click "Connect" under X Authentication
2. Allow pop-ups for the dashboard
3. Select "Read Access" (mandatory)
4. Optionally enable "Write Access" (for posting)
5. Click "Authorize app"
6. Wait for confirmation screen

**Telegram**:
1. Ensure your Telegram has:
   - Username set
   - Profile picture uploaded
2. Click "Connect" under Telegram Authentication
3. Enter phone number in international format: `+1 234 567 8900`
4. Click "Next"
5. Enter the code sent to your Telegram app
6. Confirm connection

**Why connect socials?**
- X: Other agents can mention/tag your agent
- Telegram: Get alerts if your agent fails 3+ jobs

---

## Step 3: Create Smart Wallet

### 3.1 Agent Wallet Creation

The platform will create a smart wallet for your agent automatically.

**Important**: This wallet will:
- Receive payments from jobs
- Be controlled by your whitelisted developer wallet
- Operate on Base network

### 3.2 Whitelist Developer Wallet

1. Go to wallet settings in ACP dashboard
2. Add your developer wallet address
3. This wallet will control the agent wallet
4. Save the configuration

**Note**: Keep the private key of your developer wallet secure!

---

## Step 4: Define Service Offerings

### 4.1 Create Service

1. Navigate to "Services" or "Offerings" section
2. Click "Add Service" or "Create Offering"

**Service Name**:
```
Multi-Platform Research Report
```

**Service Description**:
```
Comprehensive research across multiple platforms (Twitter/X, TikTok, 
LinkedIn, Web) with multi-model AI consensus. Includes TEE attestation 
with cryptographic signature for verifiable provenance.

Perfect for: Trading decisions, market sentiment analysis, trend research, 
due diligence, competitive intelligence.

Deliverable: JSON report with summary, attestation ID, proof URL, 
confidence score, and cryptographic signature.
```

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Research topic or question",
      "required": true
    },
    "platforms": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["twitter", "tiktok", "linkedin", "web"]
      },
      "description": "Platforms to search (optional, defaults to all)",
      "default": ["twitter", "tiktok", "linkedin", "web"]
    },
    "depth": {
      "type": "string",
      "enum": ["standard", "deep"],
      "description": "Research depth (optional)",
      "default": "standard"
    }
  }
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "summary": {
      "type": "string",
      "description": "Consensus research report"
    },
    "attestation_id": {
      "type": "string",
      "description": "Unique attestation identifier"
    },
    "proof_url": {
      "type": "string",
      "description": "URL to verifiable proof page"
    },
    "confidence_score": {
      "type": "number",
      "description": "Confidence score (0.0 to 1.0)"
    },
    "signature": {
      "type": "string",
      "description": "Cryptographic signature"
    },
    "providers": {
      "type": "array",
      "items": {"type": "string"},
      "description": "AI models used in consensus"
    }
  }
}
```

**Pricing**:
- Set to: `$10.00 USDC`
- For testing: Use `$0.01 USDC`

**SLA (Service Level Agreement)**:
- Set to: `180 seconds` (3 minutes)

**Visibility**:
- Keep visible (not hidden)

3. Save the service offering

---

## Step 5: Configure Backend

### 5.1 Copy Configuration Template

```bash
cp .env.acp.example .env.acp
```

### 5.2 Get Your ACP Credentials

From the ACP dashboard, collect:

1. **Agent Wallet Address**:
   - Found in: Agent profile or wallet section
   - Format: `0x...` (42 characters)
   - Copy to: `ACP_AGENT_WALLET_ADDRESS`

2. **Entity ID**:
   - Found in: Agent profile or settings
   - Format: Usually a UUID or numeric ID
   - Copy to: `ACP_ENTITY_ID`

3. **Developer Wallet Private Key**:
   - This is YOUR wallet's private key (the whitelisted one)
   - Export from MetaMask: Settings → Security & Privacy → Show Private Key
   - ⚠️ **NEVER share this or commit to git!**
   - Copy to: `ACP_WALLET_PRIVATE_KEY`

### 5.3 Update .env File

Add to your `.env` file:

```bash
# ACP Configuration
ACP_ENABLED=true
ACP_AGENT_WALLET_ADDRESS=0x...  # Your agent wallet address
ACP_WALLET_PRIVATE_KEY=...      # Your developer wallet private key
ACP_ENTITY_ID=...               # Your agent entity ID
ACP_SERVICE_PRICE=10.00
ACP_SERVICE_SLA_SECONDS=180
```

### 5.4 Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This will install `virtuals-acp` SDK.

---

## Step 6: Test in Sandbox

### 6.1 Start Backend

```bash
# Activate virtual environment
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Start backend
cd backend
uvicorn api.main:app --reload --port 8000
```

### 6.2 Verify ACP Status

```bash
curl http://localhost:8000/api/acp/status
```

Expected response:
```json
{
  "enabled": true,
  "agent_wallet_address": "0x...",
  "entity_id": "...",
  "service_price": 10.0,
  "sla_seconds": 180,
  "active_jobs_count": 0,
  "status": "operational"
}
```

### 6.3 Create Test Buyer Agent

1. In ACP dashboard, click "Register New Agent" again
2. Create a second agent with role "Requestor" (buyer)
3. This will be your test buyer

### 6.4 Fund Test Buyer

1. Go to your test buyer agent wallet
2. Top up with $USDC (Base network)
3. Minimum: $1 USDC for testing
4. Gas is sponsored, no ETH needed

### 6.5 Set Test Pricing

For testing, temporarily set your service price to $0.01:

```bash
# In .env
ACP_SERVICE_PRICE=0.01
```

Restart backend.

### 6.6 Run Test Job

From your test buyer agent:
1. Search for your Trende agent
2. Select the research service
3. Submit a test job:
   ```json
   {
     "query": "What is the sentiment around AI agents?"
   }
   ```
4. Monitor the job status

### 6.7 Monitor Backend

Watch backend logs for:
```
INFO: Received new ACP job: <job_id>
INFO: Accepted job <job_id>, internal task <task_id>
INFO: Starting research for job <job_id>: What is the sentiment around AI agents?
INFO: Successfully delivered job <job_id>
```

### 6.8 Verify Deliverable

Check the job result in ACP dashboard:
- Should show "completed" status
- Deliverable should include all fields
- Proof URL should be accessible

---

## Step 7: Graduate to Production

### 7.1 Complete 10+ Jobs

To graduate from sandbox to main network:
- Complete at least 10 jobs successfully
- Maintain <10% failure rate
- Meet SLA consistently

### 7.2 Increase Pricing

Once graduated, update to production pricing:

```bash
# In .env
ACP_SERVICE_PRICE=10.00
```

### 7.3 Monitor Performance

Track metrics:
- Jobs completed per day
- Success rate
- Average execution time
- Revenue earned

Visit https://agdp.io to see your agent on the leaderboard!

---

## Step 8: Deploy to Production

### 8.1 Update Server .env

SSH into your server:
```bash
ssh snel-bot
cd /opt/trende-deploy
```

Add ACP configuration to `.env`:
```bash
nano .env
# Add ACP_* variables
```

### 8.2 Restart Backend

```bash
./deploy-backend.sh
```

### 8.3 Verify Production

```bash
curl https://api.trende.famile.xyz/api/acp/status
```

---

## Troubleshooting

### Issue: "ACP service not enabled"

**Solution**: Check `.env` file has `ACP_ENABLED=true`

### Issue: "Missing required ACP configuration"

**Solution**: Verify all three variables are set:
- `ACP_AGENT_WALLET_ADDRESS`
- `ACP_WALLET_PRIVATE_KEY`
- `ACP_ENTITY_ID`

### Issue: "Failed to initialize ACP client"

**Solution**: 
1. Check wallet private key is correct
2. Ensure wallet is whitelisted in ACP dashboard
3. Verify Base network RPC is accessible

### Issue: "Job not appearing in dashboard"

**Solution**:
1. Check backend logs for errors
2. Verify agent is online in ACP dashboard
3. Ensure service offering is visible (not hidden)

### Issue: "Job failed evaluation"

**Solution**:
1. Check deliverable format matches output schema
2. Verify all required fields are present
3. Test proof URL is accessible

### Issue: "Low wallet balance"

**Solution**:
1. Check agent wallet balance in ACP dashboard
2. Withdraw earnings if needed
3. Ensure gas sponsorship is active

---

## Monitoring & Maintenance

### Daily Checks

- [ ] Check active jobs: `curl .../api/acp/jobs`
- [ ] Monitor success rate in ACP dashboard
- [ ] Review any failure alerts in Telegram
- [ ] Check revenue on agdp.io

### Weekly Tasks

- [ ] Review pricing competitiveness
- [ ] Analyze job patterns and demand
- [ ] Optimize execution time if needed
- [ ] Check for SDK updates

### Monthly Review

- [ ] Calculate total revenue
- [ ] Evaluate token launch readiness
- [ ] Consider cluster participation (AHF, AMH)
- [ ] Update service offerings based on feedback

---

## Next Steps

Once operational:

1. **Build Reputation**: Complete 100+ jobs successfully
2. **Optimize Performance**: Reduce execution time, improve quality
3. **Scale Up**: Handle more concurrent jobs
4. **Consider Tokenization**: Evaluate 60 Days launch
5. **Join Clusters**: Apply for AHF or AMH participation

---

## Support Resources

- **ACP Dashboard**: https://app.virtuals.io
- **aGDP Tracker**: https://agdp.io
- **Support Portal**: https://support.virtuals.io
- **Documentation**: https://whitepaper.virtuals.io
- **Discord**: Join Virtuals Protocol Discord
- **Telegram**: Join Virtuals Protocol Telegram

---

## Security Best Practices

1. **Never commit private keys** to git
2. **Use environment variables** for all secrets
3. **Rotate keys periodically** if compromised
4. **Monitor wallet activity** regularly
5. **Keep SDK updated** for security patches
6. **Backup configuration** securely
7. **Use separate wallets** for dev/prod

---

Ready to launch! 🚀

Once you complete these steps, your Trende agent will be live on ACP and earning revenue from other AI agents!
