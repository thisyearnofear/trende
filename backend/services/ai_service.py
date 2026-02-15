import os
import asyncio
import json
from datetime import datetime, timezone
import google.generativeai as genai
from typing import List, Optional, Dict
from backend.services.aisa_service import aisa_service
from backend.services.venice_service import venice_service
from backend.services.openrouter_service import openrouter_service
from backend.services.attestation_service import attestation_service

class AIService:
    def __init__(self):
        self._gemini_model = None

    def _ensure_configured(self):
        # Lazy load Gemini
        if not self._gemini_model:
            gemini_key = os.getenv('GEMINI_API_KEY')
            if gemini_key:
                try:
                    genai.configure(api_key=gemini_key)
                    self._gemini_model = genai.GenerativeModel('gemini-1.5-flash')
                except Exception as e:
                    print(f"Gemini configuration error: {e}")

    async def get_response(self, prompt: str, system_prompt: Optional[str] = None, provider: str = "venice") -> str:
        """
        Gets a response from an AI provider.
        Priority: Venice -> AIsa -> OpenRouter -> Gemini.
        """
        self._ensure_configured()
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # 1. Try Venice first
        if provider == "venice" or os.getenv('VENICE_API_KEY'):
            # Corrected model name for Venice
            response = await venice_service.chat_completion(
                model="llama-3.3-70b", 
                messages=messages
            )
            if response:
                return response

        # 2. Try AIsa fallback
        if os.getenv('AISA_API_KEY'):
            response = await aisa_service.chat_completion(
                model="gpt-4o",
                messages=messages
            )
            if response:
                return response

        # 3. Try OpenRouter fallback (great for free models or diverse options)
        if os.getenv('OPENROUTER_API_KEY'):
            response = await openrouter_service.chat_completion(
                model="google/gemini-flash-1.5-exp", # Fast and often cheap/free on OpenRouter
                messages=messages
            )
            if response:
                return response

        # 4. Fallback to Gemini
        if self._gemini_model:
            full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
            try:
                response = self._gemini_model.generate_content(full_prompt)
                return response.text
            except Exception as e:
                print(f"Gemini fallback failed: {e}")

        return "No AI provider configured or available."

    async def get_parallel_responses(self, prompt: str, system_prompt: Optional[str] = None, providers: Optional[List[str]] = None) -> Dict[str, str]:
        """
        Gets responses from multiple providers in parallel.
        Used for bias-free consensus synthesis.
        """
        if not providers:
            providers = ["venice", "aisa", "openrouter", "gemini"]
            
        tasks = []
        active_providers = []

        # Check availability and build task list
        if "venice" in providers and os.getenv('VENICE_API_KEY'):
            active_providers.append("venice")
            tasks.append(self.get_response(prompt, system_prompt, provider="venice"))
        
        if "aisa" in providers and os.getenv('AISA_API_KEY'):
            active_providers.append("aisa")
            tasks.append(aisa_service.chat_completion(model="gpt-4o", messages=[
                {"role": "system", "content": system_prompt or ""},
                {"role": "user", "content": prompt}
            ]))

        if os.getenv('OPENROUTER_API_KEY'):
            # Fetch from multiple free models on OpenRouter to prove diversity
            free_models = [
                ("meta-llama/llama-3.3-70b-instruct:free", "openrouter_llama"),
                ("google/gemini-2.0-flash-exp:free", "openrouter_gemini"),
                ("openrouter/free", "openrouter_auto")
            ]
            
            for model_id, provider_label in free_models:
                if provider_label in providers or "openrouter" in providers:
                    active_providers.append(provider_label)
                    tasks.append(openrouter_service.chat_completion(model=model_id, messages=[
                        {"role": "system", "content": system_prompt or ""},
                        {"role": "user", "content": prompt}
                    ]))

        if "gemini" in providers:
            self._ensure_configured()
            if self._gemini_model:
                active_providers.append("gemini")
                full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
                # Wrap sync call in async
                loop = asyncio.get_event_loop()
                tasks.append(loop.run_in_executor(None, lambda: self._gemini_model.generate_content(full_prompt).text))

        if not tasks:
            return {}

        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        provider_responses = {}
        for provider, res in zip(active_providers, results):
            if isinstance(res, Exception):
                print(f"Provider {provider} failed in parallel batch: {res}")
                continue
            provider_responses[provider] = str(res)
            
        return provider_responses

    async def get_consensus_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Gets a synthesized consensus response from all available models.
        """
        bundle = await self.get_consensus_bundle(prompt, system_prompt)
        return str(bundle.get("consensus_report", "No AI providers available for consensus."))

    async def get_consensus_bundle(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, object]:
        """
        Produces a consensus report plus verifiability metadata payload.
        """
        responses = await self.get_parallel_responses(prompt, system_prompt)
        generated_at = datetime.now(timezone.utc).isoformat()

        if not responses:
            fallback = await self.get_response(prompt, system_prompt)
            return {
                "consensus_report": fallback,
                "providers": [],
                "provider_outputs": [],
                "agreement_score": 0.0,
                "main_divergence": "No parallel providers available.",
                "synthesis_model": "single-provider-fallback",
                "attestation": await self._build_attestation_payload(
                    prompt=prompt,
                    consensus_report=fallback,
                    providers=[],
                    generated_at=generated_at,
                ),
            }

        if len(responses) == 1:
            provider, output = next(iter(responses.items()))
            return {
                "consensus_report": output,
                "providers": [provider],
                "provider_outputs": [
                    {"provider": provider, "response_excerpt": output[:600]}
                ],
                "agreement_score": 1.0,
                "main_divergence": "Only one provider was available.",
                "synthesis_model": "single-provider",
                "attestation": await self._build_attestation_payload(
                    prompt=prompt,
                    consensus_report=output,
                    providers=[provider],
                    generated_at=generated_at,
                ),
            }

        synthesis_prompt = f"""
        I have gathered responses from multiple AI models.
        REQUEST:
        {prompt}

        MODEL RESPONSES:
        """
        for provider, response in responses.items():
            synthesis_prompt += f"\n--- MODEL: {provider} ---\n{response}\n"

        synthesis_prompt += """
        Return STRICT JSON:
        {
          "consensus_report": "Neutral merged report in markdown.",
          "main_divergence": "Biggest disagreement between models.",
          "agreement_score": 0.0
        }
        """

        synthesized = await self.get_response(
            synthesis_prompt,
            system_prompt="You are a neutral consensus synthesizer.",
        )

        consensus_report = ""
        main_divergence = "No major divergence detected."
        agreement_score = self._calculate_agreement_score(list(responses.values()))

        try:
            json_str = synthesized[synthesized.find("{"):synthesized.rfind("}") + 1]
            payload = json.loads(json_str)
            consensus_report = str(payload.get("consensus_report", "")).strip()
            if payload.get("main_divergence"):
                main_divergence = str(payload["main_divergence"])
            if isinstance(payload.get("agreement_score"), (int, float)):
                agreement_score = max(0.0, min(1.0, float(payload["agreement_score"])))
        except Exception:
            consensus_report = synthesized

        if not consensus_report:
            consensus_report = synthesized

        providers = list(responses.keys())
        provider_outputs = [
            {"provider": provider, "response_excerpt": response[:600]}
            for provider, response in responses.items()
        ]

        return {
            "consensus_report": consensus_report,
            "providers": providers,
            "provider_outputs": provider_outputs,
            "agreement_score": agreement_score,
            "main_divergence": main_divergence,
            "synthesis_model": "meta-consensus",
            "attestation": await self._build_attestation_payload(
                prompt=prompt,
                consensus_report=consensus_report,
                providers=providers,
                generated_at=generated_at,
            ),
        }

    def _calculate_agreement_score(self, responses: List[str]) -> float:
        if len(responses) < 2:
            return 1.0

        token_sets = []
        for response in responses:
            words = {w.strip(".,:;!?()[]{}\"'").lower() for w in response.split()}
            token_sets.append({w for w in words if len(w) > 3})

        overlaps = []
        for i in range(len(token_sets)):
            for j in range(i + 1, len(token_sets)):
                a = token_sets[i]
                b = token_sets[j]
                union = len(a | b)
                if union == 0:
                    continue
                overlaps.append(len(a & b) / union)

        if not overlaps:
            return 0.5

        score = sum(overlaps) / len(overlaps)
        return max(0.0, min(1.0, score))

    async def _build_attestation_payload(
        self,
        prompt: str,
        consensus_report: str,
        providers: List[str],
        generated_at: str,
    ) -> Dict[str, object]:
        payload = {
            "prompt": prompt,
            "providers": providers,
            "consensus_report": consensus_report,
            "generated_at": generated_at,
            "provider_count": len(providers),
        }
        return await attestation_service.attest(payload)

ai_service = AIService()
