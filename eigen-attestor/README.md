# Trende Eigen Attestor

Minimal attestation service for EigenCloud deployment.

## Endpoints
- `GET /health`
- `POST /attest`
- `POST /verify`

## Deploy (verifiable)
Use EigenCloud CLI in repo root:

```bash
ecloud compute app deploy \
  --verifiable \
  --repo https://github.com/thisyearnofear/trende \
  --commit <git-sha> \
  --build-context eigen-attestor \
  --build-dockerfile Dockerfile \
  --name trende-attestor \
  --environment sepolia
```
