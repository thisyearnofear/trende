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

ai_service = AIService()
