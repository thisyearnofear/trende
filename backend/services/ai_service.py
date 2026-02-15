import os
import google.generativeai as genai
from typing import List, Optional, Dict
from backend.services.aisa_service import aisa_service
from backend.services.venice_service import venice_service
from backend.services.openrouter_service import openrouter_service

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

        if "openrouter" in providers and os.getenv('OPENROUTER_API_KEY'):
            active_providers.append("openrouter")
            tasks.append(openrouter_service.chat_completion(model="google/gemini-flash-1.5-exp", messages=[
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
        responses = await self.get_parallel_responses(prompt, system_prompt)
        if not responses:
            return "No AI providers available for consensus."
        
        if len(responses) == 1:
            return list(responses.values())[0]

        # Use a meta-model (AIsa/GPT-4o) to synthesize the consensus
        synthesis_prompt = f"""
        I have gathered insights from multiple AI models on the following request:
        REQUEST: {prompt}
        
        RESPONSES:
        """
        for provider, response in responses.items():
            synthesis_prompt += f"\n--- MODEL: {provider} ---\n{response}\n"
            
        synthesis_prompt += """
        TASK:
        1. Compare these responses for common facts and diverging viewpoints.
        2. Synthesize a neutral, unbiased consensus report.
        3. Highlight any areas where the models disagree significantly.
        4. List the models that contributed to this consensus.
        """
        
        # We use AIsa (GPT-4o) as the primary synthesizer of consensus
        return await self.get_response(synthesis_prompt, system_prompt="You are a neutral consensus synthesizer.")

ai_service = AIService()
