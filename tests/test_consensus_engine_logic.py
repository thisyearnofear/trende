import unittest
from unittest.mock import AsyncMock, patch

from backend.services.ai_service import AIService


class ConsensusEngineLogicTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_response_honors_explicit_provider_first(self) -> None:
        service = AIService()
        calls: list[str] = []

        async def fake_fetch(provider: str, prompt: str, system_prompt: str | None):
            calls.append(provider)
            if provider == 'openrouter':
                return 'openrouter-response'
            return None

        service._fetch_from_provider = fake_fetch  # type: ignore[method-assign]

        result = await service.get_response('test prompt', provider='openrouter')

        self.assertEqual(result, 'openrouter-response')
        self.assertGreaterEqual(len(calls), 1)
        self.assertEqual(calls[0], 'openrouter')

    async def test_parallel_responses_dedupes_provider_schedule(self) -> None:
        service = AIService()

        with patch.dict('os.environ', {'OPENROUTER_API_KEY': 'x'}, clear=False):
            service._call_openrouter = AsyncMock(return_value='ok')  # type: ignore[method-assign]

            responses = await service.get_parallel_responses(
                'prompt',
                providers=['openrouter', 'openrouter_llama'],
            )

            self.assertIn('openrouter_llama', responses)
            self.assertIn('openrouter_gemini', responses)
            self.assertIn('openrouter_mistral', responses)
            self.assertEqual(service._call_openrouter.await_count, 3)

    async def test_consensus_bundle_parses_json_and_normalizes_score(self) -> None:
        service = AIService()

        service.get_parallel_provider_results = AsyncMock(  # type: ignore[method-assign]
            return_value=[
                {'provider': 'venice', 'model_id': 'venice', 'status': 'ok', 'response': 'A', 'error': None, 'latency_ms': 12.0},
                {'provider': 'openrouter_llama', 'model_id': 'meta-llama/llama', 'status': 'ok', 'response': 'B', 'error': None, 'latency_ms': 20.0},
            ]
        )
        service.get_response = AsyncMock(  # type: ignore[method-assign]
            return_value='''```json\n{"consensus_report":"Merged report","main_divergence":"minor","agreement_score": 9,"pillars":["p1", 2],"anomalies":["a1", null]}\n```'''
        )
        service._build_attestation_payload = AsyncMock(  # type: ignore[method-assign]
            return_value={'attestation_id': 'ATTEST-1'}
        )

        bundle = await service.get_consensus_bundle('prompt')

        self.assertEqual(bundle['consensus_report'], 'Merged report')
        self.assertEqual(bundle['main_divergence'], 'minor')
        self.assertEqual(bundle['agreement_score'], 1.0)
        self.assertEqual(bundle['pillars'], ['p1'])
        self.assertEqual(bundle['anomalies'], ['a1'])
        self.assertEqual(bundle['attestation']['attestation_id'], 'ATTEST-1')

    async def test_consensus_bundle_uses_synthesized_fallback_text(self) -> None:
        service = AIService()

        service.get_parallel_provider_results = AsyncMock(  # type: ignore[method-assign]
            return_value=[
                {'provider': 'venice', 'model_id': 'venice', 'status': 'ok', 'response': 'Response one', 'error': None, 'latency_ms': 10.0},
                {'provider': 'aisa', 'model_id': 'gpt-4o', 'status': 'ok', 'response': 'Response two', 'error': None, 'latency_ms': 14.0},
            ]
        )
        service.get_response = AsyncMock(  # type: ignore[method-assign]
            return_value='Not JSON response'
        )
        service._build_attestation_payload = AsyncMock(  # type: ignore[method-assign]
            return_value={'attestation_id': 'ATTEST-2'}
        )

        bundle = await service.get_consensus_bundle('prompt')

        self.assertEqual(bundle['consensus_report'], 'Not JSON response')
        self.assertIn('providers', bundle)
        self.assertEqual(bundle['attestation']['attestation_id'], 'ATTEST-2')


if __name__ == '__main__':
    unittest.main()
