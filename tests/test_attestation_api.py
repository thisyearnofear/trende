import asyncio

from fastapi.testclient import TestClient

from backend.api.main import app
from backend.services.attestation_service import attestation_service


def test_attestation_verify_success_and_failure() -> None:
    payload = {
        'prompt': 'test prompt',
        'providers': ['venice', 'openrouter'],
        'consensus_report': 'consensus body',
        'generated_at': '2026-02-15T00:00:00Z',
        'provider_count': 2,
    }

    attestation = asyncio.run(attestation_service.attest(payload))

    with TestClient(app) as client:
        ok = client.post('/api/attest/verify', json={'payload': payload, 'attestation': attestation})
        assert ok.status_code == 200
        assert ok.json()['verified'] is True

        tampered_payload = dict(payload)
        tampered_payload['consensus_report'] = 'tampered'
        bad = client.post('/api/attest/verify', json={'payload': tampered_payload, 'attestation': attestation})
        assert bad.status_code == 200
        assert bad.json()['verified'] is False
