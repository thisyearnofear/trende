# Production Readiness Checklist

## Backend

### Core API
- ✅ Backend deployed on Hetzner
- ✅ Running on port 8000
- ✅ Health endpoints responding
- ✅ CORS configured for production domains
- ✅ SSE compatibility route enabled

### Proof Runtime
- ✅ Provider: `hetzner`
- ✅ Proof generation is local to the backend runtime
- ✅ No external attestation dependency
- ✅ Verification endpoint available at `/api/health/attestation/verify`
- ✅ Proof health endpoint available at `/api/health/attestation`

### Chainlink
- ✅ Oracle address: `0xEEDeD7daC9D6b17f5D3915542A549B1AefCeed56`
- ✅ CRE receiver path deployed
- ✅ Verified simulation trigger captured
- ⚠️ Full CRE workflow deploy still pending Chainlink org access approval

### AI + Data Services
- ✅ Venice, OpenRouter, and AIsA configured
- ✅ Repository and task cache operational
- ✅ Background loops active
- ✅ SynthData integration live

## Frontend

### Product Surface
- ✅ Research workflow functional
- ✅ Commons + saved research + history
- ✅ Export flow available
- ✅ Proof UX aligned with Hetzner runtime
- ✅ Chainlink execution proof surfaced clearly

## Environment Verification

```bash
✅ ATTESTATION_PROVIDER=hetzner
✅ ATTESTATION_DEV_SECRET=<configured>
✅ ATTESTATION_KEY_ID=hetzner-runtime-key
✅ ATTESTATION_HOST=hetzner
✅ CHAINLINK_ORACLE_ADDRESS=0xEEDeD7daC9D6b17f5D3915542A549B1AefCeed56
```

## Smoke Checklist

1. Start a research run.
2. Confirm SSE connects and progresses.
3. Verify `/api/health/attestation?probe=true`.
4. Export PDF/JSON/Markdown.
5. Confirm proof payload is present in results.

## Known Non-Blocking Items

1. Full CRE workflow deploy remains gated by Chainlink access.
2. Some wallet extensions can still emit `window.ethereum` noise in the browser console.
3. Telemetry requests may be blocked by aggressive browser extensions.
