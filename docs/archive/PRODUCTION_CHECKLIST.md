# Production Checklist

## 1) Pre-Deploy Gates

```bash
cd frontend
npx tsc --noEmit
npx eslint app/page.tsx components/ProcessingStatus.tsx components/ScrambleText.tsx
npm run build
```

```bash
cd /Users/udingethe/Dev/trende
pytest -q
```

## 2) Runtime Guardrails

Check core health endpoints:

```bash
curl -sS https://api.trende.famile.xyz/api/health/attestation?probe=true
curl -sS https://api.trende.famile.xyz/api/health/consensus?probe=true
curl -sS https://api.trende.famile.xyz/api/health/runs
```

`/api/health/runs` flags:
- stuck runs
- attestation not signed
- high provider failure rates
- empty findings / too-short report risk

## 3) Smoke Matrix (Fast / Standard / Deep)

```bash
chmod +x scripts/smoke_matrix.sh
API_BASE=https://api.trende.famile.xyz scripts/smoke_matrix.sh
```

Pass criteria:
- Each run reaches `completed`
- Attestation status is `signed`
- PDF export HTTP code is `200`
- PDF export size is non-trivial (not empty)

## 4) Release

```bash
git add .
git commit -m "chore: release gate checks"
git push
```

Then deploy backend and verify:

```bash
ssh snel-bot "cd /opt/trende-deploy && ./deploy-backend.sh"
ssh snel-bot "docker logs trende-backend --tail 200"
```
