from fastapi.testclient import TestClient

from backend.api.main import app, tasks


def test_trends_results_includes_consensus_and_attestation() -> None:
    task_id = 'task-contract-1'
    tasks[task_id] = {
        'task_id': task_id,
        'topic': 'verifiable news test',
        'platforms': ['twitter', 'newsapi'],
        'status': 'completed',
        'created_at': '2026-02-15T00:00:00Z',
        'updated_at': '2026-02-15T00:10:00Z',
        'raw_findings': [
            {
                'id': '1',
                'platform': 'newsapi',
                'title': 'Test headline',
                'content': 'Test content',
                'author': 'Reporter',
                'authorHandle': 'reporter',
                'url': 'https://example.com/news/1',
                'metrics': {'views': 100},
                'timestamp': '2026-02-15T00:00:00Z',
            }
        ],
        'summary': 'Consensus summary',
        'final_report_md': '# Report',
        'confidence_score': 0.82,
        'validation_results': ['validated by consensus'],
        'meme_page_data': {'type': 'NEWS'},
        'consensus_data': {
            'providers': ['venice', 'openrouter_llama'],
            'agreement_score': 0.74,
            'main_divergence': 'minor disagreement',
            'provider_outputs': [{'provider': 'venice', 'response_excerpt': '...'}],
            'synthesis_model': 'meta-consensus',
        },
        'attestation_data': {
            'provider': 'local_hmac',
            'method': 'hmac-sha256',
            'attestation_id': 'ATTEST-abc',
            'input_hash': 'hash',
            'signature': 'sig',
            'payload': {'k': 'v'},
        },
        'error': None,
        'logs': [],
    }

    with TestClient(app) as client:
        response = client.get(f'/api/trends/{task_id}')
        assert response.status_code == 200
        body = response.json()

    summary = body['summary']
    assert summary['consensusData']['providers'] == ['venice', 'openrouter_llama']
    assert summary['attestationData']['provider'] == 'local_hmac'
    assert summary['attestationData']['attestation_id'] == 'ATTEST-abc'
    assert body['query']['status'] == 'completed'
    assert body['results'][0]['platform'] == 'newsapi'

    tasks.pop(task_id, None)
