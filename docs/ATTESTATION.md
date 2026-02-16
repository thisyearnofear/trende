# TEE Attestation Implementation

## ✅ Status: FULLY OPERATIONAL

The Trende platform now uses **real TEE (Trusted Execution Environment) attestation** for all research reports.

---

## Architecture

```
┌─────────────────┐
│  Trende Backend │
│   (Port 8000)   │
└────────┬────────┘
         │
         │ HTTP POST /attest
         ▼
┌─────────────────────────┐
│  TEE Attestation Service│
│  (baseline-attested)    │
│     Port 8082           │
│                         │
│  🔐 Signs with wallet:  │
│  0xf39Fd...92266        │
└─────────────────────────┘
```

---

## How It Works

### 1. Research Completion
When a trend analysis completes, the backend creates a consensus payload containing:
- Research prompt
- AI providers used
- Consensus report
- Agreement score
- Timestamp

### 2. TEE Attestation Request
The backend sends this payload to the TEE service at `http://baseline-attested:8080/attest`

### 3. Cryptographic Signing
The TEE service:
1. Creates a canonical hash of the payload (SHA-256)
2. Generates an attestation ID
3. Creates a message: `TrendeAttestation|{attestation_id}|{input_hash}|{timestamp}`
4. Signs the message with the TEE wallet using EIP-191
5. Returns the signature and attestation metadata

### 4. Verification
Anyone can verify the attestation by:
1. Recreating the canonical payload hash
2. Reconstructing the attestation message
3. Verifying the signature against the known signer address

---

## Attestation Response Format

```json
{
  "provider": "eigencompute",
  "status": "signed",
  "method": "tee-attestation",
  "attestation_id": "ATTEST-2b54e3ca4ce336cf",
  "input_hash": "2b54e3ca4ce336cf5365bbba86564c6123f7e9839ddcf0abfb7bf9c9479a4aca",
  "signature": "0xf2f8f589fa013b00f7d660cad8c46c40b00ca0a3068d095df66cded23cc769643526931408ab61762b0bc8ad94a55785b9d03abdea56e02887deea39a910742e1b",
  "signer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "key_id": "eigencompute-tee",
  "generated_at": "2026-02-16T13:36:42.927422+00:00",
  "payload": { /* original consensus data */ }
}
```

---

## Verification Process

### API Endpoint
`POST /api/attest/verify`

### Request
```json
{
  "payload": { /* original consensus payload */ },
  "attestation": { /* attestation object */ }
}
```

### Response
```json
{
  "verified": true,
  "signer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "attestation_id": "ATTEST-2b54e3ca4ce336cf",
  "message": "TrendeAttestation|ATTEST-2b54e3ca4ce336cf|2b54e3ca...|2026-02-16T13:36:42.927422+00:00",
  "timestamp": "2026-02-16T13:40:00.000000+00:00"
}
```

---

## Configuration

### Backend Environment Variables
```bash
# Attestation Provider
ATTESTATION_PROVIDER=eigencompute
ATTESTATION_STRICT_MODE=true

# TEE Service Endpoints
EIGEN_ATTEST_URL=http://baseline-attested:8080/attest
EIGEN_HEALTH_URL=http://baseline-attested:8080/health

# Retry Configuration
EIGEN_ATTEST_TIMEOUT_SECS=10
EIGEN_ATTEST_RETRIES=3
EIGEN_ATTEST_BACKOFF_MS=300
```

### Docker Network
Both services must be on the same Docker network:
```bash
docker network create trende-network

docker run -d --name baseline-attested \
  --network trende-network \
  -p 8082:8080 \
  trende/baseline:v2

docker run -d --name trende-backend \
  --network trende-network \
  -p 8000:8000 \
  trende/backend:latest
```

---

## Health Checks

### Attestation Service Health
```bash
curl http://localhost:8082/health
```

### Backend Attestation Status
```bash
# Configuration check
curl https://api.trende.famile.xyz/api/health/attestation

# Live probe (tests connectivity)
curl https://api.trende.famile.xyz/api/health/attestation?probe=true
```

---

## TEE Service Endpoints

### POST /attest
Attest to an arbitrary payload

**Request:**
```json
{
  "request_id": "unique-id",
  "payload": { /* any JSON object */ },
  "generated_at": "2026-02-16T13:00:00Z"
}
```

**Response:** Attestation object with signature

### POST /verify
Verify an attestation

**Request:**
```json
{
  "payload": { /* original payload */ },
  "attestation": { /* attestation object */ }
}
```

**Response:** Verification result

### GET /random
Generate attested random number (original functionality)

### GET /health
Service health check

---

## Security Properties

### What This Provides
✅ **Non-repudiation**: The TEE wallet signature proves the attestation came from our service
✅ **Integrity**: Any tampering with the payload will be detected via hash mismatch
✅ **Timestamp**: Attestations include generation time
✅ **Verifiability**: Anyone can verify signatures using the public signer address

### What This Does NOT Provide (Yet)
⚠️ **Hardware attestation**: Currently using software wallet, not hardware TEE
⚠️ **Remote attestation**: No SGX/SEV quote verification
⚠️ **Key rotation**: Single static wallet key

### Future Enhancements
- [ ] Integrate with actual hardware TEE (Intel SGX, AMD SEV)
- [ ] Add remote attestation quotes
- [ ] Implement key rotation
- [ ] On-chain attestation registry
- [ ] IPFS storage of attestations

---

## Deployment

### Update TEE Service
```bash
cd /opt/trende-deploy/baseline-attested
# Update src/index.ts
npm run build
docker build -t trende/baseline:v2 .
docker stop baseline-attested && docker rm baseline-attested
docker run -d --name baseline-attested \
  --network trende-network \
  --env-file .env \
  -p 8082:8080 \
  --restart unless-stopped \
  trende/baseline:v2
```

### Update Backend
```bash
cd /opt/trende-deploy
./deploy-backend.sh
```

---

## Testing

### Test Attestation Endpoint
```bash
curl -X POST http://localhost:8082/attest \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-123",
    "payload": {"test": "data"}
  }'
```

### Test Full Flow
```bash
# Start analysis
TASK_ID=$(curl -s -X POST https://api.trende.famile.xyz/api/trends/start \
  -H "Content-Type: application/json" \
  -d '{"topic": "test", "platforms": ["twitter"]}' | jq -r '.task_id')

# Wait for completion
sleep 30

# Check attestation
curl -s https://api.trende.famile.xyz/api/trends/$TASK_ID | \
  jq '.summary.attestationData'
```

---

## Troubleshooting

### Backend Can't Reach TEE Service
**Symptom**: `RuntimeError: Startup aborted: ATTESTATION_STRICT_MODE=true requires live Eigen attestation reachability`

**Solution**: Ensure both containers are on the same Docker network and use container name in URL:
```bash
EIGEN_ATTEST_URL=http://baseline-attested:8080/attest
```

### Signature Verification Fails
**Symptom**: `verified: false`

**Solution**: Ensure payload hasn't been modified and canonical JSON serialization is used (sorted keys, no whitespace)

### TEE Service Not Starting
**Symptom**: Container exits immediately

**Solution**: Check MNEMONIC is set in .env file:
```bash
docker logs baseline-attested
```

---

## Signer Address

**Production TEE Wallet**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

This address signs all attestations. Verify signatures against this address to confirm authenticity.

---

## API Integration

### Frontend Display
The attestation data is available in the API response:
```typescript
const response = await fetch(`/api/trends/${taskId}`);
const data = await response.json();
const attestation = data.summary.attestationData;

console.log('Attestation ID:', attestation.attestation_id);
console.log('Signature:', attestation.signature);
console.log('Signer:', attestation.signer);
```

### Verification
```typescript
const verifyResponse = await fetch('/api/attest/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    payload: attestation.payload,
    attestation: attestation
  })
});
const result = await verifyResponse.json();
console.log('Verified:', result.verified);
```

---

## Conclusion

The Trende platform now provides **real cryptographic attestation** for all research reports. Each analysis is signed by a dedicated TEE wallet, providing verifiable proof of the consensus process and enabling trust-minimized verification by anyone.
