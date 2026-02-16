import asyncio
import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Awaitable, Dict, List, Optional, Sequence, Tuple

import google.generativeai as genai

from backend.services.aisa_service import aisa_service
from backend.services.attestation_service import attestation_service
from backend.services.composio_service import composio_service
from backend.services.openrouter_service import openrouter_service
from backend.services.pinecone_service import pinecone_service
from backend.services.venice_service import venice_service

DEFAULT_PROVIDER_ORDER: Tuple[str, ...] = ("venice", "aisa", "openrouter", "gemini")
OPENROUTER_VARIANTS: Tuple[Tuple[str, str], ...] = (
    ("openrouter_auto", "openrouter/auto"),  # Auto-select best available model
    ("openrouter_free", "nousresearch/hermes-3-llama-3.1-405b:free"),  # Free model that works
)
MAX_EXCERPT_CHARS = 600


class AIService:
    def __init__(self):
        self._gemini_model = None

    def _ensure_configured(self) -> None:
        if self._gemini_model:
            return

        gemini_key = os.getenv("GEMINI_API_KEY")
        if not gemini_key:
            return

        try:
            genai.configure(api_key=gemini_key)
            self._gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        except Exception as exc:
            print(f"Gemini configuration error: {exc}")

    def _build_messages(self, prompt: str, system_prompt: Optional[str]) -> List[Dict[str, str]]:
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        return messages

    async def _call_venice(self, prompt: str, system_prompt: Optional[str]) -> Optional[str]:
        if not os.getenv("VENICE_API_KEY"):
            return None
        return await venice_service.chat_completion(
            model="llama-3.3-70b",
            messages=self._build_messages(prompt, system_prompt),
        )

    async def _call_aisa(self, prompt: str, system_prompt: Optional[str]) -> Optional[str]:
        if not os.getenv("AISA_API_KEY"):
            return None
        return await aisa_service.chat_completion(
            model="gpt-4o",
            messages=self._build_messages(prompt, system_prompt),
        )

    async def _call_openrouter(
        self,
        prompt: str,
        system_prompt: Optional[str],
        model: str,
    ) -> Optional[str]:
        if not os.getenv("OPENROUTER_API_KEY"):
            return None
        return await openrouter_service.chat_completion(
            model=model,
            messages=self._build_messages(prompt, system_prompt),
        )

    async def _call_gemini(self, prompt: str, system_prompt: Optional[str]) -> Optional[str]:
        self._ensure_configured()
        if not self._gemini_model:
            return None

        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        try:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(
                None,
                lambda: self._gemini_model.generate_content(full_prompt).text,
            )
        except Exception as exc:
            print(f"Gemini fallback failed: {exc}")
            return None

    async def get_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        provider: str = "auto",
    ) -> str:
        """
        Gets a response from AI providers.
        - provider="auto": Venice -> AIsa -> OpenRouter -> Gemini fallback chain
        - provider explicit: strict provider first, then fallback chain
        """
        self._ensure_configured()

        provider_key = provider.lower().strip()
        explicit_result = None

        if provider_key not in {"", "auto"}:
            explicit_result = await self._fetch_from_provider(provider_key, prompt, system_prompt)
            if explicit_result:
                return explicit_result

        for fallback in DEFAULT_PROVIDER_ORDER:
            result = await self._fetch_from_provider(fallback, prompt, system_prompt)
            if result:
                return result

        return "No AI provider configured or available."

    async def _fetch_from_provider(
        self,
        provider: str,
        prompt: str,
        system_prompt: Optional[str],
    ) -> Optional[str]:
        if provider == "venice":
            return await self._call_venice(prompt, system_prompt)
        if provider == "aisa":
            return await self._call_aisa(prompt, system_prompt)
        if provider == "openrouter":
            return await self._call_openrouter(
                prompt,
                system_prompt,
                model="google/gemini-2.0-flash-001",
            )
        if provider == "gemini":
            return await self._call_gemini(prompt, system_prompt)

        for label, model in OPENROUTER_VARIANTS:
            if provider == label:
                return await self._call_openrouter(prompt, system_prompt, model=model)

        return None

    async def get_parallel_responses(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        providers: Optional[Sequence[str]] = None,
    ) -> Dict[str, str]:
        """
        Gets responses from multiple providers in parallel.
        """
        results = await self.get_parallel_provider_results(prompt, system_prompt, providers)
        return {
            item["provider"]: item["response"]
            for item in results
            if item.get("status") == "ok" and isinstance(item.get("response"), str)
        }

    async def get_parallel_provider_results(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        providers: Optional[Sequence[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Returns per-provider execution telemetry for consensus orchestration.
        """
        requested = list(providers) if providers else ["venice", "aisa", "openrouter", "gemini"]
        requested = self._dedupe_preserve_order([value.lower().strip() for value in requested if value])

        tasks: List[asyncio.Task] = []
        labels: List[Tuple[str, str]] = []
        scheduled = set()

        for name in requested:
            if name == "openrouter":
                for label, model in OPENROUTER_VARIANTS:
                    if os.getenv("OPENROUTER_API_KEY") and label not in scheduled:
                        scheduled.add(label)
                        labels.append((label, model))
                        tasks.append(
                            asyncio.create_task(
                                self._call_with_metrics(
                                    self._call_openrouter(prompt, system_prompt, model=model)
                                )
                            )
                        )
                continue

            if name in {"venice", "aisa", "gemini"}:
                if name not in scheduled:
                    scheduled.add(name)
                    labels.append((name, name))
                    tasks.append(
                        asyncio.create_task(
                            self._call_with_metrics(
                                self._fetch_from_provider(name, prompt, system_prompt)
                            )
                        )
                    )
                continue

            for label, model in OPENROUTER_VARIANTS:
                if (
                    name == label
                    and os.getenv("OPENROUTER_API_KEY")
                    and label not in scheduled
                ):
                    scheduled.add(label)
                    labels.append((label, model))
                    tasks.append(
                        asyncio.create_task(
                            self._call_with_metrics(
                                self._call_openrouter(prompt, system_prompt, model=model)
                            )
                        )
                    )

        if not tasks:
            return []

        results = await asyncio.gather(*tasks, return_exceptions=True)
        provider_results: List[Dict[str, Any]] = []

        for (label, model_id), value in zip(labels, results):
            if isinstance(value, Exception):
                print(f"Provider {label} failed in parallel batch: {value}")
                provider_results.append(
                    {
                        "provider": label,
                        "model_id": model_id,
                        "status": "error",
                        "error": str(value),
                        "response": "",
                        "latency_ms": 0.0,
                    }
                )
                continue

            if isinstance(value, tuple):
                response_value, latency_ms, error_message = value
            else:
                response_value, latency_ms, error_message = ("", 0.0, "Unknown execution error")

            normalized = str(response_value).strip() if response_value else ""
            if error_message or not normalized:
                provider_results.append(
                    {
                        "provider": label,
                        "model_id": model_id,
                        "status": "error",
                        "error": error_message or "Empty response",
                        "response": normalized,
                        "latency_ms": round(float(latency_ms), 2),
                    }
                )
                continue

            provider_results.append(
                {
                    "provider": label,
                    "model_id": model_id,
                    "status": "ok",
                    "error": None,
                    "response": normalized,
                    "latency_ms": round(float(latency_ms), 2),
                }
            )

        return provider_results

    async def get_consensus_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
    ) -> str:
        bundle = await self.get_consensus_bundle(prompt, system_prompt)
        return str(bundle.get("consensus_report", "No AI providers available for consensus."))

    async def get_consensus_bundle(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        providers: Optional[Sequence[str]] = None,
    ) -> Dict[str, object]:
        """
        Produces a consensus report plus verifiability metadata payload.
        Enhanced with advanced consensus mechanisms and deeper analysis.
        """
        provider_results = await self.get_parallel_provider_results(prompt, system_prompt, providers)
        responses = {
            item["provider"]: item["response"]
            for item in provider_results
            if item.get("status") == "ok" and isinstance(item.get("response"), str)
        }
        provider_errors = [
            {
                "provider": item.get("provider"),
                "model_id": item.get("model_id"),
                "error": item.get("error", "Unknown error"),
                "latency_ms": item.get("latency_ms", 0.0),
            }
            for item in provider_results
            if item.get("status") != "ok"
        ]
        generated_at = datetime.now(timezone.utc).isoformat()

        if not responses:
            fallback = await self.get_response(prompt, system_prompt, provider="auto")
            warnings = ["No parallel providers available. Used single fallback synthesizer."]
            return {
                "consensus_report": fallback,
                "providers": [],
                "provider_outputs": [],
                "provider_errors": provider_errors,
                "agreement_score": 0.0,
                "main_divergence": "No parallel providers available.",
                "pillars": [],
                "anomalies": [],
                "warnings": warnings,
                "diversity_level": "low",
                "synthesis_model": "single-provider-fallback",
                "confidence_score": 0.0,
                "consensus_depth": "shallow",
                "attestation": await self._build_attestation_payload(
                    prompt=prompt,
                    consensus_report=fallback,
                    providers=[],
                    generated_at=generated_at,
                    agreement_score=0.0,
                    main_divergence="No parallel providers available.",
                    warnings=warnings,
                ),
            }

        if len(responses) == 1:
            provider, output = next(iter(responses.items()))
            warnings = ["Low diversity consensus: only one provider was available."]
            return {
                "consensus_report": output,
                "providers": [provider],
                "provider_outputs": [self._provider_output(provider, output, provider_results)],
                "provider_errors": provider_errors,
                "agreement_score": 1.0,
                "main_divergence": "Only one provider was available.",
                "pillars": [],
                "anomalies": [],
                "warnings": warnings,
                "diversity_level": "low",
                "confidence_score": 0.6,
                "consensus_depth": "basic",
                "synthesis_model": "single-provider",
                "attestation": await self._build_attestation_payload(
                    prompt=prompt,
                    consensus_report=output,
                    providers=[provider],
                    generated_at=generated_at,
                    agreement_score=1.0,
                    main_divergence="Only one provider was available.",
                    warnings=warnings,
                ),
            }

        # Calculate initial agreement score
        agreement_score_hint = self._calculate_agreement_score(list(responses.values()))
        
        # Perform deeper consensus analysis
        deep_analysis = await self._perform_deep_consensus_analysis(prompt, responses, agreement_score_hint)
        
        # Generate synthesis prompt with enhanced instructions
        synthesis_prompt = self._build_enhanced_synthesis_prompt(prompt, responses, agreement_score_hint, deep_analysis)
        synthesized = await self.get_response(
            synthesis_prompt,
            system_prompt=(
                "You are a neutral, objective, and highly critical consensus aggregator. "
                "You prioritize factual overlap, uncertainty disclosure, and source-grounded claims. "
                "Provide a comprehensive analysis that identifies core truths, acknowledges disagreements, "
                "and highlights areas of uncertainty."
            ),
            provider="auto",
        )

        # Extract and validate the consensus results
        agreement_score = self._calculate_agreement_score(list(responses.values()))
        main_divergence = "No major divergence detected."
        pillars: List[str] = []
        anomalies: List[str] = []
        consensus_report = synthesized
        confidence_score = 0.7  # Default confidence
        consensus_depth = "moderate"

        payload = self._extract_json_payload(synthesized)
        if payload:
            parsed_report = str(payload.get("consensus_report", "")).strip()
            if parsed_report:
                consensus_report = parsed_report

            parsed_divergence = payload.get("main_divergence")
            if isinstance(parsed_divergence, str) and parsed_divergence.strip():
                main_divergence = parsed_divergence.strip()

            agreement_score = self._normalize_score(payload.get("agreement_score"), agreement_score)
            pillars = self._normalize_string_list(payload.get("pillars"))
            anomalies = self._normalize_string_list(payload.get("anomalies"))
            
            # Extract additional fields if available
            if "confidence_score" in payload:
                confidence_score = self._normalize_score(payload["confidence_score"], confidence_score)
            if "consensus_depth" in payload:
                consensus_depth = str(payload["consensus_depth"])

        if not consensus_report.strip():
            consensus_report = self._fallback_consensus_text(responses)

        providers = list(responses.keys())
        provider_outputs = [
            self._provider_output(provider, response, provider_results)
            for provider, response in responses.items()
        ]
        warnings = self._build_consensus_warnings(
            provider_count=len(providers),
            agreement_score=agreement_score,
            provider_errors=provider_errors,
        )
        diversity_level = self._calculate_diversity_level(len(providers), agreement_score)
        
        # Enhance confidence based on agreement and diversity
        confidence_score = self._enhance_confidence_score(confidence_score, agreement_score, len(providers))

        return {
            "consensus_report": consensus_report,
            "providers": providers,
            "provider_outputs": provider_outputs,
            "provider_errors": provider_errors,
            "agreement_score": agreement_score,
            "main_divergence": main_divergence,
            "pillars": pillars,
            "anomalies": anomalies,
            "warnings": warnings,
            "diversity_level": diversity_level,
            "confidence_score": confidence_score,
            "consensus_depth": consensus_depth,
            "synthesis_model": "advanced-meta-consensus",
            "attestation": await self._build_attestation_payload(
                prompt=prompt,
                consensus_report=consensus_report,
                providers=providers,
                generated_at=generated_at,
                agreement_score=agreement_score,
                main_divergence=main_divergence,
                warnings=warnings,
            ),
        }

    async def _perform_deep_consensus_analysis(self, prompt: str, responses: Dict[str, str], agreement_score: float) -> Dict[str, Any]:
        """
        Performs deeper analysis of the responses to identify nuanced patterns.
        Optionally leverages external services like Composio and Pinecone for enhanced analysis.
        """
        # Analyze response patterns and extract deeper insights
        analysis_prompt = f"""
        Analyze the following responses to the prompt: {prompt}
        
        Responses from different providers:
        {chr(10).join([f"Provider {provider}: {response[:500]}..." for provider, response in responses.items()])}
        
        Current agreement score: {agreement_score}
        
        Perform a deep analysis and return JSON with:
        {{
          "thematic_clusters": ["theme1", "theme2", ...],
          "confidence_indicators": ["indicator1", "indicator2", ...],
          "uncertainty_markers": ["marker1", "marker2", ...],
          "cross_validation_points": ["point1", "point2", ...],
          "nuanced_insights": ["insight1", "insight2", ...],
          "potential_biases": ["bias1", "bias2", ...],
          "external_validation_sources": ["source1", "source2", ...]  // Sources that could validate claims
        }}
        """
        
        try:
            analysis_response = await self.get_response(
                analysis_prompt,
                system_prompt="You are a deep analytical engine that identifies patterns, biases, and insights across multiple AI responses."
            )
            
            analysis_payload = self._extract_json_payload(analysis_response)
            if analysis_payload:
                # If Composio is available, we could potentially use it for external validation
                if composio_service.toolset:
                    try:
                        # Example: Use browser tool to validate claims if needed
                        external_sources = analysis_payload.get("external_validation_sources", [])
                        if external_sources:
                            # This is a simplified example - in practice, you'd want to be more selective
                            # about when to use external validation tools
                            pass
                    except Exception as e:
                        print(f"External validation with Composio failed: {e}")
                
                return analysis_payload
        except Exception as e:
            print(f"Deep consensus analysis failed: {e}")
        
        # Return default analysis if the deep analysis fails
        return {
            "thematic_clusters": ["general_topic"],
            "confidence_indicators": ["factual_claims"],
            "uncertainty_markers": ["speculation"],
            "cross_validation_points": ["common_facts"],
            "nuanced_insights": ["initial_analysis"],
            "potential_biases": ["model_specific_bias"],
            "external_validation_sources": []
        }

    def _build_enhanced_synthesis_prompt(self, prompt: str, responses: Dict[str, str], agreement_hint: float, deep_analysis: Dict[str, Any]) -> str:
        """
        Builds an enhanced synthesis prompt with deeper analysis instructions.
        """
        prompt_parts = [
            "You are an Institutional Truth Oracle for the Monad economy.",
            f"You have responses from {len(responses)} independent model paths.",
            f"LEXICAL AGREEMENT HINT: {round(agreement_hint, 2)} (0.0 = total divergence, 1.0 = identical wording). Use this as a guide for your final agreement_score.",
            "",
            f"ORIGINAL TOPIC: {prompt}",
            "",
            "DEEP ANALYSIS INSIGHTS:",
            f"- Thematic clusters: {deep_analysis.get('thematic_clusters', [])}",
            f"- Confidence indicators: {deep_analysis.get('confidence_indicators', [])}",
            f"- Uncertainty markers: {deep_analysis.get('uncertainty_markers', [])}",
            f"- Cross-validation points: {deep_analysis.get('cross_validation_points', [])}",
            f"- Nuanced insights: {deep_analysis.get('nuanced_insights', [])}",
            f"- Potential biases: {deep_analysis.get('potential_biases', [])}",
            "",
            "MODEL RESPONSES:",
        ]

        for provider, response in responses.items():
            prompt_parts.append(f"\n--- AGENT: {provider} ---\n{response}\n")

        prompt_parts.append(
            """
TASK: Implement advanced triangulated consensus with deep analysis.
1. Identify Consensus Pillars: claims repeated across multiple models with high confidence.
2. Identify Fringe Anomalies: claims made by only one model or with uncertainty markers.
3. Resolve Dissent neutrally and explicitly, noting potential biases.
4. Evaluate thematic clusters and cross-validation points.
5. Estimate agreement_score:
   - 1.0 = strong agreement on core thesis with cross-validation
   - 0.7 = good agreement with minor dissent
   - 0.5 = shared facts but narrative divergence
   - 0.3 = partial agreement with significant dissent
   - 0.1 = contradiction on foundational facts
6. Assess confidence_score considering uncertainty markers and potential biases.
7. Determine consensus_depth: shallow (surface-level), moderate (thematic), or deep (nuanced).

Return ONLY strict JSON (no markdown fence):
{
  "consensus_report": "High-conviction markdown digest focused on verified signal with uncertainty disclosure.",
  "main_divergence": "Primary disagreement or anomaly with bias consideration.",
  "agreement_score": 0.0,
  "confidence_score": 0.0,
  "consensus_depth": "shallow|moderate|deep",
  "pillars": ["..."],
  "anomalies": ["..."]
}
""".strip()
        )

        return "\n".join(prompt_parts)

    def _enhance_confidence_score(self, base_score: float, agreement_score: float, provider_count: int) -> float:
        """
        Enhances the confidence score based on agreement and diversity of providers.
        """
        # Increase confidence with more providers and higher agreement
        provider_factor = min(1.0, 0.5 + (provider_count * 0.15))  # Up to +0.5 for 4+ providers
        agreement_factor = agreement_score
        
        enhanced = (base_score * 0.4) + (agreement_factor * 0.4) + (provider_factor * 0.2)
        return max(0.0, min(1.0, enhanced))

    def _provider_output(
        self,
        provider: str,
        text: str,
        provider_results: List[Dict[str, Any]],
    ) -> Dict[str, object]:
        telemetry = next((item for item in provider_results if item.get("provider") == provider), {})
        return {
            "provider": provider,
            "model_id": telemetry.get("model_id", provider),
            "status": telemetry.get("status", "ok"),
            "latency_ms": telemetry.get("latency_ms", 0.0),
            "error": telemetry.get("error"),
            "response_excerpt": text[:MAX_EXCERPT_CHARS],
            "char_count": len(text),
        }

    def _build_synthesis_prompt(self, prompt: str, responses: Dict[str, str], agreement_hint: float) -> str:
        prompt_parts = [
            "You are an Institutional Truth Oracle for the Monad economy.",
            f"You have responses from {len(responses)} independent model paths.",
            f"LEXICAL AGREEMENT HINT: {round(agreement_hint, 2)} (0.0 = total divergence, 1.0 = identical wording). Use this as a guide for your final agreement_score.",
            "",
            f"ORIGINAL TOPIC: {prompt}",
            "",
            "MODEL RESPONSES:",
        ]

        for provider, response in responses.items():
            prompt_parts.append(f"\n--- AGENT: {provider} ---\n{response}\n")

        prompt_parts.append(
            """
TASK: Implement triangulated consensus.
1. Identify Consensus Pillars: claims repeated across multiple models.
2. Identify Fringe Anomalies: claims made by only one model.
3. Resolve Dissent neutrally and explicitly.
4. Estimate agreement_score:
   - 1.0 = strong agreement on core thesis
   - 0.5 = shared facts but narrative divergence
   - 0.1 = contradiction on foundational facts

Return ONLY strict JSON (no markdown fence):
{
  "consensus_report": "High-conviction markdown digest focused on verified signal.",
  "main_divergence": "Primary disagreement or anomaly.",
  "agreement_score": 0.0,
  "pillars": ["..."],
  "anomalies": ["..."]
}
""".strip()
        )

        return "\n".join(prompt_parts)

    def _extract_json_payload(self, text: str) -> Optional[Dict[str, Any]]:
        if not text:
            return None

        # Prefer fenced JSON blocks first.
        fenced = re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL)
        candidates = fenced or [text[text.find("{"): text.rfind("}") + 1] if "{" in text and "}" in text else ""]

        for candidate in candidates:
            if not candidate:
                continue
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                continue

        return None

    def _normalize_string_list(self, value: Any) -> List[str]:
        if not isinstance(value, list):
            return []
        normalized: List[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                normalized.append(item.strip())
        return normalized

    def _normalize_score(self, value: Any, fallback: float) -> float:
        if isinstance(value, (int, float)):
            return max(0.0, min(1.0, float(value)))
        return fallback

    def _fallback_consensus_text(self, responses: Dict[str, str]) -> str:
        # Prefer longest response as fallback digest when synthesis payload is malformed.
        return max(responses.values(), key=len)

    def _calculate_agreement_score(self, responses: List[str]) -> float:
        if len(responses) < 2:
            return 1.0

        token_sets: List[set[str]] = []
        for response in responses:
            words = {
                word.strip(".,:;!?()[]{}\"'`").lower()
                for word in response.split()
            }
            filtered = {word for word in words if len(word) > 3}
            if filtered:
                token_sets.append(filtered)

        if len(token_sets) < 2:
            return 0.5

        overlaps: List[float] = []
        for i in range(len(token_sets)):
            for j in range(i + 1, len(token_sets)):
                left = token_sets[i]
                right = token_sets[j]
                union = len(left | right)
                if union == 0:
                    continue
                overlaps.append(len(left & right) / union)

        if not overlaps:
            return 0.5

        score = sum(overlaps) / len(overlaps)
        # Mild smoothing to avoid overconfident extremes from lexical overlap alone.
        smoothed = 0.1 + (0.8 * score)
        return max(0.0, min(1.0, smoothed))

    async def _build_attestation_payload(
        self,
        prompt: str,
        consensus_report: str,
        providers: List[str],
        generated_at: str,
        agreement_score: float,
        main_divergence: str,
        warnings: List[str],
    ) -> Dict[str, object]:
        payload = {
            "prompt": prompt,
            "providers": providers,
            "consensus_report": consensus_report,
            "generated_at": generated_at,
            "provider_count": len(providers),
            "agreement_score": round(agreement_score, 4),
            "main_divergence": main_divergence,
            "warnings": warnings,
        }
        return await attestation_service.attest(payload)

    async def _call_with_metrics(
        self,
        operation: Awaitable[Optional[str]],
    ) -> Tuple[Optional[str], float, Optional[str]]:
        started = time.perf_counter()
        try:
            result = await operation
            latency_ms = (time.perf_counter() - started) * 1000
            return result, latency_ms, None
        except Exception as exc:
            latency_ms = (time.perf_counter() - started) * 1000
            return None, latency_ms, str(exc)

    def _dedupe_preserve_order(self, values: Sequence[str]) -> List[str]:
        seen = set()
        output: List[str] = []
        for value in values:
            if value in seen:
                continue
            seen.add(value)
            output.append(value)
        return output

    def _calculate_diversity_level(self, provider_count: int, agreement_score: float) -> str:
        if provider_count <= 1:
            return "low"
        if provider_count >= 3 and agreement_score >= 0.6:
            return "high"
        return "medium"

    def _build_consensus_warnings(
        self,
        provider_count: int,
        agreement_score: float,
        provider_errors: List[Dict[str, Any]],
    ) -> List[str]:
        warnings: List[str] = []
        if provider_count <= 1:
            warnings.append("Low diversity consensus: fewer than 2 provider outputs.")
        if agreement_score < 0.45:
            warnings.append("Low agreement detected across provider outputs.")
        if provider_errors:
            warnings.append(f"{len(provider_errors)} provider path(s) failed during consensus.")
        return warnings


ai_service = AIService()
