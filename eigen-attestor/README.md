# Trende Eigen Attestor

Minimal attestation service for EigenCloud deployment.

## Endpoints
- `GET /health`
- `POST /attest`
- `POST /verify`

## Security
- Set `ATTEST_API_TOKEN` to require `Authorization: Bearer <token>` for `/attest`.
- Configure request throttling with:
  - `ATTEST_RATE_LIMIT_WINDOW_SECS` (default `60`)
  - `ATTEST_RATE_LIMIT_MAX_REQUESTS` (default `60`)

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
